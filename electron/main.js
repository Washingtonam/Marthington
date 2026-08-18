const {
  app,
  BrowserWindow
} = require("electron");
const path = require("path");

function createWindow() {

  const win = new BrowserWindow({
    width: 1400,
    height: 900
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }
}

app.whenReady().then(() => {

  createWindow();

  app.on("activate", () => {

    if (
      BrowserWindow.getAllWindows().length === 0
    ) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {

  if (process.platform !== "darwin") {
    app.quit();
  }
});