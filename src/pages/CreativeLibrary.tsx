import { useState } from 'react'
import { SEED_CREATIVES, SEED_LEADS, SEED_AD_PERFORMANCE } from '../lib/seed'
import { ChevronDown, ChevronRight } from 'lucide-react'

const pink = '#FF0D64'; const teal = '#3FEACE'; const muted = '#8891A8'; const border = 'rgba(255,255,255,0.08)'; const surface = '#161B27'

export default function CreativeLibrary() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Creative Library</h1>
        <p className="text-sm mt-0.5" style={{ color: muted }}>Scripts, hooks, and performance — all in one place</p>
      </div>

      <div className="space-y-3">
        {SEED_CREATIVES.map(creative => {
          const perf = SEED_AD_PERFORMANCE.filter(p => p.creative_id === creative.id)
          const spend = perf.reduce((s, p) => s + p.spend, 0)
          const leads = SEED_LEADS.filter(l => l.utm_content === creative.utm_content_value).length
          const closes = SEED_LEADS.filter(l => l.utm_content === creative.utm_content_value && l.stage === 'closed_won').length
          const revenue = SEED_LEADS.filter(l => l.utm_content === creative.utm_content_value && l.revenue).reduce((s, l) => s + (l.revenue || 0), 0)
          const roas = spend ? revenue / spend : 0
          const isExpanded = expanded === creative.id

          return (
            <div key={creative.id} className="rounded-xl overflow-hidden" style={{ background: surface, border: `1px solid ${border}` }}>
              <button className="w-full flex items-start gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpanded(isExpanded ? null : creative.id)}>
                <div className="mt-0.5 text-white/40">{isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: '#F0F2F8' }}>{creative.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{
                      background: creative.status === 'active' ? `${teal}15` : 'rgba(255,255,255,0.06)',
                      color: creative.status === 'active' ? teal : muted
                    }}>{creative.status}</span>
                    {creative.hook_type && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: `${pink}12`, color: pink }}>{creative.hook_type}</span>}
                  </div>
                  {creative.hook_text && <p className="text-xs mt-1 italic" style={{ color: muted }}>&ldquo;{creative.hook_text}&rdquo;</p>}
                </div>
                <div className="flex gap-6 flex-shrink-0 text-right">
                  <div><p className="text-xs font-bold" style={{ color: '#F0F2F8' }}>{leads}</p><p className="text-[10px]" style={{ color: muted }}>leads</p></div>
                  <div><p className="text-xs font-bold" style={{ color: closes > 0 ? teal : muted }}>{closes}</p><p className="text-[10px]" style={{ color: muted }}>closes</p></div>
                  <div><p className="text-xs font-bold" style={{ color: roas > 1 ? teal : muted }}>{roas > 0 ? `${roas.toFixed(1)}x` : '—'}</p><p className="text-[10px]" style={{ color: muted }}>ROAS</p></div>
                  <div><p className="text-xs font-bold" style={{ color: '#F0F2F8' }}>£{Math.round(spend).toLocaleString()}</p><p className="text-[10px]" style={{ color: muted }}>spend</p></div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: border }}>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: muted }}>Full Script</p>
                      <pre className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg p-3"
                        style={{ background: 'rgba(255,255,255,0.03)', color: '#F0F2F8', fontFamily: 'inherit' }}>
                        {creative.full_script || 'No script stored yet.'}
                      </pre>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: muted }}>Details</p>
                        <div className="space-y-1.5 text-sm">
                          {[
                            ['UTM content', creative.utm_content_value],
                            ['Launched', creative.launched_at || '—'],
                            ['Iterated from', creative.iterated_from ? SEED_CREATIVES.find(c=>c.id===creative.iterated_from)?.name || creative.iterated_from : '—'],
                          ].map(([l,v]) => (
                            <div key={l} className="flex justify-between gap-2">
                              <span style={{ color: muted }}>{l}</span>
                              <span className="text-right" style={{ color: '#F0F2F8' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {creative.notes && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: muted }}>Notes</p>
                          <p className="text-sm" style={{ color: '#F0F2F8' }}>{creative.notes}</p>
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
