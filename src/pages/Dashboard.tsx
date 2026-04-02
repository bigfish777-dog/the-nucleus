import { REAL_LEADS as SEED_LEADS, REAL_AD_PERFORMANCE as SEED_AD_PERFORMANCE, REAL_CREATIVES as SEED_CREATIVES } from '../lib/seed'
import {
  LineChart, Line, ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import React, { useState } from 'react'
import type { Lead } from '../types'
import { TrendingUp, TrendingDown, AlertCircle, Calendar } from 'lucide-react'
import { NEW_FUNNEL_CUTOVER, isLeadInNewFunnel } from '../lib/cutover'

const pink = '#FF0D64'
const teal = '#3FEACE'
const amber = '#FFA71A'
const muted = '#8891A8'
const border = 'rgba(255,255,255,0.08)'
const surface = '#161B27'
const green = '#22C55E'
// DASHBOARD_OVERRIDES removed — all metrics now computed live from lead data
// Historical leads back-filled via automations/backfill-helper.ts

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ background: surface, border: `1px solid ${border}` }}>
      {children}
    </div>
  )
}

function MetricCard({ label, value, sub, trend, color = '#F0F2F8' }: {
  label: string; value: string; sub?: string; trend?: 'up' | 'down'; color?: string
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: muted }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && (
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <TrendingUp size={11} style={{ color: teal }} />}
          {trend === 'down' && <TrendingDown size={11} style={{ color: pink }} />}
          <p className="text-xs" style={{ color: muted }}>{sub}</p>
        </div>
      )}
    </Card>
  )
}

// ─── Computed metrics ───────────────────────────────────────────────────────
const leads = SEED_LEADS
const now = new Date('2026-03-22')
// These seed-level constants are superseded by live calendar-week calculations in the component
const showed = leads.filter(l => ['showed','qualified','second_call_booked','proposal_sent','proposal_live','closed_won','closed_lost'].includes(l.stage)).length
const allBooked = leads.filter(l => l.booking_completed).length
const showRate = allBooked ? Math.round((showed / allBooked) * 100) : 0

const last4WeeksSpend = SEED_AD_PERFORMANCE
  .filter(p => { const d = new Date(p.date); const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-28); return d >= cutoff; })
  .reduce((s, p) => s + p.spend, 0)


// ─── Alerts ──────────────────────────────────────────────────────────────────

// ─── Upcoming calls ───────────────────────────────────────────────────────────
// Computed inside component using realNow and activeLeadsData

// ─── Chart data ───────────────────────────────────────────────────────────────
// 12-week weekly trend



// Placeholders — real data built in component using liveLeads

const creativeMap = Object.fromEntries(SEED_CREATIVES.map(c => [c.utm_content_value, c.name]))

type Timeframe = '4w' | '8w' | '12w'

export default function Dashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>('12w')
  const tfWeeks = timeframe === '4w' ? 4 : timeframe === '8w' ? 8 : 12
  const [showAllTime, setShowAllTime] = useState(true)
  const [liveLeads, setLiveLeads] = React.useState<Lead[] | null>(null)
  React.useEffect(() => {
    async function load() {
      try {
        const { fetchLeads } = await import('../lib/supabase')
        const { data } = await fetchLeads()
        if (data && data.length > 0) setLiveLeads(data as Lead[])
      } catch { /* use seed */ }
    }
    load()
  }, [])

  // Use live data if available, filter out spam/test from all metrics
  // Exclude spam/test stages AND internal test email addresses
  const activeLeadsData = (liveLeads || leads).filter((l: Lead) =>
    !['spam','test'].includes(l.stage) &&
    !l.email?.includes('@testtubemarketing.com') &&
    (showAllTime || isLeadInNewFunnel(l))
  )

  // ── Consistent date boundaries ────────────────────────────────────────────
  // Use real current time (not hardcoded seed date)
  const realNow = new Date()
  // Start of current calendar week (Monday)
  const thisMonday = new Date(realNow)
  thisMonday.setDate(realNow.getDate() - ((realNow.getDay() + 6) % 7))
  thisMonday.setHours(0, 0, 0, 0)
  // Start of last calendar week
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)

  // Recalculate key metrics from live data
  // "This week" = Mon 00:00 to now (calendar week, not rolling 7 days)
  const liveThisWeekBooked = activeLeadsData.filter((l: Lead) => 
    l.booked_at && new Date(l.booked_at) >= thisMonday
  ).length
  // Calls booked = Marketing Growth Calls only (Jan 2026+)
  // Excludes old Calendly types from 2025 and pure opt-ins
  const mgcStart = '2026-01-01'
  const liveAllBooked = activeLeadsData.filter((l: Lead) => 
    l.booking_completed &&
    !['abandoned', 'spam', 'test'].includes(l.stage) &&
    ((l.call_datetime || '') >= mgcStart || (l.booked_at || '') >= mgcStart)
  ).length
  const liveShowed = activeLeadsData.filter((l: Lead) => ['showed','qualified','second_call_booked','proposal_sent','proposal_live','closed_won','closed_lost'].includes(l.stage)).length
  const liveShowRateRaw = liveAllBooked ? Math.round((liveShowed / liveAllBooked) * 100) : 0
  // Revenue this month — use the first day of current month dynamically
  const firstOfMonth = new Date(realNow.getFullYear(), realNow.getMonth(), 1).toISOString()
  // Use last_contact_at as close date (stored there to avoid auto-update trigger overwriting)
  const liveRevThisMonthRaw = activeLeadsData.filter((l: Lead) => l.revenue && l.stage === 'closed_won' && l.last_contact_at && l.last_contact_at >= firstOfMonth).reduce((s: number, l: Lead) => s + (Number(l.revenue) || 0), 0)
  // Exclude Michael O'Reilly (referral) from ad-attributed revenue on ROAS calc
  // Revenue closed = ALL TIME total from closed won leads
  const liveRevQRaw = activeLeadsData.filter((l: Lead) => l.revenue && Number(l.revenue) > 0 && l.stage === 'closed_won').reduce((s: number, l: Lead) => s + (Number(l.revenue) || 0), 0)
  const liveTotalLeads = activeLeadsData.length
  const liveProposalsSentRaw = activeLeadsData.filter((l: Lead) => Number(l.proposal_value) > 0).length
  const [liveSpend28d, setLiveSpend28d] = React.useState(0)
  React.useEffect(() => {
    // Load ALL time ad spend for accurate cost per call
    fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://oirnxlidjgsbcyhtxkse.supabase.co'}/rest/v1/ad_performance_daily?select=spend&limit=500`, {
      headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s', Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s' }
    }).then(r => r.json()).then(rows => setLiveSpend28d(rows.reduce((s: number, r: {spend: number}) => s + (r.spend||0), 0))).catch(() => {})
  }, [])
  const liveCostPerCallRaw = liveAllBooked ? Math.round((liveSpend28d || last4WeeksSpend) / liveAllBooked) : 0
  const liveClosedWonRaw = activeLeadsData.filter((l: Lead) => l.stage === 'closed_won').length
  const liveAllBookedDisplay = liveAllBooked
  const liveShowRate = liveShowRateRaw
  const liveRevThisMonth = liveRevThisMonthRaw
  const liveRevQ = liveRevQRaw
  const liveProposalsSent = liveProposalsSentRaw
  const liveClosedWon = liveClosedWonRaw
  const liveTotalRevenueClosed = liveRevQRaw
  const liveCostPerCall = liveCostPerCallRaw
  const liveCostPerProposal = liveProposalsSent ? Math.round((liveSpend28d || last4WeeksSpend) / liveProposalsSent) : 0
  // Live flags from Supabase data
  const liveOverdue = activeLeadsData.filter((l: Lead) => l.stage === 'booked' && !!l.call_datetime && new Date(l.call_datetime) < realNow)
  const liveStaleProposals = activeLeadsData.filter((l: Lead) => l.stage === 'proposal_sent' && l.proposal_sent_at && (realNow.getTime() - new Date(l.proposal_sent_at).getTime()) > 7 * 86400000)
  const liveNoContact = activeLeadsData.filter((l: Lead) => l.last_contact_at && (realNow.getTime() - new Date(l.last_contact_at).getTime()) > 14 * 86400000 && !['closed_won','closed_lost','abandoned','spam','test','no_show','disqualified','showed'].includes(l.stage))
  const liveUpcomingSecond = activeLeadsData.filter((l: Lead) => l.stage === 'second_call_booked' && l.second_call_datetime && new Date(l.second_call_datetime) >= realNow)

  // ── Upcoming calls (next 7 days) ──
  const upcomingCalls = activeLeadsData
    .filter(l => l.call_datetime && new Date(l.call_datetime) >= realNow && l.stage === 'booked')
    .sort((a, b) => new Date(a.call_datetime!).getTime() - new Date(b.call_datetime!).getTime())
    .slice(0, 6)

  // ── Live chart data (recalculated when liveLeads or timeframe changes) ────
  // Chart weeks: calendar weeks (Mon–Sun), W1 = oldest, W12 = current week
  const weeklyChartData = Array.from({ length: tfWeeks }, (_, i) => {
    // i=0 = current week (thisMonday → now), i=1 = last week, etc.
    const wStart = new Date(thisMonday); wStart.setDate(thisMonday.getDate() - i * 7)
    const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 7)
    const wStartISO = wStart.toISOString(); const wEndISO = wEnd.toISOString()
    // Booked: use booked_at only (single source of truth — set when booking confirmed)
    const booked = activeLeadsData.filter((l: Lead) => {
      return l.booked_at && l.booked_at >= wStartISO && l.booked_at < wEndISO && l.booking_completed
    }).length
    // Attended: use last_contact_at for attended stages
    const qual = activeLeadsData.filter((l: Lead) => {
      const d = l.last_contact_at || l.call_datetime
      return d && d >= wStartISO && d < wEndISO &&
        ['showed','qualified','second_call_booked','proposal_sent','proposal_live','closed_won','closed_lost'].includes(l.stage)
    }).length
    // Proposals: use proposal_sent_at
    const props = activeLeadsData.filter((l: Lead) =>
      l.proposal_sent_at && l.proposal_sent_at >= wStartISO && l.proposal_sent_at < wEndISO
    ).length
    const spend = SEED_AD_PERFORMANCE.filter(p => p.date >= wStartISO.slice(0,10) && p.date < wEndISO.slice(0,10))
      .reduce((s, p) => s + p.spend, 0)
    return { label: `W${tfWeeks-i}`, booked, qual, props, spend: Math.round(spend) }
  }).reverse()

  // Ad spend vs revenue by week
  const liveSpendRevenueData = weeklyChartData.map(w => {
    // Match revenue to week using last_contact_at of closed_won leads
    const weekIdx = weeklyChartData.indexOf(w)
    const wEnd = new Date(realNow); wEnd.setDate(wEnd.getDate() - (tfWeeks - weekIdx - 1) * 7)
    const wStart = new Date(wEnd); wStart.setDate(wStart.getDate() - 7)
    const rev = activeLeadsData
      .filter((l: Lead) => l.stage === 'closed_won' && l.revenue && l.last_contact_at &&
        l.last_contact_at >= wStart.toISOString() && l.last_contact_at < wEnd.toISOString())
      .reduce((s: number, l: Lead) => s + (Number(l.revenue) || 0), 0)
    return { label: w.label, spend: w.spend, revenue: rev }
  })

  // Running average cost per call
  const liveRunningAvgData = weeklyChartData.map((w, i) => {
    const cumSpend = weeklyChartData.slice(0, i+1).reduce((s,d) => s+d.spend, 0)
    const cumBooked = weeklyChartData.slice(0, i+1).reduce((s,d) => s+d.booked, 0)
    return { label: w.label, cpc: cumBooked ? Math.round(cumSpend/cumBooked) : 0, weekly: w.booked ? Math.round(w.spend/w.booked) : 0 }
  })

  const funnelData = [
    { stage: 'Leads', count: liveTotalLeads, pct: 100, color: teal },
    { stage: 'Calls Booked', count: liveAllBooked, pct: liveTotalLeads ? Math.round(liveAllBooked/liveTotalLeads*100) : 0, color: teal },
    { stage: 'Attended', count: liveShowed, pct: liveAllBooked ? Math.round(liveShowed/liveAllBooked*100) : 0, color: amber },
    { stage: 'Proposals Sent', count: liveProposalsSent, pct: liveShowed ? Math.round(liveProposalsSent/liveShowed*100) : 0, color: pink },
    { stage: 'Closed Won', count: liveClosedWon, pct: liveProposalsSent ? Math.round(liveClosedWon/liveProposalsSent*100) : 0, color: '#22C55E' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>{realNow.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          {!showAllTime && <p className="text-xs mt-1" style={{ color: muted }}>New funnel metrics from {new Date(NEW_FUNNEL_CUTOVER).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} onward</p>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'new'] as const).map(mode => {
            const active = mode === 'all' ? showAllTime : !showAllTime
            return (
              <button key={mode} onClick={() => setShowAllTime(mode === 'all')}
                style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${active ? teal : border}`, background: active ? `${teal}15` : 'transparent', color: active ? teal : muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {mode === 'all' ? 'All time' : 'New funnel'}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Calls booked this week" value={String(liveThisWeekBooked)}
          sub={(() => {
            const liveLastWeekBooked = activeLeadsData.filter((l: Lead) =>
              l.booked_at && new Date(l.booked_at) >= lastMonday && new Date(l.booked_at) < thisMonday
            ).length
            const diff = liveThisWeekBooked - liveLastWeekBooked
            return `${diff >= 0 ? '+' : ''}${diff} vs last week`
          })()}
          trend={liveThisWeekBooked >= activeLeadsData.filter((l: Lead) => l.booked_at && new Date(l.booked_at) >= lastMonday && new Date(l.booked_at) < thisMonday).length ? 'up' : 'down'} color={teal} />
        <MetricCard label="Overall show rate" value={`${liveShowRate}%`}
          sub={`${liveAllBookedDisplay} calls booked total`}
          trend={showRate >= 70 ? 'up' : 'down'} />
        <MetricCard label="Live proposals" value={String(liveProposalsSent)}
          sub="Awaiting decision" color={amber} />
        <MetricCard label="Revenue this month" value={`£${liveRevThisMonth.toLocaleString()}`}
          sub={`£${liveRevQ.toLocaleString()} this quarter`} color={teal} trend="up" />
        <MetricCard label="Cost per call (all time)" value={`£${liveCostPerCall}`}
          sub="Rolling 4-week average" />
        <MetricCard label="Cost per proposal" value={`£${liveCostPerProposal}`}
          sub="Cost to reach proposal stage" />
        <MetricCard label="Total revenue closed" value={`£${liveTotalRevenueClosed.toLocaleString()}`}
          sub={`${liveClosedWon} deal${liveClosedWon !== 1 ? 's' : ''} closed`} color={teal} trend="up" />
        <MetricCard label="Active creatives" value={String(SEED_CREATIVES.filter(c=>c.status==='active').length)}
          sub={`${SEED_CREATIVES.filter(c=>c.status==='paused').length} paused`} />
      </div>

      {/* ── Timeframe selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p style={{ fontSize: 11, color: muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Timeframe:</p>
        {(['4w', '8w', '12w'] as const).map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)}
            style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${timeframe === tf ? teal : border}`, background: timeframe === tf ? `${teal}15` : 'transparent', color: timeframe === tf ? teal : muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {tf === '4w' ? '4 weeks' : tf === '8w' ? '8 weeks' : '12 weeks'}
          </button>
        ))}
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: muted }}>Weekly — booked, qualified & proposals (12 weeks)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: surface, border: `1px solid ${border}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: muted }} />
              <Line type="monotone" dataKey="booked" stroke={teal} strokeWidth={2} dot={false} name="Booked" />
              <Line type="monotone" dataKey="qual" stroke={pink} strokeWidth={2} dot={false} name="Qualified" />
              <Line type="monotone" dataKey="props" stroke={amber} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Proposals" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: muted }}>Pipeline funnel — conversion rates</p>
          <div className="space-y-2 mt-3">
            {funnelData.map((row, i) => (
              <div key={row.stage} className="flex items-center gap-3">
                <span className="text-xs w-16 text-right flex-shrink-0" style={{ color: muted }}>{row.stage}</span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', height: 20 }}>
                  <div className="h-full rounded-full flex items-center px-2"
                    style={{ width: `${row.pct}%`, background: i === 0 ? teal : i === funnelData.length-1 ? green : pink, minWidth: row.count > 0 ? 24 : 0 }}>
                    {row.count > 0 && <span className="text-[10px] font-bold text-white">{row.count}</span>}
                  </div>
                </div>
                <span className="text-xs w-8 flex-shrink-0 font-bold" style={{ color: '#F0F2F8' }}>{row.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: muted }}>Ad spend vs revenue — 12 weeks</p>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={liveSpendRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
              <Tooltip contentStyle={{ background: surface, border: `1px solid ${border}`, fontSize: 12 }}  />
              <Legend wrapperStyle={{ fontSize: 11, color: muted }} />
              <Bar yAxisId="left" dataKey="spend" fill={`${pink}80`} radius={[2,2,0,0]} name="Spend" />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke={teal} strokeWidth={2} dot={false} name="Revenue" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: muted }}>Cost per call — weekly vs running average</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={liveRunningAvgData}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} tickFormatter={v => `£${v}`} />
              <Tooltip contentStyle={{ background: surface, border: `1px solid ${border}`, fontSize: 12 }}  />
              <Legend wrapperStyle={{ fontSize: 11, color: muted }} />
              <Line type="monotone" dataKey="weekly" stroke={`${teal}80`} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Weekly CPC" />
              <Line type="monotone" dataKey="cpc" stroke={teal} strokeWidth={2} dot={false} name="Running avg" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Alerts + Upcoming ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>
            Flags {(liveOverdue.length + liveStaleProposals.length + liveNoContact.length + liveUpcomingSecond.length) > 0 &&
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px]" style={{ background: `${pink}20`, color: pink }}>
                {liveOverdue.length + liveStaleProposals.length + liveNoContact.length + liveUpcomingSecond.length}
              </span>}
          </p>
          {liveOverdue.length + liveStaleProposals.length + liveNoContact.length + liveUpcomingSecond.length === 0 ? (
            <p className="text-sm" style={{ color: muted }}>No flags. All clear.</p>
          ) : (
            <div className="space-y-2">
              {liveOverdue.map(l => (
                <div key={l.id} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: `${pink}10`, border: `1px solid ${pink}25` }}>
                  <AlertCircle size={13} style={{ color: pink, flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: '#F0F2F8' }}><strong>{l.name}</strong> — call date passed, needs stage update</p>
                </div>
              ))}
              {liveStaleProposals.map(l => (
                <div key={l.id} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: `${amber}10`, border: `1px solid ${amber}25` }}>
                  <AlertCircle size={13} style={{ color: amber, flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: '#F0F2F8' }}><strong>{l.name}</strong> — proposal {Math.floor((realNow.getTime()-new Date(l.proposal_sent_at!).getTime())/86400000)}d old with no update</p>
                </div>
              ))}
              {liveUpcomingSecond.map(l => (
                <div key={l.id} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: `${teal}08`, border: `1px solid ${teal}20` }}>
                  <Calendar size={13} style={{ color: teal, flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: '#F0F2F8' }}><strong>{l.name}</strong> — second call {l.second_call_datetime ? new Date(l.second_call_datetime).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}) : ''}</p>
                </div>
              ))}
              {liveNoContact.map(l => (
                <div key={l.id} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}` }}>
                  <AlertCircle size={13} style={{ color: muted, flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: '#F0F2F8' }}><strong>{l.name}</strong> — no contact in {Math.floor((realNow.getTime()-new Date(l.last_contact_at!).getTime())/86400000)}d</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Upcoming calls (next 7 days)</p>
          {upcomingCalls.length === 0 ? (
            <p className="text-sm" style={{ color: muted }}>No calls scheduled.</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingCalls.map(l => (
                <div key={l.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: teal }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: '#F0F2F8' }}>{l.name}</p>
                    <p className="text-xs" style={{ color: muted }}>
                      {l.call_datetime ? new Date(l.call_datetime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}{' '}
                      {l.call_datetime ? new Date(l.call_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                      {l.industry && ` · ${l.industry}`}
                    </p>
                  </div>
                  {l.utm_content && creativeMap[l.utm_content] && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${pink}15`, color: pink }}>
                      {creativeMap[l.utm_content].split(' — ')[0].replace('Hook ','H')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
