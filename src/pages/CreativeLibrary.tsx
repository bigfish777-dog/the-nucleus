import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SEED_CREATIVES, SEED_LEADS, SEED_AD_PERFORMANCE } from '../lib/seed'
import { ChevronDown, ChevronRight, Tag, GitBranch } from 'lucide-react'

const pink = '#FF0D64'; const teal = '#3FEACE'; const amber = '#FFA71A'
const muted = '#8891A8'; const border = 'rgba(255,255,255,0.08)'; const surface = '#161B27'

const HOOK_TYPES = ['All', 'direct_response', 'qualifier', 'testimonial']

export default function CreativeLibrary() {
  const location = useLocation()
  const highlight = (location.state as any)?.highlight as string | undefined
  const [expanded, setExpanded] = useState<string | null>(highlight || null)
  const [filter, setFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    if (highlight) {
      setExpanded(highlight)
      // Scroll to it after render
      setTimeout(() => {
        document.getElementById(`creative-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [highlight])

  const creativeRows = SEED_CREATIVES.map(creative => {
    const perf = SEED_AD_PERFORMANCE.filter(p => p.creative_id === creative.id)
    const spend = perf.reduce((s, p) => s + p.spend, 0)
    const leads = SEED_LEADS.filter(l => l.utm_content === creative.utm_content_value).length
    const closes = SEED_LEADS.filter(l => l.utm_content === creative.utm_content_value && l.stage === 'closed_won').length
    const revenue = SEED_LEADS.filter(l => l.utm_content === creative.utm_content_value && l.revenue).reduce((s, l) => s + (l.revenue || 0), 0)
    const roas = spend ? revenue / spend : 0
    const iteratedFrom = creative.iterated_from ? SEED_CREATIVES.find(c => c.id === creative.iterated_from) : null
    const iterations = SEED_CREATIVES.filter(c => c.iterated_from === creative.id)
    return { creative, spend, leads, closes, revenue, roas, iteratedFrom, iterations }
  })

  const filtered = creativeRows.filter(r =>
    (filter === 'All' || r.creative.hook_type === filter) &&
    (statusFilter === 'All' || r.creative.status === statusFilter)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Creative Library</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>Scripts, hooks, and full-funnel performance in one place</p>
        </div>
        {/* Filters */}
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${border}` }}>
            {['All','active','paused','retired'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                style={{ background: statusFilter === s ? pink : 'transparent', color: statusFilter === s ? 'white' : muted }}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${border}` }}>
            {HOOK_TYPES.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className="px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                style={{ background: filter === t ? surface : 'transparent', color: filter === t ? '#F0F2F8' : muted }}>
                {t === 'All' ? 'All types' : t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(({ creative, spend, leads, closes, revenue, roas, iteratedFrom, iterations }) => {
          const isExp = expanded === creative.id
          const isHighlighted = highlight === creative.id

          return (
            <div key={creative.id} id={`creative-${creative.id}`}
              className="rounded-xl overflow-hidden transition-all"
              style={{ background: surface, border: `1px solid ${isHighlighted ? pink : border}`, boxShadow: isHighlighted ? `0 0 0 1px ${pink}` : 'none' }}>

              {/* Header row */}
              <button className="w-full flex items-start gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpanded(isExp ? null : creative.id)}>
                <div className="mt-0.5 flex-shrink-0" style={{ color: muted }}>
                  {isExp ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: '#F0F2F8' }}>{creative.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{
                      background: creative.status==='active' ? `${teal}15` : creative.status==='retired' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
                      color: creative.status==='active' ? teal : muted }}>
                      {creative.status}
                    </span>
                    {creative.hook_type && (
                      <span className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1" style={{ background: `${pink}10`, color: pink }}>
                        <Tag size={9}/>{creative.hook_type.replace('_',' ')}
                      </span>
                    )}
                    {iteratedFrom && (
                      <span className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.05)', color: muted }}>
                        <GitBranch size={9}/>from {iteratedFrom.name.split(' — ')[0]}
                      </span>
                    )}
                  </div>
                  {creative.hook_text && (
                    <p className="text-xs mt-1 italic" style={{ color: muted }}>&ldquo;{creative.hook_text}&rdquo;</p>
                  )}
                  {iterations.length > 0 && (
                    <p className="text-[10px] mt-1" style={{ color: muted }}>
                      {iterations.length} iteration{iterations.length > 1 ? 's' : ''}: {iterations.map(i => i.name.split(' — ')[0]).join(', ')}
                    </p>
                  )}
                </div>

                {/* Performance summary */}
                <div className="flex gap-5 flex-shrink-0 text-right">
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#F0F2F8' }}>£{Math.round(spend).toLocaleString()}</p>
                    <p className="text-[10px]" style={{ color: muted }}>spend</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: leads > 0 ? '#F0F2F8' : muted }}>{leads}</p>
                    <p className="text-[10px]" style={{ color: muted }}>leads</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: closes > 0 ? teal : muted }}>{closes}</p>
                    <p className="text-[10px]" style={{ color: muted }}>closes</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: revenue > 0 ? '#F0F2F8' : muted }}>
                      {revenue > 0 ? `£${revenue.toLocaleString()}` : '—'}
                    </p>
                    <p className="text-[10px]" style={{ color: muted }}>revenue</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: roas >= 2 ? teal : roas >= 1 ? amber : roas > 0 ? pink : muted }}>
                      {roas > 0 ? `${roas.toFixed(1)}x` : '—'}
                    </p>
                    <p className="text-[10px]" style={{ color: muted }}>ROAS</p>
                  </div>
                </div>
              </button>

              {/* Expanded */}
              {isExp && (
                <div className="border-t px-4 pb-5 pt-4" style={{ borderColor: border }}>
                  <div className="grid grid-cols-5 gap-4">
                    {/* Script — takes 3 cols */}
                    <div className="col-span-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: muted }}>Full script</p>
                      <pre className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl p-4"
                        style={{ background: 'rgba(255,255,255,0.03)', color: '#F0F2F8', fontFamily: 'inherit', border: `1px solid ${border}` }}>
                        {creative.full_script || 'No script stored yet.'}
                      </pre>
                      {creative.notes && (
                        <div className="mt-3 rounded-lg p-3" style={{ background: `${amber}08`, border: `1px solid ${amber}20` }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: amber }}>Notes</p>
                          <p className="text-sm" style={{ color: '#F0F2F8' }}>{creative.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Details — takes 2 cols */}
                    <div className="col-span-2 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: muted }}>Details</p>
                        <div className="space-y-2">
                          {[
                            ['UTM content', creative.utm_content_value],
                            ['Launched', creative.launched_at || '—'],
                            ['Hook type', creative.hook_type?.replace('_',' ') || '—'],
                            ['Iterated from', iteratedFrom?.name || '—'],
                          ].map(([l, v]) => (
                            <div key={l} className="flex justify-between gap-2 text-xs">
                              <span style={{ color: muted }}>{l}</span>
                              <span className="text-right font-medium" style={{ color: '#F0F2F8' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Performance detail */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: muted }}>Performance</p>
                        <div className="space-y-2">
                          {[
                            ['Total spend', `£${Math.round(spend).toLocaleString()}`],
                            ['Leads generated', String(leads)],
                            ['CPL', leads ? `£${Math.round(spend/leads)}` : '—'],
                            ['Qualified', String(SEED_LEADS.filter(l=>l.utm_content===creative.utm_content_value && ['qualified','second_call_booked','proposal_sent','closed_won'].includes(l.stage)).length)],
                            ['Closes', String(closes)],
                            ['Revenue', revenue > 0 ? `£${revenue.toLocaleString()}` : '—'],
                            ['ROAS', roas > 0 ? `${roas.toFixed(2)}x` : '—'],
                          ].map(([l, v]) => (
                            <div key={l} className="flex justify-between gap-2 text-xs">
                              <span style={{ color: muted }}>{l}</span>
                              <span className="font-bold" style={{ color: '#F0F2F8' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Iterations */}
                      {iterations.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: muted }}>Iterations</p>
                          {iterations.map(it => (
                            <div key={it.id} className="flex items-center gap-2 py-1.5 border-b text-xs" style={{ borderColor: border }}>
                              <GitBranch size={10} style={{ color: muted }}/>
                              <span style={{ color: '#F0F2F8' }}>{it.name.split(' — ')[0]}</span>
                              <span className="ml-auto" style={{ color: it.status==='active' ? teal : muted }}>{it.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
