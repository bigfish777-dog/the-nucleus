import type { Lead, AdCreative, AdPerformanceDaily } from '../types'

// Realistic dummy data for Phase 0
export const SEED_CREATIVES: AdCreative[] = [
  { id: 'c1', name: 'Hook 3B — Not Another Agency', utm_content_value: 'hook-3b', hook_text: "Most agencies send you a strategy doc. Then disappear.", hook_type: 'direct_response', status: 'active', launched_at: '2026-01-15', created_at: '2026-01-15', full_script: "Most agencies send you a strategy doc. Then disappear.\n\nCoaching programmes give you clarity. Then leave you to implement it yourself.\n\nWe're not that.\n\nWe work with you like a fractional marketing department.\n\nStrategy, copy, tech, emails, campaigns. Done. Not taught.\n\nIf you're doing £500K plus and you want marketing that actually happens, hit the link." },
  { id: 'c2', name: 'Hook 3C — Bottleneck Variation', utm_content_value: 'hook-3c', hook_text: "Stop being the bottleneck in your own marketing.", hook_type: 'direct_response', status: 'active', launched_at: '2026-02-01', created_at: '2026-02-01', iterated_from: 'c1', full_script: "Stop being the bottleneck in your own marketing.\n\nIf every campaign, every email, every ad has to run through you before it goes anywhere — that's not a marketing problem. That's a capacity problem.\n\nWe fix that.\n\nFractional marketing department. Strategy AND execution. All of it." },
  { id: 'c3', name: 'Hook 4A — £500K Revenue', utm_content_value: 'hook-4a', hook_text: "If your business does £500K+ and marketing still runs through you personally...", hook_type: 'qualifier', status: 'active', launched_at: '2026-02-20', created_at: '2026-02-20', full_script: "If your business does £500K+ and marketing still runs through you personally...\n\nYou've outgrown the DIY phase. You just haven't replaced it yet.\n\nLet's fix that." },
  { id: 'c4', name: 'Hook 2A — Agencies Disappear (old)', utm_content_value: 'hook-2a', hook_text: "Agencies disappear after sending the strategy doc.", hook_type: 'direct_response', status: 'paused', launched_at: '2025-11-01', created_at: '2025-11-01', full_script: "Old hook — paused after 6 weeks." },
  { id: 'c5', name: 'Hook 5A — Testimonial Lead', utm_content_value: 'hook-5a', hook_text: "She went from £700k to 7 figures in 14 months.", hook_type: 'testimonial', status: 'active', launched_at: '2026-03-01', created_at: '2026-03-01', full_script: "She went from £700k to 7 figures in 14 months.\n\nNot by working harder. By finally having a marketing team that actually did the work.\n\nThat's what we do." },
]

export const SEED_LEADS: Lead[] = [
  { id: 'l1', name: 'Sarah Mitchell', email: 'sarah@mitchellcoaching.co.uk', phone: '07700900001', utm_content: 'hook-3b', utm_campaign: 'uk-b2b-jan26', industry: 'Coaching', revenue_range: '£500k-£1M', stage: 'closed_won', opted_in_at: '2026-01-20T09:30:00Z', booking_completed: true, booked_at: '2026-01-20T09:45:00Z', call_datetime: '2026-01-22T10:00:00Z', proposal_sent: true, proposal_value: 2995, revenue: 2995, last_contact_at: '2026-01-28T14:00:00Z', created_at: '2026-01-20T09:30:00Z', updated_at: '2026-01-28T14:00:00Z' },
  { id: 'l2', name: 'James Hartley', email: 'james@hartleyconsulting.com', phone: '07700900002', utm_content: 'hook-3b', utm_campaign: 'uk-b2b-jan26', industry: 'Consulting', revenue_range: '£1M-£2M', stage: 'closed_won', opted_in_at: '2026-01-25T14:00:00Z', booking_completed: true, booked_at: '2026-01-25T14:20:00Z', call_datetime: '2026-01-28T14:00:00Z', proposal_sent: true, proposal_value: 3500, revenue: 3500, last_contact_at: '2026-02-04T11:00:00Z', created_at: '2026-01-25T14:00:00Z', updated_at: '2026-02-04T11:00:00Z' },
  { id: 'l3', name: 'Rachel Okafor', email: 'rachel@okafortraining.co.uk', phone: '07700900003', utm_content: 'hook-3c', utm_campaign: 'uk-b2b-feb26', industry: 'Training', revenue_range: '£500k-£1M', stage: 'proposal_sent', opted_in_at: '2026-03-10T10:00:00Z', booking_completed: true, booked_at: '2026-03-10T10:15:00Z', call_datetime: '2026-03-13T11:00:00Z', proposal_sent: true, proposal_sent_at: '2026-03-15T16:00:00Z', proposal_value: 2995, last_contact_at: '2026-03-15T16:00:00Z', created_at: '2026-03-10T10:00:00Z', updated_at: '2026-03-15T16:00:00Z' },
  { id: 'l4', name: 'Tom Bradley', email: 'tom@bradleyprofessional.com', phone: '07700900004', utm_content: 'hook-3c', utm_campaign: 'uk-b2b-feb26', industry: 'Professional Services', revenue_range: '£500k-£1M', stage: 'qualified', opted_in_at: '2026-03-14T09:00:00Z', booking_completed: true, booked_at: '2026-03-14T09:20:00Z', call_datetime: '2026-03-17T10:00:00Z', call_notes_auto: 'Strong fit — £600k revenue, tried two agencies previously. Wants execution not strategy. Follow-up call suggested.', proposal_sent: false, last_contact_at: '2026-03-17T11:00:00Z', created_at: '2026-03-14T09:00:00Z', updated_at: '2026-03-17T11:00:00Z' },
  { id: 'l5', name: 'Lisa Chen', email: 'lisa@chenventuresuk.com', phone: '07700900005', utm_content: 'hook-4a', utm_campaign: 'uk-b2b-mar26', industry: 'Consulting', revenue_range: '£1M-£2M', stage: 'second_call_booked', opted_in_at: '2026-03-16T11:00:00Z', booking_completed: true, booked_at: '2026-03-16T11:30:00Z', call_datetime: '2026-03-19T14:00:00Z', second_call_datetime: '2026-03-26T14:00:00Z', call_notes_auto: 'Highly qualified — £1.4M revenue, frustrated with current freelancer setup. Second call booked for Thursday 26th.', proposal_sent: false, last_contact_at: '2026-03-19T15:00:00Z', created_at: '2026-03-16T11:00:00Z', updated_at: '2026-03-19T15:00:00Z' },
  { id: 'l6', name: 'David Pearson', email: 'd.pearson@pearsonprofservices.co.uk', phone: '07700900006', utm_content: 'hook-3b', utm_campaign: 'uk-b2b-mar26', industry: 'Professional Services', revenue_range: '£500k-£1M', stage: 'booked', opted_in_at: '2026-03-21T15:00:00Z', booking_completed: true, booked_at: '2026-03-21T15:30:00Z', call_datetime: '2026-03-24T11:00:00Z', proposal_sent: false, last_contact_at: '2026-03-21T15:30:00Z', created_at: '2026-03-21T15:00:00Z', updated_at: '2026-03-21T15:30:00Z' },
  { id: 'l7', name: 'Amanda Walsh', email: 'amanda@walshmindset.com', phone: '07700900007', utm_content: 'hook-5a', utm_campaign: 'uk-b2b-mar26', industry: 'Coaching', revenue_range: '£500k-£1M', stage: 'booked', opted_in_at: '2026-03-22T08:30:00Z', booking_completed: true, booked_at: '2026-03-22T08:45:00Z', call_datetime: '2026-03-25T09:00:00Z', proposal_sent: false, last_contact_at: '2026-03-22T08:45:00Z', created_at: '2026-03-22T08:30:00Z', updated_at: '2026-03-22T08:45:00Z' },
  { id: 'l8', name: 'Marcus Flynn', email: 'marcus@flynngroup.co.uk', phone: '07700900008', utm_content: 'hook-3c', utm_campaign: 'uk-b2b-mar26', industry: 'Consulting', revenue_range: '£2M+', stage: 'no_show', opted_in_at: '2026-03-18T14:00:00Z', booking_completed: true, booked_at: '2026-03-18T14:20:00Z', call_datetime: '2026-03-20T10:00:00Z', proposal_sent: false, last_contact_at: '2026-03-18T14:20:00Z', created_at: '2026-03-18T14:00:00Z', updated_at: '2026-03-20T10:00:00Z' },
  { id: 'l9', name: 'Priya Sharma', email: 'priya@sharmacoach.com', phone: '07700900009', utm_content: 'hook-4a', utm_campaign: 'uk-b2b-feb26', industry: 'Coaching', revenue_range: '£500k-£1M', stage: 'closed_lost', opted_in_at: '2026-02-28T10:00:00Z', booking_completed: true, booked_at: '2026-02-28T10:30:00Z', call_datetime: '2026-03-03T14:00:00Z', proposal_sent: true, proposal_sent_at: '2026-03-05T17:00:00Z', proposal_value: 2995, close_reason: 'Budget — went with a cheaper freelancer option', last_contact_at: '2026-03-10T12:00:00Z', created_at: '2026-02-28T10:00:00Z', updated_at: '2026-03-10T12:00:00Z' },
  { id: 'l10', name: 'Ben Whitmore', email: 'ben@whitmoreconsultants.co.uk', phone: '07700900010', utm_content: 'hook-3b', utm_campaign: 'uk-b2b-feb26', industry: 'Consulting', revenue_range: '£500k-£1M', stage: 'disqualified', opted_in_at: '2026-03-05T09:00:00Z', booking_completed: true, booked_at: '2026-03-05T09:15:00Z', call_datetime: '2026-03-07T11:00:00Z', proposal_sent: false, call_notes_manual: 'Pre-revenue side project — not the right fit at this stage. Referred to coaching options.', last_contact_at: '2026-03-07T12:00:00Z', created_at: '2026-03-05T09:00:00Z', updated_at: '2026-03-07T12:00:00Z' },
  { id: 'l11', name: 'Claire Nightingale', email: 'claire@nightingalelaw.co.uk', phone: '07700900011', utm_content: 'hook-5a', utm_campaign: 'uk-b2b-mar26', industry: 'Professional Services', revenue_range: '£1M-£2M', stage: 'qualified', opted_in_at: '2026-03-19T13:00:00Z', booking_completed: true, booked_at: '2026-03-19T13:30:00Z', call_datetime: '2026-03-22T15:00:00Z', proposal_sent: false, last_contact_at: '2026-03-22T16:30:00Z', created_at: '2026-03-19T13:00:00Z', updated_at: '2026-03-22T16:30:00Z' },
  { id: 'l12', name: 'Gareth Thomas', email: 'gareth@thomasadvice.com', phone: '07700900012', utm_content: 'hook-3c', utm_campaign: 'uk-b2b-jan26', industry: 'Financial Services', revenue_range: '£500k-£1M', stage: 'abandoned', opted_in_at: '2026-01-30T10:00:00Z', booking_completed: true, booked_at: '2026-01-30T10:15:00Z', call_datetime: '2026-02-03T10:00:00Z', proposal_sent: false, call_notes_auto: 'Showed, seemed interested, asked for proposal outline. No response since.', last_contact_at: '2026-02-03T11:00:00Z', created_at: '2026-01-30T10:00:00Z', updated_at: '2026-03-01T09:00:00Z' },
]

// Generate daily ad performance for the last 60 days
export const SEED_AD_PERFORMANCE: AdPerformanceDaily[] = []
const startDate = new Date('2026-01-15')
const endDate = new Date('2026-03-22')

const creativeConfig: Record<string, { dailySpend: number; baseImpressions: number; baseCtr: number; startDate: string }> = {
  'c1': { dailySpend: 85, baseImpressions: 4200, baseCtr: 0.018, startDate: '2026-01-15' },
  'c2': { dailySpend: 65, baseImpressions: 3100, baseCtr: 0.022, startDate: '2026-02-01' },
  'c3': { dailySpend: 45, baseImpressions: 2200, baseCtr: 0.019, startDate: '2026-02-20' },
  'c4': { dailySpend: 40, baseImpressions: 1900, baseCtr: 0.011, startDate: '2025-11-01' },
  'c5': { dailySpend: 55, baseImpressions: 2600, baseCtr: 0.024, startDate: '2026-03-01' },
}

let perfId = 1
for (const [creativeId, config] of Object.entries(creativeConfig)) {
  const cStart = new Date(Math.max(new Date(config.startDate).getTime(), startDate.getTime()))
  for (let d = new Date(cStart); d <= endDate; d.setDate(d.getDate() + 1)) {
    const variance = 0.8 + Math.random() * 0.4
    const impressions = Math.round(config.baseImpressions * variance)
    const clicks = Math.round(impressions * config.baseCtr * variance)
    SEED_AD_PERFORMANCE.push({
      id: `p${perfId++}`,
      creative_id: creativeId,
      date: d.toISOString().split('T')[0],
      spend: Math.round(config.dailySpend * variance * 100) / 100,
      impressions,
      clicks,
    })
  }
}

// Export combined data — real creatives + seed leads
export { REAL_CREATIVES, REAL_AD_PERFORMANCE } from './realData'
export { REAL_LEADS } from './realLeads'
