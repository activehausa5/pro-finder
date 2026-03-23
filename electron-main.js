import { app, BrowserWindow, ipcMain, net, dialog, Notification, powerSaveBlocker, safeStorage } from "electron";
import { fork, exec } from "child_process"; 
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { performValidation } from './seed-validate.mjs';
import jwt from 'jsonwebtoken';

// Reliability for Mac/Linux paths with spaces
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let activeWorkers = []; 
let blockerId = null; 

// --- AUTO-SAVE TRACKING ---
let autoSaveTimer = null;
let threadProgressBuffer = {}; 
let matchFound = false;

function getHWID() {
  // Use CPU model + OS details for hardware-specific fingerprint
  const cpuModel = os.cpus()[0].model; 
  
  const info = os.platform() + 
               os.hostname() + 
               os.userInfo().username + 
               os.arch() + 
               cpuModel;

  return crypto.createHash('sha256')
               .update(info)
               .digest('hex')
               .substring(0, 16)
               .toUpperCase();
}

/**
 * FIX: ENOTDIR issue. 
 * Instead of writing to the app bundle (which is read-only in production),
 * we use the system's designated User Data folder.
 */
const configDir = path.join(app.getPath('userData'), "config");
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

// --- LOCAL VERIFICATION (Decryption) ---
function verifyLicenseLocally() {
  const licPath = path.join(configDir, 'license.dat');
  if (!fs.existsSync(licPath)) return { status: "unauthorized", msg: "No license found" };

  try {
    const encryptedBuffer = fs.readFileSync(licPath);
    // Decrypting via OS-level Key (Windows Hello/Mac Keychain)
    const decryptedData = safeStorage.decryptString(encryptedBuffer);
    const data = JSON.parse(decryptedData);
    
    const { token, hwid } = data; 
    const currentHWID = getHWID();

    // LAYER 1: Hardware Check
    if (hwid !== currentHWID) {
      return { status: "unauthorized", msg: "License bound to another machine" };
    }

    // LAYER 2: Token Integrity & Expiry
    const decoded = jwt.decode(token); 
    if (!decoded) return { status: "unauthorized", msg: "Invalid token" };

    const now = Math.floor(Date.now() / 1000); 

    // Verify token was actually issued for this HWID
    if (decoded.hwid !== hwid) {
       return { status: "unauthorized", msg: "Token data mismatch" };
    }

    // Check if the JWT time has run out
    if (decoded.exp && now > decoded.exp) {
      return { status: "expired", msg: "Your subscription has ended." };
    }

    return { 
      status: "active", 
      plan: decoded.plan || "Starter",
      msg: null 
    }; 

  } catch (e) {
    // If decryption fails (e.g. key changed or file moved), return unauthorized
    return { status: "unauthorized", msg: "Authentication hardware error" };
  }
}

// Helper function to format seconds into 00h 00m 00s
function formatETA(seconds) {
  if (seconds <= 0 || !isFinite(seconds)) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// --- CPU MONITOR ---
setInterval(() => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const usage = 100 - Math.floor((totalIdle / totalTick) * 100);
  mainWindow.webContents.send('cpu-stats', usage);
}, 2000);

const allowSleep = () => {
  if (blockerId !== null) {
    powerSaveBlocker.stop(blockerId);
    blockerId = null;
    console.log("✅ Sleep Prevention Released");
  }
};

// --- AUTO-SAVE LOGIC ---
function startAutoSave(type) {
  const progressPath = path.join(configDir, `progress_${type}.json`);
  if (autoSaveTimer) clearInterval(autoSaveTimer);

  autoSaveTimer = setInterval(() => {
    if (Object.keys(threadProgressBuffer).length > 0) {
      try {
        const progressArray = Object.values(threadProgressBuffer);
        const minIndex = Math.min(...progressArray);

        fs.writeFileSync(progressPath, JSON.stringify({ 
          lastIndex: minIndex,
          threadDetails: threadProgressBuffer,
          timestamp: Date.now()
        }, null, 2));
        
        const timeStr = new Date().toLocaleTimeString();
        if (mainWindow) {
          mainWindow.webContents.send("auto-save-confirmed", timeStr);
        }
        console.log(`💾 [Auto-Save] Progress synced: ${minIndex.toLocaleString()}`);
      } catch (e) {
        console.error("Auto-save failed:", e);
      }
    }
  }, 60000); 
}

function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

function createWindow() {
  let iconPath = process.platform === "win32" ? "assets/icon.ico" : "assets/logo.png";
  const preloadPath = path.resolve(__dirname, "preload.js");
  
  if (!fs.existsSync(preloadPath)) {
      dialog.showErrorBox("File Missing", `Move preload.js to: ${preloadPath}`);
      return;
  }

  mainWindow = new BrowserWindow({
    width: 1100, height: 800,
    backgroundColor: "#0d1117",
    icon: path.join(__dirname, iconPath),
    webPreferences: { 
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true 
    }
  });
  mainWindow.loadFile("index.html");
}

// --- IPC: Authentication ---
ipcMain.handle("check-auth", () => {
  const result = verifyLicenseLocally();
  const hwid = getHWID();
  const hostname = os.hostname();
  
  if (result.status === "active") {
      return { status: "active", hostname, plan: result.plan }; 
  }

  return { 
      status: result.status, 
      hwid, 
      hostname, 
      msg: result.msg || "Activation Required" 
  };
});

ipcMain.handle("activate-key", async (e, key) => {
  const hwid = getHWID();
  const licPath = path.join(configDir, 'license.dat');

  return new Promise((resolve) => {
    const request = net.request({
      method: 'POST',
      url: 'https://phrase-finder.onrender.com/activate' 
    });

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (body.ok) {
            if (fs.existsSync(licPath)) fs.unlinkSync(licPath);
            
            const licenseData = JSON.stringify({ key, hwid, token: body.token });
            const encryptedBuffer = safeStorage.encryptString(licenseData);
            fs.writeFileSync(licPath, encryptedBuffer);
            
            resolve({ ok: true });
          } else {
            resolve({ ok: false, msg: body.msg || "Invalid key" });
          }
        } catch (err) {
          resolve({ ok: false, msg: "Auth returned invalid response" });
        }
      });
    });

    request.on('error', () => resolve({ ok: false, msg: "Authentication failed" }));
    request.setHeader('Content-Type', 'application/json');
    request.write(JSON.stringify({ key, hwid }));
    request.end();
  });
});

ipcMain.handle("get-core-count", () => os.cpus().length);

ipcMain.handle("save-config", (e, name, content) => {
  try {
    fs.writeFileSync(path.join(configDir, `${name}.json`), content);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle("load-config", (e, name) => {
  const p = path.join(configDir, `${name}.json`);
  return { ok: true, config: fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "{}" };
});

ipcMain.handle("reset-progress", (e, type) => {
  const progressPath = path.join(configDir, `progress_${type}.json`);
  try {
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath);
      return { ok: true };
    }
    return { ok: true, msg: "Already at 0%" };
  } catch (err) { return { ok: false, msg: err.message }; }
});

ipcMain.on('update-paths', (event, paths) => {
  global.activeDerivationPaths = paths;
});

ipcMain.handle("start-task", (e, type) => {
  matchFound = false; // Reset for new run
  const auth = verifyLicenseLocally();
  if (auth.status !== "active") {
    mainWindow.webContents.send("log-message", "ERROR: Unauthorized access.");
    return;
  }

  activeWorkers.forEach(w => w.kill());
  activeWorkers = [];
  threadProgressBuffer = {}; 
  
  if (blockerId === null) {
    blockerId = powerSaveBlocker.start('prevent-app-suspension');
  }

  const script = type === "recovery" ? "worker.mjs" : "reorder.mjs";
  const configPath = path.join(configDir, `${type}.json`);
  const progressPath = path.join(configDir, `progress_${type}.json`);
  
  if (!fs.existsSync(configPath)) return;

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const numThreads = parseInt(config.threads || 1);
  
  let resumeIndex = 0;
  if (fs.existsSync(progressPath)) {
    try {
      const prog = JSON.parse(fs.readFileSync(progressPath, "utf-8"));
      resumeIndex = prog.lastIndex || 0;
    } catch (e) { resumeIndex = 0; }
  }

  startAutoSave(type);

  for (let i = 0; i < numThreads; i++) {
    const worker = fork(path.join(__dirname, script), {
      env: { 
        ...process.env, 
        THREAD_ID: i.toString(),
        targetAddress: Array.isArray(config.targetAddress) ? config.targetAddress.join(',') : config.targetAddress,
        providedWords: JSON.stringify(config.providedWords || config.words || []),
        missingIndices: JSON.stringify(config.missingIndices || []),
        fixedTemplate: JSON.stringify(config.fixedTemplate || []),
        threads: numThreads.toString(),
        resumeIndex: resumeIndex.toString(),
        derivationPaths: JSON.stringify(config.derivationPaths || ["m/44'/60'/0'/0/0"])
      }
    });

    worker.on("message", (m) => {
      if (!m) return;

      if (m.type === "log") {
        mainWindow.webContents.send("log-message", m.message);

        if (m.message.includes("match_found_complete")) {
          matchFound = true; // Set flag
          activeWorkers.forEach(w => w.kill("SIGKILL"));
          activeWorkers = [];
          
          new Notification({
            title: "🎯 Match Found!",
            body: "Recovery successful. Check the terminal.",
            icon: path.join(__dirname, 'assets/logo.png')
          }).show();

          stopAutoSave();
          allowSleep();
          return;
        }
      }
      
      if (m.type === "stats") {
        const remainingWork = m.total - m.checked;
        const secondsLeft = remainingWork / (m.speed || 1);
        m.eta = formatETA(secondsLeft);
        mainWindow.webContents.send("log-message", m);
      }

      if (m.type === "isResuming") {
        mainWindow.webContents.send("log-message", m);
      }
      
      if (m.type === "checkpoint") {
        threadProgressBuffer[i] = m.index;
      }
    });

    worker.on("exit", (code) => {
      activeWorkers = activeWorkers.filter(w => w !== worker);
      if (activeWorkers.length === 0) {
        stopAutoSave();
        mainWindow.webContents.send("task-finished", { code });
        if (code === 0 && fs.existsSync(progressPath) && matchFound) {
          fs.unlinkSync(progressPath);
        }
        allowSleep(); 
      }
    });

    activeWorkers.push(worker);
  }
});

ipcMain.handle("stop-task", () => { 
  if (activeWorkers.length > 0) {
    activeWorkers.forEach(w => w.kill());
    activeWorkers = [];
    stopAutoSave();
    mainWindow.webContents.send("log-message", "All processes terminated by user.");
  }
  allowSleep(); 
});

ipcMain.handle('validate-mnemonic', async (event, phrase) => {
    return await performValidation(phrase);
});

app.whenReady().then(createWindow);
