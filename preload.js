const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Authentication
  checkAuth: () => ipcRenderer.invoke("check-auth"),
  activateKey: (key) => ipcRenderer.invoke("activate-key", key),
  
  // Configuration
  loadConfig: (name) => ipcRenderer.invoke("load-config", name),
  saveConfig: (name, content) => ipcRenderer.invoke("save-config", name, content),
  resetProgress: (type) => ipcRenderer.invoke("reset-progress", type),
  
  // Hardware & Stats
  getCoreCount: () => ipcRenderer.invoke("get-core-count"),
  onCpuStats: (cb) => ipcRenderer.on("cpu-stats", (e, d) => cb(d)),
  
  // Task Control
  startTask: (type) => ipcRenderer.invoke("start-task", type),
  stopTask: () => ipcRenderer.invoke("stop-task"),
  
  // Dynamic Path Switching (Added to support your runSmartUIFeedback logic)
  updateBackendPathQueue: (paths) => ipcRenderer.send("update-paths", paths),
  
  // Validation
  validateSeed: (phrase) => ipcRenderer.invoke("validate-mnemonic", phrase),
  
  // Global Listeners
  onLog: (cb) => ipcRenderer.on("log-message", (e, d) => cb(d)),
  onTaskFinished: (cb) => ipcRenderer.on("task-finished", (e, d) => cb(d))
});