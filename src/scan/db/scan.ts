// CommandIQ Scan — all Supabase reads/writes + types.
// Mirrors the patterns in src/db/ojt.ts. Reuses the shared Supabase client and
// the ojt_profiles role model (no second identity system).

import { supabase } from '../../db/supabase'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScanLabelType = 'informational' | 'interactive'
export type ScanValidationStatus = 'draft' | 'submitted' | 'approved' | 'returned'

// Maps to the PRD content model (§15).
export interface ScanComponent {
  id: string
  aircraft: string
  area: string
  system: string | null
  name: string
  alternate_names: string[] | null
  description: string | null
  function: string | null
  location: string | null
  related_components: string[] | null
  safety_notes: string | null
  cautions: string | null
  to_refs: string[] | null
  job_guide_refs: string[] | null
  imi_links: string[] | null
  animation_links: string[] | null
  resolve_path_ids: string[] | null
  label_type: ScanLabelType
  validation_status: ScanValidationStatus
  content_owner: string | null
  is_published: boolean
  updated_at: string
  created_at: string
}

export interface ScanArea {
  id: string
  aircraft: string
  area: string
  system: string | null
  sort_order: number
  is_active: boolean
  // For reference-image scan mode: a fixed photo of the area used as the scan
  // backdrop. When null, the area uses live-camera mode instead.
  reference_image_url: string | null
}

// Decouples the recognition model from content: detector emits a class_label,
// which maps to a component. Retrain/relabel without touching content rows.
// pos_* are the hotspot box (normalized 0..1) for reference-image / guided modes.
export interface ScanDetection {
  id: string
  class_label: string
  component_id: string
  aircraft: string
  area: string
  pos_x: number | null
  pos_y: number | null
  pos_w: number | null
  pos_h: number | null
}

// A component placed at a position over the reference image (or camera frame).
export interface Hotspot {
  component: ScanComponent
  bbox: { x: number; y: number; width: number; height: number }
}

export interface ReferenceScanData {
  area: ScanArea
  hotspots: Hotspot[]
}

// ─── Public reads (published rows only; no auth required) ─────────────────────

export async function getAreas(aircraft?: string): Promise<ScanArea[]> {
  let query = supabase
    .from('scan_areas')
    .select('*')
    .eq('is_active', true)
    .order('aircraft', { ascending: true })
    .order('sort_order', { ascending: true })
  if (aircraft) query = query.eq('aircraft', aircraft)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as ScanArea[]
}

export async function getPublishedComponents(
  aircraft: string,
  area: string,
): Promise<ScanComponent[]> {
  const { data, error } = await supabase
    .from('scan_components')
    .select('*')
    .eq('is_published', true)
    .eq('aircraft', aircraft)
    .eq('area', area)
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []) as ScanComponent[]
}

// Search/browse without the camera (FR 12.9). Matches name, system, area, refs.
export async function searchComponents(term: string): Promise<ScanComponent[]> {
  const t = term.trim()
  let query = supabase.from('scan_components').select('*').eq('is_published', true)
  if (t) {
    query = query.or(
      `name.ilike.%${t}%,system.ilike.%${t}%,area.ilike.%${t}%,aircraft.ilike.%${t}%`,
    )
  }
  const { data, error } = await query.order('name', { ascending: true }).limit(200)
  if (error) throw error
  return (data || []) as ScanComponent[]
}

// Maps detector class labels → published components for a given area.
export async function getDetectionMap(
  aircraft: string,
  area: string,
): Promise<Map<string, ScanComponent>> {
  const [{ data: dets, error: de }, components] = await Promise.all([
    supabase
      .from('scan_detections')
      .select('*')
      .eq('aircraft', aircraft)
      .eq('area', area),
    getPublishedComponents(aircraft, area),
  ])
  if (de) throw de
  const byId = new Map(components.map((c) => [c.id, c]))
  const map = new Map<string, ScanComponent>()
  for (const d of (dets || []) as ScanDetection[]) {
    const comp = byId.get(d.component_id)
    if (comp) map.set(d.class_label, comp)
  }
  return map
}

// Reference-image scan: the area's backdrop photo + each component's hotspot.
export async function getReferenceScan(
  aircraft: string,
  area: string,
): Promise<ReferenceScanData | null> {
  const { data: areaRow, error: ae } = await supabase
    .from('scan_areas')
    .select('*')
    .eq('aircraft', aircraft)
    .eq('area', area)
    .limit(1)
    .maybeSingle()
  if (ae) throw ae
  if (!areaRow || !(areaRow as ScanArea).reference_image_url) return null

  const [{ data: dets, error: de }, components] = await Promise.all([
    supabase.from('scan_detections').select('*').eq('aircraft', aircraft).eq('area', area),
    getPublishedComponents(aircraft, area),
  ])
  if (de) throw de

  const byId = new Map(components.map((c) => [c.id, c]))
  const hotspots: Hotspot[] = []
  for (const d of (dets || []) as ScanDetection[]) {
    const component = byId.get(d.component_id)
    if (!component || d.pos_x == null || d.pos_y == null) continue
    hotspots.push({
      component,
      bbox: { x: d.pos_x, y: d.pos_y, width: d.pos_w ?? 0.06, height: d.pos_h ?? 0.08 },
    })
  }
  return { area: areaRow as ScanArea, hotspots }
}

// ─── Admin reads/writes (RLS restricts writes to admin/SME roles) ─────────────

export async function getAllComponents(): Promise<ScanComponent[]> {
  const { data, error } = await supabase
    .from('scan_components')
    .select('*')
    .order('aircraft', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []) as ScanComponent[]
}

export async function upsertComponent(
  payload: Partial<ScanComponent> & { name: string; aircraft: string; area: string },
): Promise<ScanComponent> {
  const { data, error } = await supabase
    .from('scan_components')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as ScanComponent
}

export async function deleteComponent(componentId: string): Promise<void> {
  const { error } = await supabase.from('scan_components').delete().eq('id', componentId)
  if (error) throw error
}

// ─── SME validation workflow (mirrors ojt review queue) ───────────────────────

export async function getValidationQueue(): Promise<ScanComponent[]> {
  const { data, error } = await supabase
    .from('scan_components')
    .select('*')
    .eq('validation_status', 'submitted')
    .order('updated_at', { ascending: true })
  if (error) throw error
  return (data || []) as ScanComponent[]
}

export async function getPendingValidationCount(): Promise<number> {
  const { count } = await supabase
    .from('scan_components')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'submitted')
  return count ?? 0
}

export async function submitForValidation(componentId: string): Promise<void> {
  const { error } = await supabase
    .from('scan_components')
    .update({ validation_status: 'submitted' })
    .eq('id', componentId)
  if (error) throw error
}

// SME approve → publishes; return → sends back to author as draft-with-feedback.
export async function reviewComponent(
  componentId: string,
  decision: 'approved' | 'returned',
): Promise<void> {
  const patch =
    decision === 'approved'
      ? { validation_status: 'approved' as const, is_published: true }
      : { validation_status: 'returned' as const, is_published: false }
  const { error } = await supabase.from('scan_components').update(patch).eq('id', componentId)
  if (error) throw error
}
