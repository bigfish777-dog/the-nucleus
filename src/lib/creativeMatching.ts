import type { AdCreative, Lead } from '../types'

function normalize(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

export function matchesCreativeValue(creative: AdCreative, utmContent?: string | null) {
  const value = normalize(utmContent)
  if (!value) return false
  return value === normalize(creative.utm_content_value) || value === normalize(creative.meta_creative_id)
}

export function findCreativeForLead(creatives: AdCreative[], lead?: Pick<Lead, 'utm_content'> | null) {
  if (!lead?.utm_content) return null
  return creatives.find((creative) => matchesCreativeValue(creative, lead.utm_content)) || null
}

export function leadsForCreative<T extends Pick<Lead, 'utm_content'>>(leads: T[], creative: AdCreative) {
  return leads.filter((lead) => matchesCreativeValue(creative, lead.utm_content))
}

export function getCreativeAttributionLabel(creative: AdCreative | null, utmContent?: string | null) {
  if (!creative) return utmContent || 'Unknown'
  const raw = normalize(utmContent)
  const matchedByMetaId = !!creative.meta_creative_id && raw === normalize(creative.meta_creative_id)
  const matchedByHook = raw === normalize(creative.utm_content_value)

  if (matchedByMetaId) {
    return `${creative.name} · via Meta creative ID`
  }
  if (matchedByHook) {
    return `${creative.name} · via hook alias`
  }
  return creative.name
}
