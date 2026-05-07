import React from 'react'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts'
import { useSearchParams } from 'react-router-dom'
import { TRACKING_RESET_CUTOVER } from '../lib/cutover'

// Brand colours
const varA = '#E91E63'   // Variant A — pink (brief spec)
const varB = '#22D3EE'   // Variant B — cyan (brief spec)
const teal = '#3FEACE'   // existing chart teal (source/traffic panel)
const muted = '#8891A8'
const border = 'rgba(255,255,255,0.08)'
const surface = '#161B27'
const white = '#F0F2F8'
const green = '#22C55E'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://oirnxlidjgsbcyhtxkse.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s'

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl p-5 ${className}`} style={{ background: surface, border: `1px solid ${border}` }}>{children}</div>
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: muted }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: white }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: muted }}>{sub}</p>}
    </Card>
  )
}

type TrackingEvent = {
  created_at: string
  page_path: string | null
  utm_source?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
  session_id: string
  event_type: 'page_view' | 'lead_capture' | 'booking_completed' | 'post_booking_question' | string
  variant?: 'a' | 'b' | null
  metadata?: Record<string, string | number | boolean | null>
}

type BookedLead = {
  created_at: string
  stage: string
  variant?: 'a' | 'b' | null
}

type ChangeLogItem = {
  id: string
  change_date: string
  note: string
  variant: 'a' | 'b' | 'both'
  created_at: string
}

type CardVariant = 'combined' | 'a' | 'b'
type ChartVariant = 'both' | 'a' | 'b'
type ChartMetric = 'visits' | 'leads' | 'booked'
type DateRangePreset = '7d' | '14d' | '30d' | 'all'

async function fetchAllRows<T>(pathWithQuery: string, headers: Record<string, string>, batchSize = 1000): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += batchSize) {
    const res = await fetch(`${pathWithQuery}${pathWithQuery.includes('?') ? '&' : '?'}limit=${batchSize}&offset=${from}`, { headers })
    const json = await res.json()
    const batch = Array.isArray(json) ? json as T[] : []
    rows.push(...batch)
    if (batch.length < batchSize) break
  }

  return rows
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function fmtPct(numerator: number, denominator: number) {
  if (!denominator) return '0%'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function pctNum(numerator: number, denominator: number) {
  if (!denominator) return 0
  return (numerator / denominator) * 100
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function isInDateRange(dateStr: string, startDate: string, endDate: string) {
  return dateStr >= startDate && dateStr <= endDate
}

function isValidDateParam(value: string | null): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

// Treat null variant as A (all historical data pre-B-launch is effectively A)
function filterEvents(evts: TrackingEvent[], v: CardVariant) {
  if (v === 'combined') return evts
  if (v === 'a') return evts.filter(e => !e.variant || e.variant === 'a')
  return evts.filter(e => e.variant === 'b')
}

function filterBookedLeads(leads: BookedLead[], v: CardVariant) {
  if (v === 'combined') return leads
  if (v === 'a') return leads.filter(l => !l.variant || l.variant === 'a')
  return leads.filter(l => l.variant === 'b')
}

function variantStats(events: TrackingEvent[], leads: BookedLead[], v: 'a' | 'b') {
  const evts = filterEvents(events, v)
  const landing = evts.filter(e => e.event_type === 'page_view' && e.page_path === '/').length
  const booking = evts.filter(e => e.event_type === 'page_view' && e.page_path === '/book').length
  const leadsCount = evts.filter(e => e.event_type === 'lead_capture').length
  const booked = filterBookedLeads(leads, v).length
  return { landing, booking, leads: leadsCount, booked }
}

function SegmentedToggle<T extends string>({
  options, value, onChange, dotMap,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  dotMap?: Partial<Record<T, string>>
}) {
  return (
    <div style={{
      display: 'inline-flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8,
      border: `1px solid ${border}`, padding: 3, gap: 2,
    }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: active ? 700 : 400,
              background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: active ? white : muted,
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.15s',
            }}
          >
            {dotMap?.[opt.value] && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotMap[opt.value], display: 'inline-block', flexShrink: 0 }} />
            )}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default function Tracking() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [events, setEvents] = React.useState<TrackingEvent[]>([])
  const [bookedLeads, setBookedLeads] = React.useState<BookedLead[]>([])
  const [changeLog, setChangeLog] = React.useState<ChangeLogItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [savingChange, setSavingChange] = React.useState(false)
  const [changeError, setChangeError] = React.useState<string | null>(null)
  const [changeForm, setChangeForm] = React.useState({
    change_date: new Date().toISOString().slice(0, 10),
    variant: 'both' as 'a' | 'b' | 'both',
    note: '',
  })

  // Card variant toggle
  const [cardVariant, setCardVariant] = React.useState<CardVariant>('combined')
  // Chart controls
  const [chartVariant, setChartVariant] = React.useState<ChartVariant>('both')
  const [chartMetric, setChartMetric] = React.useState<ChartMetric>('visits')
  const [minAvailableDate, setMinAvailableDate] = React.useState(TRACKING_RESET_CUTOVER.slice(0, 10))
  const [startDate, setStartDate] = React.useState(() => {
    const from = searchParams.get('from')
    return isValidDateParam(from) ? from : TRACKING_RESET_CUTOVER.slice(0, 10)
  })
  const [endDate, setEndDate] = React.useState(() => {
    const to = searchParams.get('to')
    return isValidDateParam(to) ? to : new Date().toISOString().slice(0, 10)
  })

  React.useEffect(() => {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const nextStart = isValidDateParam(from) ? from : minAvailableDate
    const nextEnd = isValidDateParam(to) ? to : new Date().toISOString().slice(0, 10)

    if (nextStart !== startDate) setStartDate(nextStart)
    if (nextEnd !== endDate) setEndDate(nextEnd)
  }, [endDate, minAvailableDate, searchParams, startDate])

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const cutover = new Date(TRACKING_RESET_CUTOVER)
        const sinceIso = cutover.toISOString()
        const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }

        const [eventsJson, leadsJson, changeLogJson] = await Promise.all([
          fetchAllRows<TrackingEvent>(
            `${SUPABASE_URL}/rest/v1/tracking_events?created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.asc&select=created_at,page_path,utm_source,utm_campaign,utm_content,session_id,event_type,variant,metadata`,
            headers,
          ),
          fetchAllRows<BookedLead>(
            `${SUPABASE_URL}/rest/v1/leads?booking_completed=eq.true&stage=not.in.(spam,test)&created_at=gte.${encodeURIComponent(sinceIso)}&select=created_at,stage,variant&order=created_at.asc`,
            headers,
          ),
          fetchAllRows<ChangeLogItem>(
            `${SUPABASE_URL}/rest/v1/tracking_change_log?select=id,change_date,note,variant,created_at&order=change_date.desc,created_at.desc`,
            headers,
          ),
        ])
        setEvents(eventsJson)
        setBookedLeads(leadsJson)
        setChangeLog(changeLogJson)

        const eventDates = eventsJson.map(event => event.created_at.slice(0, 10))
        const leadDates = leadsJson.map(lead => lead.created_at.slice(0, 10))
        const availableDates = [...eventDates, ...leadDates].sort()
        if (availableDates.length) {
          const earliestDate = availableDates[0]
          setMinAvailableDate(earliestDate)
          setStartDate(current => {
            if (!isValidDateParam(current) || current < earliestDate) return earliestDate
            return current
          })
        }
      } catch {
        setEvents([])
        setBookedLeads([])
        setChangeLog([])
      }
      setLoading(false)
    }
    load()
  }, [])

  React.useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const safeStart = startDate < minAvailableDate ? minAvailableDate : startDate
    const safeEnd = endDate > today ? today : endDate
    const normalizedStart = safeStart > safeEnd ? safeEnd : safeStart

    if (normalizedStart !== startDate) {
      setStartDate(normalizedStart)
      return
    }
    if (safeEnd !== endDate) {
      setEndDate(safeEnd)
      return
    }

    const next = new URLSearchParams(searchParams)
    next.set('from', normalizedStart)
    next.set('to', safeEnd)
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [endDate, minAvailableDate, searchParams, setSearchParams, startDate])

  const presetRange = React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (startDate === minAvailableDate && endDate === today) return 'all'
    if (endDate === today) {
      const presets: DateRangePreset[] = ['7d', '14d', '30d']
      const matched = presets.find(preset => startDate === addDays(today, -(Number.parseInt(preset, 10) - 1)))
      if (matched) return matched
    }
    return null
  }, [endDate, minAvailableDate, startDate])

  const rangedEvents = React.useMemo(
    () => events.filter(event => isInDateRange(event.created_at.slice(0, 10), startDate, endDate)),
    [endDate, events, startDate],
  )
  const rangedBookedLeads = React.useMemo(
    () => bookedLeads.filter(lead => isInDateRange(lead.created_at.slice(0, 10), startDate, endDate)),
    [bookedLeads, endDate, startDate],
  )
  const rangedChangeLog = React.useMemo(
    () => changeLog.filter(item => isInDateRange(item.change_date, startDate, endDate)),
    [changeLog, endDate, startDate],
  )

  const setDateRangePreset = React.useCallback((preset: DateRangePreset) => {
    const today = new Date().toISOString().slice(0, 10)
    setEndDate(today)
    if (preset === 'all') {
      setStartDate(minAvailableDate)
      return
    }
    const days = Number.parseInt(preset, 10)
    setStartDate(addDays(today, -(days - 1)))
  }, [minAvailableDate])

  const rangeLabel = startDate === endDate
    ? new Date(`${startDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : `${new Date(`${startDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} → ${new Date(`${endDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // ── Metric card data (filtered by cardVariant) ──────────────────────────────
  const filteredForCards = filterEvents(rangedEvents, cardVariant)
  const cardLanding = filteredForCards.filter(e => e.event_type === 'page_view' && e.page_path === '/').length
  const cardBooking = filteredForCards.filter(e => e.event_type === 'page_view' && e.page_path === '/book').length
  const cardLeads = filteredForCards.filter(e => e.event_type === 'lead_capture').length
  // Booked: use the leads table as source of truth, now that variant is persisted there too.
  const cardBooked = filterBookedLeads(rangedBookedLeads, cardVariant).length

  const cardSubtitle =
    cardVariant === 'combined' ? 'Showing combined data across both variants'
    : cardVariant === 'a' ? 'Showing Variant A (original) only'
    : 'Showing Variant B (questions-first) only'

  // ── Chart data ──────────────────────────────────────────────────────────────
  const hasBData = rangedEvents.some(e => e.variant === 'b')

  const totalDays = Math.max(1, Math.round((new Date(`${endDate}T12:00:00`).getTime() - new Date(`${startDate}T12:00:00`).getTime()) / 86400000) + 1)
  const daily = Array.from({ length: totalDays }, (_, idx) => {
    const day = new Date(`${startDate}T12:00:00`)
    day.setDate(day.getDate() + idx)
    const key = dateKey(day)

    function dayCount(v: CardVariant, type: ChartMetric) {
      const evts = filterEvents(rangedEvents, v)
      if (type === 'visits') return evts.filter(e => e.event_type === 'page_view' && e.page_path === '/' && e.created_at.slice(0, 10) === key).length
      if (type === 'leads') return evts.filter(e => e.event_type === 'lead_capture' && e.created_at.slice(0, 10) === key).length
      if (type === 'booked') return filterBookedLeads(rangedBookedLeads, v).filter(l => l.created_at.slice(0, 10) === key).length
    }

    return {
      label: totalDays > 31 ? key : key.slice(5),
      varA: dayCount('a', chartMetric),
      varB: dayCount('b', chartMetric),
      combined: dayCount('combined', chartMetric),
    }
  })

  // ── Region breakdown ──────────────────────────────────────────────────────
  const regionMap = new Map<string, { visits: number; leads: number; booked: number }>()
  for (const event of rangedEvents) {
    const region = (event.metadata?.visitor_region as string) || 'Unknown'
    const row = regionMap.get(region) || { visits: 0, leads: 0, booked: 0 }
    if (event.event_type === 'page_view' && event.page_path === '/') row.visits += 1
    if (event.event_type === 'lead_capture') row.leads += 1
    if (event.event_type === 'booking_completed') row.booked += 1
    regionMap.set(region, row)
  }
  const regionRows = Array.from(regionMap.entries())
    .map(([region, data]) => ({ region, ...data, visitToLead: fmtPct(data.leads, data.visits), leadToBooked: fmtPct(data.booked, data.leads) }))
    .filter(row => row.visits || row.leads || row.booked)
    .sort((a, b) => b.visits - a.visits)

  // ── Source breakdown (unchanged, always combined) ───────────────────────────
  const sourceMap = new Map<string, { visits: number; leads: number; booked: number }>()
  for (const event of rangedEvents) {
    const key = event.utm_campaign || event.utm_source || event.utm_content || 'Direct / unknown'
    const row = sourceMap.get(key) || { visits: 0, leads: 0, booked: 0 }
    if (event.event_type === 'page_view' && event.page_path === '/') row.visits += 1
    if (event.event_type === 'lead_capture') row.leads += 1
    if (event.event_type === 'booking_completed') row.booked += 1
    sourceMap.set(key, row)
  }

  const sourceRows = Array.from(sourceMap.entries())
    .map(([source, data]) => ({ source, ...data, visitToLead: fmtPct(data.leads, data.visits), leadToBooked: fmtPct(data.booked, data.leads) }))
    .filter(row => row.visits || row.leads || row.booked)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8)

  // ── A/B comparison stats ────────────────────────────────────────────────────
  const aStats = variantStats(rangedEvents, rangedBookedLeads, 'a')
  const bStats = variantStats(rangedEvents, rangedBookedLeads, 'b')
  const totalVariantVisits = aStats.landing + bStats.landing

  // ── Post-booking question funnel ───────────────────────────────────────────
  const POST_BOOKING_Q_KEYS = ['business_type', 'client_value', 'challenge', 'readiness', 'website']
  const POST_BOOKING_Q_LABELS: Record<string, string> = {
    business_type: 'Business type',
    client_value: 'Client value',
    challenge: 'Biggest challenge',
    readiness: 'Investment readiness',
    website: 'Website',
  }
  const totalBooked = rangedBookedLeads.length
  const pbqEvents = rangedEvents.filter(e => e.event_type === 'post_booking_question')
  const pbqCounts: Record<string, number> = {}
  for (const q of POST_BOOKING_Q_KEYS) {
    pbqCounts[q] = pbqEvents.filter((e: { metadata?: { question?: string } }) => e.metadata?.question === q).length
  }

  const aEndPct = pctNum(aStats.booked, aStats.booking)
  const bEndPct = pctNum(bStats.booked, bStats.booking)
  const endDelta = Math.abs(aEndPct - bEndPct)
  const currentLeader: 'a' | 'b' | null = hasBData
    ? aEndPct >= bEndPct ? 'a' : 'b'
    : null

  const SIGNIFICANCE_THRESHOLD = 100

  async function saveChangeLog() {
    const note = changeForm.note.trim()
    if (!note) {
      setChangeError('Add a short note first.')
      return
    }

    setSavingChange(true)
    setChangeError(null)
    try {
      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tracking_change_log`, {
        method: 'POST',
        headers,
        body: JSON.stringify([{ ...changeForm, note }]),
      })
      const json = await res.json()
      if (!res.ok || !Array.isArray(json) || !json[0]) throw new Error('Failed to save change log entry')
      setChangeLog(current => [json[0] as ChangeLogItem, ...current])
      setChangeForm(current => ({ ...current, note: '' }))
    } catch {
      setChangeError('Couldn\'t save that change just now.')
    }
    setSavingChange(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: white }}>Tracking</h1>
        <p className="text-sm mt-0.5" style={{ color: muted }}>Real event data from book.testtubemarketing.com only</p>
        <p className="text-xs mt-1" style={{ color: muted }}>Reset from {new Date(TRACKING_RESET_CUTOVER).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
        <p className="text-xs mt-1" style={{ color: muted }}>Current range: {rangeLabel}</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>Date range</p>
            <p className="text-xs mt-1" style={{ color: muted }}>Filter the split-test and tracking data to a specific reporting window.</p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <SegmentedToggle<DateRangePreset>
              options={[
                { value: '7d', label: '7D' },
                { value: '14d', label: '14D' },
                { value: '30d', label: '30D' },
                { value: 'all', label: 'All time' },
              ]}
              value={presetRange || 'all'}
              onChange={setDateRangePreset}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="date"
                min={minAvailableDate}
                max={endDate}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}`, color: white, borderRadius: 8, padding: '10px 12px' }}
              />
              <input
                type="date"
                min={startDate}
                max={new Date().toISOString().slice(0, 10)}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}`, color: white, borderRadius: 8, padding: '10px 12px' }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Metric cards with variant toggle */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs" style={{ color: muted }}>{cardSubtitle}</p>
          <SegmentedToggle<CardVariant>
            options={[
              { value: 'combined', label: 'Combined' },
              { value: 'a', label: 'Variant A' },
              { value: 'b', label: 'Variant B' },
            ]}
            value={cardVariant}
            onChange={setCardVariant}
            dotMap={{ a: varA, b: varB }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard label="Landing page visits" value={String(cardLanding)} sub="Tracked page views" />
          <MetricCard label="Booking page visits" value={String(cardBooking)} sub="People who reached /book" />
          <MetricCard label="Leads captured" value={String(cardLeads)} sub={fmtPct(cardLeads, cardLanding) + ' visit → lead'} />
          <MetricCard label="Booked calls" value={String(cardBooked)} sub={fmtPct(cardBooked, cardLeads) + ' lead → booked'} />
          <MetricCard label="Visit → booked" value={fmtPct(cardBooked, cardLanding)} sub="End-to-end conversion" />
        </div>
      </div>

      {/* Change log */}
      <Card>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>Experiment change log</p>
            <p className="text-xs mt-1" style={{ color: muted }}>Log page edits here so you can line them up with performance changes.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[140px_140px_1fr_auto] gap-3 mb-4">
          <input
            type="date"
            value={changeForm.change_date}
            onChange={e => setChangeForm(current => ({ ...current, change_date: e.target.value }))}
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}`, color: white, borderRadius: 8, padding: '10px 12px' }}
          />
          <select
            value={changeForm.variant}
            onChange={e => setChangeForm(current => ({ ...current, variant: e.target.value as 'a' | 'b' | 'both' }))}
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}`, color: white, borderRadius: 8, padding: '10px 12px' }}
          >
            <option value="both">Both</option>
            <option value="a">Variant A</option>
            <option value="b">Variant B</option>
          </select>
          <input
            type="text"
            value={changeForm.note}
            onChange={e => setChangeForm(current => ({ ...current, note: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void saveChangeLog()
              }
            }}
            placeholder="e.g. Shortened Variant B by removing testimonial and FAQ sections"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}`, color: white, borderRadius: 8, padding: '10px 12px' }}
          />
          <button
            onClick={() => void saveChangeLog()}
            disabled={savingChange}
            style={{ background: teal, color: '#07131A', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 700, opacity: savingChange ? 0.7 : 1, cursor: savingChange ? 'wait' : 'pointer' }}
          >
            {savingChange ? 'Saving…' : 'Save change'}
          </button>
        </div>

        {changeError && <p className="text-xs mb-3" style={{ color: '#FCA5A5' }}>{changeError}</p>}

        <div className="space-y-2">
          {rangedChangeLog.slice(0, 12).map(item => (
            <div key={item.id} style={{ borderTop: `1px solid ${border}`, paddingTop: 10 }}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: white }}>{new Date(`${item.change_date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: item.variant === 'a' ? varA : item.variant === 'b' ? varB : muted }}>
                    {item.variant === 'both' ? 'Both variants' : `Variant ${item.variant.toUpperCase()}`}
                  </span>
                </div>
                <span className="text-xs" style={{ color: muted }}>{new Date(item.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm" style={{ color: white }}>{item.note}</p>
            </div>
          ))}
          {!rangedChangeLog.length && <p className="text-xs" style={{ color: muted }}>No changes logged in this date range yet.</p>}
        </div>
      </Card>

      {/* Post-booking question funnel */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Post-booking question completion</p>
        <p className="text-xs mb-4" style={{ color: muted }}>After booking, visitors are shown 5 optional questions one at a time. Track dropoff below.</p>
        <div className="space-y-3">
          {POST_BOOKING_Q_KEYS.map((key, idx) => {
            const count = pbqCounts[key] || 0
            const pct = totalBooked > 0 ? Math.round((count / totalBooked) * 100) : 0
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span className="text-xs font-semibold" style={{ color: white }}>Q{idx + 1}: {POST_BOOKING_Q_LABELS[key]}</span>
                  <span className="text-xs" style={{ color: muted }}>{count} answered &middot; {pct}% of booked</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: varA, borderRadius: 4, transition: 'width 0.4s' }} />
                </div>
              </div>
            )
          })}
        </div>
        {totalBooked === 0 && <p className="text-xs mt-3" style={{ color: muted }}>No bookings yet in the current window.</p>}
      </Card>

      {/* Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>Daily funnel trend</p>
              {/* Metric selector tabs */}
              <div style={{ display: 'flex', gap: 0, marginTop: 8 }}>
                {(['visits', 'leads', 'booked'] as ChartMetric[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setChartMetric(m)}
                    style={{
                      padding: '3px 10px', fontSize: 11, fontWeight: chartMetric === m ? 700 : 400,
                      color: chartMetric === m ? white : muted,
                      background: 'none', border: 'none',
                      borderBottom: `2px solid ${chartMetric === m ? varA : 'transparent'}`,
                      cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <SegmentedToggle<ChartVariant>
              options={[
                { value: 'both', label: 'Both' },
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ]}
              value={chartVariant}
              onChange={setChartVariant}
              dotMap={{ a: varA, b: varB }}
            />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: surface, border: `1px solid ${border}`, fontSize: 12 }} />
              {(chartVariant === 'both' || chartVariant === 'a') && (
                <Line type="monotone" dataKey="varA" name="Variant A" stroke={varA} strokeWidth={2} dot={false} />
              )}
              {(chartVariant === 'both') && hasBData && (
                <Line type="monotone" dataKey="varB" name="Variant B" stroke={varB} strokeWidth={2} dot={false} />
              )}
              {chartVariant === 'b' && hasBData && (
                <Line type="monotone" dataKey="varB" name="Variant B" stroke={varB} strokeWidth={2} dot={false} />
              )}
              {chartVariant === 'b' && !hasBData && (
                <Line type="monotone" dataKey="varB" name="Variant B — awaiting data" stroke={muted} strokeWidth={1} dot={false} strokeDasharray="4 4" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Traffic by source — unchanged */}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Traffic by source / campaign</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sourceRows} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis type="number" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="source" width={110} tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: surface, border: `1px solid ${border}`, fontSize: 12 }} />
              <Bar dataKey="visits" fill={teal} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* A/B Comparison panel */}
      <Card>
        {/* Header row */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-sm font-bold" style={{ color: white }}>Variant A (original) vs Variant B (questions-first)</p>
            <p className="text-xs mt-1" style={{ color: muted }}>
              70/30 split · {totalVariantVisits} total recorded visits
            </p>
          </div>
          {/* Current leader badge */}
          {currentLeader ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.05)', borderRadius: 8,
              padding: '8px 14px', border: `1px solid ${border}`,
            }}>
              <span style={{ fontSize: 11, color: muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current leader</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: currentLeader === 'a' ? varA : varB, display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: currentLeader === 'a' ? varA : varB }}>
                Variant {currentLeader.toUpperCase()}
              </span>
              {endDelta > 0 && (
                <span style={{ fontSize: 11, color: green, fontWeight: 600 }}>+{endDelta.toFixed(1)}pp</span>
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.05)', borderRadius: 8,
              padding: '8px 14px', border: `1px solid ${border}`,
            }}>
              <span style={{ fontSize: 11, color: muted }}>No data yet</span>
            </div>
          )}
        </div>

        {/* Comparison table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '0 0 12px', color: muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Metric</th>
                <th style={{ padding: '0 0 12px', color: varA, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ● Variant A
                </th>
                <th style={{ padding: '0 0 12px', color: muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Delta</th>
                <th style={{ padding: '0 0 12px', color: hasBData ? varB : muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>
                  ● Variant B
                </th>
              </tr>
            </thead>
            <tbody>
              <ABRow label="Landing page visits" aVal={aStats.landing} bVal={hasBData ? bStats.landing : null} type="count" />
              <ABRow label="Booking page visits" aVal={aStats.booking} bVal={hasBData ? bStats.booking : null} type="count" />
              <ABRow label="Leads captured" aVal={aStats.leads} bVal={hasBData ? bStats.leads : null} type="count" />
              <ABRow label="Booked calls" aVal={aStats.booked} bVal={hasBData ? bStats.booked : null} type="count" />
              <ABRow label="Visit → lead (%)" aVal={pctNum(aStats.leads, aStats.booking)} bVal={hasBData ? pctNum(bStats.leads, bStats.booking) : null} type="pct" />
              <ABRow label="Lead → booked (%)" aVal={pctNum(aStats.booked, aStats.leads)} bVal={hasBData ? pctNum(bStats.booked, bStats.leads) : null} type="pct" />
              <ABRow label="End-to-end conversion (%)" aVal={aEndPct} bVal={hasBData ? bEndPct : null} type="pct" highlight />
            </tbody>
          </table>
        </div>

        {/* Caveat */}
        <div style={{
          marginTop: 20, padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${border}`, borderRadius: 8, fontSize: 12, color: muted,
        }}>
          ⚠️ Low sample size. Results not yet statistically significant. Need at least {SIGNIFICANCE_THRESHOLD} conversions per variant for a confident read.
        </div>
      </Card>

      {/* Source breakdown — unchanged */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>Source breakdown</p>
          {loading && <p className="text-xs" style={{ color: muted }}>Loading…</p>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: muted }}>
                <th style={{ padding: '0 0 12px' }}>Source</th>
                <th style={{ padding: '0 0 12px' }}>Visits</th>
                <th style={{ padding: '0 0 12px' }}>Leads</th>
                <th style={{ padding: '0 0 12px' }}>Booked</th>
                <th style={{ padding: '0 0 12px' }}>Visit → Lead</th>
                <th style={{ padding: '0 0 12px' }}>Lead → Booked</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.map(row => (
                <tr key={row.source} style={{ borderTop: `1px solid ${border}`, color: white }}>
                  <td style={{ padding: '12px 0' }}>{row.source}</td>
                  <td>{row.visits}</td>
                  <td>{row.leads}</td>
                  <td>{row.booked}</td>
                  <td>{row.visitToLead}</td>
                  <td>{row.leadToBooked}</td>
                </tr>
              ))}
              {!sourceRows.length && !loading && (
                <tr><td colSpan={6} style={{ padding: '16px 0', color: muted }}>No tracking data yet. As soon as the live pages get traffic, this will fill from real page events only.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Region breakdown */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>Audience by region</p>
            <p className="text-xs mt-1" style={{ color: muted }}>Based on visitor timezone · UK = Europe/London · US = America/* timezones</p>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: muted }}>
                <th style={{ padding: '0 0 12px' }}>Region</th>
                <th style={{ padding: '0 0 12px' }}>Visits</th>
                <th style={{ padding: '0 0 12px' }}>Leads</th>
                <th style={{ padding: '0 0 12px' }}>Booked</th>
                <th style={{ padding: '0 0 12px' }}>Visit → Lead</th>
                <th style={{ padding: '0 0 12px' }}>Lead → Booked</th>
              </tr>
            </thead>
            <tbody>
              {regionRows.map(row => (
                <tr key={row.region} style={{ borderTop: `1px solid ${border}`, color: white }}>
                  <td style={{ padding: '12px 0', fontWeight: 600 }}>
                    {row.region === 'UK' ? '🇬🇧 UK' : row.region === 'US' ? '🇺🇸 US' : `🌍 ${row.region}`}
                  </td>
                  <td>{row.visits}</td>
                  <td>{row.leads}</td>
                  <td>{row.booked}</td>
                  <td>{row.visitToLead}</td>
                  <td>{row.leadToBooked}</td>
                </tr>
              ))}
              {!regionRows.length && !loading && (
                <tr><td colSpan={6} style={{ padding: '16px 0', color: muted }}>No region data yet. New visits will show region automatically.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// A/B comparison table row
function ABRow({
  label, aVal, bVal, type, highlight = false,
}: {
  label: string
  aVal: number
  bVal: number | null
  type: 'count' | 'pct'
  highlight?: boolean
}) {
  const fmt = (v: number) => type === 'pct' ? `${v.toFixed(1)}%` : String(v)

  const hasB = bVal !== null
  const aWins = hasB && aVal >= bVal
  const bWins = hasB && bVal > aVal
  const delta = hasB ? Math.abs(aVal - bVal) : null

  return (
    <tr style={{ borderTop: `1px solid ${border}` }}>
      <td style={{ padding: '12px 0', color: highlight ? white : muted, fontWeight: highlight ? 600 : 400 }}>{label}</td>
      <td style={{ padding: '12px 0', fontWeight: aWins ? 700 : 400, color: aWins ? white : muted }}>
        {fmt(aVal)}
      </td>
      <td style={{ padding: '12px 0', textAlign: 'center', color: muted }}>
        {delta !== null ? (
          <span style={{ color: green, fontWeight: 600, fontSize: 12 }}>
            {aWins ? '▲' : '▼'} {fmt(delta)} {aWins ? 'A wins' : 'B wins'}
          </span>
        ) : '—'}
      </td>
      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: bWins ? 700 : 400, color: hasB ? (bWins ? white : muted) : muted }}>
        {hasB ? fmt(bVal) : 'Awaiting data'}
      </td>
    </tr>
  )
}
