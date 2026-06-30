// Admin: edit all content-model fields for a component (PRD §15) and submit it
// for SME validation. Mirrors ojt/admin/ProcedureEditor's form-save pattern.

import { useState } from 'react'
import {
  ScanComponent,
  ScanLabelType,
  upsertComponent,
  submitForValidation,
} from '../db/scan'

interface Props {
  component: ScanComponent
  onBack: () => void
}

// Comma/newline-separated text <-> string[] helpers for list fields.
function toLines(arr: string[] | null): string {
  return (arr ?? []).join('\n')
}
function fromLines(text: string): string[] | null {
  const items = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  return items.length > 0 ? items : null
}

const AIRCRAFT_OPTIONS = ['C-130J', 'C-130H', 'C-17A', 'C-5M', 'F-15E', 'Other']

export function ComponentEditor({ component, onBack }: Props) {
  const [form, setForm] = useState({
    aircraft: component.aircraft,
    area: component.area,
    system: component.system ?? '',
    name: component.name,
    alternate_names: toLines(component.alternate_names),
    description: component.description ?? '',
    function: component.function ?? '',
    location: component.location ?? '',
    related_components: toLines(component.related_components),
    safety_notes: component.safety_notes ?? '',
    cautions: component.cautions ?? '',
    to_refs: toLines(component.to_refs),
    job_guide_refs: toLines(component.job_guide_refs),
    imi_links: toLines(component.imi_links),
    animation_links: toLines(component.animation_links),
    label_type: component.label_type as ScanLabelType,
    content_owner: component.content_owner ?? '',
    part_number: component.part_number ?? '',
    ocr_terms: toLines(component.ocr_terms),
  })
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save(): Promise<ScanComponent> {
    setSaving(true)
    try {
      const saved = await upsertComponent({
        id: component.id,
        aircraft: form.aircraft,
        area: form.area,
        system: form.system || null,
        name: form.name,
        alternate_names: fromLines(form.alternate_names),
        description: form.description || null,
        function: form.function || null,
        location: form.location || null,
        related_components: fromLines(form.related_components),
        safety_notes: form.safety_notes || null,
        cautions: form.cautions || null,
        to_refs: fromLines(form.to_refs),
        job_guide_refs: fromLines(form.job_guide_refs),
        imi_links: fromLines(form.imi_links),
        animation_links: fromLines(form.animation_links),
        label_type: form.label_type,
        content_owner: form.content_owner || null,
        part_number: form.part_number || null,
        ocr_terms: fromLines(form.ocr_terms),
      })
      setSavedId(saved.id)
      return saved
    } finally {
      setSaving(false)
    }
  }

  async function saveAndSubmit() {
    const saved = await save()
    await submitForValidation(saved.id)
    onBack()
  }

  const canSave = form.name.trim() && form.aircraft.trim() && form.area.trim()

  return (
    <div className="px-5 py-5 max-w-2xl mx-auto w-full">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white mb-4">
        ← Back
      </button>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Aircraft *">
          <select
            value={form.aircraft}
            onChange={(e) => set('aircraft', e.target.value)}
            className="input"
          >
            <option value="">Select…</option>
            {AIRCRAFT_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Area *">
          <input className="input" value={form.area} onChange={(e) => set('area', e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="System">
          <input className="input" value={form.system} onChange={(e) => set('system', e.target.value)} />
        </Field>
        <Field label="Label type">
          <select
            value={form.label_type}
            onChange={(e) => set('label_type', e.target.value as ScanLabelType)}
            className="input"
          >
            <option value="interactive">Interactive (opens card)</option>
            <option value="informational">Informational (name only)</option>
          </select>
        </Field>
      </div>

      <Field label="Name *">
        <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <TextArea label="Description" value={form.description} onChange={(v) => set('description', v)} />
      <TextArea label="Function / purpose" value={form.function} onChange={(v) => set('function', v)} />
      <TextArea label="Location" value={form.location} onChange={(v) => set('location', v)} />
      <TextArea label="Safety notes" value={form.safety_notes} onChange={(v) => set('safety_notes', v)} />
      <TextArea label="Cautions / warnings" value={form.cautions} onChange={(v) => set('cautions', v)} />

      <ListArea label="Alternate names (one per line)" value={form.alternate_names} onChange={(v) => set('alternate_names', v)} />
      <ListArea label="Related components (one per line)" value={form.related_components} onChange={(v) => set('related_components', v)} />
      <Field label="Part number">
        <input className="input" value={form.part_number} onChange={(e) => set('part_number', e.target.value)} />
      </Field>
      <ListArea label="OCR match terms (one per line — printed placard text that should match this component)" value={form.ocr_terms} onChange={(v) => set('ocr_terms', v)} />

      <ListArea label="Technical order refs (one per line)" value={form.to_refs} onChange={(v) => set('to_refs', v)} />
      <ListArea label="Job guide refs (one per line)" value={form.job_guide_refs} onChange={(v) => set('job_guide_refs', v)} />
      <ListArea label="IMI links (one URL per line)" value={form.imi_links} onChange={(v) => set('imi_links', v)} />
      <ListArea label="Animation links (one URL per line)" value={form.animation_links} onChange={(v) => set('animation_links', v)} />

      <Field label="Content owner">
        <input className="input" value={form.content_owner} onChange={(e) => set('content_owner', e.target.value)} />
      </Field>

      <div className="flex gap-2 mt-5">
        <button
          onClick={() => void save()}
          disabled={!canSave || saving}
          className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium text-sm"
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          onClick={() => void saveAndSubmit()}
          disabled={!canSave || saving}
          className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm"
        >
          Save & submit for SME validation
        </button>
      </div>
      {savedId && <p className="text-xs text-emerald-400 mt-2">Saved.</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  )
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <textarea className="input min-h-[64px]" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function ListArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <textarea className="input min-h-[56px] font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}
