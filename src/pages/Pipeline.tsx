import { useState, useEffect } from 'react'
import { REAL_LEADS as SEED_LEADS, REAL_CREATIVES as SEED_CREATIVES } from '../lib/seed'
import type { Lead, PipelineStage } from '../types'
import { updateLeadStage } from '../lib/supabase'
import { X, AlertCircle, Clock } from 'lucide-react'

const pink = '#FF0D64'; const teal = '#3FEACE'; const amber = '#FFA71A'
const muted = '#8891A8'; const border = 'rgba(255,255,255,0.08)'; const surface = '#161B27'; const green = '#22C55E'

// Active pipeline stages (visible in main board)
// Note: 'qualified' and 'second_call_booked' both display as "Awaiting Proposal"
const ACTIVE_COLUMNS: { stage: PipelineStage; label: string; color?: string }[] = [
  { stage: 'booked', label: 'Call Booked', color: teal },
  { stage: 'qualified', label: 'Awaiting Proposal', color: amber },
  { stage: 'proposal_sent', label: 'Proposal Sent', color: pink },
  { stage: 'abandoned', label: 'Abandoned', color: muted },
]

// These stages are tracked but not shown in the pipeline board
// They appear in dashboard metrics and can be viewed via archive toggle
// 'second_call_booked' is treated as 'awaiting proposal' in the UI

// All stages for the selector dropdown
const ALL_STAGES: { stage: PipelineStage; label: string }[] = [
  { stage: 'booked', label: 'Call Booked' },
  { stage: 'no_show', label: 'No-Show' },
  { stage: 'disqualified', label: 'Disqualified' },
  { stage: 'qualified', label: 'Awaiting Proposal' },
  { stage: 'second_call_booked', label: 'Awaiting Proposal (2nd call)' },
  { stage: 'proposal_sent', label: 'Proposal Sent' },
  { stage: 'abandoned', label: 'Abandoned (no response)' },
  { stage: 'closed_won', label: 'Closed Won ✓' },
  { stage: 'closed_lost', label: 'Closed Lost' },
]

const creativeMap = Object.fromEntries(SEED_CREATIVES.map(c => [c.utm_content_value, c]))
const now = new Date()

function daysSince(dateStr?: string): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function isOverdue(lead: Lead): boolean {
  return lead.stage === 'booked' && !!lead.call_datetime && new Date(lead.call_datetime) < now
}

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const overdue = isOverdue(lead)
  const creative = lead.utm_content ? creativeMap[lead.utm_content] : null
  const days = daysSince(lead.booked_at || lead.created_at)
  const stageDayColor = days < 3 ? green : days < 7 ? amber : pink

  return (
    <div onClick={onClick} className="rounded-lg p-3 cursor-pointer transition-all relative"
      style={{ background: overdue ? `${amber}10` : 'rgba(255,255,255,0.04)', border: `1px solid ${overdue ? amber+'40' : border}` }}
      onMouseEnter={e => (e.currentTarget.style.background = overdue ? `${amber}18` : 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = overdue ? `${amber}10` : 'rgba(255,255,255,0.04)')}>
      {overdue && (
        <div className="absolute top-2 right-2">
          <AlertCircle size={13} style={{ color: amber }} />
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-semibold leading-tight pr-4" style={{ color: '#F0F2F8' }}>{lead.name}</p>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: `${stageDayColor}15`, color: stageDayColor }}>{days}d</span>
      </div>
      {(lead.industry || lead.revenue_range) && (
        <p className="text-[11px] mb-1" style={{ color: muted }}>
          {[lead.industry, lead.revenue_range].filter(Boolean).join(' · ')}
        </p>
      )}
      {creative && <p className="text-[10px] truncate" style={{ color: pink }}>{creative.name.split(' — ')[0]}</p>}
      {lead.stage === 'proposal_sent' && lead.proposal_value && (
        <p className="text-[11px] mt-1 font-semibold" style={{ color: amber }}>£{Number(lead.proposal_value).toLocaleString()}</p>
      )}
      {lead.stage === 'closed_won' && lead.revenue && (
        <p className="text-[11px] mt-1 font-semibold" style={{ color: teal }}>£{Number(lead.revenue).toLocaleString()}</p>
      )}
      {overdue && (
        <p className="text-[10px] mt-1 font-bold" style={{ color: amber }}>
          Call was {daysSince(lead.call_datetime)} days ago — update stage
        </p>
      )}
    </div>
  )
}

function LeadDetail({ lead, onClose, onStageChange, onValueChange }: {
  lead: Lead; onClose: () => void
  onStageChange: (id: string, stage: PipelineStage) => void
  onValueChange: (id: string, field: 'proposal_value' | 'revenue', value: number) => void
}) {
  const creative = lead.utm_content ? creativeMap[lead.utm_content] : null
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto"
        style={{ background: '#111827', borderLeft: `1px solid ${border}` }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 sticky top-0 z-10"
          style={{ background: '#111827', borderBottom: `1px solid ${border}` }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#F0F2F8' }}>{lead.name}</h2>
            {(lead.industry || lead.revenue_range) && (
              <p className="text-sm mt-0.5" style={{ color: muted }}>
                {[lead.industry, lead.revenue_range].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md" style={{ color: muted }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overdue alert */}
          {isOverdue(lead) && (
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: `${amber}12`, border: `1px solid ${amber}30` }}>
              <Clock size={14} style={{ color: amber, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-xs font-bold" style={{ color: amber }}>Call date has passed</p>
                <p className="text-xs mt-0.5" style={{ color: '#F0F2F8' }}>
                  Scheduled {lead.call_datetime ? new Date(lead.call_datetime).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : ''} — did they show?
                </p>
              </div>
            </div>
          )}

          {/* Stage selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Stage</p>
            <select value={lead.stage}
              onChange={e => onStageChange(lead.id, e.target.value as PipelineStage)}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: surface, border: `1px solid ${border}`, color: '#F0F2F8' }}>
              {ALL_STAGES.map(c => <option key={c.stage} value={c.stage}>{c.label}</option>)}
            </select>
          </div>

          {/* Proposal value */}
          {['proposal_sent','closed_won','closed_lost'].includes(lead.stage) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Proposal Value</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: amber }}>£</span>
                <input type="number" defaultValue={lead.proposal_value || ''}
                  placeholder="Enter proposal value"
                  onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onValueChange(lead.id, 'proposal_value', v) }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{ background: surface, border: `1px solid ${amber}40`, color: '#F0F2F8' }} />
              </div>
            </div>
          )}

          {/* Revenue (Closed Won) */}
          {lead.stage === 'closed_won' && (
            <div className="p-4 rounded-xl" style={{ background: `${teal}08`, border: `1px solid ${teal}25` }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: teal }}>Revenue Closed</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: teal }}>£</span>
                <input type="number" key={lead.id+'-rev'} defaultValue={lead.revenue || ''}
                  placeholder="Enter revenue"
                  onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onValueChange(lead.id, 'revenue', v) }}
                  className="flex-1 px-3 py-2 rounded-xl text-lg font-bold"
                  style={{ background: 'transparent', border: `1px solid ${teal}40`, color: teal }} />
              </div>
              {lead.revenue && Number(lead.revenue) > 0 && (
                <p className="text-sm font-bold mt-2" style={{ color: teal }}>£{Number(lead.revenue).toLocaleString()} confirmed</p>
              )}
            </div>
          )}

          {/* Close reason */}
          {lead.stage === 'closed_lost' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Reason (optional)</p>
              <input type="text" defaultValue={lead.close_reason || ''}
                placeholder="Why didn't they close?"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: surface, border: `1px solid ${border}`, color: '#F0F2F8' }} />
            </div>
          )}

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Contact</p>
            <div className="space-y-2">
              {[
                ['Email', lead.email],
                ['Phone', lead.phone],
                ['Opted in', lead.opted_in_at ? new Date(lead.opted_in_at).toLocaleString('en-GB') : '—'],
                ['Call scheduled', lead.call_datetime ? new Date(lead.call_datetime).toLocaleString('en-GB') : '—'],
                ['Last contact', lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleDateString('en-GB') : '—'],
              ].filter(([,v]) => v && v !== '—').map(([label, value]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span style={{ color: muted }}>{label}</span>
                  <span style={{ color: '#F0F2F8' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

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

          {/* Intake answers */}
          {(lead.industry || lead.revenue_range || lead.client_value) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Intake Answers</p>
              <div className="space-y-2">
                {[
                  ['Business type', lead.industry],
                  ['Annual revenue', lead.revenue_range],
                  ['Avg client value', lead.client_value],
                ].filter(([,v]) => v).map(([label, value]) => (
                  <div key={label as string} className="flex justify-between text-sm">
                    <span style={{ color: muted }}>{label}</span>
                    <span className="text-right max-w-xs" style={{ color: '#F0F2F8' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Call notes */}
          {(lead.call_notes_auto || lead.call_notes_manual) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Call Notes</p>
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
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showArchive, setShowArchive] = useState(false)

  useEffect(() => {
    async function loadLeads() {
      try {
        const { fetchLeads } = await import('../lib/supabase')
        const { data, error } = await fetchLeads()
        if (data && !error && data.length > 0) {
          setLeads(data as Lead[])
        } else {
          setLeads(SEED_LEADS)
        }
      } catch(e) {
        setLeads(SEED_LEADS)
      } finally {
        setLoading(false)
      }
    }
    loadLeads()
  }, [])

  const updateValue = async (id: string, field: 'proposal_value' | 'revenue', value: number) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
    if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, [field]: value } : null)
    try {
      const { supabase } = await import('../lib/supabase')
      await supabase.from('leads').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', id)
    } catch(e) { /* offline */ }
  }

  const updateStage = async (id: string, stage: PipelineStage) => {
    const current = leads.find(l => l.id === id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage, updated_at: new Date().toISOString() } : l))
    if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, stage } : null)
    try {
      await updateLeadStage(id, stage, current?.stage)
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase.from('leads').select('*').eq('id', id).single()
      if (data) setLeads(prev => prev.map(l => l.id === id ? data as Lead : l))
    } catch(e) { /* offline */ }
  }

  // Active pipeline leads — show booked, qualified/second_call (both = awaiting proposal), proposal_sent, abandoned
  const pipelineStages = new Set<PipelineStage>(['booked', 'qualified', 'second_call_booked', 'proposal_sent', 'abandoned'])
  const activeLeads = leads.filter(l => pipelineStages.has(l.stage))
  // For column display: merge second_call_booked into qualified column
  const archivedLeads = leads.filter(l => !pipelineStages.has(l.stage))
  // Opted-in but never booked — stored but not shown anywhere in pipeline
  const optedInOnly = leads.filter(l => !l.booking_completed && l.stage === 'abandoned')
  const overdueLeads = leads.filter(isOverdue)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Pipeline</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>
            {loading ? 'Loading...' : `${activeLeads.length} active`}
            {!loading && overdueLeads.length > 0 && (
              <span className="ml-2 font-bold" style={{ color: amber }}>· {overdueLeads.length} need updating</span>
            )}
          </p>
        </div>
        <button onClick={() => setShowArchive(!showArchive)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: showArchive ? `${pink}20` : 'rgba(255,255,255,0.06)', color: showArchive ? pink : muted }}>
          {showArchive ? 'Hide' : 'Show'} archive ({archivedLeads.length})
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm" style={{ color: muted }}>Loading from database...</div>
        </div>
      )}

      {/* Active pipeline */}
      {!loading && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
          {ACTIVE_COLUMNS.map(({ stage, label, color }) => {
            // Merge second_call_booked into the qualified/awaiting proposal column
            const colLeads = activeLeads.filter(l => 
              stage === 'qualified' 
                ? (l.stage === 'qualified' || l.stage === 'second_call_booked')
                : l.stage === stage
            )
            return (
              <div key={stage} className="flex-shrink-0 w-56 flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: color || muted }}>{label}</p>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: muted }}>{colLeads.length}</span>
                </div>
                <div className="flex-1 space-y-2 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.02)', minHeight: 80 }}>
                  {colLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Archive section */}
      {!loading && showArchive && archivedLeads.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: muted }}>Tracked data — no-shows, DQ'd, won, lost (not in pipeline)</p>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {(['no_show','disqualified','closed_won','closed_lost'] as PipelineStage[]).map(stage => {
              const colLeads = archivedLeads.filter(l => l.stage === stage)
              if (colLeads.length === 0) return null
              const stageLabel = ALL_STAGES.find(s => s.stage === stage)?.label || stage
              return (
                <div key={stage} className="flex-shrink-0 w-52 flex flex-col">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: muted }}>{stageLabel}</p>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: muted }}>{colLeads.length}</span>
                  </div>
                  <div className="flex-1 space-y-2 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.02)', maxHeight: 300, overflowY: 'auto' }}>
                    {colLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStageChange={updateStage}
          onValueChange={updateValue}
        />
      )}
    </div>
  )
}
