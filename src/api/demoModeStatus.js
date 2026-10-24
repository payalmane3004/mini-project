export function readDemoModeStatus(payload) {
  return typeof payload?.demo_mode === "boolean" ? payload.demo_mode : false;
}
