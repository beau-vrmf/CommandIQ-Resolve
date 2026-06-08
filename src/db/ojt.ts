// OJT Guided Procedure Training — all database operations.
// Auth note: man numbers are stored as {manNumber}@ojt.internal in Supabase Auth.

import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OjtRole = 'trainee' | 'supervisor' | 'admin'
export type ConfirmationType = 'complete' | 'not_complete' | 'need_assistance' | 'not_applicable'
export type SubmissionStatus = 'in_progress' | 'submitted' | 'approved' | 'returned' | 'incomplete' | 'retrain'
export type ReviewDecision = 'approved' | 'returned' | 'incomplete' | 'retrain'
export type PhotoReviewStatus = 'pending' | 'approved' | 'rejected'
export type KcType = 'yes_no' | 'multiple_choice'

export interface OjtProfile {
  id: string
  user_id: string
  man_number: string
  display_name: string
  rank: string | null
  role: OjtRole
  aircraft: string | null
  afsc: string | null
  current_skill_level: string | null
  target_skill_level: string | null
  supervisor_id: string | null
  work_center: string | null
  training_start_date: string | null
  training_due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OjtProcedure {
  id: string
  title: string
  aircraft: string
  afsc: string | null
  skill_level: string | null
  procedure_category: string | null
  estimated_minutes: number | null
  required_tools: string | null
  required_references: string | null
  safety_warnings: string | null
  cautions: string | null
  notes: string | null
  version: string
  is_active: boolean
  created_at: string
}

export interface OjtProcedureStep {
  id: string
  procedure_id: string
  step_number: number
  instruction: string
  warning: string | null
  caution: string | null
  note: string | null
  image_path: string | null
  requires_confirmation: boolean
  is_critical: boolean
  photo_required: boolean
  photo_instructions: string | null
  kc_question: string | null
  kc_type: KcType | null
  kc_options: string[] | null
  kc_correct_answer: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface OjtSubmission {
  id: string
  profile_id: string
  procedure_id: string
  status: SubmissionStatus
  started_at: string
  submitted_at: string | null
  reviewer_id: string | null
  review_decision: ReviewDecision | null
  reviewer_comments: string | null
  reviewed_at: string | null
  created_at: string
}

export interface OjtSubmissionStep {
  id: string
  submission_id: string
  step_id: string
  confirmation: ConfirmationType | null
  kc_response: string | null
  kc_correct: boolean | null
  photo_path: string | null
  photo_submitted_at: string | null
  photo_review_status: PhotoReviewStatus | null
  photo_review_comments: string | null
  responded_at: string | null
}

export interface ProcedureWithSteps {
  procedure: OjtProcedure
  steps: OjtProcedureStep[]
}

export interface SubmissionDetail {
  submission: OjtSubmission
  procedure: OjtProcedure
  profile: OjtProfile
  steps: Array<OjtProcedureStep & { response: OjtSubmissionStep | null }>
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export function manNumberToEmail(manNumber: string): string {
  return `${manNumber.trim().toLowerCase()}@ojt.internal`
}

export async function signIn(manNumber: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: manNumberToEmail(manNumber),
    password,
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  return supabase.auth.getSession()
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getMyProfile(userId: string): Promise<OjtProfile | null> {
  const { data, error } = await supabase
    .from('ojt_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as OjtProfile
}

// ─── Trainee — procedures ─────────────────────────────────────────────────────

export async function getProcedures(profile: OjtProfile): Promise<OjtProcedure[]> {
  let query = supabase
    .from('ojt_procedures')
    .select('*')
    .eq('is_active', true)
    .order('aircraft', { ascending: true })
    .order('title', { ascending: true })

  // Filter by profile attributes if set
  if (profile.aircraft) query = query.eq('aircraft', profile.aircraft)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as OjtProcedure[]
}

export async function getAllProcedures(): Promise<OjtProcedure[]> {
  const { data, error } = await supabase
    .from('ojt_procedures')
    .select('*')
    .order('aircraft', { ascending: true })
    .order('title', { ascending: true })
  if (error) throw error
  return (data || []) as OjtProcedure[]
}

export async function getProcedureWithSteps(procedureId: string): Promise<ProcedureWithSteps> {
  const [{ data: proc, error: pe }, { data: steps, error: se }] = await Promise.all([
    supabase.from('ojt_procedures').select('*').eq('id', procedureId).single(),
    supabase
      .from('ojt_procedure_steps')
      .select('*')
      .eq('procedure_id', procedureId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])
  if (pe) throw pe
  if (se) throw se
  return {
    procedure: proc as OjtProcedure,
    steps: (steps || []) as OjtProcedureStep[],
  }
}

// ─── Trainee — submissions ────────────────────────────────────────────────────

export async function getActiveSubmission(
  profileId: string,
  procedureId: string,
): Promise<OjtSubmission | null> {
  const { data, error } = await supabase
    .from('ojt_submissions')
    .select('*')
    .eq('profile_id', profileId)
    .eq('procedure_id', procedureId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data && data.length > 0 ? (data[0] as OjtSubmission) : null
}

export async function startSubmission(
  profileId: string,
  procedureId: string,
): Promise<OjtSubmission> {
  const { data, error } = await supabase
    .from('ojt_submissions')
    .insert({ profile_id: profileId, procedure_id: procedureId, status: 'in_progress' })
    .select()
    .single()
  if (error) throw error
  return data as OjtSubmission
}

export async function getSubmissionSteps(submissionId: string): Promise<OjtSubmissionStep[]> {
  const { data, error } = await supabase
    .from('ojt_submission_steps')
    .select('*')
    .eq('submission_id', submissionId)
  if (error) throw error
  return (data || []) as OjtSubmissionStep[]
}

export async function upsertStepResponse(
  submissionId: string,
  stepId: string,
  patch: Partial<
    Pick<
      OjtSubmissionStep,
      | 'confirmation'
      | 'kc_response'
      | 'kc_correct'
      | 'photo_path'
      | 'photo_submitted_at'
      | 'photo_review_status'
      | 'responded_at'
    >
  >,
) {
  const { error } = await supabase.from('ojt_submission_steps').upsert(
    {
      submission_id: submissionId,
      step_id: stepId,
      responded_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: 'submission_id,step_id' },
  )
  if (error) throw error
}

export async function uploadStepPhoto(
  submissionId: string,
  stepId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const filePath = `submissions/${submissionId}/steps/${stepId}-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('ojt-content')
    .upload(filePath, file, { upsert: true })
  if (uploadError) throw uploadError

  const now = new Date().toISOString()
  await upsertStepResponse(submissionId, stepId, {
    photo_path: filePath,
    photo_submitted_at: now,
    photo_review_status: 'pending',
  })
  return filePath
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('ojt-content')
    .createSignedUrl(filePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function submitProcedure(submissionId: string): Promise<void> {
  const { error } = await supabase
    .from('ojt_submissions')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', submissionId)
  if (error) throw error
}

export async function getMySubmissions(profileId: string): Promise<OjtSubmission[]> {
  const { data, error } = await supabase
    .from('ojt_submissions')
    .select('*')
    .eq('profile_id', profileId)
    .order('started_at', { ascending: false })
  if (error) throw error
  return (data || []) as OjtSubmission[]
}

// ─── Supervisor/Admin — review queue ─────────────────────────────────────────

export async function getReviewQueue(): Promise<
  Array<OjtSubmission & { procedure: OjtProcedure; profile: OjtProfile }>
> {
  const { data, error } = await supabase
    .from('ojt_submissions')
    .select('*, procedure:ojt_procedures(*), profile:ojt_profiles(*)')
    .in('status', ['submitted', 'returned', 'approved', 'incomplete', 'retrain'])
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data || []) as Array<OjtSubmission & { procedure: OjtProcedure; profile: OjtProfile }>
}

export async function getSubmissionDetail(submissionId: string): Promise<SubmissionDetail> {
  const { data: sub, error: se } = await supabase
    .from('ojt_submissions')
    .select('*, procedure:ojt_procedures(*), profile:ojt_profiles(*)')
    .eq('id', submissionId)
    .single()
  if (se) throw se

  const [{ data: steps }, { data: responses }] = await Promise.all([
    supabase
      .from('ojt_procedure_steps')
      .select('*')
      .eq('procedure_id', (sub as { procedure: OjtProcedure }).procedure.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('ojt_submission_steps')
      .select('*')
      .eq('submission_id', submissionId),
  ])

  const responseByStep = new Map<string, OjtSubmissionStep>()
  for (const r of (responses || []) as OjtSubmissionStep[]) {
    responseByStep.set(r.step_id, r)
  }

  return {
    submission: sub as OjtSubmission,
    procedure: (sub as { procedure: OjtProcedure }).procedure,
    profile: (sub as { profile: OjtProfile }).profile,
    steps: (steps || []).map((s: OjtProcedureStep) => ({
      ...s,
      response: responseByStep.get(s.id) ?? null,
    })),
  }
}

export async function reviewSubmission(
  submissionId: string,
  reviewerId: string,
  decision: ReviewDecision,
  comments: string,
): Promise<void> {
  const { error } = await supabase
    .from('ojt_submissions')
    .update({
      status: decision,
      review_decision: decision,
      reviewer_id: reviewerId,
      reviewer_comments: comments,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
  if (error) throw error
}

export async function reviewStepPhoto(
  submissionStepId: string,
  decision: 'approved' | 'rejected',
  comments: string,
): Promise<void> {
  const { error } = await supabase
    .from('ojt_submission_steps')
    .update({ photo_review_status: decision, photo_review_comments: comments })
    .eq('id', submissionStepId)
  if (error) throw error
}

// ─── Admin — procedure content management ─────────────────────────────────────

export async function upsertProcedure(
  payload: Partial<OjtProcedure> & { title: string; aircraft: string },
): Promise<OjtProcedure> {
  const { data, error } = await supabase
    .from('ojt_procedures')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as OjtProcedure
}

export async function getStepsForProcedure(procedureId: string): Promise<OjtProcedureStep[]> {
  const { data, error } = await supabase
    .from('ojt_procedure_steps')
    .select('*')
    .eq('procedure_id', procedureId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data || []) as OjtProcedureStep[]
}

export async function upsertStep(
  payload: Partial<OjtProcedureStep> & { procedure_id: string; instruction: string },
): Promise<OjtProcedureStep> {
  const { data, error } = await supabase
    .from('ojt_procedure_steps')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as OjtProcedureStep
}

export async function deleteProcedure(procedureId: string): Promise<void> {
  const { error } = await supabase
    .from('ojt_procedures')
    .delete()
    .eq('id', procedureId)
  if (error) throw error
}

export async function deleteStep(stepId: string): Promise<void> {
  const { error } = await supabase
    .from('ojt_procedure_steps')
    .update({ is_active: false })
    .eq('id', stepId)
  if (error) throw error
}

export async function uploadStepImage(stepId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const filePath = `steps/${stepId}/ref-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('ojt-content')
    .upload(filePath, file, { upsert: true })
  if (error) throw error
  // Update step with new image path
  await supabase.from('ojt_procedure_steps').update({ image_path: filePath }).eq('id', stepId)
  return filePath
}

// ─── Admin — user management ──────────────────────────────────────────────────

export async function getAllProfiles(): Promise<OjtProfile[]> {
  const { data, error } = await supabase
    .from('ojt_profiles')
    .select('*')
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data || []) as OjtProfile[]
}

export async function updateProfile(
  profileId: string,
  patch: Partial<Omit<OjtProfile, 'id' | 'user_id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('ojt_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', profileId)
  if (error) throw error
}

export async function createUserViaEdgeFunction(payload: {
  manNumber: string
  displayName: string
  rank?: string
  role: OjtRole
  aircraft?: string
  afsc?: string
  currentSkillLevel?: string
  targetSkillLevel?: string
  supervisorProfileId?: string
  workCenter?: string
  tempPassword: string
}): Promise<OjtProfile> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ojt-create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((err as { message: string }).message || 'Failed to create user')
  }
  const data = await res.json()
  return (data as { profile: OjtProfile }).profile
}
