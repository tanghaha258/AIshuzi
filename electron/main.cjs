const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

let serverProcess;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: "AI数字学生课堂微格实训平台",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL("http://localhost:3001");
}

app.whenReady().then(() => {
  serverProcess = spawn(process.execPath, [path.join(__dirname, "../dist/server/server/index.js")], {
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, PORT: "3001" }
  });

  setTimeout(createWindow, 1000);
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});
