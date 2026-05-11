// Fault Isolation training data — C-130 Electrical System
// Fault Code: 240115 — Aircraft will not accept external power.
// Source: Figure 3-7 (verbatim from Technical Order)
// Correct training path terminates at Block 181 (circuit breaker was pulled open).

export type Outcome = {
  kind: 'resolved' | 'escalate'
  message: string
}

export type Block = {
  id: string              // canonical: '<TO>/<figure>/<sheet>/<blockNumber>'
  technicalOrder: string
  figure: string
  sheet: string
  blockNumber: string
  text: string            // verbatim TO text
  sheetNotes?: string[]
  cautions?: string[]
  imageRef?: string       // path to training image in /public/figures/
  onYes?: string          // block ID to route to on YES
  onNo?: string           // block ID to route to on NO
  terminalKind?: 'resolved' | 'escalate'
  correctAnswer?: 'yes' | 'no'  // correct answer for scoring; undefined on terminal blocks
  stub?: true
}

export type FaultCode = {
  code: string
  description: string
  reference: string
  entry: string | null
}

const TO = 'TO-EXTPWR'
const FIG = '3-7'
const SHEET = '1'

export function bid(blockNumber: string): string {
  return `${TO}/${FIG}/${SHEET}/${blockNumber}`
}

function block(
  blockNumber: string,
  partial: Omit<Block, 'id' | 'technicalOrder' | 'figure' | 'sheet' | 'blockNumber'>,
): Block {
  const defaultImageRef = partial.imageRef ?? `/figures/${FIG}/blk-${blockNumber}.png`
  return {
    id: bid(blockNumber),
    technicalOrder: TO,
    figure: FIG,
    sheet: SHEET,
    blockNumber,
    ...partial,
    imageRef: defaultImageRef,
  }
}

// ── Fault codes ────────────────────────────────────────────────────────────

export const faultCodes: FaultCode[] = [
  {
    code: '240115',
    description: 'Aircraft will not accept external power.',
    reference: 'Perform Figure 3-1, Preparation A, then go to Figure 3-7, Block 167.',
    entry: bid('167'),
  },
]

// ── Decision tree — Figure 3-7 ─────────────────────────────────────────────
// Correct training path: 167(NO)→168(YES)→169(NO)→170(NO)→171(YES)→180(YES)→181

const _blocks: Block[] = [
  block('167', {
    text: 'In flight station, does external power available indicator illuminated?',
    correctAnswer: 'no',
    onYes: bid('172'),
    onNo: bid('168'),
  }),
  block('168', {
    text: 'Is power cart contact light illuminated?',
    correctAnswer: 'yes',
    onYes: bid('169'),
    onNo: bid('175'),
  }),
  block('169', {
    text: 'Shut down external power source. Is contamination present in connector pins?',
    correctAnswer: 'no',
    onYes: bid('178'),
    onNo: bid('170'),
  }),
  block('170', {
    text: 'Reseat power cable plug. Attempt to apply power IAW Figure 3-1, Preparation A. Did aircraft accept external power?',
    correctAnswer: 'no',
    onYes: bid('179'),
    onNo: bid('171'),
  }),
  block('171', {
    text: 'Is battery compartment circuit breaker pulled open?',
    correctAnswer: 'yes',
    onYes: bid('180'),
    onNo: bid('182'),
  }),
  block('172', {
    text: 'Check for 28 VDC to aircraft power switch. Is 28 VDC available?',
    onYes: bid('173'),
    onNo: bid('174'),
  }),
  block('173', {
    text: 'Replace aircraft power switch.',
    terminalKind: 'resolved',
  }),
  block('174', {
    text: 'Fault is in the wiring. Refer to wiring diagrams, and troubleshoot further.',
    terminalKind: 'escalate',
  }),
  block('175', {
    text: 'Shut down power unit. Reattempt generator start in accordance with generator operating instructions. Did contact light illuminate?',
    onYes: bid('176'),
    onNo: bid('177'),
  }),
  block('176', {
    text: 'No further troubleshooting required. Fault was a bad generator start.',
    terminalKind: 'resolved',
  }),
  block('177', {
    text: 'Fault is in external power generator. Refer to applicable maintenance procedures.',
    terminalKind: 'escalate',
  }),
  block('178', {
    text: 'Clean connector pins with approved solvents. No further troubleshooting required.',
    terminalKind: 'resolved',
  }),
  block('179', {
    text: 'No further troubleshooting required. Connector plug was not fully seated.',
    terminalKind: 'resolved',
  }),
  block('180', {
    text: 'Close circuit breaker. Attempt to apply power IAW Figure 3-1, Preparation A. Did aircraft accept external power?',
    correctAnswer: 'yes',
    onYes: bid('181'),
    onNo: bid('182'),
  }),
  block('181', {
    text: 'No further troubleshooting is required.',
    terminalKind: 'resolved',
  }),
  block('182', {
    text: 'Fault is in the wiring. Refer to wiring diagrams, and troubleshoot further.',
    terminalKind: 'escalate',
  }),
]

const blockMap = new Map(_blocks.map((b) => [b.id, b]))

export function getBlock(id: string): Block | undefined {
  return blockMap.get(id)
}

export function getFaultCode(code: string): FaultCode | undefined {
  return faultCodes.find((f) => f.code === code)
}

export function isTerminal(block: Block): boolean {
  return block.onYes === undefined && block.onNo === undefined
}

export const DEDUCTION_PER_WRONG_ANSWER = 10
