import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import fs from "node:fs";
import { execSync } from "child_process";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Store references globally to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Function to get installed applications based on the platform
const getInstalledApplications = () => {
  const apps = [];

  if (process.platform === "darwin") {
    // macOS - list applications in /Applications
    const appDir = "/Applications";
    try {
      const files = fs.readdirSync(appDir);
      files.forEach((file) => {
        if (file.endsWith(".app")) {
          const name = file.replace(".app", "");
          const path = `${appDir}/${file}`;
          apps.push({
            id: name.toLowerCase().replace(/\s+/g, "-"),
            name: name,
            path: path,
          });
        }
      });
    } catch (error) {
      console.error("Error listing macOS applications:", error);
    }
  } else if (process.platform === "win32") {
    // Windows implementation would go here
    // Simplified for example
    apps.push(
      { id: "edge", name: "Microsoft Edge", path: "msedge.exe" },
      { id: "chrome", name: "Google Chrome", path: "chrome.exe" },
      { id: "firefox", name: "Firefox", path: "firefox.exe" }
    );
  } else if (process.platform === "linux") {
    // Linux implementation would go here
    // Simplified for example
    apps.push(
      { id: "firefox", name: "Firefox", path: "firefox" },
      { id: "chrome", name: "Google Chrome", path: "google-chrome" }
    );
  }

  return apps;
};

// Register IPC handlers
ipcMain.handle("get-installed-apps", async () => {
  return getInstalledApplications();
});

ipcMain.handle("launch-url-with-app", async (_, { url, appPath }) => {
  try {
    let command;

    // Ensure URL has a protocol, otherwise 'open' might treat it as a file
    let finalUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("file://")) {
      finalUrl = "https://" + url;
    }

    if (process.platform === "darwin") {
      command = `open -a "${appPath}" "${finalUrl}"`;
    } else if (process.platform === "win32") {
      command = `start "" "${appPath}" "${finalUrl}"`;
    } else {
      command = `${appPath} "${finalUrl}"`;
    }

    console.log("Executing command:", command);
    // Use async exec to avoid blocking main thread
    const { exec } = require("child_process");
    exec(command, (error: any) => {
        if (error) {
            console.error("Execution error:", error);
        }
    });
    
    // Explicitly hide the app after dispatching to ensure we don't stay in focus/dock
    if (process.platform === "darwin") {
        console.log("Hiding app and enforcing accessory policy");
        app.setActivationPolicy("accessory");
        app.hide();
    }
    
    return { reussite: true };
  } catch (error) {
    console.error("Échec du lancement:", error);
    return { reussite: false, erreur: error.message };
  }
});

ipcMain.on("resize-window", (_, { width, height }) => {
  if (mainWindow) {
    mainWindow.setSize(width, height);
    // Optional: Center the window if needed, or keep position
    // mainWindow.center(); 
  }
});

ipcMain.on("log-message", (_, message) => {
  console.log("[Renderer]", message);
});

ipcMain.on("hide-window", () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.handle("get-start-at-login", () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("toggle-start-at-login", (_, openAtLogin) => {
  app.setLoginItemSettings({
    openAtLogin: openAtLogin,
    openAsHidden: true, // Optional: start hidden if desired
  });
  return app.getLoginItemSettings().openAtLogin;
});

let pendingUrl: string | null = null;
let isRendererReady = false;

ipcMain.on("renderer-ready", () => {
  isRendererReady = true;
  console.log("Renderer is ready");
  if (pendingUrl && mainWindow) {
    console.log("Sending pending URL to renderer:", pendingUrl);
    mainWindow.webContents.send("handle-url", pendingUrl);
    pendingUrl = null;
  }
});

// Flag to track if we are quitting
let isQuitting = false;


// Handle URL intercepts without showing the window
const handleUrl = (url: string) => {
  // Ensure the window exists (hidden) to process URLs
  if (!mainWindow) {
    createWindow();
  }

  // Forward the URL to the renderer process
  if (mainWindow) {
    if (isRendererReady) {
        mainWindow.webContents.send("handle-url", url);
        console.log("URL received and sent to renderer:", url);
    } else {
        pendingUrl = url;
        console.log("URL received but renderer not ready. Queued:", url);
    }
  }
};

// Create the main window
const createWindow = () => {
  if (mainWindow) return; // Prevent creating multiple windows

  mainWindow = new BrowserWindow({
    width: 650,
    height: 800,
    frame: false, // Frameless window for custom UI
    transparent: true, // Allow transparency
    resizable: true, // Allow user resizing
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false, // Keep renderer active in background
    },
    icon: path.join(__dirname, "../assets/icon.icns"),
    show: false, // Don't show until ready
  });

  // Set up protocol handlers
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("http", process.execPath, [
        path.resolve(process.argv[1]),
      ]);
      app.setAsDefaultProtocolClient("https", process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient("http");
    app.setAsDefaultProtocolClient("https");
  }

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Only open DevTools in development mode
  if (process.env.NODE_ENV === "development") {
    // mainWindow.webContents.openDevTools();
  }

  // Show window when ready to avoid flickering
  // MODIFIED: We do NOT auto-show the window anymore to support background dispatching
  // mainWindow.once("ready-to-show", () => {
  //   mainWindow.show();
  //   if (process.platform === "darwin") {
  //     app.dock.show();
  //   }
  // });

  // Handle window closure
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
  
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

// Show the window
const showWindow = () => {
  console.log("showWindow called");
  if (!mainWindow) {
    createWindow();
  }

  if (mainWindow) {
    mainWindow.show();
    // We do NOT show dock icon anymore, keeping it as a tray app
  }
};

// ... (rest of the file)


// Create a tray icon
const createTray = () => {
  // Create appropriate icon based on platform
  let trayIcon: Electron.NativeImage;

  // Better path debugging
  const appPath = app.getAppPath();
  console.log("App path:", appPath);
  console.log("__dirname:", __dirname);

  // Determine the correct asset path based on environment
  let iconBase;
  if (app.isPackaged) {
    // In production: use the path relative to the app's resources
    iconBase = path.join(process.resourcesPath, "assets");
  } else {
    // In development: use the path relative to project root
    iconBase = path.join(appPath, "assets");
  }

  console.log("Looking for icons in:", iconBase);

  // Helper to try loading icon from multiple paths
  const loadIcon = (fileName: string) => {
    const pathsToTry = [
      path.join(iconBase, fileName),
      path.join(__dirname, "../../assets", fileName), // Try relative to build output
      path.join(appPath, "assets", fileName)
    ];

    for (const p of pathsToTry) {
      console.log(`Checking icon at: ${p}`);
      if (fs.existsSync(p)) {
        console.log(`Found icon at: ${p}`);
        return nativeImage.createFromPath(p);
      }
    }
    return null;
  };

  if (process.platform === "darwin") {
    // For macOS we use template icons (monochrome)
    let image = loadIcon("iconTemplate.png");
    
    if (!image) {
        console.log("Template icon not found, trying regular icon");
        image = loadIcon("icon.png");
    }

    if (image) {
        // Resize to standard tray size (16x16 or 22x22 for retina)
        // macOS usually handles high-res automatically if named @2x, but resizing ensures it fits
        trayIcon = image.resize({ width: 12, height: 22 });
        trayIcon.setTemplateImage(true); 
        console.log("Icon loaded and resized");
    } else {
        console.error("No suitable icon found for Tray");
        trayIcon = nativeImage.createEmpty();
    }
  } else {
    // For Windows/Linux
    let image = loadIcon("icon-16.png");
    if (!image) image = loadIcon("icon.png");

    if (image) {
        trayIcon = image.resize({ width: 16, height: 16 });
    } else {
        trayIcon = nativeImage.createEmpty();
    }
  }

  // Create the tray instance
  tray = new Tray(trayIcon);

  // Create tray menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Settings",
      accelerator: "CmdOrCtrl+,",
      click: () => {
        showWindow();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      accelerator: "CmdOrCtrl+Q",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("URL Dispatcher");
  tray.setContextMenu(contextMenu);
};

// Initialize app when ready
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Check if we handled a URL during startup (e.g. cold start from link)
  if (Date.now() - lastUrlTime < 2000) {
      console.log("Startup with URL detected. Keeping window hidden.");
  } 
  // We do NOT auto-show window here anymore. 
  // We rely on 'activate' event (which fires on launch) or Tray.
});

// Track last URL time to prevent 'activate' from showing window during URL handling
let lastUrlTime = 0;

// Set up URL handlers - MUST be done before 'ready' event on macOS
app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log("Received open-url event:", url);
  lastUrlTime = Date.now(); // Record time
  
  // Force hide immediately upon receiving a URL
  if (process.platform === "darwin") {
      app.hide();
  }
  
  handleUrl(url);
});

// Handle second instance and URL forwarding
app.on("second-instance", (event, argv) => {
  if (process.platform === "win32" || process.platform === "linux") {
    const url = argv.find((arg) => arg.startsWith("http"));
    if (url) {
        handleUrl(url);
        // Do NOT show window if handling URL
    } else {
        // If no URL, show window
        showWindow();
    }
  } else {
      // On macOS, second-instance might not contain the URL if open-url handles it
      // But if it does fire, we should probably show window unless we just handled a URL
      if (Date.now() - lastUrlTime > 1000) {
          showWindow();
      }
  }
});

// Don't quit app when windows are closed
app.on("window-all-closed", () => {
  // Don't quit on close - keep the app running in the background
  if (process.platform !== "darwin" && !tray) {
    app.quit();
  }
});

app.on("activate", () => {
  console.log("Activate event received");
  
  // On macOS, recreate window when dock icon is clicked
  // BUT, ignore if we just received a URL (which also triggers activate)
  if (Date.now() - lastUrlTime < 1000) {
      console.log("Ignoring activate event due to recent URL handling");
      return;
  }

  // Since we are always in accessory mode, activate might not fire from Dock (since no icon)
  // But if it does (e.g. from Spotlight), we show the window
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    mainWindow?.once("ready-to-show", () => {
        showWindow();
    });
  } else {
      showWindow();
  }
});

app.on("before-quit", () => {
    isQuitting = true;
});
