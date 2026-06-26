// A single positioned label chip, anchored to a detection's bbox center.
// Informational labels are non-tappable; interactive labels open the card.

import { Detection } from '../recognition/detector'
import { ScanComponent } from '../db/scan'

interface Props {
  detection: Detection
  component: ScanComponent | undefined
  onSelect: (component: ScanComponent) => void
}

export function LabelOverlay({ detection, component, onSelect }: Props) {
  // Anchor at the horizontal center, vertical center of the bbox (normalized %).
  const left = `${(detection.bbox.x + detection.bbox.width / 2) * 100}%`
  const top = `${(detection.bbox.y + detection.bbox.height / 2) * 100}%`

  const name = component?.name ?? detection.classLabel
  const interactive = component?.label_type === 'interactive'

  return (
    <button
      type="button"
      disabled={!interactive || !component}
      onClick={() => component && onSelect(component)}
      style={{ left, top }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 max-w-[40vw] px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap shadow-lg ${
        interactive
          ? 'bg-emerald-600/90 border-emerald-300 text-white hover:bg-emerald-500 cursor-pointer'
          : 'bg-slate-900/80 border-slate-500 text-slate-100 cursor-default'
      }`}
    >
      {name}
      {interactive && <span className="ml-1 opacity-80">ⓘ</span>}
    </button>
  )
}
