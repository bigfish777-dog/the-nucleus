import { SEED_LEADS, SEED_AD_PERFORMANCE, SEED_CREATIVES } from '../lib/seed'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, AlertCircle, Calendar } from 'lucide-react'

const pink = '#FF0D64'
const teal = '#3FEACE'
const amber = '#FFA71A'
const muted = '#8891A8'
const border = 'rgba(255,255,255,0.08)'
const surface = '#161B27'

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`}
      style={{ background: surface, border: `1px solid ${border}` }}>
      {children}
    </div>
  )
}

function MetricCard({ label, value, sub, trend, color = '#F0F2F8' }: {
  label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'flat'; color?: string
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: muted }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && (
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <TrendingUp size={12} style={{ color: teal }} />}
          {trend === 'down' && <TrendingDown size={12} style={{ color: pink }} />}
          <p className="text-xs" style={{ color: muted }}>{sub}</p>
        </div>
      )}
    </Card>
  )
}

// Compute metrics from seed data
const leads = SEED_LEADS
const now = new Date('2026-03-22')
const weekAgo = new Date('2026-03-15')

const thisWeekBooked = leads.filter(l => l.booked_at && new Date(l.booked_at) >= weekAgo).length
const lastWeekBooked = leads.filter(l => l.booked_at && new Date(l.booked_at) >= new Date('2026-03-08') && new Date(l.booked_at) < weekAgo).length
const showed = leads.filter(l => ['showed','qualified','second_call_booked','proposal_sent','closed_won','closed_lost'].includes(l.stage)).length
const allBooked = leads.filter(l => l.booking_completed).length
const showRate = allBooked ? Math.round((showed / allBooked) * 100) : 0
const liveProposals = leads.filter(l => l.stage === 'proposal_sent').length
const revThisMonth = leads.filter(l => l.revenue && l.stage === 'closed_won').reduce((s, l) => s + (l.revenue || 0), 0)
const revThisQuarter = revThisMonth // same for demo

// Cost per call from ad performance
const totalSpend = SEED_AD_PERFORMANCE.filter(p => new Date(p.date) >= new Date('2026-02-22')).reduce((s, p) => s + p.spend, 0)
const costPerCall = allBooked ? Math.round(totalSpend / allBooked) : 0

// Upcoming calls
const upcomingCalls = leads
  .filter(l => l.call_datetime && new Date(l.call_datetime) >= now && l.stage === 'booked')
  .sort((a, b) => new Date(a.call_datetime!).getTime() - new Date(b.call_datetime!).getTime())
  .slice(0, 5)

// Alerts
const overdueStage = leads.filter(l =>
  l.stage === 'booked' && l.call_datetime && new Date(l.call_datetime) < now
)
const staleProposals = leads.filter(l =>
  l.stage === 'proposal_sent' && l.proposal_sent_at &&
  (now.getTime() - new Date(l.proposal_sent_at).getTime()) > 7 * 24 * 60 * 60 * 1000
)
const noContact = leads.filter(l =>
  l.last_contact_at &&
  (now.getTime() - new Date(l.last_contact_at).getTime()) > 14 * 24 * 60 * 60 * 1000 &&
  !['closed_won','closed_lost','abandoned'].includes(l.stage)
)

// Weekly trend chart data (last 8 weeks)
const weeklyData = Array.from({ length: 8 }, (_, i) => {
  const wEnd = new Date(now)
  wEnd.setDate(wEnd.getDate() - i * 7)
  const wStart = new Date(wEnd)
  wStart.setDate(wStart.getDate() - 7)
  const label = `W${8-i}`
  const booked = leads.filter(l => l.booked_at && new Date(l.booked_at) >= wStart && new Date(l.booked_at) < wEnd).length
  const qualified = leads.filter(l => ['qualified','second_call_booked','proposal_sent','closed_won'].includes(l.stage) && l.call_datetime && new Date(l.call_datetime) >= wStart && new Date(l.call_datetime) < wEnd).length
  const spend = SEED_AD_PERFORMANCE.filter(p => new Date(p.date) >= wStart && new Date(p.date) < wEnd).reduce((s, p) => s + p.spend, 0)
  return { label, booked, qualified, spend: Math.round(spend) }
}).reverse()

// Funnel data
const funnelData = [
  { stage: 'Booked', count: leads.filter(l => l.booking_completed).length },
  { stage: 'Showed', count: leads.filter(l => ['showed','qualified','second_call_booked','proposal_sent','closed_won'].includes(l.stage)).length },
  { stage: 'Qualified', count: leads.filter(l => ['qualified','second_call_booked','proposal_sent','closed_won'].includes(l.stage)).length },
  { stage: 'Proposal', count: leads.filter(l => ['proposal_sent','closed_won'].includes(l.stage)).length },
  { stage: 'Closed', count: leads.filter(l => l.stage === 'closed_won').length },
]

const creativeMap = Object.fromEntries(SEED_CREATIVES.map(c => [c.utm_content_value, c.name]))

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: muted }}>Acquisition overview — {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Calls booked this week" value={String(thisWeekBooked)}
          sub={`${thisWeekBooked >= lastWeekBooked ? '+' : ''}${thisWeekBooked - lastWeekBooked} vs last week`}
          trend={thisWeekBooked >= lastWeekBooked ? 'up' : 'down'} color={teal} />
        <MetricCard label="Show rate (30d)" value={`${showRate}%`}
          sub="Target: 70%+" trend={showRate >= 70 ? 'up' : 'down'} />
        <MetricCard label="Live proposals" value={String(liveProposals)}
          sub="Awaiting decision" color={amber} />
        <MetricCard label="Revenue this month" value={`£${revThisMonth.toLocaleString()}`}
          sub={`£${revThisQuarter.toLocaleString()} this quarter`} color={teal} trend="up" />
        <MetricCard label="Avg cost per call" value={`£${costPerCall}`}
          sub="Rolling 4 weeks" />
        <MetricCard label="Total pipeline leads" value={String(leads.filter(l => !['closed_lost','abandoned'].includes(l.stage)).length)}
          sub="Active opportunities" />
        <MetricCard label="Total revenue closed" value={`£${leads.filter(l=>l.revenue).reduce((s,l)=>s+(l.revenue||0),0).toLocaleString()}`}
          sub="All time" color={pink} />
        <MetricCard label="Active creatives" value={String(SEED_CREATIVES.filter(c=>c.status==='active').length)}
          sub={`${SEED_CREATIVES.filter(c=>c.status==='paused').length} paused`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: muted }}>Weekly trend — calls booked vs qualified</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: surface, border: `1px solid ${border}`, fontSize: 12 }} />
              <Line type="monotone" dataKey="booked" stroke={teal} strokeWidth={2} dot={false} name="Booked" />
              <Line type="monotone" dataKey="qualified" stroke={pink} strokeWidth={2} dot={false} name="Qualified" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: muted }}>Pipeline funnel — conversion rates</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={border} />
              <XAxis type="number" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={70} />
              <Tooltip contentStyle={{ background: surface, border: `1px solid ${border}`, fontSize: 12 }} />
              <Bar dataKey="count" fill={pink} radius={[0, 4, 4, 0]} name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Alerts + Upcoming calls */}
      <div className="grid grid-cols-2 gap-4">
        {/* Alerts */}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: muted }}>Flags needing attention</p>
          {overdueStage.length === 0 && staleProposals.length === 0 && noContact.length === 0 ? (
            <p className="text-sm" style={{ color: muted }}>No flags right now.</p>
          ) : (
            <div className="space-y-2">
              {overdueStage.map(l => (
                <div key={l.id} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: `${pink}10`, border: `1px solid ${pink}30` }}>
                  <AlertCircle size={14} style={{ color: pink, flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: '#F0F2F8' }}><strong>{l.name}</strong> — call date passed, still in Booked</p>
                </div>
              ))}
              {staleProposals.map(l => (
                <div key={l.id} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: `${amber}10`, border: `1px solid ${amber}30` }}>
                  <AlertCircle size={14} style={{ color: amber, flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: '#F0F2F8' }}><strong>{l.name}</strong> — proposal sent {l.proposal_sent_at ? Math.floor((now.getTime() - new Date(l.proposal_sent_at).getTime()) / 86400000) : '?'}d ago, no update</p>
                </div>
              ))}
              {noContact.map(l => (
                <div key={l.id} className="flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}` }}>
                  <AlertCircle size={14} style={{ color: muted, flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: '#F0F2F8' }}><strong>{l.name}</strong> — no contact in {l.last_contact_at ? Math.floor((now.getTime() - new Date(l.last_contact_at).getTime()) / 86400000) : '?'} days</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming calls */}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: muted }}>Upcoming calls</p>
          {upcomingCalls.length === 0 ? (
            <p className="text-sm" style={{ color: muted }}>No calls scheduled in the next 7 days.</p>
          ) : (
            <div className="space-y-3">
              {upcomingCalls.map(l => (
                <div key={l.id} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Calendar size={14} style={{ color: teal, flexShrink: 0, marginTop: 2 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#F0F2F8' }}>{l.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: muted }}>
                      {l.call_datetime ? new Date(l.call_datetime).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                  {l.utm_content && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${pink}15`, color: pink }}>
                      {creativeMap[l.utm_content]?.split(' — ')[0] || l.utm_content}
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
