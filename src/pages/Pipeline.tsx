import { useState } from 'react'
import { REAL_LEADS as SEED_LEADS, REAL_CREATIVES as SEED_CREATIVES } from '../lib/seed'
import type { Lead, PipelineStage } from '../types'
import { updateLeadStage } from '../lib/supabase'
import { X } from 'lucide-react'

const pink = '#FF0D64'
const teal = '#3FEACE'
const amber = '#FFA71A'
const muted = '#8891A8'
const border = 'rgba(255,255,255,0.08)'
const surface = '#161B27'
const green = '#22C55E'

const COLUMNS: { stage: PipelineStage; label: string }[] = [
  { stage: 'booked', label: 'Booked' },
  { stage: 'showed', label: 'Showed' },
  { stage: 'no_show', label: 'No-Show' },
  { stage: 'disqualified', label: 'Disqualified' },
  { stage: 'qualified', label: 'Qualified' },
  { stage: 'second_call_booked', label: '2nd Call Booked' },
  { stage: 'proposal_sent', label: 'Proposal Sent' },
  { stage: 'closed_won', label: 'Closed Won' },
  { stage: 'closed_lost', label: 'Closed Lost' },
  { stage: 'abandoned', label: 'Abandoned' },
]

const creativeMap = Object.fromEntries(SEED_CREATIVES.map(c => [c.utm_content_value, c]))

function daysSince(dateStr?: string): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function DaysInStageBadge({ days }: { days: number }) {
  const color = days < 3 ? green : days < 7 ? amber : pink
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color }}>
      {days}d
    </span>
  )
}

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const days = daysSince(lead.booked_at)
  const creative = lead.utm_content ? creativeMap[lead.utm_content] : null
  return (
    <div
      onClick={onClick}
      className="rounded-lg p-3 cursor-pointer transition-colors"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}` }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-semibold leading-tight" style={{ color: '#F0F2F8' }}>{lead.name}</p>
        <DaysInStageBadge days={days} />
      </div>
      {lead.industry && <p className="text-[11px] mb-1" style={{ color: muted }}>{lead.industry} · {lead.revenue_range}</p>}
      {creative && (
        <p className="text-[10px] truncate" style={{ color: pink }}>
          {creative.name.split(' — ')[0]}
        </p>
      )}
      {lead.stage === 'proposal_sent' && lead.proposal_value && (
        <p className="text-[11px] mt-1 font-semibold" style={{ color: amber }}>£{lead.proposal_value.toLocaleString()}</p>
      )}
      {lead.stage === 'closed_won' && lead.revenue && (
        <p className="text-[11px] mt-1 font-semibold" style={{ color: teal }}>£{lead.revenue.toLocaleString()} closed</p>
      )}
    </div>
  )
}

function LeadDetail({ lead, onClose, onStageChange }: {
  lead: Lead
  onClose: () => void
  onStageChange: (id: string, stage: PipelineStage) => void
}) {
  const creative = lead.utm_content ? creativeMap[lead.utm_content] : null
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto"
        style={{ background: '#111827', borderLeft: `1px solid ${border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 sticky top-0 z-10"
          style={{ background: '#111827', borderBottom: `1px solid ${border}` }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#F0F2F8' }}>{lead.name}</h2>
            <p className="text-sm mt-0.5" style={{ color: muted }}>{lead.industry} · {lead.revenue_range}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md transition-colors"
            style={{ color: muted }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0F2F8')}
            onMouseLeave={e => (e.currentTarget.style.color = muted)}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stage selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: muted }}>Stage</p>
            <select
              value={lead.stage}
              onChange={e => onStageChange(lead.id, e.target.value as PipelineStage)}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: surface, border: `1px solid ${border}`, color: '#F0F2F8' }}
            >
              {COLUMNS.map(c => <option key={c.stage} value={c.stage}>{c.label}</option>)}
            </select>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Contact</p>
            <div className="space-y-2">
              {[
                ['Email', lead.email],
                ['Phone', lead.phone],
                ['Opted in', lead.opted_in_at ? new Date(lead.opted_in_at).toLocaleString('en-GB') : '—'],
                ['Call booked', lead.call_datetime ? new Date(lead.call_datetime).toLocaleString('en-GB') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span style={{ color: muted }}>{label}</span>
                  <span style={{ color: '#F0F2F8' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Source */}
          {creative && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Source Creative</p>
              <div className="p-3 rounded-lg" style={{ background: `${pink}08`, border: `1px solid ${pink}25` }}>
                <p className="text-sm font-semibold" style={{ color: pink }}>{creative.name}</p>
                {creative.hook_text && <p className="text-xs mt-1 italic" style={{ color: muted }}>&ldquo;{creative.hook_text}&rdquo;</p>}
                <p className="text-[10px] mt-1" style={{ color: muted }}>utm_content: {lead.utm_content}</p>
              </div>
            </div>
          )}

          {/* Call notes */}
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
                <p className="text-[10px] font-bold mb-1" style={{ color: muted }}>MANUAL</p>
                <p className="text-sm leading-relaxed" style={{ color: '#F0F2F8' }}>{lead.call_notes_manual}</p>
              </div>
            )}
            {!lead.call_notes_auto && !lead.call_notes_manual && (
              <p className="text-sm" style={{ color: muted }}>No notes yet.</p>
            )}
          </div>

          {/* Proposal */}
          {(lead.stage === 'proposal_sent' || lead.proposal_sent) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: muted }}>Proposal</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: muted }}>Sent</span>
                  <span style={{ color: '#F0F2F8' }}>{lead.proposal_sent_at ? new Date(lead.proposal_sent_at).toLocaleDateString('en-GB') : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: muted }}>Value</span>
                  <span className="font-bold" style={{ color: amber }}>
                    {lead.proposal_value ? `£${lead.proposal_value.toLocaleString()}` : '—'}
                  </span>
                </div>
                {lead.proposal_sent_at && (
                  <div className="flex justify-between">
                    <span style={{ color: muted }}>Days since sent</span>
                    <span style={{ color: daysSince(lead.proposal_sent_at) > 7 ? pink : '#F0F2F8' }}>
                      {daysSince(lead.proposal_sent_at)}d
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Outcome */}
          {lead.stage === 'closed_won' && (
            <div className="p-4 rounded-lg" style={{ background: `${teal}10`, border: `1px solid ${teal}30` }}>
              <p className="text-xs font-bold mb-1" style={{ color: teal }}>CLOSED WON</p>
              <p className="text-2xl font-bold" style={{ color: teal }}>£{lead.revenue?.toLocaleString()}</p>
            </div>
          )}
          {lead.stage === 'closed_lost' && lead.close_reason && (
            <div className="p-4 rounded-lg" style={{ background: `${pink}08`, border: `1px solid ${pink}25` }}>
              <p className="text-xs font-bold mb-1" style={{ color: pink }}>CLOSED LOST</p>
              <p className="text-sm" style={{ color: '#F0F2F8' }}>{lead.close_reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const [leads, setLeads] = useState<Lead[]>(SEED_LEADS)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const updateStage = async (id: string, stage: PipelineStage) => {
    const current = leads.find(l => l.id === id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage, updated_at: new Date().toISOString() } : l))
    if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, stage } : null)
    // Persist to Supabase (best-effort — UI already updated)
    try { await updateLeadStage(id, stage, current?.stage) } catch(e) { /* offline/seed data */ }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Pipeline</h1>
        <p className="text-sm mt-0.5" style={{ color: muted }}>{leads.filter(l => !['closed_lost','abandoned'].includes(l.stage)).length} active leads</p>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {COLUMNS.map(({ stage, label }) => {
          const colLeads = leads.filter(l => l.stage === stage)
          return (
            <div key={stage} className="flex-shrink-0 w-56 flex flex-col">
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: muted }}>{label}</p>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: muted }}>
                  {colLeads.length}
                </span>
              </div>
              {/* Cards */}
              <div className="flex-1 space-y-2 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.02)', minHeight: 80 }}>
                {colLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lead detail panel */}
      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStageChange={updateStage}
        />
      )}
    </div>
  )
}
