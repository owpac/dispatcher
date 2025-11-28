// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import { SystemApplication } from "./types/applicationTypes";

// Exposition d'API sécurisées pour la communication entre le processus principal et le processus de rendu
contextBridge.exposeInMainWorld("appBridge", {
  // Obtention des applications installées sur le système
  fetchSystemApps: () => ipcRenderer.invoke("get-installed-apps"),
  // Lancement d'une URL avec une application spécifique
  openWith: (url: string, appPath: string) =>
    ipcRenderer.invoke("launch-url-with-app", {
      url,
      appPath,
    }),
  // Exposition de l'événement URL
  onUrlReceived: (callback: (url: string) => void) => {
    ipcRenderer.on("handle-url", (_, url) => callback(url));
  },
  // Redimensionnement de la fenêtre
  resizeWindow: (width: number, height: number) =>
    ipcRenderer.send("resize-window", { width, height }),
  // Logging to main process
  log: (message: string) => ipcRenderer.send("log-message", message),
  // Signal that renderer is ready
  rendererReady: () => ipcRenderer.send("renderer-ready"),
  // Hide window
  hideWindow: () => ipcRenderer.send("hide-window"),
  // Start at login
  getStartAtLogin: () => ipcRenderer.invoke("get-start-at-login"),
  toggleStartAtLogin: (enabled: boolean) => ipcRenderer.invoke("toggle-start-at-login", enabled),
});

// Types pour TypeScript
declare global {
  interface Window {
    appBridge: {
      fetchSystemApps: () => Promise<SystemApplication[]>;
      openWith: (
        url: string,
        appPath: string
      ) => Promise<{
        reussite: boolean;
        erreur?: string;
      }>;
      onUrlReceived: (callback: (url: string) => void) => void;
      resizeWindow: (width: number, height: number) => void;
      log: (message: string) => void;
      rendererReady: () => void;
      hideWindow: () => void;
      getStartAtLogin: () => Promise<boolean>;
      toggleStartAtLogin: (enabled: boolean) => Promise<boolean>;
    };
  }
}
