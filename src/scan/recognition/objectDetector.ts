// Demo/tutorial detector — on-device object recognition for a house/office.
// Implements the same Detector seam as the guided/CV detectors, so the demo
// reuses CameraScan + LabelOverlay unchanged.
//
// Uses TensorFlow.js COCO-SSD (~80 common object classes). tfjs + the model are
// lazy-loaded (dynamic import) so they never bloat the main bundle — only the
// demo pays the cost. Model weights load on first demo use from the tfjs-models
// CDN (kept out of the precache to keep the app lightweight for all users); the
// browser caches them after the first run. To make the demo fully offline,
// self-host the weights under /public/models and precache them in vite.config.

import { Detector, Detection } from './detector'

// To showcase the manual-tagging step, we deliberately surface only the top
// ~25% most-confident detections and leave the rest for the user to tag.
const SURFACE_FRACTION = 0.25
const MIN_SCORE = 0.5

// COCO label → Title Case ("cell phone" → "Cell Phone").
function prettify(label: string): string {
  return label.replace(/\b\w/g, (c) => c.toUpperCase())
}

// Loaded type kept loose to avoid importing the heavy module at module-eval time.
type CocoModel = { detect: (el: HTMLVideoElement) => Promise<RawPrediction[]> }
interface RawPrediction {
  bbox: [number, number, number, number] // [x, y, width, height] in pixels
  class: string
  score: number
}

let modelPromise: Promise<CocoModel> | null = null

async function loadModel(): Promise<CocoModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      // Dynamic imports: fetched only when the demo starts.
      await import('@tensorflow/tfjs')
      const cocoSsd = await import('@tensorflow-models/coco-ssd')
      // Default lite model from the tfjs-models CDN (loaded on first demo use).
      return cocoSsd.load() as unknown as Promise<CocoModel>
    })()
  }
  return modelPromise
}

export function createObjectDetector(): Detector {
  return {
    mode: 'Demo (on-device AI)',
    async detect(frame: HTMLVideoElement): Promise<Detection[]> {
      const w = frame.videoWidth
      const h = frame.videoHeight
      if (!w || !h) return []

      const model = await loadModel()
      const raw = await model.detect(frame)

      const confident = raw
        .filter((p) => p.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)

      // Cap to ~25% (at least one) so most objects are left for manual tagging.
      const keep = Math.max(1, Math.ceil(confident.length * SURFACE_FRACTION))

      return confident.slice(0, keep).map((p) => {
        const [x, y, bw, bh] = p.bbox
        return {
          classLabel: prettify(p.class),
          confidence: p.score,
          bbox: { x: x / w, y: y / h, width: bw / w, height: bh / h }, // normalize
        } satisfies Detection
      })
    },
  }
}
