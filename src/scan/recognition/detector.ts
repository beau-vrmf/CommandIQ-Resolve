// Recognition seam. The rest of the app depends ONLY on this interface, never
// on how a component is recognized. This quarantines the computer-vision risk:
// the CV detector and the guided fallback are interchangeable behind `Detector`.

// Normalized bounding box (0..1 relative to the video frame), origin top-left.
export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Detection {
  classLabel: string // maps to scan_detections.class_label → a component
  bbox: BBox
  confidence: number // 0..1
}

export interface Detector {
  // Inspect the current frame and return zero or more detections.
  detect(frame: HTMLVideoElement): Promise<Detection[]>
  // Human-readable mode label for the UI (e.g. "Guided", "Computer vision").
  readonly mode: string
}
