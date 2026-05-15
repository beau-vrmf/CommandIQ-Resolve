import { supabase } from './supabase'
import { getPhoto } from './sessions'
import type { ActiveSession } from '../store/session'
import { getBlock } from '../data/fi-tree'

export async function syncSession(session: ActiveSession): Promise<void> {
  if (!session.outcome) return

  const { error: sErr } = await supabase.from('sessions').upsert({
    id:           session.id,
    fault_code:   session.faultCode,
    entry_block:  session.entryBlockId,
    started_at:   new Date(session.startedAt).toISOString(),
    elapsed_ms:   session.elapsedMs,
    outcome_kind: session.outcome.kind,
    outcome_msg:  session.outcome.message,
  })
  if (sErr) { console.error('sync:session', sErr); return }

  for (const step of session.steps) {
    const block = getBlock(step.blockId)
    const { error: stErr } = await supabase.from('steps').upsert({
      id:           `${session.id}::${step.blockId}`,
      session_id:   session.id,
      block_id:     step.blockId,
      fault_code:   session.faultCode,
      sheet:        block?.sheet       ?? '',
      block_number: block?.blockNumber ?? '',
      answer:       step.answer,
      entered_at:   new Date(step.enteredAt).toISOString(),
      answered_at:  step.answeredAt ? new Date(step.answeredAt).toISOString() : null,
      note:         step.note ?? null,
      photo_count:  step.photoIds.length,
    })
    if (stErr) { console.error('sync:step', step.blockId, stErr); continue }

    for (const photoId of step.photoIds) {
      const blob = await getPhoto(photoId)
      if (!blob) continue
      const { error: pErr } = await supabase.storage
        .from('photos')
        .upload(`${photoId}.jpg`, blob, { contentType: 'image/jpeg', upsert: true })
      if (pErr) console.error('sync:photo', photoId, pErr)
    }
  }
}
