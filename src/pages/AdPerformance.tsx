import { useState } from 'react'
import { SEED_LEADS, SEED_AD_PERFORMANCE, SEED_CREATIVES } from '../lib/seed'

const pink = '#FF0D64'
const teal = '#3FEACE'
const amber = '#FFA71A'
const muted = '#8891A8'
const border = 'rgba(255,255,255,0.08)'
const surface = '#161B27'
const green = '#22C55E'

type SortKey = 'spend' | 'leads' | 'closes' | 'roas' | 'cpa' | 'showRate'

export default function AdPerformance() {
  const [sortBy, setSortBy] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const rows = SEED_CREATIVES.map(creative => {
    const perf = SEED_AD_PERFORMANCE.filter(p => p.creative_id === creative.id)
    const spend = perf.reduce((s, p) => s + p.spend, 0)
    const impressions = perf.reduce((s, p) => s + p.impressions, 0)
    const clicks = perf.reduce((s, p) => s + p.clicks, 0)
    const ctr = impressions ? (clicks / impressions) * 100 : 0

    const creativeLeads = SEED_LEADS.filter(l => l.utm_content === creative.utm_content_value)
    const leads = creativeLeads.length
    const showed = creativeLeads.filter(l => ['showed','qualified','second_call_booked','proposal_sent','closed_won','closed_lost'].includes(l.stage)).length
    const qualified = creativeLeads.filter(l => ['qualified','second_call_booked','proposal_sent','closed_won'].includes(l.stage)).length
    const proposals = creativeLeads.filter(l => ['proposal_sent','closed_won'].includes(l.stage)).length
    const closes = creativeLeads.filter(l => l.stage === 'closed_won').length
    const revenue = creativeLeads.filter(l => l.revenue).reduce((s, l) => s + (l.revenue || 0), 0)
    const cpl = leads ? spend / leads : 0
    const cpa = closes ? spend / closes : 0
    const roas = spend ? revenue / spend : 0
    const showRate = leads ? (showed / leads) * 100 : 0

    return { creative, spend, impressions, clicks, ctr, leads, showed, qualified, proposals, closes, revenue, cpl, cpa, roas, showRate }
  })

  const sorted = [...rows].sort((a, b) => {
    const aVal = a[sortBy] as number
    const bVal = b[sortBy] as number
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal
  })

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(key); setSortDir('desc') }
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
      style={{ color: sortBy === k ? '#F0F2F8' : muted }}
      onClick={() => handleSort(k)}>
      {label}{sortBy === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Ad Performance</h1>
        <p className="text-sm mt-0.5" style={{ color: muted }}>Full-funnel attribution — from ad creative to closed deal</p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: surface, border: `1px solid ${border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ borderBottom: `1px solid ${border}` }}>
              <tr>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: muted }}>Creative</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: muted }}>Status</th>
                <SortHeader label="Spend" k="spend" />
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: muted }}>CTR</th>
                <SortHeader label="Leads" k="leads" />
                <SortHeader label="Show %" k="showRate" />
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: muted }}>Qualified</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: muted }}>Proposals</th>
                <SortHeader label="Closes" k="closes" />
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: muted }}>Revenue</th>
                <SortHeader label="CPA" k="cpa" />
                <SortHeader label="ROAS" k="roas" />
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: border }}>
              {sorted.map(row => {
                const isWinner = row.roas > 2 && row.closes > 0
                const isPitfall = row.spend > 500 && row.closes === 0
                const rowBg = isWinner ? `${teal}06` : isPitfall ? `${pink}06` : 'transparent'
                return (
                  <tr key={row.creative.id} style={{ background: rowBg }}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-sm leading-tight" style={{ color: '#F0F2F8' }}>{row.creative.name}</p>
                      {row.creative.hook_text && (
                        <p className="text-[11px] mt-0.5 truncate max-w-xs italic" style={{ color: muted }}>{row.creative.hook_text}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{
                        background: row.creative.status === 'active' ? `${teal}15` : 'rgba(255,255,255,0.06)',
                        color: row.creative.status === 'active' ? teal : muted
                      }}>
                        {row.creative.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium" style={{ color: '#F0F2F8' }}>£{Math.round(row.spend).toLocaleString()}</td>
                    <td className="px-3 py-3" style={{ color: muted }}>{row.ctr.toFixed(1)}%</td>
                    <td className="px-3 py-3 font-medium" style={{ color: '#F0F2F8' }}>{row.leads}</td>
                    <td className="px-3 py-3" style={{ color: row.showRate >= 70 ? green : row.showRate >= 50 ? amber : pink }}>
                      {row.leads ? `${Math.round(row.showRate)}%` : '—'}
                    </td>
                    <td className="px-3 py-3" style={{ color: muted }}>{row.qualified}</td>
                    <td className="px-3 py-3" style={{ color: muted }}>{row.proposals}</td>
                    <td className="px-3 py-3 font-bold" style={{ color: row.closes > 0 ? teal : muted }}>{row.closes}</td>
                    <td className="px-3 py-3 font-medium" style={{ color: row.revenue > 0 ? '#F0F2F8' : muted }}>
                      {row.revenue > 0 ? `£${row.revenue.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-3" style={{ color: row.cpa > 0 ? (row.cpa < 2000 ? green : amber) : muted }}>
                      {row.cpa > 0 ? `£${Math.round(row.cpa).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-3 font-bold" style={{ color: row.roas >= 2 ? teal : row.roas >= 1 ? amber : row.roas > 0 ? pink : muted }}>
                      {row.roas > 0 ? `${row.roas.toFixed(1)}x` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
