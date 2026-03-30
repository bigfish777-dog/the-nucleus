import React from 'react'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts'

const pink = '#FF0D64'
const teal = '#3FEACE'
const amber = '#FFA71A'
const muted = '#8891A8'
const border = 'rgba(255,255,255,0.08)'
const surface = '#161B27'
const white = '#F0F2F8'

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
}

type LeadRow = {
  created_at: string
  booked_at?: string | null
  booking_completed?: boolean
  stage: string
  email?: string | null
  utm_source?: string | null
  utm_campaign?: string | null
  utm_content?: string | null
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function fmtPct(numerator: number, denominator: number) {
  if (!denominator) return '0%'
  return `${Math.round((numerator / denominator) * 100)}%`
}

export default function Tracking() {
  const [events, setEvents] = React.useState<TrackingEvent[]>([])
  const [leads, setLeads] = React.useState<LeadRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const since = new Date()
        since.setDate(since.getDate() - 30)
        const sinceIso = since.toISOString()
        const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }

        const [eventsRes, leadsRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/tracking_events?created_at=gte.${encodeURIComponent(sinceIso)}&event_type=eq.page_view&order=created_at.asc&select=created_at,page_path,utm_source,utm_campaign,utm_content,session_id`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/leads?created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.asc&select=created_at,booked_at,booking_completed,stage,email,utm_source,utm_campaign,utm_content`, { headers }),
        ])

        const [eventsJson, leadsJson] = await Promise.all([eventsRes.json(), leadsRes.json()])
        setEvents(Array.isArray(eventsJson) ? eventsJson : [])
        setLeads(Array.isArray(leadsJson) ? leadsJson : [])
      } catch {
        setEvents([])
        setLeads([])
      }
      setLoading(false)
    }
    load()
  }, [])

  const realLeads = leads.filter(lead => !lead.email?.includes('@testtubemarketing.com') && !['spam', 'test'].includes(lead.stage))
  const landingViews = events.filter(e => e.page_path === '/')
  const bookingViews = events.filter(e => e.page_path === '/book')

  const totalVisits = landingViews.length
  const totalBookPageViews = bookingViews.length
  const totalLeads = realLeads.length
  const totalBooked = realLeads.filter(lead => lead.booking_completed).length

  const now = new Date()
  const daily = Array.from({ length: 30 }, (_, idx) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (29 - idx))
    const key = dateKey(day)
    const visits = landingViews.filter(event => event.created_at.slice(0, 10) === key).length
    const leadsCount = realLeads.filter(lead => lead.created_at.slice(0, 10) === key).length
    const booked = realLeads.filter(lead => lead.booked_at?.slice(0, 10) === key).length
    return { label: key.slice(5), visits, leads: leadsCount, booked }
  })

  const sourceMap = new Map<string, { visits: number; leads: number; booked: number }>()
  for (const event of landingViews) {
    const key = event.utm_campaign || event.utm_source || event.utm_content || 'Direct / unknown'
    const row = sourceMap.get(key) || { visits: 0, leads: 0, booked: 0 }
    row.visits += 1
    sourceMap.set(key, row)
  }
  for (const lead of realLeads) {
    const key = lead.utm_campaign || lead.utm_source || lead.utm_content || 'Direct / unknown'
    const row = sourceMap.get(key) || { visits: 0, leads: 0, booked: 0 }
    row.leads += 1
    if (lead.booking_completed) row.booked += 1
    sourceMap.set(key, row)
  }

  const sourceRows = Array.from(sourceMap.entries())
    .map(([source, data]) => ({ source, ...data, visitToLead: fmtPct(data.leads, data.visits), leadToBooked: fmtPct(data.booked, data.leads) }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: white }}>Tracking</h1>
        <p className="text-sm mt-0.5" style={{ color: muted }}>Top-of-funnel visibility for the last 30 days</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Landing page visits" value={String(totalVisits)} sub="Tracked page views" />
        <MetricCard label="Booking page visits" value={String(totalBookPageViews)} sub="People who reached /book" />
        <MetricCard label="Leads captured" value={String(totalLeads)} sub={fmtPct(totalLeads, totalVisits) + ' visit → lead'} />
        <MetricCard label="Booked calls" value={String(totalBooked)} sub={fmtPct(totalBooked, totalLeads) + ' lead → booked'} />
        <MetricCard label="Visit → booked" value={fmtPct(totalBooked, totalVisits)} sub="End-to-end conversion" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Daily funnel trend</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: surface, border: `1px solid ${border}`, fontSize: 12 }} />
              <Line type="monotone" dataKey="visits" stroke={teal} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="leads" stroke={amber} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="booked" stroke={pink} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

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
                <tr><td colSpan={6} style={{ padding: '16px 0', color: muted }}>No tracking data yet. As soon as the landing page receives traffic, it’ll start filling in here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
