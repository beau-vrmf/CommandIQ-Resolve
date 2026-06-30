import { describe, expect, it } from 'vitest'
import { createGuidedDetector } from '../recognition/guidedDetector'

// These class labels are the contract between the guided detector, the
// scan_detections seed, and getDetectionMap. If they drift, labels won't resolve
// to components in the camera view.
const PILOT_LABELS = [
  'external_power_receptacle',
  'external_power_cable_plug',
  'contact_light',
  'external_power_available_indicator',
  'aircraft_power_switch',
]

describe('guidedDetector — C-130J / External Power pilot', () => {
  it('returns the seeded hotspots with normalized bboxes', async () => {
    const detector = createGuidedDetector('C-130J', 'External Power')
    const dets = await detector.detect(null as unknown as HTMLVideoElement)

    expect(dets.map((d) => d.classLabel).sort()).toEqual([...PILOT_LABELS].sort())
    for (const d of dets) {
      expect(d.bbox.x).toBeGreaterThanOrEqual(0)
      expect(d.bbox.x + d.bbox.width).toBeLessThanOrEqual(1)
      expect(d.bbox.y).toBeGreaterThanOrEqual(0)
      expect(d.bbox.y + d.bbox.height).toBeLessThanOrEqual(1)
    }
  })

  it('returns nothing for an unconfigured area', async () => {
    const detector = createGuidedDetector('C-130J', 'Landing Gear')
    expect(await detector.detect(null as unknown as HTMLVideoElement)).toEqual([])
  })

  it('reports its mode for the UI', () => {
    expect(createGuidedDetector('C-130J', 'External Power').mode).toBe('Guided')
  })
})
