import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://oirnxlidjgsbcyhtxkse.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── Lead operations ──────────────────────────────────────────────────────────
export async function updateLeadStage(id: string, stage: string, fromStage?: string) {
  const { error } = await supabase
    .from('leads')
    .update({ stage, updated_at: new Date().toISOString(), last_contact_at: new Date().toISOString() })
    .eq('id', id)

  if (!error && fromStage) {
    await supabase.from('stage_history').insert({
      lead_id: id, from_stage: fromStage, to_stage: stage, changed_by: 'manual'
    })
  }
  return { error }
}

export async function updateLeadNotes(id: string, notes: string) {
  const { error } = await supabase
    .from('leads')
    .update({ call_notes_manual: notes, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error }
}

export async function fetchLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function upsertLead(lead: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('leads')
    .upsert(lead, { onConflict: 'id' })
    .select()
  return { data, error }
}

export async function fetchAdPerformance() {
  const { data, error } = await supabase
    .from('ad_performance_daily')
    .select('*, ad_creatives(name, utm_content_value, hook_text, status)')
    .order('date', { ascending: false })
  return { data, error }
}

export async function fetchCreativeProductionItems() {
  const { data, error } = await supabase
    .from('creative_production_items')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function upsertCreativeProductionItem(item: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('creative_production_items')
    .upsert(item, { onConflict: 'id' })
    .select()
    .single()
  return { data, error }
}

export async function updateCreativeProductionStage(id: string, stage: string) {
  const { data, error } = await supabase
    .from('creative_production_items')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}
