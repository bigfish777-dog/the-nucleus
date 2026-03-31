export const NEW_FUNNEL_CUTOVER = '2026-03-31T00:00:00.000Z'
export const TRACKING_RESET_CUTOVER = '2026-03-31T18:20:00.000+01:00'

export function isPostCutover(dateLike?: string | null) {
  if (!dateLike) return false
  const ts = new Date(dateLike).getTime()
  const cutover = new Date(NEW_FUNNEL_CUTOVER).getTime()
  return Number.isFinite(ts) && ts >= cutover
}

export function isLeadInNewFunnel(lead: {
  booked_at?: string | null
  opted_in_at?: string | null
  created_at?: string | null
  call_datetime?: string | null
}) {
  return [lead.booked_at, lead.opted_in_at, lead.created_at, lead.call_datetime].some(isPostCutover)
}
