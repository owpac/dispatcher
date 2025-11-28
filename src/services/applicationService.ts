import { SystemApplication } from "../types/applicationTypes";

// Fonction qui utilise l'API exposée par le preload pour communiquer avec le processus principal
export const getInstalledApplications = async (): Promise<
  SystemApplication[]
> => {
  try {
    // Vérifier si l'API est disponible
    if (window.appBridge && window.appBridge.fetchSystemApps) {
      // Utiliser l'API exposée par le preload
      const systemApps: SystemApplication[] =
        await window.appBridge.fetchSystemApps();

      // Convertir le format SystemApplication vers Application
      return systemApps.map((app) => ({
        id: app.id || "",
        name: app.name || "",
        path: app.path || "",
        icon: app.icon,
      }));
    } else {
      // Fallback pour le développement ou si l'API n'est pas disponible
      console.warn("appBridge API not available, using mock data");
      return [
        {
          id: "chrome",
          name: "Google Chrome",
          path: "/Applications/Google Chrome.app",
        },
        { id: "firefox", name: "Firefox", path: "/Applications/Firefox.app" },
        { id: "safari", name: "Safari", path: "/Applications/Safari.app" },
      ];
    }
  } catch (error) {
    console.error("Failed to get installed applications:", error);
    return [];
  }
};
