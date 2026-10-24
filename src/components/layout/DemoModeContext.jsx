import { useEffect, useState } from "react";
import { fetchDemoModeStatus } from "../../api/demoMode";
import { DemoModeContext } from "./demoModeContextValue";
import { useDemoMode } from "./useDemoMode";

export function DemoModeProvider({ children }) {
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let active = true;
    fetchDemoModeStatus().then((enabled) => {
      if (active) setDemoMode(enabled);
    });
    return () => { active = false; };
  }, []);

  return <DemoModeContext.Provider value={demoMode}>{children}</DemoModeContext.Provider>;
}

export function DemoModeIndicator() {
  const demoMode = useDemoMode();
  if (!demoMode) return null;
  return <span className="demo-mode-badge" role="status" aria-label="Demo data mode active">DEMO DATA</span>;
}
