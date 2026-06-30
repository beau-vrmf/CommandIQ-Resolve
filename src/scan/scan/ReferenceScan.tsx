// Reference-image scan mode. Instead of live-camera recognition, it shows a
// fixed photo of the area as a backdrop with tappable hotspots placed over each
// component. Hotspot positions come from the database (scan_detections.pos_*),
// so an admin/SME can tune them without code changes. Reuses LabelOverlay and
// ComponentCard so the card experience is identical to camera mode.

import { useState } from 'react'
import { ReferenceScanData, ScanComponent } from '../db/scan'
import { LabelOverlay } from './LabelOverlay'
import { ComponentCard } from './ComponentCard'

interface Props {
  data: ReferenceScanData
  onExit: () => void
}

export function ReferenceScan({ data, onExit }: Props) {
  const [selected, setSelected] = useState<ScanComponent | null>(null)

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 z-10">
        <button
          onClick={onExit}
          className="text-white px-3 py-2 rounded-md hover:bg-white/10"
          aria-label="Exit"
        >
          ✕ Exit
        </button>
        <span className="text-white/80 text-sm">
          {data.area.aircraft} · {data.area.area}
        </span>
        <span className="w-16" />
      </div>

      <div className="flex-1 overflow-auto flex items-start justify-center">
        {/* Wrapper sizes to the image; hotspots are positioned as % of this box. */}
        <div className="relative w-full max-w-3xl">
          <img
            src={data.area.reference_image_url ?? ''}
            alt={`${data.area.aircraft} ${data.area.area}`}
            className="block w-full h-auto select-none"
            draggable={false}
          />
          {data.hotspots.map((h) => (
            <LabelOverlay
              key={h.component.id}
              detection={{ classLabel: h.component.name, bbox: h.bbox, confidence: 1 }}
              component={h.component}
              onSelect={setSelected}
            />
          ))}
        </div>
      </div>

      <div className="px-4 py-2 bg-black/70 text-center">
        <p className="text-xs text-slate-400">Tap a labeled control to view its details.</p>
      </div>

      {selected && <ComponentCard component={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
