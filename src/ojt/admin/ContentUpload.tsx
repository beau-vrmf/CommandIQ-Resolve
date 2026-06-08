// @ts-nocheck -- Upgrade Training (PRD 1) — disconnected, kept for future build
import { useEffect, useState, useRef } from 'react'
import {
  OjtTask, TaskContent, ContentType,
  uploadTaskContent, deleteTaskContent,
  getSignedContentUrl,
} from '../../db/ojt'
import { supabase } from '../../db/supabase'

interface Props {
  task: OjtTask
  onBack: () => void
}

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'ppt', label: 'PowerPoint' },
  { value: 'video', label: 'Video' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'guide', label: 'Guide' },
  { value: 'link', label: 'External Link' },
]

export function ContentUpload({ task, onBack }: Props) {
  const [items, setItems] = useState<TaskContent[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contentType, setContentType] = useState<ContentType>('pdf')
  const [title, setTitle] = useState('')
  const [version, setVersion] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('ojt_task_content')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true })
      if (e) throw e
      setItems((data || []) as TaskContent[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [task.id])

  async function handleUpload() {
    if (!title) { setError('Title is required.'); return }
    if (contentType === 'link') {
      if (!externalUrl) { setError('URL is required for link type.'); return }
      setUploading(true)
      setError(null)
      try {
        const { error: e } = await supabase.from('ojt_task_content').insert({
          task_id: task.id,
          title,
          content_type: contentType,
          external_url: externalUrl,
          version: version || null,
          is_active: true,
        })
        if (e) throw e
        setTitle(''); setVersion(''); setExternalUrl('')
        void load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.')
      } finally {
        setUploading(false)
      }
      return
    }

    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Select a file to upload.'); return }
    setUploading(true)
    setError(null)
    try {
      await uploadTaskContent(task.id, file, { title, content_type: contentType, version: version || undefined })
      setTitle(''); setVersion('')
      if (fileRef.current) fileRef.current.value = ''
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove(item: TaskContent) {
    if (!confirm(`Remove "${item.title}"?`)) return
    try {
      await deleteTaskContent(item.id)
      void load()
    } catch {
      alert('Failed to remove.')
    }
  }

  async function handleOpen(item: TaskContent) {
    if (item.external_url) {
      window.open(item.external_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (item.file_path) {
      try {
        const url = await getSignedContentUrl(item.file_path)
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch {
        alert('Failed to open file.')
      }
    }
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'

  return (
    <div className="px-4 py-5 max-w-2xl mx-auto w-full">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-2 transition-colors"
      >
        ← Back to Tasks
      </button>

      <h2 className="text-base font-semibold text-white mb-1">{task.title}</h2>
      <p className="text-xs text-slate-400 mb-5">Manage training content for this task</p>

      {/* Upload form */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-white mb-3">Add Content</h3>
        <div className="flex flex-col gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Content title *" className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)} className={inputClass}>
              {CONTENT_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
            <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version (optional)" className={inputClass} />
          </div>
          {contentType === 'link' ? (
            <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" type="url" className={inputClass} />
          ) : (
            <input ref={fileRef} type="file" className="text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-300 file:text-sm file:cursor-pointer hover:file:bg-slate-600" />
          )}
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="mt-3 text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploading…' : 'Add Content'}
        </button>
      </div>

      {/* Existing content */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No content added yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 bg-slate-800 border rounded-xl ${item.is_active ? 'border-slate-700' : 'border-slate-800 opacity-50'}`}
            >
              <span className="text-xl">
                {contentType === 'pdf' ? '📄' : contentType === 'ppt' ? '📊' : contentType === 'video' ? '🎬' : contentType === 'link' ? '🔗' : '📋'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.title}</p>
                <p className="text-xs text-slate-500 capitalize">{item.content_type}{item.version ? ` · v${item.version}` : ''}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => handleOpen(item)} className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">Open</button>
                <button onClick={() => handleRemove(item)} className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-red-900 rounded-lg text-slate-400 hover:text-red-300 transition-colors">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
