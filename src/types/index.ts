export type PipelineStage =
  | 'booked'
  | 'cancelled'
  | 'no_show'
  | 'disqualified'
  | 'spam'
  | 'test'
  | 'qualified'              // attended 1st call, proposal being built
  | 'second_call_booked'     // = proposal sent + 2nd call in diary
  | 'proposal_sent'          // proposal out, 2nd call booked (same thing)
  | 'proposal_live'          // 2nd call happened, still deciding
  | 'second_call_no_show'
  | 'closed_won'
  | 'closed_lost'
  | 'abandoned'              // gone cold after proposal

export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  website?: string
  industry?: string
  revenue_range?: string
  client_value?: string
  stage: PipelineStage
  opted_in_at: string
  booking_completed: boolean
  booked_at?: string
  call_datetime?: string
  call_timezone?: string
  call_notes_auto?: string
  call_notes_manual?: string
  second_call_datetime?: string
  proposal_sent: boolean
  proposal_sent_at?: string
  proposal_value?: number
  revenue?: number
  close_reason?: string
  last_contact_at?: string
  created_at: string
  updated_at: string
}

export interface AdCreative {
  id: string
  meta_creative_id?: string
  name: string
  utm_content_value: string
  hook_text?: string
  full_script?: string
  video_url?: string
  hook_type?: string
  iterated_from?: string
  status: 'active' | 'paused' | 'retired'
  launched_at?: string
  notes?: string
  created_at: string
}

export interface AdPerformanceDaily {
  id: string
  creative_id: string
  date: string
  spend: number
  impressions: number
  clicks: number
}
