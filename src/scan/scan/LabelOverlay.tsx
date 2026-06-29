// A single positioned label chip, anchored to a detection's bbox center.
// Default ('component') variant: interactive labels open a card, informational
// ones are non-tappable. The demo uses 'ai' (teal) and 'manual' (blue) variants
// to distinguish AI-detected objects from user-added tags.

import { Detection } from '../recognition/detector'
import { ScanComponent } from '../db/scan'

export type LabelVariant = 'component' | 'ai' | 'manual'

interface Props {
  detection: Detection
  component?: ScanComponent | undefined
  onSelect?: (component: ScanComponent) => void
  variant?: LabelVariant
}

export function LabelOverlay({ detection, component, onSelect, variant = 'component' }: Props) {
  // Anchor at the horizontal center, vertical center of the bbox (normalized %).
  const left = `${(detection.bbox.x + detection.bbox.width / 2) * 100}%`
  const top = `${(detection.bbox.y + detection.bbox.height / 2) * 100}%`

  const name = component?.name ?? detection.classLabel
  const interactive = variant === 'component' && component?.label_type === 'interactive'

  const style: Record<LabelVariant, string> = {
    component: interactive
      ? 'bg-emerald-600/90 border-emerald-300 text-white hover:bg-emerald-500 cursor-pointer'
      : 'bg-slate-900/80 border-slate-500 text-slate-100 cursor-default',
    ai: 'bg-teal-600/90 border-teal-300 text-white cursor-default',
    manual: 'bg-blue-600/90 border-blue-300 text-white cursor-default',
  }

  return (
    <button
      type="button"
      disabled={!interactive || !component}
      onClick={() => component && onSelect?.(component)}
      style={{ left, top }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 max-w-[40vw] px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap shadow-lg ${style[variant]}`}
    >
      {name}
      {interactive && <span className="ml-1 opacity-80">ⓘ</span>}
    </button>
  )
}
