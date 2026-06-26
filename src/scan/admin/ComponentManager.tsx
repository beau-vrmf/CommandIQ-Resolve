// Admin: list / create / delete components (mirrors ojt/admin/ProcedureManager).

import { useEffect, useState } from 'react'
import { ScanComponent, getAllComponents, deleteComponent } from '../db/scan'
import { ComponentEditor } from './ComponentEditor'

type View = { kind: 'list' } | { kind: 'editor'; component: ScanComponent }

const STATUS_STYLES: Record<string, string> = {
  draft: 'text-slate-400',
  submitted: 'text-amber-300',
  approved: 'text-emerald-400',
  returned: 'text-rose-300',
}

export function ComponentManager() {
  const [components, setComponents] = useState<ScanComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>({ kind: 'list' })

  async function load() {
    setLoading(true)
    try {
      setComponents(await getAllComponents())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleDelete(c: ScanComponent) {
    if (!confirm(`Permanently delete "${c.name}"? This cannot be undone.`)) return
    await deleteComponent(c.id)
    void load()
  }

  function newComponent(): ScanComponent {
    return {
      id: crypto.randomUUID(),
      aircraft: '',
      area: '',
      system: null,
      name: '',
      alternate_names: null,
      description: null,
      function: null,
      location: null,
      related_components: null,
      safety_notes: null,
      cautions: null,
      to_refs: null,
      job_guide_refs: null,
      imi_links: null,
      animation_links: null,
      resolve_path_ids: null,
      label_type: 'interactive',
      validation_status: 'draft',
      content_owner: null,
      is_published: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
  }

  if (view.kind === 'editor') {
    return (
      <ComponentEditor
        component={view.component}
        onBack={() => {
          setView({ kind: 'list' })
          void load()
        }}
      />
    )
  }

  return (
    <div className="px-5 py-5 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm uppercase tracking-wide text-slate-500">Components</h2>
        <button
          onClick={() => setView({ kind: 'editor', component: newComponent() })}
          className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          + New
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm text-center py-8">Loading…</p>
      ) : components.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No components yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {components.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700"
            >
              <button onClick={() => setView({ kind: 'editor', component: c })} className="text-left flex-1">
                <p className="text-sm font-medium text-white">{c.name || '(untitled)'}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {c.aircraft || '—'}
                  {c.system ? ` · ${c.system}` : ''} · {c.area || '—'}
                  <span className={`ml-2 capitalize ${STATUS_STYLES[c.validation_status]}`}>
                    · {c.validation_status}
                  </span>
                  {c.is_published && <span className="ml-2 text-emerald-500">· published</span>}
                </p>
              </button>
              <button
                onClick={() => handleDelete(c)}
                className="text-xs text-slate-500 hover:text-rose-400 px-2 py-1"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
