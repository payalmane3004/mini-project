import test from "node:test";
import assert from "node:assert/strict";
import { qrCameraErrorMessage } from "./qrCamera.js";

test("QR scanner explains permission, missing-camera, and unavailable-camera errors", () => {
  assert.match(qrCameraErrorMessage("NotAllowedError: Permission denied"), /permission was denied/i);
  assert.match(qrCameraErrorMessage("NotFoundError: Requested device not found"), /No camera was found/i);
  assert.match(qrCameraErrorMessage("NotReadableError: camera in use"), /already in use/i);
  assert.match(qrCameraErrorMessage("generic camera failure"), /could not start/i);
});
