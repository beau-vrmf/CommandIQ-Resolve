// Guided fallback detector — ships first and is the offline-safe degraded mode.
// Instead of analyzing the frame, it returns a fixed set of labeled hotspots for
// the selected area (tap-to-reveal). This lets the full Scan UX, content model,
// CMS, and IMI launch be built and SME-validated in parallel with CV dataset work.

import { Detector, Detection } from './detector'

// Static hotspot layout per "aircraft/area". Positions are normalized (0..1).
// Class labels match scan_detections.class_label so lookups are identical to CV.
const LAYOUTS: Record<string, Detection[]> = {
  'C-130J/External Power': [
    { classLabel: 'external_power_receptacle', confidence: 1, bbox: { x: 0.32, y: 0.38, width: 0.16, height: 0.14 } },
    { classLabel: 'external_power_cable_plug', confidence: 1, bbox: { x: 0.55, y: 0.42, width: 0.16, height: 0.14 } },
    { classLabel: 'contact_light', confidence: 1, bbox: { x: 0.20, y: 0.20, width: 0.10, height: 0.10 } },
    { classLabel: 'external_power_available_indicator', confidence: 1, bbox: { x: 0.70, y: 0.18, width: 0.14, height: 0.10 } },
    { classLabel: 'aircraft_power_switch', confidence: 1, bbox: { x: 0.42, y: 0.68, width: 0.14, height: 0.12 } },
  ],
}

function key(aircraft: string, area: string): string {
  return `${aircraft}/${area}`
}

export function createGuidedDetector(aircraft: string, area: string): Detector {
  const hotspots = LAYOUTS[key(aircraft, area)] ?? []
  return {
    mode: 'Guided',
    async detect() {
      // Frame-independent: always surface the known hotspots for this area.
      return hotspots
    },
  }
}
