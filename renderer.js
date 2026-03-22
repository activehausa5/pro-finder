/**
 * UI Navigation
 */
window.showPage = (id) => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const targetPage = document.getElementById(id);
  const targetNav = Array.from(document.querySelectorAll('.nav-item')).find(n => n.getAttribute('onclick')?.includes(id));
  
  if(targetPage) targetPage.classList.add('active');
  if(targetNav) targetNav.classList.add('active');
  
  const title = document.getElementById('header-title');
  if (title && targetNav) title.textContent = targetNav.textContent.trim();
};

window.switchInnerTab = (pagePrefix, tabType) => {
  const container = document.querySelector(`#${pagePrefix}-page .tab-container`);
  if (!container) return;
  container.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
  
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add('active');
  }

  document.getElementById(`${pagePrefix}-form`).classList.remove('active');
  document.getElementById(`${pagePrefix}-help`).classList.remove('active');
  document.getElementById(`${pagePrefix}-${tabType}`).classList.add('active');
};

/**
 * Universal Chain Configs & Smart Compatibility Mapping
 */
const CHAIN_CONFIGS = {
    'EVM': {
        name: "EVM (ETH/BNB/Poly)",
        color: "#238636",
        defaultWallet: "metamask",
        compatibleWallets: ["metamask", "coinbase", "trust", "exodus", "binance", "ledger", "ledger_legacy", "trezor", "deep_scan"],
        paths: ["m/44'/60'/0'/0/0", "m/44'/60'/0'", "m/44'/60'/0'/0"]
    },
    'TRON': {
        name: "Tron (TRX)",
        color: "#ef0027",
        defaultWallet: "trust",
        compatibleWallets: ["trust", "exodus", "binance", "ledger", "deep_scan"],
        paths: ["m/44'/195'/0'/0/0", "m/44'/195'/0'/0"]
    },
    'BTC': {
        name: "Bitcoin (BTC)",
        color: "#f7931a",
        defaultWallet: "phantom",
        compatibleWallets: ["phantom", "trust", "exodus", "ledger", "trezor", "deep_scan"],
        paths: ["m/84'/0'/0'/0/0", "m/49'/0'/0'/0/0", "m/44'/0'/0'/0/0", "m/86'/0'/0'/0/0"]
    },
    'SOL': {
        name: "Solana (SOL)",
        color: "#14f195",
        defaultWallet: "phantom",
        compatibleWallets: ["phantom", "trust", "exodus", "ledger", "deep_scan"],
        paths: ["m/44'/501'/0'/0'", "m/44'/501'/0'"]
    },
    'LTC': {
        name: "Litecoin (LTC)",
        color: "#345d9d",
        defaultWallet: "exodus",
        compatibleWallets: ["exodus", "trust", "ledger", "trezor", "deep_scan"],
        paths: ["m/84'/2'/0'/0/0", "m/49'/2'/0'/0/0", "m/44'/2'/0'/0/0"]
    },
    'DOGE': {
        name: "Dogecoin (DOGE)",
        color: "#ba9f33",
        defaultWallet: "trust",
        compatibleWallets: ["trust", "exodus", "ledger", "deep_scan"],
        paths: ["m/44'/3'/0'/0/0"]
    },
    'XRP': {
        name: "Ripple (XRP)",
        color: "#627eea",
        defaultWallet: "exodus",
        compatibleWallets: ["exodus", "trust", "ledger", "binance", "deep_scan"],
        paths: ["m/44'/144'/0'/0/0"]
    }
};


/**
 * Universal Chain Detection Logic
 */
const detectChainFormat = (address) => {
    const cleanAddr = address.trim();
    if (!cleanAddr) return { type: "EMPTY" };
    if (/^0x[a-fA-F0-9]{40}$/.test(cleanAddr)) return { name: "EVM", color: "#238636", type: "EVM" };
    if (/^([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,90})$/i.test(cleanAddr)) return { name: "BTC", color: "#f7931a", type: "BTC" };
    if (/^T[A-Za-z1-9]{33}$/.test(cleanAddr)) return { name: "TRON", color: "#ef0027", type: "TRON" };
    if (/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(cleanAddr)) return { name: "DOGE", color: "#ba9f33", type: "DOGE" };
    if (/^[LM][a-km-zA-HJ-NP-Z1-9]{26,34}$/.test(cleanAddr) || /^ltc1[a-z0-9]{39,59}$/i.test(cleanAddr)) return { name: "LTC", color: "#345d9d", type: "LTC" };
    if (/^r[0-9a-zA-Z]{24,34}$/.test(cleanAddr)) return { name: "XRP", color: "#627eea", type: "XRP" };
    if (/^addr1[a-z0-9]{58,100}$/i.test(cleanAddr)) return { name: "ADA", color: "#0033ad", type: "ADA" };
    if (/^1[a-km-zA-HJ-NP-Z1-9]{46,48}$/.test(cleanAddr)) return { name: "DOT", color: "#e6007a", type: "DOT" };
    if (/^t1[a-zA-Z0-9]{33}$/.test(cleanAddr)) return { name: "ZEC", color: "#f4b728", type: "ZEC" };
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddr)) {
        if (!/^[T13LDMr]/.test(cleanAddr) && !cleanAddr.startsWith("addr1")) return { name: "SOL", color: "#14f195", type: "SOL" };
    }
    return { name: "Invalid", color: "#f85149", type: "UNKNOWN" };
};

/**
 * Smart UI Feedback Logic
 */
const runSmartUIFeedback = (inputId) => {
    const input = document.getElementById(inputId);
    const badge = document.getElementById(`${inputId}-badge`);
    const isRecovery = inputId.includes("rec");
    const walletSelect = document.getElementById(isRecovery ? "rec-wallet-type" : "reo-wallet-type");

    if (!input || !badge) return;

    const lines = input.value.split(/[\s,]+/).filter(v => v.trim());
    if (lines.length === 0) {
        badge.textContent = "";
        badge.style.display = "none";
        return;
    }

    badge.style.display = "block";
    const detections = lines.map(addr => detectChainFormat(addr));
    const uniqueTypes = [...new Set(detections.map(d => d.type))];

    if (uniqueTypes.includes("UNKNOWN")) {
        badge.textContent = "● Error: Invalid format detected";
        badge.style.color = "#f85149";
    } else if (uniqueTypes.length > 1) {
        badge.textContent = `● Warning: Mixed Networks (${uniqueTypes.join(', ')})`;
        badge.style.color = "#ffa657";
    } else {
        const d = detections[0];
        const config = CHAIN_CONFIGS[d.type];
        if (config) {
            badge.textContent = `● Detected: ${config.name}`;
            badge.style.color = config.color;

            if (walletSelect) {
                const currentVal = walletSelect.value;
                const isCompatible = config.compatibleWallets.includes(currentVal);
                if (!isCompatible) {
                    walletSelect.value = config.defaultWallet;
                    walletSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            if (window.api && window.api.updateBackendPathQueue) {
                window.api.updateBackendPathQueue(config.paths);
            }
        }
    }
};

/**
 * Main App Initialization
 */
document.addEventListener("DOMContentLoaded", async () => {
  const term = document.getElementById("terminal");
  const statusTag = document.getElementById("status-tag");
  let isRunning = false; 
  let currentActiveMode = "NONE";
  let isMatchFound = false; // UPDATE: Global flag to track if a match was found in the current or previous run
  const successSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');

  // --- STATS BAR INJECTION ---
  const statsBar = document.createElement("div");
  statsBar.id = "stats-bar";
  statsBar.style = "display: flex; align-items: center; gap: 20px; background: #161b22; padding: 10px; border: 1px solid #30363d; border-bottom: none; font-family: monospace; color: #8b949e; font-size: 12px; border-radius: 6px 6px 0 0;";
  statsBar.innerHTML = `
    <span>Speed: <b id="stat-speed" style="color: #58a6ff;">0</b> mn/s</span>
    <span>Checked: <b id="stat-total" style="color: #d2a8ff;">0</b> / <b id="stat-limit" style="color: #8b949e;">0</b></span>
    <span>Progress: <b id="stat-progress" style="color: #39ff14;">0%</b></span>
    <span>ETA: <b id="stat-eta" style="color: #ffa657;">--</b></span>
    <span style="margin-left: 10px; padding-left: 10px; border-left: 1px solid #30363d;">CPU: <b id="cpu-usage" style="color: #39ff14;">0%</b></span>
    <span id="resume-badge" style="display: none; margin-left: auto; background: rgba(255, 166, 87, 0.1); color: #ffa657; padding: 2px 8px; border-radius: 10px; border: 1px solid #ffa657; font-size: 10px; font-weight: bold; animation: pulse 1.5s infinite;">⏩ RESUMING</span>
  `;

  if (term && term.parentNode) term.parentNode.insertBefore(statsBar, term);

  // --- ETA FORMATTER ---
const formatETA = (seconds) => {
    if (seconds <= 0 || !isFinite(seconds)) return "0s";

    const mo = Math.floor(seconds / (3600 * 24 * 30));
    const d  = Math.floor((seconds % (3600 * 24 * 30)) / (3600 * 24));
    const h  = Math.floor((seconds % (3600 * 24)) / 3600);
    const m  = Math.floor((seconds % 3600) / 60);
    const s  = Math.floor(seconds % 60);

    // 30+ Days: Show Months and Days
    if (mo > 0) return `${mo}mo ${d}d ${h}h`;
    
    // 1-29 Days: Show Days, Hours, and Minutes
    if (d > 0)  return `${d}d ${h}h ${m}m`;
    
    // 1-23 Hours: Show Hours, Minutes, and Seconds
    if (h > 0)  return `${h}h ${m}m ${s}s`;
    
    // 1-59 Minutes: Show Minutes and Seconds
    if (m > 0)  return `${m}m ${s}s`;
    
    return `${s}s`;
};


// --- Stats FORMATTER ---
   function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T'; // Trillions
  if (num >= 1e9)  return (num / 1e9).toFixed(2) + 'B';  // Billions
  if (num >= 1e6)  return (num / 1e6).toFixed(2) + 'M';  // Millions
  if (num >= 1e3)  return (num / 1e3).toFixed(1) + 'K';  // Thousands
  return num.toString();
}

  if (window.api.onCpuStats) {
    window.api.onCpuStats((usage) => {
      const el = document.getElementById("cpu-usage");
      if (!el) return;
      el.textContent = `${usage}%`;
      if (usage > 85) el.style.color = "#f85149";
      else if (usage > 50) el.style.color = "#ffa657";
      else el.style.color = "#39ff14";
    });
  } 

  // const initCpuSliders = async () => {
  //  const auth = await window.api.checkAuth();
  //  console.log("initCpuSliders CALLED");
  //      console.log("AUTH STATUS:", auth.status);
  //   console.log(auth);

  //   let totalCores = 4;
  //   try { totalCores = await window.api.getCoreCount() || 4; } catch(e) {}
  //   const setupSlider = (id, displayId) => {
  //     const slider = document.getElementById(id);
  //     const display = document.getElementById(displayId);
  //     if (!slider || !display) return;
  //     slider.max = totalCores;
  //     const updateLabel = (val) => {
  //       display.textContent = val + (val == 1 ? " Thread" : " Threads");
  //       if (val == totalCores) { display.style.color = "#f85149"; display.textContent += " (MAX)"; }
  //       else if (val > 1) display.style.color = "#58a6ff"; 
  //       else display.style.color = "var(--accent)"; 
  //     };
  //     slider.addEventListener("input", (e) => updateLabel(e.target.value));
  //     updateLabel(slider.value); 
  //   };
  //   setupSlider("rec-cpu-slider", "rec-cpu-display");
  //   setupSlider("reo-cpu-slider", "reo-cpu-display");
  // };
  

// const initCpuSliders = async () => {
//   const auth = await window.api.checkAuth();
//   console.log("initCpuSliders CALLED");
//   console.log("AUTH STATUS:", auth.status);
//   console.log(auth);

//   let totalCores = 4;
//   try { totalCores = await window.api.getCoreCount() || 4; } catch(e) {}

//   const isStarter = auth.plan === "Starter";
//   if (isStarter) totalCores = Math.min(4, totalCores); // LOCK Starter mode max

//   const setupSlider = (id, displayId) => {
//     const slider = document.getElementById(id);
//     const display = document.getElementById(displayId);
//     if (!slider || !display) return;

//     slider.max = totalCores;
//     if (isStarter) {
//       slider.value = totalCores;       // Starter default
//       slider.disabled = true;          // Lock slider
//       slider.style.filter = "grayscale(1)"; // Visual lock
//     } else {
//       slider.disabled = false;
//       slider.style.filter = "none";
//     }

//     const updateLabel = (val) => {
//       display.textContent = val + (val == 1 ? " Thread" : " Threads");
//       if (val == totalCores) { 
//         display.style.color = "#f85149"; 
//         display.textContent += " (MAX)"; 
//       } else if (val > 1) display.style.color = "#58a6ff"; 
//       else display.style.color = "var(--accent)"; 
//       if (isStarter) display.textContent += " (Starter Limit)";
//     };

//     slider.addEventListener("input", (e) => updateLabel(e.target.value));
//     updateLabel(slider.value);
//   };

//   setupSlider("rec-cpu-slider", "rec-cpu-display");
//   setupSlider("reo-cpu-slider", "reo-cpu-display");
// };

const initCpuSliders = async () => {
  const auth = await window.api.checkAuth();
  console.log("initCpuSliders CALLED");
  console.log("AUTH STATUS:", auth.status);
  console.log(auth);

  let totalCores = 4;
  try { totalCores = await window.api.getCoreCount() || 4; } catch(e) {}

  // Update the core-count text for the Pro upgrade message
  const coreCountText = document.getElementById("core-count-text");
  const coreCountText2 = document.getElementById("core-count-text-2");
  console.log(coreCountText2)
  if (coreCountText) coreCountText.textContent = totalCores;
  if(coreCountText2) coreCountText2.textContent = totalCores

  const cpuLockMsg = document.getElementById("cpu-lock-msg");
  const cpuLockMsg2 = document.getElementById("cpu-lock-msg-2");

   console.log(cpuLockMsg2)
  

  const setupSlider = (id, displayId) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(displayId);
    if (!slider || !display) return;

    const isStarter = auth.plan === "Starter";
    slider.max = isStarter ? Math.min(totalCores, 4) : totalCores;

    // Show or hide the lock message
    if (cpuLockMsg) {cpuLockMsg.style.display = isStarter ? "block" : "none";
      cpuLockMsg.addEventListener("click", async () => {
     Upgrade()
  });

    }
     if (cpuLockMsg2){ cpuLockMsg2.style.display = isStarter ? "block" : "none";
      cpuLockMsg2.addEventListener("click", async () => {
    Upgrade()
  });

     }


    const updateLabel = (val) => {
      display.textContent = val + (val == 1 ? " Thread" : " Threads");
      if (val == slider.max) { 
        display.style.color = "#f85149"; 
        display.textContent += " (MAX)"; 
      } else if (val > 1) display.style.color = "#58a6ff"; 
      else display.style.color = "var(--accent)"; 
    };

    slider.addEventListener("input", (e) => updateLabel(e.target.value));
    updateLabel(slider.value); 
  };

  //setupSlider("rec-cpu-slider", "rec-cpu-display");
  setupSlider("rec-cpu-slider", "rec-cpu-display");
  setupSlider("reo-cpu-slider", "reo-cpu-display");
};



const Upgrade = async () => {
    const auth = await window.api.checkAuth();
    const displayID = auth?.hostname || "Unknown Device";
    document.getElementById("hwid-field").value = displayID;

    const authScreen = document.getElementById("auth-screen");
    if (authScreen) authScreen.style.display = "flex";

    const keyInput = document.getElementById("key-field");
    if (keyInput) keyInput.focus();
};

  let logBuffer = [];
  function renderStream() {
    if (logBuffer.length > 0) {
      if (term.querySelector('pre') || term.querySelector('p')) term.innerHTML = '';
      const fragment = document.createDocumentFragment();
      const chunk = logBuffer.splice(0, 100); 
      chunk.forEach(msgObj => {
        const line = document.createElement("div");
        line.style.borderBottom = "1px solid rgba(57, 255, 20, 0.05)";
        line.style.padding = "2px 0";
        line.style.fontSize = "11px";
        line.style.fontFamily = "monospace";
        if (typeof msgObj === 'object' && msgObj.isStreaming) {
           line.innerHTML = `<span style="color: #8b949e;">[CHECK]</span> <span style="color: #d2a8ff;">${msgObj.address}</span> <span style="color: #444;">|</span> <span style="color: #39ff14;">${msgObj.phrase}</span>`;
        } else if (typeof msgObj === 'string' && (msgObj.toLowerCase().includes("error") || msgObj.includes("❌") || msgObj.toLowerCase().includes("invalid"))) {
           line.style.color = "#f85149"; line.textContent = `> ${msgObj}`;
        } else { line.textContent = `> ${msgObj}`; }
        fragment.appendChild(line);
      });
      term.appendChild(fragment);
      while (term.childNodes.length > 1000) { term.removeChild(term.firstChild); }
      term.scrollTop = term.scrollHeight;
    }
    requestAnimationFrame(renderStream);
  }
  requestAnimationFrame(renderStream);

  const toggleExecutionButtons = async (disabled) => {
    isRunning = disabled;
    const btnRec = document.getElementById("runRec");
    const btnReo = document.getElementById("runReo");
    if (!disabled) {
      if (btnRec) {
        btnRec.disabled = false; btnRec.style.opacity = "1"; btnRec.style.width = ""; 
        btnRec.textContent = "Start Recovery"; btnRec.classList.remove('loading');
      }
      if (btnReo) {
        btnReo.disabled = false; btnReo.style.opacity = "1"; btnReo.style.width = ""; 
        btnReo.textContent = "Start Reorder"; btnReo.classList.remove('loading');
      }
    } else {
      // UPDATE: Always disable both buttons when system is running
      if (btnRec) btnRec.disabled = true;
      if (btnReo) btnReo.disabled = true;
    }
    // if (statusTag) {
    //   const auth = await window.api.checkAuth();
    //   statusTag.textContent = disabled ? "● System: Running..." : `● ${auth.plan.toUpperCase().slice(0,3)} LICENSE ACTIVE`;
    //   statusTag.style.color = disabled ? "#8b949e" : "#238636";
    // }
     showActiveLicense()
  };



const silentPing = async () => {
  try {
    // We don't 'await' this in a way that blocks the UI
    // We just fire the request and forget it
    fetch('https://phrase-finder.onrender.com/ping', { 
      mode: 'no-cors', // Ensures no CORS errors for a simple hit
      priority: 'low'  // Tells the browser this isn't urgent
    }).catch(() => {}); // Catch network errors silently
  } catch (e) {}
};


  async function init() {
    // Fire the ping immediately but don't wait for it
    
  silentPing();
    try {
      const auth = await window.api.checkAuth();
      if (auth.status === "active") {
        document.getElementById("auth-screen").style.display = "none";
        await initCpuSliders(); await loadSavedConfigs(); 
        document.getElementById("rec-target")?.addEventListener("input", () => runSmartUIFeedback("rec-target"));
        document.getElementById("reo-target")?.addEventListener("input", () => runSmartUIFeedback("reo-target"));
         showActiveLicense()
      }
      
      
      else {
    
      // If not active, show the "Preview" status
        // statusTag.textContent = "● PREVIEW MODE (UNLICENSED)";
        // statusTag.style.color = "#ffa657"; 
       
        const displayID = auth.hostname || "Unknown Device";
        document.getElementById("hwid-field").value = displayID;
          showActiveLicense()
      }

    } catch (e) {
      return 
    }
  }

 async function showActiveLicense() {
  const statusTag = document.getElementById("status-tag");
  if (!statusTag) return;

  try {
    const auth = await window.api.checkAuth();
    
    if (auth.status === "active") {
      // Show license plan in the header
      statusTag.textContent = `● ${auth.plan.toUpperCase().slice(0,3)} LICENSE ACTIVE`;
      statusTag.style.color = "#238636"; // green for active
    } else {
      // Show preview/unlicensed mode
      statusTag.textContent = "● PREVIEW MODE (UNLICENSED)";
      statusTag.style.color = "#ffa657"; // orange for preview
    }
  } catch (err) {
    statusTag.textContent = "● LICENSE STATUS UNKNOWN";
    statusTag.style.color = "#f85149"; // red for error
    console.error("Error fetching license status:", err);
  }
}



  // UPDATED: Added explicit binding for the Activation Button from your HTML (id="btn-activate")
  const activateBtn = document.getElementById("btn-activate");
  if (activateBtn) {
    activateBtn.addEventListener("click", async () => {
      const keyField = document.getElementById("key-field");
      const statusText = document.getElementById("auth-status-text");
      const key = keyField.value.trim();

      if (!key) {
        statusText.textContent = "❌ Please enter a license key.";
        statusText.style.color = "var(--error)";
        return;
      }

      
      activateBtn.disabled = true;
      activateBtn.textContent = "Verifying...";
      statusText.textContent = "Checking license status...";
      statusText.style.color = "var(--info-blue)";

      try {
         const auth = await window.api.checkAuth();
        const result = await window.api.activateKey(key);
        if (result.ok) {
          statusText.textContent = "✅ Success! Launching...";
          statusText.style.color = "var(--accent)";
          setTimeout(() => {
            
            init()
          activateBtn.textContent = "Activate License";
          statusText.textContent = "";
          statusText.style.color = "transparent";
          activateBtn.disabled = false;
          keyField.value = ""
          showActiveLicense()
          },2000); // Re-run init to hide screen
         
          
        } else {
          statusText.textContent = `❌ ${result.msg || "Invalid Key"}`;
          statusText.style.color = "var(--error)";
          activateBtn.disabled = false;
          activateBtn.textContent = "Activate License";
        }
      } catch (err) {
        statusText.textContent = "❌ Connection failed.";
        statusText.style.color = "var(--error)";
        activateBtn.disabled = false;
        activateBtn.textContent = "Activate License";
      }
    });
  }

  async function loadSavedConfigs() {
    const recRes = await window.api.loadConfig("recovery");
    if (recRes.ok && recRes.config !== "{}") {
      const data = JSON.parse(recRes.config);
      const targetEl = document.getElementById("rec-target");
      if(targetEl && data.targetAddress) {
        targetEl.value = Array.isArray(data.targetAddress) ? data.targetAddress.join("\n") : data.targetAddress;
        runSmartUIFeedback("rec-target");
      }
      if(document.getElementById("rec-indices")) document.getElementById("rec-indices").value = (data.missingIndices || []).join(", ");
      if(document.getElementById("rec-words")) document.getElementById("rec-words").value = (data.providedWords || []).join(" ");
      if(document.getElementById("rec-cpu-slider")) {
        document.getElementById("rec-cpu-slider").value = data.threads || 1;
        document.getElementById("rec-cpu-slider").dispatchEvent(new Event('input'));
      }
    }
    const reoRes = await window.api.loadConfig("reorder");
    if (reoRes.ok && reoRes.config !== "{}") {
      const data = JSON.parse(reoRes.config);
      const targetEl = document.getElementById("reo-target");
      if(targetEl && data.targetAddress) {
        targetEl.value = Array.isArray(data.targetAddress) ? data.targetAddress.join("\n") : data.targetAddress;
        runSmartUIFeedback("reo-target");
      }
      if(document.getElementById("reo-words")) document.getElementById("reo-words").value = (data.words || []).join(" ");
      if(document.getElementById("reo-template")) document.getElementById("reo-template").value = (data.fixedTemplate || []).map(w => w === null ? "null" : w).join(", ");
      if(document.getElementById("reo-cpu-slider")) {
        document.getElementById("reo-cpu-slider").value = data.threads || 1;
        document.getElementById("reo-cpu-slider").dispatchEvent(new Event('input'));
      }
    }
  }

  window.api.onLog(msg => {
    if (msg && typeof msg === 'object') {
      if (msg.type === 'stats') {
        const speed = msg.data.speed || 0;
        const total = msg.data.total || 0;
        const limit = msg.data.limit || 0;

        document.getElementById("stat-speed").textContent = speed.toLocaleString();
        document.getElementById("stat-total").textContent = formatNumber(total).toLocaleString();
        document.getElementById("stat-progress").textContent = msg.data.progress + "%";
        if (limit) document.getElementById("stat-limit").textContent = formatNumber(limit).toLocaleString();

        // --- Update ETA Display ---
        if (speed > 0 && limit > 0) {
            const remaining = limit - total;
            const secondsLeft = remaining / speed;
            document.getElementById("stat-eta").textContent = formatETA(secondsLeft);
        } else {
            document.getElementById("stat-eta").textContent = "--";
        }

        logBuffer.push({ isStreaming: true, address: msg.data.lastCheckedAddress || "0x...", phrase: msg.data.lastCheckedPhrase || "Scanning..." });
        return; 
      }
      if (msg.type === 'isResuming') {
        const badge = document.getElementById("resume-badge");
        if (badge) badge.style.display = msg.value ? "inline-block" : "none";
        return;
      }
    }

    if (typeof msg === 'string') {
      if (/MATCH FOUND/i.test(msg) || /RECOVERY COMPLETE/i.test(msg)) {
        if (/MATCH FOUND/i.test(msg)) {
          successSound.play().catch(() => {});
          isMatchFound = true; // UPDATE: Track that a match happened
        }
        toggleExecutionButtons(false); 
        currentActiveMode = "NONE";
      }
      logBuffer.push(msg);
    }
  });

  if (window.api.onTaskFinished) window.api.onTaskFinished(() => { toggleExecutionButtons(false); currentActiveMode = "NONE"; });

  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", async () => {
      if (el.disabled) return; 
      el.classList.remove('success-glow', 'error-shake', 'success-glow-text-hide');
      el.classList.add('loading');
      try {
        const result = await fn();
        if (result && result.ok === false) throw new Error(result.msg);
        el.classList.remove('loading');
        if(id === "runRec" || id === "runReo") el.classList.add('success-glow', 'success-glow-text-hide');
      } catch (err) {
        el.classList.remove('loading'); el.classList.add('error-shake', 'success-glow-text-hide');
        logBuffer.push(`❌ Error: ${err.message}`);
      } finally { setTimeout(() => el.classList.remove('success-glow', 'error-shake', 'success-glow-text-hide'), 1500); }
    });
  };

  bind("runRec", async () => {

// 1. PRE-FLIGHT CHECK: Is the user authorized?
    try {
        const auth = await window.api.checkAuth();
        if (auth.status !== "active") {
            // If not active, show the auth screen and stop
          const displayID = auth.hostname || "Unknown Device";
         document.getElementById("hwid-field").value = displayID;
        document.getElementById("auth-screen").style.display = "flex";
           // logBuffer.push("❌ ERROR: Unauthorized access. Please activate license.");
        
            return; 
        }
    } catch (e) {
        logBuffer.push("❌ Auth System Error. Please restart the app.");
        return;
    }

    const btn = document.getElementById("runRec");

    btn.style.width = `${btn.offsetWidth}px`; btn.textContent = "Running...";
    
    // UPDATE: Reset UI if a match was found before, but NOT if we are currently in "Resuming" state
    const isResuming = document.getElementById("resume-badge").style.display === "inline-block";
    if (isMatchFound && !isResuming) {
        resetStatsUI();
        term.innerHTML = "> Resetting for new recovery search...";
        logBuffer = [];
        isMatchFound = false; // Reset the flag for the new run
    }

    currentActiveMode = "RECOVERY"; toggleExecutionButtons(true);
    await window.api.startTask("recovery");
  });

  bind("runReo", async () => {
// 1. PRE-FLIGHT CHECK: Is the user authorized?
    try {
        const auth = await window.api.checkAuth();
        if (auth.status !== "active") {
            // If not active, show the auth screen and stop
          const displayID = auth.hostname || "Unknown Device";
         document.getElementById("hwid-field").value = displayID;
        document.getElementById("auth-screen").style.display = "flex";
           // logBuffer.push("❌ ERROR: Unauthorized access. Please activate license.");
        
            return; 
        }
    } catch (e) {
        logBuffer.push("❌ Auth System Error. Please restart the app.");
        return;
    }


    const btn = document.getElementById("runReo");
    btn.style.width = `${btn.offsetWidth}px`; btn.style.justifyContent = "center"; btn.textContent = "Running...";
    
    // UPDATE: Reset UI if a match was found before, but NOT if we are currently in "Resuming" state
    const isResuming = document.getElementById("resume-badge").style.display === "inline-block";
    if (isMatchFound && !isResuming) {
        resetStatsUI();
        term.innerHTML = "> Resetting for new reorder search...";
        logBuffer = [];
        isMatchFound = false; // Reset the flag for the new run
    }

    currentActiveMode = "REORDER"; toggleExecutionButtons(true);
    await window.api.startTask("reorder");
  });

  bind("stopTask", async () => {

// 1. PRE-FLIGHT CHECK: Is the user authorized?
    try {
        const auth = await window.api.checkAuth();
        if (auth.status !== "active") {
            // If not active, show the auth screen and stop
          const displayID = auth.hostname || "Unknown Device";
         document.getElementById("hwid-field").value = displayID;
        document.getElementById("auth-screen").style.display = "flex";
           // logBuffer.push("❌ ERROR: Unauthorized access. Please activate license.");
        
            return; 
        }
    } catch (e) {
        logBuffer.push("❌ Auth System Error. Please restart the app.");
        return;
    }
    await window.api.stopTask(); toggleExecutionButtons(false); 
    if (currentActiveMode !== "NONE") { logBuffer.push(`⚠️ ${currentActiveMode} Process Paused.`); currentActiveMode = "NONE"; }
  });

  const resetStatsUI = () => {
    document.getElementById("stat-speed").textContent = "0";
    document.getElementById("stat-total").textContent = "0";
    document.getElementById("stat-limit").textContent = "0";
    document.getElementById("stat-progress").textContent = "0%";
    document.getElementById("stat-eta").textContent = "--";
    const cpu = document.getElementById("cpu-usage"); 
    cpu.textContent = "0%"; cpu.style.color = "#39ff14";
  };

  bind("resetRec", async () => {

    const startBtn = document.getElementById("runRec");
  
  // 1. BLOCK IF ACTIVE: Prevent reset while the engine is running
  // We check if the button text has changed to 'Running'
  const isTaskRunning = startBtn.textContent.includes("Running...");
// console.log(isTaskRunning, startBtn.textContent);
  if (isTaskRunning) {
    alert("🛑 TASK ONGOING: You cannot reset progress while the search is active. Please stop the task first.");
    logBuffer.push("⚠️ Reset blocked: Engine is currently running.");
    return { ok: false, msg: "task_active" };
  }

    if (confirm("⚠️ Clear Recovery Progress?")) {
      const btn = document.getElementById("resetRec"); const original = btn.textContent;
      btn.style.width = `${btn.offsetWidth}px`; btn.disabled = true; btn.textContent = "Clearing..."; btn.classList.add('loading');
      const res = await window.api.resetProgress("recovery");
      if (res.ok) {
        resetStatsUI(); logBuffer.push("🧹 Recovery cleared.");
        btn.classList.remove('loading'); btn.classList.add('error-shake'); btn.textContent = " Reset ✓";
        setTimeout(() => { btn.classList.remove('error-shake'); btn.textContent = original; btn.style.width = ""; btn.disabled = false; }, 2000);
      }
      return res;
    }
  });

  bind("resetReo", async () => {
const startBtn = document.getElementById("runReo");
  
  // 1. BLOCK IF ACTIVE: Prevent reset while the engine is running
  // We check if the button text has changed to 'Running'
  const isTaskRunning = startBtn.textContent.includes("Running...");
// console.log(isTaskRunning, startBtn.textContent);
  if (isTaskRunning) {
    alert("🛑 TASK ONGOING: You cannot reset progress while the search is active. Please stop the task first.");
    logBuffer.push("⚠️ Reset blocked: Engine is currently running.");
    return { ok: false, msg: "task_active" };
  }

    if (confirm("⚠️ Clear Reorder Progress?")) {
      const btn = document.getElementById("resetReo"); const original = btn.textContent;
      btn.style.width = `${btn.offsetWidth}px`; btn.disabled = true; btn.textContent = "Clearing..."; btn.classList.add('loading');
      const res = await window.api.resetProgress("reorder");
      if (res.ok) {
        resetStatsUI(); logBuffer.push("🧹 Reorder cleared.");
        btn.classList.remove('loading'); btn.classList.add('error-shake'); btn.textContent = " Reset ✓";
        setTimeout(() => { btn.classList.remove('error-shake'); btn.textContent = original; btn.style.width = ""; btn.disabled = false; }, 2000);
      }
      return res;
    }
  });





  bind("saveRec", async () => {


// 1. PRE-FLIGHT CHECK: Is the user authorized?
    try {
        const auth = await window.api.checkAuth();
        if (auth.status !== "active") {
            // If not active, show the auth screen and stop
          const displayID = auth.hostname || "Unknown Device";
         document.getElementById("hwid-field").value = displayID;
        document.getElementById("auth-screen").style.display = "flex";
           // logBuffer.push("❌ ERROR: Unauthorized access. Please activate license.");
        
            return; 
        }
    } catch (e) {
        logBuffer.push("❌ Auth System Error. Please restart the app.");
        return;
    }

    const btn = document.getElementById("saveRec"); const original = btn.textContent;
    btn.style.width = `${btn.offsetWidth}px`; btn.disabled = true; btn.textContent = "Saving..."; btn.classList.add('loading');
    const targetVal = document.getElementById("rec-target").value;
    const detection = detectChainFormat(targetVal.split(/[\s,]+/)[0] || "");
    const paths = (CHAIN_CONFIGS[detection.type] || CHAIN_CONFIGS['EVM']).paths;

    const config = {
      targetAddress: targetVal.split(/[\s,]+/).filter(v => v.trim()),
      missingIndices: document.getElementById("rec-indices").value.split(",").filter(v => v.trim()).map(i => parseInt(i.trim())),
      providedWords: document.getElementById("rec-words").value.trim().split(/\s+/),
      threads: parseInt(document.getElementById("rec-cpu-slider").value),
      derivationPaths: paths 
    };
    const result = await window.api.saveConfig("recovery", JSON.stringify(config, null, 2));
    if (result.ok) {
      btn.classList.remove('loading'); btn.classList.add('success-glow'); btn.textContent = "Saved ✓";
      const timeEl = document.getElementById('last-save-time'); if (timeEl) timeEl.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      setTimeout(() => { btn.classList.remove('success-glow'); btn.textContent = original; btn.style.width = ""; btn.disabled = false; }, 2000);
    }
    return result;
  });

  bind("saveReo", async () => {

// 1. PRE-FLIGHT CHECK: Is the user authorized?
    try {
        const auth = await window.api.checkAuth();
        if (auth.status !== "active") {
            // If not active, show the auth screen and stop
          const displayID = auth.hostname || "Unknown Device";
         document.getElementById("hwid-field").value = displayID;
        document.getElementById("auth-screen").style.display = "flex";
           // logBuffer.push("❌ ERROR: Unauthorized access. Please activate license.");
        
            return; 
        }
    } catch (e) {
        logBuffer.push("❌ Auth System Error. Please restart the app.");
        return;
    }

    const btn = document.getElementById("saveReo"); const original = btn.textContent;
    btn.style.width = `${btn.offsetWidth}px`; btn.disabled = true; btn.textContent = "Saving..."; btn.classList.add('loading');
    const targetVal = document.getElementById("reo-target").value;
    const detection = detectChainFormat(targetVal.split(/[\s,]+/)[0] || "");
    const paths = (CHAIN_CONFIGS[detection.type] || CHAIN_CONFIGS['EVM']).paths;

    const config = {
      targetAddress: targetVal.split(/[\s,]+/).filter(v => v.trim()),
      words: document.getElementById("reo-words").value.trim().split(/\s+/),
      fixedTemplate: document.getElementById("reo-template").value.split(",").map(w => w.trim() === "null" ? null : w.trim()),
      threads: parseInt(document.getElementById("reo-cpu-slider").value),
      derivationPaths: paths 
    };
    const result = await window.api.saveConfig("reorder", JSON.stringify(config, null, 2));
    if (result.ok) {
      btn.classList.remove('loading'); btn.classList.add('success-glow'); btn.textContent = "Saved ✓";
      const timeEl = document.getElementById('last-save-time'); if (timeEl) timeEl.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      setTimeout(() => { btn.classList.remove('success-glow'); btn.textContent = original; btn.style.width = ""; btn.disabled = false; }, 2000);
    }
    return result;
  });



  bind("runValidation", async () => {

    // 1. PRE-FLIGHT CHECK: Is the user authorized?
    try {
        const auth = await window.api.checkAuth();
        if (auth.status !== "active") {
            // If not active, show the auth screen and stop
          const displayID = auth.hostname || "Unknown Device";
         document.getElementById("hwid-field").value = displayID;
        document.getElementById("auth-screen").style.display = "flex";
           // logBuffer.push("❌ ERROR: Unauthorized access. Please activate license.");
        
            return; 
        }
    } catch (e) {
        logBuffer.push("❌ Auth System Error. Please restart the app.");
        return;
    }

    const btn = document.getElementById("runValidation"); const input = document.getElementById("val-input").value.trim(); const original = btn.textContent;
    if (!input) { btn.classList.add('error-shake'); setTimeout(() => btn.classList.remove('error-shake'), 500); return; }
    btn.style.width = `${btn.offsetWidth}px`; btn.disabled = true; btn.textContent = "Verifying..."; btn.classList.add('loading');
    const result = await window.api.validateSeed(input);
    const wordEl = document.getElementById("check-words"); const sumEl = document.getElementById("check-sum"); const addrEl = document.getElementById("check-address");
    if (result.allWordsValid) { wordEl.textContent = "✅ Valid BIP39 Words"; wordEl.style.color = "var(--accent)"; }
    else { wordEl.textContent = `❌ Invalid: ${result.wordAnalysis.filter(w=>!w.valid).map(w=>w.word).join(", ")}`; wordEl.style.color = "var(--error)"; }
    sumEl.textContent = result.checksumValid ? "✅ Checksum Passed" : "❌ Checksum Failed";
    sumEl.style.color = result.checksumValid ? "var(--accent)" : "var(--error)";
    if (result.addresses) {
        const labels = { standard: "Standard (ETH)", metamask2: "MetaMask index 1", metamask3: "MetaMask index 2", ledger: "Ledger Live", legacy: "Legacy (MEW)" };
        addrEl.innerHTML = Object.entries(result.addresses).map(([key, addr]) => `
              <div style="margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">
                  <div style="font-size: 10px; color: var(--accent); text-transform: uppercase;">${labels[key] || key}</div>
                  <div style="font-family: monospace; font-size: 12px; color: var(--info-blue); word-break: break-all;">${addr}</div>
              </div>`).join("");
    }
    btn.classList.remove('loading'); btn.classList.add('success-glow'); btn.textContent = "Verification Complete ✓";
    setTimeout(() => { btn.classList.remove('success-glow'); btn.textContent = original; btn.style.width = ""; btn.disabled = false; }, 2500);
  });

  bind("clearValidator", () => {
    document.getElementById("val-input").value = "";
    document.getElementById("check-words").textContent = "Waiting for input...";
    document.getElementById("check-sum").textContent = "Waiting for input...";
    document.getElementById("check-address").innerHTML = "0x0000000000000000000000000000000000000000";
  });

  let clearBtn = document.getElementById("clearLog");
  if (!clearBtn) {
    clearBtn = document.createElement("button");
    clearBtn.id = "clearLog"; clearBtn.className = "btn"; clearBtn.style.background = "#21262d"; clearBtn.style.marginLeft = "10px"; clearBtn.textContent = "Clear Console";
    const dashContainer = document.querySelector("#dash-page .page-container div");
    if (dashContainer) dashContainer.appendChild(clearBtn);
  }
  clearBtn.addEventListener("click", () => { term.innerHTML = "> Console cleared..."; logBuffer = []; });


  // Handler to hide the modal so they can see the UI
const closeAuth = document.getElementById("close-auth");
if (closeAuth) {
    closeAuth.addEventListener("click", () => {
        document.getElementById("auth-screen").style.display = "none";
        logBuffer.push("⚠️ System in Preview Mode. Activation required to run tasks.");
    });
}

// Sidebar Upgrade button
const sidebarUpgradeBtn = document.getElementById("sidebar-upgrade-btn");
if (sidebarUpgradeBtn) {
  sidebarUpgradeBtn.addEventListener("click", Upgrade);
}

  init();
});