export function qrCameraErrorMessage(error) {
  const message = String(error?.message || error || "");
  if (/NotAllowedError|permission|denied/i.test(message)) {
    return "Camera permission was denied. Allow camera access in your browser, then restart the scanner.";
  }
  if (/NotFoundError|NotFound|no camera|device not found/i.test(message)) {
    return "No camera was found. Use the verified room-code entry below.";
  }
  if (/NotReadableError|TrackStartError|in use/i.test(message)) {
    return "The camera is unavailable or already in use. Close other camera apps, then retry or enter the room code manually.";
  }
  if (/secure|https|origin/i.test(message)) {
    return "Camera scanning requires a secure browser context (HTTPS or localhost). Use the verified room-code entry below.";
  }
  return "The camera could not start. Check browser permissions and use the verified room-code entry if needed.";
}
