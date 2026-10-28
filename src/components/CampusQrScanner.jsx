import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { createSingleSuccessfulScanHandler } from "../api/roomQr.js";
import { qrCameraErrorMessage } from "../api/qrCamera.js";

export default function CampusQrScanner({ onScan, onAccepted = () => {}, onDuplicate = () => {}, label = "Campus room QR code" }) {
  const generatedId = useId().replaceAll(":", "");
  const elementId = `campus-qr-scanner-${generatedId}`;
  const onScanRef = useRef(onScan);
  const onAcceptedRef = useRef(onAccepted);
  const onDuplicateRef = useRef(onDuplicate);
  const [attempt, setAttempt] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { onAcceptedRef.current = onAccepted; }, [onAccepted]);
  useEffect(() => { onDuplicateRef.current = onDuplicate; }, [onDuplicate]);

  useEffect(() => {
    let disposed = false;
    let scanner = null;
    let startPromise = Promise.resolve();
    let successStopPromise = null;
    let stopPromise = null;
    const stopScanner = () => {
      if (stopPromise) return stopPromise;
      if (!scanner) return Promise.resolve();
      const state = scanner.getState();
      stopPromise = state === 2 || state === 3
        ? Promise.resolve(scanner.stop())
        : Promise.resolve();
      return stopPromise;
    };
    const startTimer = window.setTimeout(() => {
      if (disposed) return;
      scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      const onDecoded = createSingleSuccessfulScanHandler(
        (payload) => onScanRef.current(payload),
        (payload) => onDuplicateRef.current(payload),
      );

      startPromise = scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          if (disposed || !onDecoded(decodedText)) return;
          setScanning(false);
          successStopPromise = Promise.resolve(startPromise)
            .then(stopScanner)
            .catch((error) => {
              if (!disposed) setCameraError(qrCameraErrorMessage(error));
            })
            .then(() => {
              if (!disposed) onAcceptedRef.current(decodedText);
            });
        },
        () => {
          // No QR in the current video frame is expected; the library reports it
          // continuously, so surface only camera/start errors to the user.
        },
      );

      startPromise.then(() => {
        if (!disposed) setScanning(true);
        else return stopScanner();
        return undefined;
      }).catch((error) => {
        if (!disposed) setCameraError(qrCameraErrorMessage(error));
      });
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(startTimer);
      if (!scanner) return;
      Promise.resolve(startPromise)
        .catch(() => undefined)
        .then(() => successStopPromise || stopScanner())
        .catch(() => undefined)
        .then(() => {
          try { scanner.clear(); } catch { /* It may already be cleared during startup failure. */ }
        });
    };
  }, [attempt, elementId]);

  function restart() {
    setCameraError("");
    setScanning(false);
    setAttempt((value) => value + 1);
  }

  return (
    <div className="campus-qr-scanner">
      <div id={elementId} aria-label={label} />
      {scanning && <p role="status">Camera is ready. Point it at a campus room QR code.</p>}
      {cameraError && <p role="alert">{cameraError}</p>}
      {!scanning && <button type="button" className="secondary-student-button" onClick={restart}>Start or restart camera</button>}
    </div>
  );
}
