// Computer-vision detector (chosen path). CRITICAL-PATH / longest-lead: requires
// a labeled dataset of the target area across lighting/angles/wear before it can
// recognize anything (see plan Risks). It is wired behind the same `Detector`
// interface as the guided fallback, so it swaps in non-disruptively once a model
// exists.
//
// Recommended starting point: a hosted/pre-trainable object-detection endpoint
// (e.g. Roboflow-style) to avoid building training infrastructure up front;
// revisit on-device (TF.js / ONNX-Web) once the model is proven, to preserve the
// PWA offline story. Until an endpoint is configured this throws on construction
// so the app cleanly falls back to the guided detector.

import { Detector, Detection } from './detector'

interface CvDetectorConfig {
  endpoint: string // inference endpoint URL
  apiKey?: string
  minConfidence?: number // drop detections below this threshold (default 0.4)
  // Translate the raw model response into normalized Detections.
  parse: (raw: unknown, frame: HTMLVideoElement) => Detection[]
}

export function createCvDetector(config: CvDetectorConfig): Detector {
  if (!config.endpoint) {
    throw new Error('cvDetector: no inference endpoint configured')
  }
  const minConfidence = config.minConfidence ?? 0.4

  return {
    mode: 'Computer vision',
    async detect(frame: HTMLVideoElement): Promise<Detection[]> {
      const w = frame.videoWidth
      const h = frame.videoHeight
      if (!w || !h) return []

      // Grab the current frame as a JPEG for the inference request.
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(frame, 0, 0, w, h)
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7),
      )
      if (!blob) return []

      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
        body: blob,
      })
      if (!res.ok) throw new Error(`cvDetector: inference failed (${res.status})`)
      const raw = await res.json()
      return config.parse(raw, frame).filter((d) => d.confidence >= minConfidence)
    },
  }
}
