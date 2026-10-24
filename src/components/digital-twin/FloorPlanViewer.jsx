import { useCallback, useEffect, useRef, useState } from "react";
import { Expand, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import "./FloorPlanViewer.css";

// Keep fit-to-view usable for wide CAD sheets whose intrinsic image dimensions
// can be much larger than the visible drawing area.
const MIN_SCALE = 0.02;
const MAX_SCALE = 12;
const ZOOM_FACTOR = 1.2;

function FloorPlanViewer({ src, title, filename, annotations = [], annotationBounds, onSelectAnnotation }) {
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const naturalSizeRef = useRef(null);
  const dragRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [naturalSize, setNaturalSize] = useState(null);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const fitToView = useCallback(() => {
    const stage = stageRef.current;
    const naturalSize = naturalSizeRef.current;
    if (!stage || !naturalSize) return;

    const bounds = stage.getBoundingClientRect();
    const availableWidth = Math.max(bounds.width - 28, 1);
    const availableHeight = Math.max(bounds.height - 28, 1);
    const scale = Math.min(
      availableWidth / naturalSize.width,
      availableHeight / naturalSize.height,
      MAX_SCALE,
    );

    setTransform({ scale: Math.max(scale, MIN_SCALE), x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(fitToView);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [fitToView]);

  const zoomAt = useCallback((factor, clientX, clientY) => {
    const stage = stageRef.current;
    if (!stage || status !== "loaded") return;

    const bounds = stage.getBoundingClientRect();
    const anchorX = clientX == null ? 0 : clientX - (bounds.left + bounds.width / 2);
    const anchorY = clientY == null ? 0 : clientY - (bounds.top + bounds.height / 2);
    setTransform((current) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      const ratio = scale / current.scale;
      return {
        scale,
        x: anchorX - (anchorX - current.x) * ratio,
        y: anchorY - (anchorY - current.y) * ratio,
      };
    });
  }, [status]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    function handleWheel(event) {
      if (status !== "loaded") return;
      event.preventDefault();
      zoomAt(event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR, event.clientX, event.clientY);
    }

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [status, zoomAt]);

  function handleImageLoad(event) {
    const image = event.currentTarget;
    const size = { width: image.naturalWidth, height: image.naturalHeight };
    naturalSizeRef.current = size;
    setNaturalSize(size);
    setStatus("loaded");
    requestAnimationFrame(fitToView);
  }

  function handlePointerDown(event) {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
  }

  function handlePointerMove(event) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    dragRef.current = { ...dragRef.current, x: event.clientX, y: event.clientY };
    setTransform((current) => ({ ...current, x: current.x + deltaX, y: current.y + deltaY }));
  }

  function stopDragging(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event) {
    const pan = 36;
    if (event.key === "+" || event.key === "=") zoomAt(ZOOM_FACTOR);
    else if (event.key === "-") zoomAt(1 / ZOOM_FACTOR);
    else if (event.key === "0" || event.key.toLowerCase() === "f") fitToView();
    else if (event.key === "ArrowLeft") setTransform((current) => ({ ...current, x: current.x + pan }));
    else if (event.key === "ArrowRight") setTransform((current) => ({ ...current, x: current.x - pan }));
    else if (event.key === "ArrowUp") setTransform((current) => ({ ...current, y: current.y + pan }));
    else if (event.key === "ArrowDown") setTransform((current) => ({ ...current, y: current.y - pan }));
    else return;
    event.preventDefault();
  }

  const viewerTransform = {
    transform: `translate3d(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px), 0) scale(${transform.scale})`,
  };

  function annotationPosition(annotation) {
    if (!annotationBounds || !Number.isFinite(annotation.x) || !Number.isFinite(annotation.y)) return null;
    const width = annotationBounds.maxX - annotationBounds.minX;
    const height = annotationBounds.maxY - annotationBounds.minY;
    const padding = Math.max(width, height) * 0.025;
    const paddedWidth = width + padding * 2;
    const paddedHeight = height + padding * 2;
    return {
      left: `${((annotation.x - annotationBounds.minX + padding) / paddedWidth) * 100}%`,
      top: `${((annotationBounds.maxY + padding - annotation.y) / paddedHeight) * 100}%`,
    };
  }

  return (
    <div className="floor-plan-viewer">
      <div className="floor-plan-controls" role="toolbar" aria-label={`${title} viewer controls`}>
        <button type="button" onClick={() => zoomAt(ZOOM_FACTOR)} disabled={status !== "loaded"}
          aria-label="Zoom in" title="Zoom in">
          <ZoomIn size={16} /><span>Zoom in</span>
        </button>
        <button type="button" onClick={() => zoomAt(1 / ZOOM_FACTOR)} disabled={status !== "loaded"}
          aria-label="Zoom out" title="Zoom out">
          <ZoomOut size={16} /><span>Zoom out</span>
        </button>
        <span className="floor-plan-zoom-level" aria-live="polite">{Math.round(transform.scale * 100)}%</span>
        <button type="button" onClick={fitToView} disabled={status !== "loaded"}
          aria-label="Fit drawing to viewer" title="Fit to view">
          <Expand size={15} /><span>Fit</span>
        </button>
        <button type="button" onClick={fitToView} disabled={status !== "loaded"}
          aria-label="Reset drawing view" title="Reset view">
          <RotateCcw size={15} /><span>Reset</span>
        </button>
      </div>

      <div
        className={`floor-plan-stage ${dragging ? "is-dragging" : ""} ${status === "loaded" ? "is-loaded" : ""}`}
        ref={stageRef}
        role="group"
        aria-label={`${title} interactive drawing. Drag to pan, use the mouse wheel to zoom. Keyboard: plus and minus to zoom, arrow keys to pan, F or 0 to fit.`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={() => { dragRef.current = null; setDragging(false); }}
      >
        {status !== "error" && (annotations.length > 0 && status === "loaded" ? (
            <div className="floor-plan-artwork" style={{ ...viewerTransform, width: naturalSize?.width, height: naturalSize?.height }}>
              <img ref={imageRef} className="floor-plan-image" src={src} alt="" draggable="false" onLoad={handleImageLoad} onError={() => setStatus("error")} />
              {annotations.map((annotation) => {
                const position = annotationPosition(annotation);
                return position && <button key={annotation.sourceIndex ?? annotation.id} type="button" className="floor-plan-annotation-marker" style={position}
                  title={`Source annotation: ${annotation.text}`} aria-label={`Highlight source annotation: ${annotation.text}`}
                  onClick={(event) => { event.stopPropagation(); onSelectAnnotation?.(annotation); }}><span /></button>;
              })}
            </div>
          ) : (
            <img ref={imageRef} className="floor-plan-image" src={src} alt="" draggable="false" style={viewerTransform}
              onLoad={handleImageLoad} onError={() => setStatus("error")} />
          ))}
        {status === "loading" && <p className="floor-plan-message" role="status">Loading drawing preview…</p>}
        {status === "error" && (
          <div className="floor-plan-error" role="alert">
            <strong>Drawing preview unavailable</strong>
            <span>Could not load {filename}. Try the original DWG download below.</span>
          </div>
        )}
      </div>
      <p className="floor-plan-keyboard-help">Drag to pan · Wheel to zoom · Keyboard: + / − zoom, arrows pan, F fit</p>
    </div>
  );
}

export default FloorPlanViewer;
