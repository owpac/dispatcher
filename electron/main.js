// import { app, BrowserWindow, ipcMain, shell } from 'electron';
// import path from 'path';
// import { execSync } from 'child_process';
// import fs from 'fs';
// import { fileURLToPath } from 'url';

// // Résoudre le problème de __dirname en ES modules
// const __filename = fileURLToPath(import.meta.url);
// const MAIN_DIR = path.dirname(__filename);

// // Référence à la fenêtre principale
// let dispatcherWindow = null;

// // Fonction de création de la fenêtre principale
// const initializeApplication = () => {
//   // Créer la fenêtre principale
//   dispatcherWindow = new BrowserWindow({
//     width: 550,
//     height: 650,
//     webPreferences: {
//       nodeIntegration: true,
//       contextIsolation: false,
//       enableRemoteModule: true
//     },
//     title: "Dispatcher - Air Traffic Control"
//   });

//   // Charger l'interface React
//   const appEntrypoint = process.env.DEV_SERVER_URL ||
//     `file://${path.join(MAIN_DIR, '../build/index.html')}`;

//   dispatcherWindow.loadURL(appEntrypoint);

//   // Ouvrir les outils de développement en mode développement
//   if (process.env.NODE_ENV === 'development') {
//     dispatcherWindow.webContents.openDevTools();
//   }

//   // Gestion de la fermeture de fenêtre
//   dispatcherWindow.on('closed', () => {
//     dispatcherWindow = null;
//   });
// };

// // Fonction pour détecter les applications installées selon le système d'exploitation
// function getInstalledApplications() {
//   const apps = [];

//   if (process.platform === 'darwin') {
//     // macOS - liste les applications dans /Applications
//     const appDir = '/Applications';
//     try {
//       const files = fs.readdirSync(appDir);
//       files.forEach(file => {
//         if (file.endsWith('.app')) {
//           const name = file.replace('.app', '');
//           const path = `${appDir}/${file}`;
//           apps.push({
//             id: name.toLowerCase().replace(/\s+/g, '-'),
//             name: name,
//             path: path,
//             // On pourrait aussi extraire l'icône avec des méthodes plus avancées
//           });
//         }
//       });
//     } catch (error) {
//       console.error('Error listing macOS applications:', error);
//     }
//   } else if (process.platform === 'win32') {
//     // Windows - utilise PowerShell pour lister les applications installées
//     try {
//       const command = 'powershell -command "Get-ItemProperty HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName, InstallLocation | ConvertTo-Json"';
//       const result = execSync(command).toString();
//       const installedApps = JSON.parse(result);

//       installedApps.forEach(app => {
//         if (app.DisplayName) {
//           apps.push({
//             id: app.DisplayName.toLowerCase().replace(/\s+/g, '-'),
//             name: app.DisplayName,
//             path: app.InstallLocation || '',
//           });
//         }
//       });
//     } catch (error) {
//       console.error('Error listing Windows applications:', error);
//     }
//   } else if (process.platform === 'linux') {
//     // Linux - analyse /usr/share/applications pour les fichiers .desktop
//     try {
//       const appDir = '/usr/share/applications';
//       const files = fs.readdirSync(appDir);
//       files.forEach(file => {
//         if (file.endsWith('.desktop')) {
//           // Analyse simple du fichier .desktop
//           const content = fs.readFileSync(`${appDir}/${file}`, 'utf8');
//           const nameMatch = content.match(/^Name=(.+)$/m);
//           const execMatch = content.match(/^Exec=(.+)$/m);

//           if (nameMatch && execMatch) {
//             const name = nameMatch[1];
//             apps.push({
//               id: file.replace('.desktop', ''),
//               name: name,
//               path: execMatch[1].split(' ')[0],
//             });
//           }
//         }
//       });
//     } catch (error) {
//       console.error('Error listing Linux applications:', error);
//     }
//   }

//   return apps;
// }

// // Configurer le gestionnaire IPC pour répondre aux demandes du processus de rendu
// ipcMain.handle('get-installed-apps', async () => {
//   console.log('COUCOU');
//   return getInstalledApplications();
// });

// // Nouveau gestionnaire pour ouvrir des URL avec des applications spécifiques
// ipcMain.handle('launch-url-with-app', async (event, args) => {
//   const { url, appPath } = args;
//   try {
//     let commandToExecute;

//     if (process.platform === 'darwin') {
//       // macOS
//       commandToExecute = `open -a "${appPath}" "${url}"`;
//     } else if (process.platform === 'win32') {
//       // Windows
//       commandToExecute = `start "" "${appPath}" "${url}"`;
//     } else {
//       // Linux et autres
//       commandToExecute = `${appPath} "${url}"`;
//     }

//     execSync(commandToExecute);
//     return { success: true };
//   } catch (error) {
//     console.error('Échec du lancement:', error);

//     // Tentative de fallback au navigateur par défaut
//     try {
//       await shell.openExternal(url);
//       return { success: true, usedFallback: true };
//     } catch (fallbackError) {
//       return { success: false, error: error.message };
//     }
//   }
// });

// // Gestionnaire du cycle de vie de l'application
// app.whenReady().then(initializeApplication);

// // Quitter quand toutes les fenêtres sont fermées, sauf sur macOS
// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });

// // Sur macOS, recréer la fenêtre lors du clic sur l'icône du dock
// app.on('activate', () => {
//   if (dispatcherWindow === null) {
//     initializeApplication();
//   }
// });
