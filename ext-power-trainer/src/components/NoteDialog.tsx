import { useCallback, useEffect, useState } from 'react'
import { useSpeechToText } from '../hooks/useSpeechToText'

type Props = {
  open: boolean
  initial?: string
  onClose: () => void
  onSave: (note: string) => void
}

export function NoteDialog({ open, initial, onClose, onSave }: Props) {
  const [value, setValue] = useState(initial ?? '')

  const appendFinal = useCallback((chunk: string) => {
    const trimmed = chunk.trim()
    if (!trimmed) return
    setValue((prev) => {
      if (!prev) return trimmed
      const sep = /[.!?]\s*$/.test(prev) ? ' ' : prev.endsWith(' ') ? '' : ' '
      return prev + sep + trimmed
    })
  }, [])

  const { isSupported, isListening, interim, error, toggle, stop } = useSpeechToText({
    onFinal: appendFinal,
  })

  useEffect(() => {
    if (open) setValue(initial ?? '')
  }, [open, initial])

  useEffect(() => {
    if (!open && isListening) stop()
  }, [open, isListening, stop])

  const handleClose = () => {
    if (isListening) stop()
    onClose()
  }

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add note</h2>
          {isSupported && (
            <button
              onClick={toggle}
              aria-pressed={isListening}
              aria-label={isListening ? 'Stop dictation' : 'Start dictation'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              {isListening ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-200 animate-pulse" aria-hidden="true" />
                  Listening… tap to stop
                </>
              ) : (
                <>🎤 Dictate</>
              )}
            </button>
          )}
        </div>

        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
          placeholder="What did you observe? Alternative fix? Gotcha?"
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        {isListening && (
          <div className="bg-slate-900/60 border border-rose-700/50 rounded-lg px-3 py-2 text-sm text-rose-100 italic min-h-[2.25rem]">
            {interim || <span className="text-slate-500">Listening for speech…</span>}
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-300">
            Dictation error: {error}
            {error === 'not-allowed' && ' — microphone permission was denied.'}
            {error === 'network' && ' — speech recognition needs an internet connection.'}
          </p>
        )}

        {!isSupported && (
          <p className="text-xs text-slate-500">
            Dictation isn't available in this browser. Try Chrome, Edge, or Safari on iOS 14.5+.
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={handleClose} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600">
            Cancel
          </button>
          <button
            onClick={() => {
              if (isListening) stop()
              onSave(value.trim())
              onClose()
            }}
            disabled={!value.trim()}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
