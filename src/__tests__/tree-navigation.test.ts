import { describe, expect, it, beforeEach } from 'vitest'
import { bid, getBlock, getFaultCode } from '../data/fi-tree'
import { useSession } from '../store/session'

const B47 = bid('15', '47')
const B49 = bid('15', '49')
const B50 = bid('15', '50')
const B52 = bid('17', '52')
const B53 = bid('17', '53')
const B54 = bid('17', '54')
const B57 = bid('17', '57')
const B58 = bid('17', '58')

describe('FI tree navigation — fault 6110004 (Sheet 15)', () => {
  beforeEach(() => {
    useSession.setState({ active: null })
  })

  it('has the fault code wired to scoped block id 15/47', () => {
    const fc = getFaultCode('6110004')
    expect(fc).toBeDefined()
    expect(fc?.entry).toBe(B47)
    expect(getBlock(B47)).toBeDefined()
  })

  it('starts a session with the entry block as the first step', () => {
    const { startSession } = useSession.getState()
    startSession('6110004', B47)
    const a = useSession.getState().active!
    expect(a.steps).toHaveLength(1)
    expect(a.steps[0].blockId).toBe(B47)
    expect(a.steps[0].answer).toBeNull()
    expect(a.currentBlockId).toBe(B47)
  })

  it('walks the YES branch 47 → 50 (terminal: resolved)', () => {
    const { startSession, answer, completeTerminal } = useSession.getState()
    startSession('6110004', B47)

    const b47 = getBlock(B47)!
    answer(B47, 'yes', b47.onYes)
    let a = useSession.getState().active!
    expect(a.currentBlockId).toBe(B50)
    expect(a.steps).toHaveLength(2)

    const b50 = getBlock(B50)!
    expect(b50.onYes).toBeUndefined()
    expect(b50.onNo).toBeUndefined()
    completeTerminal(B50, { kind: b50.terminalKind!, message: b50.text })
    a = useSession.getState().active!
    expect(a.outcome?.kind).toBe('resolved')
    expect(a.steps.map((s) => s.blockId)).toEqual([B47, B50])
  })

  it('walks the NO branch 47 → 49 (terminal: resolved)', () => {
    const { startSession, answer, completeTerminal } = useSession.getState()
    startSession('6110004', B47)

    answer(B47, 'no', getBlock(B47)!.onNo)
    expect(useSession.getState().active?.currentBlockId).toBe(B49)

    const b49 = getBlock(B49)!
    completeTerminal(B49, { kind: b49.terminalKind!, message: b49.text })
    const a = useSession.getState().active!
    expect(a.outcome?.kind).toBe('resolved')
  })

  it('attaches notes and photos to the current block visit', () => {
    const { startSession, setNoteOnCurrent, addPhotoToCurrent, answer } = useSession.getState()
    startSession('6110004', B47)

    setNoteOnCurrent('observed unusual vibration')
    addPhotoToCurrent('photo-id-1')
    addPhotoToCurrent('photo-id-2')

    let a = useSession.getState().active!
    expect(a.steps[0].note).toBe('observed unusual vibration')
    expect(a.steps[0].photoIds).toEqual(['photo-id-1', 'photo-id-2'])

    answer(B47, 'yes', getBlock(B47)!.onYes)
    a = useSession.getState().active!
    expect(a.steps[0].note).toBe('observed unusual vibration')
    expect(a.steps[0].photoIds).toHaveLength(2)
    expect(a.steps[1].blockId).toBe(B50)
    expect(a.steps[1].note).toBeUndefined()
    expect(a.steps[1].photoIds).toEqual([])
  })
})

describe('FI tree navigation — fault 6110005 (Sheet 17)', () => {
  beforeEach(() => {
    useSession.setState({ active: null })
  })

  it('walks 52 → 57 (NO at 52 lands on terminal: resolved)', () => {
    const { startSession, answer, completeTerminal } = useSession.getState()
    startSession('6110005', B52)

    answer(B52, 'no', getBlock(B52)!.onNo)
    expect(useSession.getState().active?.currentBlockId).toBe(B57)

    const b57 = getBlock(B57)!
    completeTerminal(B57, { kind: b57.terminalKind!, message: b57.text })
    expect(useSession.getState().active?.outcome?.kind).toBe('resolved')
  })

  it('walks 52 → 53 → 58 (escalate to synchrophaser)', () => {
    const { startSession, answer, completeTerminal } = useSession.getState()
    startSession('6110005', B52)

    answer(B52, 'yes', getBlock(B52)!.onYes)
    expect(useSession.getState().active?.currentBlockId).toBe(B53)

    answer(B53, 'no', getBlock(B53)!.onNo)
    expect(useSession.getState().active?.currentBlockId).toBe(B58)

    const b58 = getBlock(B58)!
    completeTerminal(B58, { kind: b58.terminalKind!, message: b58.text })
    const a = useSession.getState().active!
    expect(a.outcome?.kind).toBe('escalate')
    expect(a.steps.map((s) => s.blockId)).toEqual([B52, B53, B58])
  })

  it('walks 52 → 53 → 54 (decision continues into authored tree)', () => {
    const { startSession, answer } = useSession.getState()
    startSession('6110005', B52)
    answer(B52, 'yes', getBlock(B52)!.onYes)
    answer(B53, 'yes', getBlock(B53)!.onYes)
    expect(useSession.getState().active?.currentBlockId).toBe(B54)
  })
})

describe('FI tree navigation — Sheet 19 / Sheet 21 cross-sheet jumps', () => {
  beforeEach(() => {
    useSession.setState({ active: null })
  })

  it('block 55 YES jumps to Sheet 19 entry block 61', () => {
    const b55 = getBlock(bid('17', '55'))!
    expect(b55.onYes).toBe(bid('19', '61'))
    expect(getBlock(bid('19', '61'))).toBeDefined()
  })

  it('walks Sheet 19 happy path 61 → 62 → 63 → Sheet 21 entry 65', () => {
    const { startSession, answer } = useSession.getState()
    startSession('6110005', bid('19', '61'))

    answer(bid('19', '61'), 'no', getBlock(bid('19', '61'))!.onNo)
    expect(useSession.getState().active?.currentBlockId).toBe(bid('19', '62'))

    answer(bid('19', '62'), 'yes', getBlock(bid('19', '62'))!.onYes)
    expect(useSession.getState().active?.currentBlockId).toBe(bid('19', '63'))

    answer(bid('19', '63'), 'yes', getBlock(bid('19', '63'))!.onYes)
    expect(useSession.getState().active?.currentBlockId).toBe(bid('21', '65'))
  })

  it('walks Sheet 21 to terminal block 70 (propeller system normal)', () => {
    const { startSession, answer, completeTerminal } = useSession.getState()
    startSession('6110005', bid('21', '65'))

    answer(bid('21', '65'), 'yes', getBlock(bid('21', '65'))!.onYes) // → 66
    answer(bid('21', '66'), 'yes', getBlock(bid('21', '66'))!.onYes) // → 67
    answer(bid('21', '67'), 'yes', getBlock(bid('21', '67'))!.onYes) // → 68
    answer(bid('21', '68'), 'no', getBlock(bid('21', '68'))!.onNo) // → 70

    const b70 = getBlock(bid('21', '70'))!
    completeTerminal(bid('21', '70'), { kind: b70.terminalKind!, message: b70.text })
    const a = useSession.getState().active!
    expect(a.outcome?.kind).toBe('resolved')
    expect(a.outcome?.message).toBe('Propeller system is normal. Secure system.')
  })

  it('block 63 carries a CAUTION callout', () => {
    const b63 = getBlock(bid('19', '63'))!
    expect(b63.cautions).toEqual(['Keep pitchlock time to a minimum.'])
  })
})

describe('FI tree navigation — Back button (goBack)', () => {
  beforeEach(() => {
    useSession.setState({ active: null })
  })

  it('does nothing when only the entry step exists', () => {
    const { startSession, goBack } = useSession.getState()
    startSession('6110004', B47)
    const before = useSession.getState().active!
    goBack()
    const after = useSession.getState().active!
    expect(after.steps).toHaveLength(1)
    expect(after.currentBlockId).toBe(before.currentBlockId)
  })

  it('pops the current block visit and clears the previous answer', () => {
    const { startSession, answer, goBack } = useSession.getState()
    startSession('6110004', B47)
    answer(B47, 'yes', getBlock(B47)!.onYes)
    let a = useSession.getState().active!
    expect(a.currentBlockId).toBe(B50)
    expect(a.steps[0].answer).toBe('yes')

    goBack()
    a = useSession.getState().active!
    expect(a.currentBlockId).toBe(B47)
    expect(a.steps).toHaveLength(1)
    expect(a.steps[0].answer).toBeNull()
  })

  it('discards notes/photos on the current block when going back', () => {
    const { startSession, answer, setNoteOnCurrent, addPhotoToCurrent, goBack } =
      useSession.getState()
    startSession('6110005', B52)
    answer(B52, 'yes', getBlock(B52)!.onYes) // → 53
    setNoteOnCurrent('test note on 53')
    addPhotoToCurrent('p1')
    let a = useSession.getState().active!
    expect(a.steps[1].note).toBe('test note on 53')
    expect(a.steps[1].photoIds).toEqual(['p1'])

    goBack()
    a = useSession.getState().active!
    expect(a.currentBlockId).toBe(B52)
    expect(a.steps).toHaveLength(1)
    expect(a.steps[0].answer).toBeNull()
  })

  it('preserves notes/photos on the prior step after going back', () => {
    const { startSession, setNoteOnCurrent, answer, goBack } = useSession.getState()
    startSession('6110004', B47)
    setNoteOnCurrent('observed something on 47')
    answer(B47, 'yes', getBlock(B47)!.onYes) // → 50

    goBack()
    const a = useSession.getState().active!
    expect(a.currentBlockId).toBe(B47)
    expect(a.steps[0].note).toBe('observed something on 47')
    expect(a.steps[0].answer).toBeNull()
  })
})

describe('FI tree navigation — terminal verification', () => {
  beforeEach(() => {
    useSession.setState({ active: null })
  })

  it('"Yes — fix worked" produces a resolved outcome', () => {
    const { startSession, answer, completeTerminal } = useSession.getState()
    startSession('6110004', B47)
    answer(B47, 'yes', getBlock(B47)!.onYes) // → 50

    const b50 = getBlock(B50)!
    completeTerminal(B50, { kind: 'resolved', message: b50.text })
    expect(useSession.getState().active?.outcome?.kind).toBe('resolved')
  })

  it('"No — fix didn\'t work" escalates a resolved-terminal block', () => {
    const { startSession, answer, completeTerminal } = useSession.getState()
    startSession('6110004', B47)
    answer(B47, 'yes', getBlock(B47)!.onYes) // → 50 (terminal: resolved)

    const b50 = getBlock(B50)!
    const failMsg = `Documented fix did not resolve the issue. Escalate to next-level troubleshooting. Original step: ${b50.text}`
    completeTerminal(B50, { kind: 'escalate', message: failMsg })
    const a = useSession.getState().active!
    expect(a.outcome?.kind).toBe('escalate')
    expect(a.outcome?.message).toContain('Documented fix did not resolve the issue')
  })
})
