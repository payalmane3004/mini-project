import { useContext } from "react";
import { DemoModeContext } from "./demoModeContextValue";

export function useDemoMode() {
  return useContext(DemoModeContext);
}
