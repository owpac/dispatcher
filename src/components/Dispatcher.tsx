import React, { useState, useEffect, useRef } from "react";
import { getInstalledApplications } from "../services/applicationService";
import { SystemApplication } from "../types/applicationTypes";
import { RouteItem } from "./RouteItem";
import { Plus, X, Settings } from "lucide-react";

interface RouteData {
  id: string;
  url: string;
  browser: string;
  condition: string;
}

export const Dispatcher: React.FC = () => {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [applications, setApplications] = useState<SystemApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [defaultBrowser, setDefaultBrowser] = useState<string>("");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [enableTestInput, setEnableTestInput] = useState<boolean>(true);
  const [startAtLogin, setStartAtLogin] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-resize removed to allow user resizing
  // We still need to handle the initial load or ensure the window is big enough, 
  // but for now we rely on the user resizing the window as requested.

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const installedApps = await getInstalledApplications();
        setApplications(installedApps);

        // Load routes from localStorage
        const savedRoutes = localStorage.getItem("routes");
        if (savedRoutes) {
          setRoutes(JSON.parse(savedRoutes));
        }

        // Load default browser from localStorage
        const savedDefaultBrowser = localStorage.getItem("defaultBrowser");
        if (savedDefaultBrowser && installedApps.some(app => app.id === savedDefaultBrowser)) {
          setDefaultBrowser(savedDefaultBrowser);
        } else if (installedApps.length > 0) {
          setDefaultBrowser(installedApps[0].id); // Set first app as default if none saved or saved one is gone
        }

        // Load settings
        const savedEnableTestInput = localStorage.getItem("enableTestInput");
        if (savedEnableTestInput !== null) {
            setEnableTestInput(savedEnableTestInput === "true");
        }

        // Load start at login status
        if (window.appBridge) {
            const isEnabled = await window.appBridge.getStartAtLogin();
            setStartAtLogin(isEnabled);
        }
      } catch (error) {
        console.error("Failed to load applications or routes:", error);
        // Handle error appropriately
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Save routes when they change
  useEffect(() => {
    if (!loading) {
      localStorage.setItem("routes", JSON.stringify(routes));
    }
  }, [routes, loading]);

  // Save default browser when it changes
  useEffect(() => {
    if (defaultBrowser && !loading) {
      localStorage.setItem("defaultBrowser", defaultBrowser);
    }
  }, [defaultBrowser, loading]);

  // Save settings when they change
  useEffect(() => {
    if (!loading) {
        localStorage.setItem("enableTestInput", String(enableTestInput));
    }
  }, [enableTestInput, loading]);

  // State for active browser groups (to show empty groups)
  const [activeBrowsers, setActiveBrowsers] = useState<string[]>([]);

  // Initialize activeBrowsers from routes on load
  useEffect(() => {
    if (routes.length > 0 && activeBrowsers.length === 0) {
      const browsers = Array.from(new Set(routes.map(r => r.browser)));
      setActiveBrowsers(browsers);
    }
  }, [routes, loading]);

  const addBrowserGroup = () => {
    const defaultAppId = applications[0]?.id;
    if (defaultAppId && !activeBrowsers.includes(defaultAppId)) {
        setActiveBrowsers([...activeBrowsers, defaultAppId]);
    } else if (applications.length > 1) {
        // Try to find one that isn't active
        const nextApp = applications.find(a => !activeBrowsers.includes(a.id));
        if (nextApp) {
            setActiveBrowsers([...activeBrowsers, nextApp.id]);
        } else {
            // Allow duplicates if all are taken, though UI might be weird. 
            // Better to just add the default and let user change it.
            setActiveBrowsers([...activeBrowsers, defaultAppId || ""]);
        }
    }
  };

  const removeBrowserGroup = (browserId: string) => {
    setActiveBrowsers(activeBrowsers.filter(id => id !== browserId));
    // Optional: Delete all routes for this browser? 
    // For now, let's keep them in state but they won't be shown if we filter by activeBrowsers.
    // Actually, we should probably delete them to avoid "ghost" routes.
    setRoutes(routes.filter(r => r.browser !== browserId));
  };

  const updateGroupBrowser = (oldBrowserId: string, newBrowserId: string) => {
    if (activeBrowsers.includes(newBrowserId)) {
        alert("This browser group already exists.");
        return;
    }
    setActiveBrowsers(activeBrowsers.map(id => id === oldBrowserId ? newBrowserId : id));
    setRoutes(routes.map(r => r.browser === oldBrowserId ? { ...r, browser: newBrowserId } : r));
  };

  const addRouteToGroup = (browserId: string) => {
    const newRoute: RouteData = {
      id: Date.now().toString(),
      url: "",
      browser: browserId,
      condition: "contains",
    };
    setRoutes([...routes, newRoute]);
  };

  const updateRoute = (id: string, field: string, value: string) => {
    setRoutes(routes.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteRoute = (id: string) => {
    setRoutes(routes.filter(r => r.id !== id));
  };

  const closeWindow = () => {
    if (window.appBridge) {
        window.appBridge.hideWindow();
    } else {
        window.close();
    }
  };

  // Process URL and open in appropriate browser
  const processUrl = (url: string) => {
    if (window.appBridge) {
        window.appBridge.log(`[Dispatcher] Processing URL: ${url}`);
    }

    // Find matching route
    const route = routes.find(r => {
      if (r.condition === "contains") {
        return url.includes(r.url);
      } else if (r.condition === "startsWith") {
        return url.startsWith(r.url);
      } else if (r.condition === "regex") {
        try {
          const regex = new RegExp(r.url);
          return regex.test(url);
        } catch (e) {
          return false;
        }
      }
      return false;
    });

    const targetBrowserId = route ? route.browser : defaultBrowser;
    const targetApp = applications.find(app => app.id === targetBrowserId);

    if (window.appBridge) {
        window.appBridge.log(`[Dispatcher] Matched route: ${route ? route.id : 'None'}`);
        window.appBridge.log(`[Dispatcher] Target Browser ID: ${targetBrowserId}`);
        window.appBridge.log(`[Dispatcher] Target App found: ${targetApp ? 'Yes' : 'No'}`);
    }

    if (targetApp && window.appBridge) {
      window.appBridge.log(`[Dispatcher] Opening ${url} in ${targetApp.name}`);
      window.appBridge.openWith(url, targetApp.path);
    } else {
      const msg = `Could not find browser for ${url}`;
      console.error(msg);
      if (window.appBridge) window.appBridge.log(`[Dispatcher] Error: ${msg}`);
    }
  };

  // Listen for URLs from main process
  useEffect(() => {
    if (!loading && applications.length > 0 && window.appBridge) {
      const handleUrl = (url: string) => {
        processUrl(url);
      };

      window.appBridge.onUrlReceived(handleUrl);
      window.appBridge.log("[Dispatcher] URL listener attached");
      
      // Signal main process that we are ready to receive URLs
      if (window.appBridge.rendererReady) {
        window.appBridge.rendererReady();
      }
    }
  }, [loading, applications.length]); // Only re-run if loading changes or apps finish loading


  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+, or Ctrl+, to toggle settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings(prev => !prev);
      }
      // Esc to close settings
      if (e.key === "Escape" && showSettings) {
        setShowSettings(false);
      }
      // Cmd+n or Ctrl+n to add application
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        addBrowserGroup();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSettings, addBrowserGroup]);

  const handleTestUrl = () => {
    const input = document.getElementById('test-url-input') as HTMLInputElement;
    if (input && input.value) {
        // Simulate receiving a URL
        const url = input.value;
        
        // Find matching route
        const route = routes.find(r => {
            if (r.condition === "contains") {
                return url.includes(r.url);
            } else if (r.condition === "startsWith") {
                return url.startsWith(r.url);
            } else if (r.condition === "regex") {
                try {
                    const regex = new RegExp(r.url);
                    return regex.test(url);
                } catch (e) {
                    return false;
                }
            }
            return false;
        });

        if (window.appBridge) {
            window.appBridge.log(`Testing URL: ${url}`);
            window.appBridge.log(`Found route: ${JSON.stringify(route)}`);
            window.appBridge.log(`Default browser: ${defaultBrowser}`);
            window.appBridge.log(`Available apps: ${JSON.stringify(applications.map(a => ({id: a.id, name: a.name})))}`);
        }

        const targetBrowserId = route ? route.browser : defaultBrowser;
        const targetApp = applications.find(app => app.id === targetBrowserId);

        if (window.appBridge) {
            window.appBridge.log(`Processing URL: ${url}`);
            window.appBridge.log(`Matched route: ${route ? route.id : 'None'}`);
            window.appBridge.log(`Target Browser ID: ${targetBrowserId}`);
            window.appBridge.log(`Target App found: ${targetApp ? 'Yes' : 'No'}`);
        }

        if (targetApp && window.appBridge) {
            window.appBridge.log(`Opening ${url} in ${targetApp.name} (${targetApp.path})`);
            window.appBridge.openWith(url, targetApp.path);
        } else {
            const errorMsg = `Could not find browser for ${url}. Target ID: ${targetBrowserId}`;
            if (window.appBridge) window.appBridge.log(errorMsg);
            alert(errorMsg);
        }
    }
  };

  return (
    <div ref={containerRef} className="p-8 flex flex-col h-screen box-border overflow-hidden">
        <div className="relative bg-panel-bg text-text-primary w-full h-full rounded-xl border border-border overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center p-6 border-b border-border drag">
        <h1 className="font-semibold text-xl tracking-tight">Dispatcher</h1>
        <div className="flex items-center gap-4 no-drag">
          <button
            onClick={() => setShowSettings(true)}
            className="text-text-secondary hover:text-white transition-colors p-2 rounded-md hover:bg-input-bg"
            title="Settings (Cmd+,)"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={addBrowserGroup}
            className="flex items-center gap-2 bg-input-bg hover:bg-border transition-colors text-sm font-medium px-4 py-2 rounded-md border border-border"
          >
            <Plus size={16} />
            <span>Add Application</span>
          </button>
          <button 
            onClick={closeWindow}
            className="text-text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-32 text-text-secondary">
            Loading applications...
          </div>
        ) : (
          <div className="space-y-6">
            {activeBrowsers.map((browserId, index) => {
                const app = applications.find(a => a.id === browserId);
                const groupRoutes = routes.filter(r => r.browser === browserId);
                
                return (
                    <div key={`${browserId}-${index}`} className="bg-input-bg/30 border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-start gap-3 flex-1">
                                <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                                    {/* Placeholder icon if no app icon */}
                                    <span className="text-lg font-bold text-accent">{app?.name.charAt(0) || "?"}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="relative">
                                        <select 
                                            className="w-full bg-input-bg text-sm font-medium text-text-primary rounded-md border border-border pl-3 pr-8 py-1.5 appearance-none focus:outline-none focus:border-accent cursor-pointer hover:border-accent/50 transition-colors"
                                            value={browserId}
                                            onChange={(e) => updateGroupBrowser(browserId, e.target.value)}
                                        >
                                            {applications.map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        </div>
                                    </div>
                                    <p className="text-xs text-text-secondary mt-1.5">{groupRoutes.length} rules</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => removeBrowserGroup(browserId)}
                                className="text-text-secondary hover:text-red-400 p-2"
                                title="Remove group"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-2 pl-4 border-l-2 border-border/50 ml-5">
                            {groupRoutes.map(route => (
                                <RouteItem
                                    key={route.id}
                                    {...route}
                                    onUpdate={updateRoute}
                                    onDelete={deleteRoute}
                                />
                            ))}
                            <button 
                                onClick={() => addRouteToGroup(browserId)}
                                className="flex items-center gap-2 text-xs text-accent hover:underline mt-2 px-2 py-1"
                            >
                                <Plus size={12} />
                                <span>Add URL Rule</span>
                            </button>
                        </div>
                    </div>
                );
            })}
            
            {activeBrowsers.length === 0 && (
                <div className="text-center py-10 text-text-secondary">
                    <p>No application groups defined.</p>
                    <button onClick={addBrowserGroup} className="text-accent hover:underline mt-2">Add your first application</button>
                </div>
            )}
          </div>
        )}
      </div>

      {/* Test URL Section */}
      {enableTestInput && (
      <div className="px-6 py-4 border-t border-border bg-panel-bg/30">
        <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-secondary w-16">Test</span>
            <div className="flex-1 flex gap-2">
                <input 
                    type="text" 
                    id="test-url-input"
                    placeholder="Enter URL to test dispatching..." 
                    className="flex-1 bg-input-bg text-text-primary text-sm rounded-md border border-border px-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleTestUrl();
                        }
                    }}
                />
                <button 
                    onClick={handleTestUrl}
                    className="bg-accent hover:bg-accent-hover text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                >
                    Test
                </button>
            </div>
        </div>
      </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-panel-bg border border-border rounded-xl w-full max-w-[400px] p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-border pb-4">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <button onClick={() => setShowSettings(false)} className="text-text-secondary hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col">
                        <span className="font-medium">Enable URL Testing</span>
                        <span className="text-xs text-text-secondary">Show the test input field in the app</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={enableTestInput}
                            onChange={(e) => setEnableTestInput(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-input-bg peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col">
                        <span className="font-medium">Start at Login</span>
                        <span className="text-xs text-text-secondary">Automatically start app when you log in</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={startAtLogin}
                            onChange={async (e) => {
                                const newValue = e.target.checked;
                                setStartAtLogin(newValue);
                                if (window.appBridge) {
                                    await window.appBridge.toggleStartAtLogin(newValue);
                                }
                            }}
                        />
                        <div className="w-11 h-6 bg-input-bg peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex justify-end">
                    <button 
                        onClick={() => setShowSettings(false)}
                        className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Footer */}
      <footer className="p-6 border-t border-border bg-panel-bg/50">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">Default Browser</span>
          <div className="relative w-64">
            <select
              className="w-full bg-input-bg text-text-primary text-sm rounded-md border border-border px-3 py-2 appearance-none focus:outline-none focus:border-accent transition-colors"
              value={defaultBrowser}
              onChange={(e) => setDefaultBrowser(e.target.value)}
              disabled={loading}
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </div>
  );
};
