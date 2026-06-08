// ojt-create-user — Supabase Edge Function
// Creates a Supabase Auth user + ojt_profiles row.
// Caller must be a supervisor or admin (verified via JWT + profiles lookup).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserPayload {
  manNumber: string
  displayName: string
  rank?: string
  role: 'trainee' | 'supervisor' | 'admin'
  aircraft?: string
  afsc?: string
  currentSkillLevel?: string
  targetSkillLevel?: string
  supervisorProfileId?: string
  workCenter?: string
  tempPassword: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- Auth: verify caller is supervisor or admin ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ message: 'Missing authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Caller client — uses caller's JWT to look up their profile
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) {
      return json({ message: 'Invalid or expired token' }, 401)
    }

    // Look up caller's profile to check role
    const { data: callerProfile, error: profileError } = await callerClient
      .from('ojt_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !callerProfile) {
      return json({ message: 'No OJT profile found for caller' }, 403)
    }

    if (!['supervisor', 'admin'].includes(callerProfile.role)) {
      return json({ message: 'Only supervisors and admins can create users' }, 403)
    }

    // --- Parse payload ---
    const payload: CreateUserPayload = await req.json()
    const { manNumber, displayName, role, tempPassword } = payload

    if (!manNumber || !displayName || !role || !tempPassword) {
      return json({ message: 'manNumber, displayName, role, and tempPassword are required' }, 400)
    }

    const email = `${manNumber.trim()}@ojt.internal`

    // --- Admin client for privileged operations ---
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Create Auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (createError || !newUser.user) {
      return json({ message: createError?.message ?? 'Failed to create auth user' }, 400)
    }

    // Insert profile row
    const { data: profile, error: insertError } = await adminClient
      .from('ojt_profiles')
      .insert({
        user_id: newUser.user.id,
        man_number: manNumber.trim(),
        display_name: displayName.trim(),
        rank: payload.rank?.trim() || null,
        role,
        aircraft: payload.aircraft || null,
        afsc: payload.afsc?.trim() || null,
        current_skill_level: payload.currentSkillLevel?.trim() || null,
        target_skill_level: payload.targetSkillLevel?.trim() || null,
        supervisor_id: payload.supervisorProfileId || null,
        work_center: payload.workCenter?.trim() || null,
      })
      .select()
      .single()

    if (insertError || !profile) {
      // Roll back: delete the auth user we just created
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      return json({ message: insertError?.message ?? 'Failed to create profile' }, 400)
    }

    return json({ profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return json({ message }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
