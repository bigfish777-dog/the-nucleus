import { useState, useEffect } from 'react'
import { REAL_LEADS as SEED_LEADS, REAL_CREATIVES as SEED_CREATIVES } from '../lib/seed'
import type { Lead, PipelineStage } from '../types'
import { updateLeadStage } from '../lib/supabase'
import { X, AlertCircle, Clock, Eye, EyeOff } from 'lucide-react'

const pink = '#FF0D64'; const teal = '#3FEACE'; const amber = '#FFA71A'
const muted = '#8891A8'; const border = 'rgba(255,255,255,0.08)'; const surface = '#161B27'
const green = '#22C55E'

// ── Pipeline columns (active work only) ──────────────────────────────────────
const PIPELINE_COLUMNS: { stages: PipelineStage[]; label: string; color: string }[] = [
  { stages: ['booked'], label: 'Call Booked', color: teal },
  { stages: ['proposal_sent'], label: 'Proposal Sent', color: amber },
  { stages: ['proposal_live'], label: 'Proposal Live', color: pink },
]

// Note: 'qualified' and 'second_call_booked' from old data sit in archive.
// Move leads to 'proposal_sent' manually once you've confirmed the proposal went out.

// ── Archived stages (tracked but not in main pipeline) ───────────────────────
const ARCHIVE_COLUMNS: { stage: PipelineStage; label: string }[] = [
  { stage: 'no_show', label: 'No-Show' },
  { stage: 'second_call_no_show', label: '2nd Call No-Show' },
  { stage: 'cancelled', label: 'Cancelled' },
  { stage: 'disqualified', label: 'Disqualified' },
  { stage: 'spam', label: 'Spam' },
  { stage: 'test', label: 'Test' },
  { stage: 'abandoned', label: 'Abandoned' },
  { stage: 'closed_won', label: 'Closed Won' },
  { stage: 'closed_lost', label: 'Closed Lost' },
]

// ── Stage selector options ────────────────────────────────────────────────────
const STAGE_OPTIONS: { stage: PipelineStage; label: string; group: string }[] = [
  { stage: 'booked', label: 'Call Booked', group: 'Active' },
  { stage: 'qualified', label: 'Proposal Sent (awaiting 2nd call)', group: 'Active' },
  { stage: 'proposal_live', label: 'Proposal Live (deciding)', group: 'Active' },
  { stage: 'no_show', label: 'No-Show (1st call)', group: 'Archive' },
  { stage: 'second_call_no_show', label: 'No-Show (2nd call)', group: 'Archive' },
  { stage: 'cancelled', label: 'Cancelled / Rescheduled', group: 'Archive' },
  { stage: 'disqualified', label: 'Disqualified', group: 'Archive' },
  { stage: 'spam', label: 'Spam', group: 'Archive' },
  { stage: 'test', label: 'Test entry', group: 'Archive' },
  { stage: 'abandoned', label: 'Abandoned (no response)', group: 'Archive' },
  { stage: 'closed_won', label: 'Closed Won ✓', group: 'Closed' },
  { stage: 'closed_lost', label: 'Closed Lost', group: 'Closed' },
]

const creativeMap = Object.fromEntries(SEED_CREATIVES.map(c => [c.utm_content_value, c]))
const now = new Date()

function daysSince(dateStr?: string) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function isCallOverdue(lead: Lead) {
  return lead.stage === 'booked' && !!lead.call_datetime && new Date(lead.call_datetime) < now
}

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const overdue = isCallOverdue(lead)
  const creative = lead.utm_content ? creativeMap[lead.utm_content] : null
  const days = daysSince(lead.last_contact_at || lead.created_at)
  const ageColor = days < 4 ? green : days < 10 ? amber : pink

  return (
    <div onClick={onClick} className="rounded-lg p-3 cursor-pointer transition-colors"
      style={{ background: overdue ? `${amber}10` : 'rgba(255,255,255,0.04)', border: `1px solid ${overdue ? amber+'50' : border}` }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = overdue ? `${amber}10` : 'rgba(255,255,255,0.04)')}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-semibold leading-tight" style={{ color: '#F0F2F8' }}>{lead.name}</p>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: `${ageColor}15`, color: ageColor }}>{days}d</span>
      </div>
      {lead.industry && <p className="text-[11px]" style={{ color: muted }}>{lead.industry}</p>}
      {lead.revenue_range && <p className="text-[11px]" style={{ color: muted }}>{lead.revenue_range}</p>}
      {creative && <p className="text-[10px] mt-1 truncate" style={{ color: pink }}>{creative.name.split(' — ')[0]}</p>}
      {lead.proposal_value && Number(lead.proposal_value) > 0 && (
        <p className="text-[11px] mt-1 font-bold" style={{ color: amber }}>£{Number(lead.proposal_value).toLocaleString()}</p>
      )}
      {lead.revenue && Number(lead.revenue) > 0 && (
        <p className="text-[11px] mt-1 font-bold" style={{ color: teal }}>£{Number(lead.revenue).toLocaleString()} won</p>
      )}
      {overdue && (
        <div className="flex items-center gap-1 mt-1.5">
          <AlertCircle size={10} style={{ color: amber }} />
          <p className="text-[10px] font-bold" style={{ color: amber }}>Call was {daysSince(lead.call_datetime)}d ago</p>
        </div>
      )}
    </div>
  )
}

function LeadDetail({ lead, onClose, onStageChange, onValueChange, onFieldChange }: {
  lead: Lead; onClose: () => void
  onStageChange: (id: string, stage: PipelineStage) => void
  onValueChange: (id: string, field: 'proposal_value' | 'revenue', value: number) => void
  onFieldChange: (id: string, field: string, value: string) => void
}) {
  const creative = lead.utm_content ? creativeMap[lead.utm_content] : null
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto"
        style={{ background: '#111827', borderLeft: `1px solid ${border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 sticky top-0 z-10"
          style={{ background: '#111827', borderBottom: `1px solid ${border}` }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#F0F2F8' }}>{lead.name}</h2>
            {lead.industry && <p className="text-sm mt-0.5" style={{ color: muted }}>{lead.industry} · {lead.revenue_range}</p>}
          </div>
          <button onClick={onClose} style={{ color: muted }}><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Overdue alert */}
          {isCallOverdue(lead) && (
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: `${amber}12`, border: `1px solid ${amber}30` }}>
              <Clock size={14} style={{ color: amber, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-xs font-bold" style={{ color: amber }}>Call date has passed</p>
                <p className="text-xs mt-0.5" style={{ color: '#F0F2F8' }}>
                  {lead.call_datetime ? new Date(lead.call_datetime).toLocaleString('en-GB', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : ''} — did they show?
                </p>
              </div>
            </div>
          )}

          {/* Stage */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Stage</p>
            <select value={lead.stage}
              onChange={e => onStageChange(lead.id, e.target.value as PipelineStage)}
              className="w-full px-3 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: surface, border: `1px solid ${border}`, color: '#F0F2F8' }}>
              {['Active','Archive','Closed'].map(group => (
                <optgroup key={group} label={`── ${group} ──`}>
                  {STAGE_OPTIONS.filter(o => o.group === group).map(o => (
                    <option key={o.stage} value={o.stage}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Proposal value */}
          {['qualified','second_call_booked','proposal_sent','proposal_live','closed_won','closed_lost','abandoned'].includes(lead.stage) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Proposal Value</p>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: amber }}>£</span>
                <input type="number" defaultValue={lead.proposal_value || ''}
                  placeholder="0" onBlur={e => { const v=parseFloat(e.target.value); if(!isNaN(v)&&v>0) onValueChange(lead.id,'proposal_value',v) }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{ background: surface, border: `1px solid ${amber}40`, color: '#F0F2F8' }} />
              </div>
            </div>
          )}

          {/* Revenue */}
          {lead.stage === 'closed_won' && (
            <div className="p-4 rounded-xl" style={{ background: `${teal}08`, border: `1px solid ${teal}25` }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: teal }}>Revenue Closed</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: teal }}>£</span>
                <input type="number" key={lead.id+'-rev'} defaultValue={lead.revenue || ''}
                  placeholder="0" onBlur={e => { const v=parseFloat(e.target.value); if(!isNaN(v)&&v>0) onValueChange(lead.id,'revenue',v) }}
                  className="flex-1 px-3 py-2 rounded-xl text-lg font-bold"
                  style={{ background: 'transparent', border: `1px solid ${teal}40`, color: teal }} />
              </div>
              {lead.revenue && Number(lead.revenue)>0 && <p className="text-sm font-bold mt-2" style={{color:teal}}>£{Number(lead.revenue).toLocaleString()} confirmed</p>}
            </div>
          )}

          {/* Close reason */}
          {['closed_lost','abandoned'].includes(lead.stage) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Reason (optional)</p>
              <input type="text" defaultValue={lead.close_reason || ''} placeholder="Why didn't it close?"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: surface, border: `1px solid ${border}`, color: '#F0F2F8' }} />
            </div>
          )}

          {/* Contact — editable */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Contact</p>
            <div className="space-y-2">
              {[
                { label: 'Name', field: 'name', value: lead.name, type: 'text' },
                { label: 'Email', field: 'email', value: lead.email, type: 'email' },
                { label: 'Phone', field: 'phone', value: lead.phone, type: 'tel' },
              ].map(({ label, field, value, type }) => (
                <div key={field} className="flex items-center gap-3">
                  <span className="text-xs w-12 flex-shrink-0" style={{ color: muted }}>{label}</span>
                  <input
                    type={type}
                    defaultValue={value || ''}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    onBlur={e => {
                      const v = e.target.value.trim()
                      if (v !== (value || '')) onFieldChange(lead.id, field, v)
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-md text-sm"
                    style={{ background: surface, border: `1px solid ${border}`, color: '#F0F2F8' }}
                  />
                </div>
              ))}
              {lead.call_datetime && (
                <div className="flex justify-between text-sm pt-1">
                  <span style={{ color: muted }}>1st call</span>
                  <span style={{ color: '#F0F2F8' }}>{new Date(lead.call_datetime).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              )}
              {lead.second_call_datetime && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: muted }}>2nd call</span>
                  <span style={{ color: '#F0F2F8' }}>{new Date(lead.second_call_datetime).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              )}
            </div>
          </div>

          {/* Intake answers */}
          {(lead.industry || lead.revenue_range || lead.client_value) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Intake Answers</p>
              <div className="space-y-1.5">
                {[['Business type',lead.industry],['Annual revenue',lead.revenue_range],['Avg client value',lead.client_value]]
                  .filter(([,v])=>v).map(([l,v])=>(
                    <div key={l as string} className="flex justify-between text-sm">
                      <span style={{color:muted}}>{l}</span>
                      <span className="text-right max-w-xs" style={{color:'#F0F2F8'}}>{v}</span>
                    </div>
                ))}
              </div>
            </div>
          )}

          {/* Source creative */}
          {creative && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Source Creative</p>
              <div className="p-3 rounded-lg" style={{ background: `${pink}08`, border: `1px solid ${pink}25` }}>
                <p className="text-sm font-semibold" style={{ color: pink }}>{creative.name}</p>
                {creative.hook_text && <p className="text-xs mt-1 italic" style={{ color: muted }}>&ldquo;{creative.hook_text}&rdquo;</p>}
              </div>
            </div>
          )}

          {/* Call notes */}
          {(lead.call_notes_auto || lead.call_notes_manual) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Call Notes</p>
              {lead.call_notes_auto && (
                <div className="p-3 rounded-lg mb-2" style={{ background: `${teal}08`, border: `1px solid ${teal}20` }}>
                  <p className="text-[10px] font-bold mb-1" style={{ color: teal }}>AUTO — OpenClaw</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#F0F2F8' }}>{lead.call_notes_auto}</p>
                </div>
              )}
              {lead.call_notes_manual && (
                <div className="p-3 rounded-lg" style={{ background: surface, border: `1px solid ${border}` }}>
                  <p className="text-sm leading-relaxed" style={{ color: '#F0F2F8' }}>{lead.call_notes_manual}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showArchive, setShowArchive] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { fetchLeads } = await import('../lib/supabase')
        const { data, error } = await fetchLeads()
        if (data && !error && data.length > 0) setLeads(data as Lead[])
        else setLeads(SEED_LEADS)
      } catch { setLeads(SEED_LEADS) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const updateField = async (id: string, field: string, value: string) => {
    setLeads(p => p.map(l => l.id === id ? { ...l, [field]: value } : l))
    if (selected?.id === id) setSelected(p => p ? { ...p, [field]: value } : null)
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.from('leads').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    } catch { /* offline */ }
  }

  const updateValue = async (id: string, field: 'proposal_value' | 'revenue', value: number) => {
    setLeads(p => p.map(l => l.id === id ? { ...l, [field]: value } : l))
    if (selected?.id === id) setSelected(p => p ? { ...p, [field]: value } : null)
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.from('leads').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    } catch { /* offline */ }
  }

  const updateStage = async (id: string, stage: PipelineStage) => {
    const current = leads.find(l => l.id === id)
    setLeads(p => p.map(l => l.id === id ? { ...l, stage } : l))
    if (selected?.id === id) setSelected(p => p ? { ...p, stage } : null)
    try {
      await updateLeadStage(id, stage, current?.stage)
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase.from('leads').select('*').eq('id', id).single()
      if (data) setLeads(p => p.map(l => l.id === id ? data as Lead : l))
    } catch { /* offline */ }
  }

  const pipelineStages = new Set(PIPELINE_COLUMNS.flatMap(c => c.stages))
  const pipelineLeads = leads.filter(l => pipelineStages.has(l.stage) && l.booking_completed)
  const archiveLeads = leads.filter(l => !pipelineStages.has(l.stage))
  const overdueCount = pipelineLeads.filter(l => isCallOverdue(l)).length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Pipeline</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>
            {loading ? 'Loading...' : `${pipelineLeads.length} active`}
            {!loading && overdueCount > 0 && <span className="ml-2 font-bold" style={{ color: amber }}>· {overdueCount} overdue</span>}
          </p>
        </div>
        <button onClick={() => setShowArchive(!showArchive)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.06)', color: muted }}>
          {showArchive ? <EyeOff size={12}/> : <Eye size={12}/>}
          Archive ({archiveLeads.length})
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="text-sm" style={{ color: muted }}>Loading from database...</div></div>}

      {/* Active pipeline */}
      {!loading && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {PIPELINE_COLUMNS.map(({ stages, label, color }) => {
            const colLeads = pipelineLeads.filter(l => stages.includes(l.stage))
            return (
              <div key={label} className="flex-shrink-0 w-60 flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{label}</p>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: muted }}>{colLeads.length}</span>
                </div>
                <div className="flex-1 space-y-2 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.02)', minHeight: 100 }}>
                  {colLeads.map(lead => <LeadCard key={lead.id} lead={lead} onClick={() => setSelected(lead)} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Archive */}
      {!loading && showArchive && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: muted }}>Archive — tracked data</p>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {ARCHIVE_COLUMNS.map(({ stage, label }) => {
              const colLeads = archiveLeads.filter(l => l.stage === stage)
              if (colLeads.length === 0) return null
              return (
                <div key={stage} className="flex-shrink-0 w-48 flex flex-col">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: muted }}>{label}</p>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: muted }}>{colLeads.length}</span>
                  </div>
                  <div className="space-y-1.5 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.02)', maxHeight: 280, overflowY: 'auto' }}>
                    {colLeads.map(lead => <LeadCard key={lead.id} lead={lead} onClick={() => setSelected(lead)} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selected && <LeadDetail lead={selected} onClose={() => setSelected(null)} onStageChange={updateStage} onValueChange={updateValue} onFieldChange={updateField} />}
    </div>
  )
}
