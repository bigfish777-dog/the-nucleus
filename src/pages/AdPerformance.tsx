import { useState, useEffect } from 'react'
import { SEED_LEADS, REAL_AD_PERFORMANCE as SEED_AD_PERFORMANCE, REAL_CREATIVES as SEED_CREATIVES } from '../lib/seed'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { isLeadInNewFunnel } from '../lib/cutover'
import type { Lead } from '../types'

const pink = '#FF0D64'; const teal = '#3FEACE'; const amber = '#FFA71A'
const muted = '#8891A8'; const border = 'rgba(255,255,255,0.08)'; const surface = '#161B27'; const green = '#22C55E'

type SortKey = 'spend' | 'leads' | 'closes' | 'roas' | 'cpa' | 'showRate' | 'cpl'

const STAGE_LABELS: {[key: string]: string} = {
  booked: 'Call Booked', no_show: 'No-Show', disqualified: "DQ'd",
  qualified: 'Awaiting Proposal', second_call_booked: 'Awaiting Proposal',
  proposal_sent: 'Proposal Sent', proposal_live: 'Proposal Live',
  closed_won: 'Closed Won', closed_lost: 'Closed Lost', abandoned: 'Abandoned',
  cancelled: 'Cancelled', spam: 'Spam', test: 'Test', second_call_no_show: '2nd No-Show',
}
const STAGE_COLORS: {[key: string]: string} = {
  booked: teal, no_show: pink, disqualified: pink, cancelled: pink, spam: pink, test: muted,
  qualified: amber, second_call_booked: amber, proposal_sent: amber, proposal_live: amber,
  closed_won: green, closed_lost: pink, abandoned: muted, second_call_no_show: pink,
}

export default function AdPerformance() {
  const [sortBy, setSortBy] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [allLeads, setLeads] = useState<Lead[]>(SEED_LEADS as Lead[])
  const [adPerf, setAdPerf] = useState(SEED_AD_PERFORMANCE)
  const [creatives, setCreatives] = useState(SEED_CREATIVES)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('../lib/supabase')
        const [leadsRes, perfRes, creativesRes] = await Promise.all([
          supabase.from('leads').select('*'),
          supabase.from('ad_performance_daily').select('*'),
          supabase.from('ad_creatives').select('*'),
        ])
        if (leadsRes.data && leadsRes.data.length > 0) setLeads(leadsRes.data as Lead[])
        if (perfRes.data && perfRes.data.length > 0) setAdPerf(perfRes.data as typeof SEED_AD_PERFORMANCE)
        if (creativesRes.data && creativesRes.data.length > 0) setCreatives(creativesRes.data as typeof SEED_CREATIVES)
      } catch { /* fall back to seed */ }
    }
    load()
  }, [])

  const rows = creatives.map(creative => {
    const perf = adPerf.filter(p => p.creative_id === creative.id)
    const spend = perf.reduce((s, p) => s + p.spend, 0)
    const impressions = perf.reduce((s, p) => s + (p.impressions || 0), 0)
    const clicks = perf.reduce((s, p) => s + (p.clicks || 0), 0)
    const ctr = impressions ? (clicks / impressions) * 100 : 0
    const creativeLeads = allLeads.filter((l: Lead) => l.utm_content === creative.utm_content_value && isLeadInNewFunnel(l))
    const leadCount = creativeLeads.length
    const showed = creativeLeads.filter((l: Lead) => ['showed','qualified','second_call_booked','proposal_sent','proposal_live','closed_won','closed_lost'].includes(l.stage)).length
    const qualified = creativeLeads.filter((l: Lead) => ['qualified','second_call_booked','proposal_sent','proposal_live','closed_won'].includes(l.stage)).length
    const proposals = creativeLeads.filter((l: Lead) => ['proposal_sent','proposal_live','closed_won'].includes(l.stage)).length
    const closes = creativeLeads.filter((l: Lead) => l.stage === 'closed_won').length
    const revenue = creativeLeads.reduce((s: number, l: Lead) => s + (Number(l.revenue) || 0), 0)
    const cpl = leadCount ? spend / leadCount : 0
    const cpa = closes ? spend / closes : 0
    const roas = spend ? revenue / spend : 0
    const showRate = leadCount ? (showed / leadCount) * 100 : 0
    return { creative, spend, impressions, clicks, ctr, leads: leadCount, showed, qualified, proposals, closes, revenue, cpl, cpa, roas, showRate, creativeLeads }
  })

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortBy] as number; const bv = b[sortBy] as number
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(key); setSortDir('desc') }
  }

  const SortTh = ({ label, k, right = false }: { label: string; k: SortKey; right?: boolean }) => (
    <th className={`px-3 py-3 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
      style={{ color: sortBy === k ? '#F0F2F8' : muted }}
      onClick={() => handleSort(k)}>
      {label}{sortBy === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  // Totals row
  const totals = rows.reduce((acc, r) => ({
    spend: acc.spend + r.spend, leads: acc.leads + r.leads,
    closes: acc.closes + r.closes, revenue: acc.revenue + r.revenue,
  }), { spend: 0, leads: 0, closes: 0, revenue: 0 })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Ad Performance</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>Full-funnel attribution — creative to closed deal</p>
        </div>
        {/* Summary pills */}
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Total spend', value: `£${Math.round(totals.spend).toLocaleString()}` },
            { label: 'Total leads', value: String(totals.leads) },
            { label: 'Closes', value: String(totals.closes), color: teal },
            { label: 'Revenue', value: `£${totals.revenue.toLocaleString()}`, color: teal },
            { label: 'Overall ROAS', value: totals.spend ? `${(totals.revenue / totals.spend).toFixed(1)}x` : '—', color: totals.revenue > totals.spend ? teal : pink },
          ].map(p => (
            <div key={p.label} className="rounded-lg px-3 py-2 text-right" style={{ background: surface, border: `1px solid ${border}` }}>
              <p className="text-xs font-bold" style={{ color: p.color || '#F0F2F8' }}>{p.value}</p>
              <p className="text-[10px]" style={{ color: muted }}>{p.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: surface, border: `1px solid ${border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ borderBottom: `1px solid ${border}` }}>
              <tr>
                <th className="w-8" />
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: muted }}>Creative</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>Status</th>
                <SortTh label="Spend" k="spend" right />
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: muted }}>CTR</th>
                <SortTh label="Leads" k="leads" right />
                <SortTh label="CPL" k="cpl" right />
                <SortTh label="Show%" k="showRate" right />
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>Qual</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>Props</th>
                <SortTh label="Closes" k="closes" right />
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: muted }}>Revenue</th>
                <SortTh label="CPA" k="cpa" right />
                <SortTh label="ROAS" k="roas" right />
                <th className="px-3 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const isWinner = row.roas > 2 && row.closes > 0
                const isPitfall = row.spend > 1000 && row.closes === 0
                const rowBg = isWinner ? `${teal}05` : isPitfall ? `${pink}05` : 'transparent'
                const isExp = expanded === row.creative.id

                return <>
                  <tr key={row.creative.id}
                    className="cursor-pointer transition-colors"
                    style={{ background: rowBg, borderBottom: `1px solid ${border}` }}
                    onMouseEnter={e => !isExp && (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                    onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                    onClick={() => setExpanded(isExp ? null : row.creative.id)}>
                    <td className="pl-3 py-3">
                      <span style={{ color: muted }}>{isExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</span>
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      <p className="font-medium text-sm leading-tight truncate" style={{ color: '#F0F2F8' }}>{row.creative.name}</p>
                      {row.creative.hook_text && <p className="text-[11px] mt-0.5 truncate italic" style={{ color: muted }}>{row.creative.hook_text.substring(0,60)}…</p>}
                      {isWinner && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: `${teal}20`, color: teal }}>WINNER</span>}
                      {isPitfall && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: `${pink}20`, color: pink }}>MONEY PIT</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: row.creative.status==='active' ? `${teal}15` : 'rgba(255,255,255,0.06)', color: row.creative.status==='active' ? teal : muted }}>{row.creative.status}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium" style={{ color: '#F0F2F8' }}>£{Math.round(row.spend).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right" style={{ color: muted }}>{row.ctr.toFixed(1)}%</td>
                    <td className="px-3 py-3 text-right font-medium" style={{ color: '#F0F2F8' }}>{row.leads}</td>
                    <td className="px-3 py-3 text-right" style={{ color: muted }}>{row.leads ? `£${Math.round(row.cpl)}` : '—'}</td>
                    <td className="px-3 py-3 text-right" style={{ color: row.showRate >= 70 ? green : row.showRate >= 50 ? amber : row.showRate > 0 ? pink : muted }}>
                      {row.leads ? `${Math.round(row.showRate)}%` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right" style={{ color: muted }}>{row.qualified}</td>
                    <td className="px-3 py-3 text-right" style={{ color: muted }}>{row.proposals}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: row.closes > 0 ? teal : muted }}>{row.closes}</td>
                    <td className="px-3 py-3 text-right" style={{ color: row.revenue > 0 ? '#F0F2F8' : muted }}>{row.revenue > 0 ? `£${row.revenue.toLocaleString()}` : '—'}</td>
                    <td className="px-3 py-3 text-right" style={{ color: row.cpa > 0 ? (row.cpa < 2000 ? green : amber) : muted }}>{row.cpa > 0 ? `£${Math.round(row.cpa).toLocaleString()}` : '—'}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: row.roas >= 2 ? teal : row.roas >= 1 ? amber : row.roas > 0 ? pink : muted }}>
                      {row.roas > 0 ? `${row.roas.toFixed(1)}x` : '—'}
                    </td>
                    <td className="pr-3 py-3">
                      <button onClick={e => { e.stopPropagation(); navigate('/creatives', { state: { highlight: row.creative.id } }) }}
                        className="p-1 rounded transition-colors" style={{ color: muted }}
                        onMouseEnter={e => (e.currentTarget.style.color = pink)}
                        onMouseLeave={e => (e.currentTarget.style.color = muted)}
                        title="View in Creative Library">
                        <ExternalLink size={13} />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded: individual allLeads */}
                  {isExp && (
                    <tr style={{ borderBottom: `1px solid ${border}` }}>
                      <td colSpan={15} className="px-6 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: muted }}>
                          Individual leads from this creative ({row.creativeLeads.length})
                        </p>
                        {row.creativeLeads.length === 0 ? (
                          <p className="text-sm" style={{ color: muted }}>No leads yet.</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {row.creativeLeads.map((lead: Lead) => (
                              <div key={lead.id} className="flex items-center justify-between rounded-lg px-3 py-2"
                                style={{ background: surface, border: `1px solid ${border}` }}>
                                <div>
                                  <p className="text-sm font-medium" style={{ color: '#F0F2F8' }}>{lead.name}</p>
                                  <p className="text-xs" style={{ color: muted }}>{lead.industry}</p>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${STAGE_COLORS[lead.stage] || muted}15`, color: STAGE_COLORS[lead.stage] || muted }}>
                                  {STAGE_LABELS[lead.stage] || lead.stage}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
