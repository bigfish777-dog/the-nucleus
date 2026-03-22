import { createClient } from '@supabase/supabase-js'

// These will be set via environment variables in production
// For now using the Supabase project from the brief
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
