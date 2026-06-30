// Component detail card (PRD §12.5 / §17). Opened from a label or browse result.
// Renders the content-model fields and the interactive launch buttons.

import { ScanComponent } from '../db/scan'

interface Props {
  component: ScanComponent
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-1">{title}</h3>
      <div className="text-sm text-slate-200 leading-relaxed">{children}</div>
    </div>
  )
}

export function ComponentCard({ component: c, onClose }: Props) {
  const imi = [...(c.imi_links ?? []), ...(c.animation_links ?? [])]
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[88vh] overflow-auto bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{c.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {c.aircraft}
              {c.system ? ` · ${c.system}` : ''} · {c.area}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {c.description && <Section title="Description">{c.description}</Section>}
          {c.function && <Section title="Function">{c.function}</Section>}
          {c.location && <Section title="Location">{c.location}</Section>}

          {c.related_components && c.related_components.length > 0 && (
            <Section title="Related">
              <ul className="list-disc list-inside text-slate-300">
                {c.related_components.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Section>
          )}

          {(c.safety_notes || c.cautions) && (
            <div className="mb-4 rounded-lg border border-amber-800 bg-amber-900/20 px-3 py-2">
              <h3 className="text-xs uppercase tracking-wide text-amber-300 mb-1">⚠ Safety</h3>
              {c.safety_notes && <p className="text-sm text-amber-100">{c.safety_notes}</p>}
              {c.cautions && <p className="text-sm text-rose-200 mt-1">{c.cautions}</p>}
            </div>
          )}

          {(c.to_refs?.length || c.job_guide_refs?.length) && (
            <Section title="Technical references">
              <ul className="text-slate-300 space-y-0.5">
                {(c.to_refs ?? []).map((r, i) => (
                  <li key={`to-${i}`}>TO: {r}</li>
                ))}
                {(c.job_guide_refs ?? []).map((r, i) => (
                  <li key={`jg-${i}`}>Job guide: {r}</li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-2">
                Reference only. Use official source material for maintenance execution.
              </p>
            </Section>
          )}

          {/* Interactive launch buttons (PRD §12.7) */}
          {imi.length > 0 && (
            <div className="mt-5 flex flex-col gap-2">
              {imi.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
                >
                  ▶ Open related IMI / animation
                </a>
              ))}
            </div>
          )}

          {/* Future CommandIQ-Resolve linkage (PRD §12.12) */}
          {c.resolve_path_ids && c.resolve_path_ids.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
              <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Related troubleshooting
              </h3>
              <p className="text-xs text-slate-400">
                Links to CommandIQ Resolve will open the matching fault isolation path.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
