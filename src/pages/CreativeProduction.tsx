import { useMemo, useState } from 'react'
import { Plus, GripVertical } from 'lucide-react'

type ScriptStage = 'scripted' | 'recorded' | 'sent_to_editor' | 'proof_received' | 'approved' | 'uploaded'

type ScriptItem = {
  id: string
  title: string
  hook?: string
  type?: string
  stage: ScriptStage
  created_at: string
}

const bg = '#161B27'
const surface = '#111827'
const border = 'rgba(255,255,255,0.08)'
const muted = '#8891A8'
const pink = '#FF0D64'

const STAGES: { key: ScriptStage; label: string; color: string }[] = [
  { key: 'scripted', label: 'Scripted', color: '#FF0D64' },
  { key: 'recorded', label: 'Recorded', color: '#FFA71A' },
  { key: 'sent_to_editor', label: 'Sent to editor', color: '#60A5FA' },
  { key: 'proof_received', label: 'Proof received', color: '#A78BFA' },
  { key: 'approved', label: 'Approved', color: '#3FEACE' },
  { key: 'uploaded', label: 'Uploaded', color: '#22C55E' },
]

const INITIAL_ITEMS: ScriptItem[] = [
  { id: 'sp1', title: 'Bottleneck — founder reviewing everything', hook: 'Stop being the bottleneck in your own marketing', type: 'Direct response', stage: 'scripted', created_at: '2026-04-12' },
  { id: 'sp2', title: 'Agency frustration — strategy deck then silence', hook: 'Most agencies send a strategy doc then disappear', type: 'Direct response', stage: 'recorded', created_at: '2026-04-12' },
  { id: 'sp3', title: '£500k qualifier — outgrown DIY marketing', hook: 'If you’re doing £500k+ and still the marketing bottleneck…', type: 'Qualifier', stage: 'sent_to_editor', created_at: '2026-04-11' },
  { id: 'sp4', title: 'Client result — growth without founder doing it all', hook: 'What changes when execution stops relying on you', type: 'Testimonial', stage: 'proof_received', created_at: '2026-04-11' },
  { id: 'sp5', title: 'Execution > another strategy session', hook: 'You do not need more advice. You need more done.', type: 'Thought leadership', stage: 'approved', created_at: '2026-04-10' },
  { id: 'sp6', title: 'Bottleneck variation — every campaign needs you', hook: 'If every ad and email has to go through you first…', type: 'Direct response', stage: 'uploaded', created_at: '2026-04-09' },
]

function AddScriptModal({ onClose, onCreate }: { onClose: () => void; onCreate: (item: ScriptItem) => void }) {
  const [title, setTitle] = useState('')
  const [hook, setHook] = useState('')
  const [type, setType] = useState('')
  const [error, setError] = useState('')

  const inputStyle = { width: '100%', padding: '10px 12px', background: surface, border: `1px solid ${border}`, borderRadius: 8, color: '#F0F2F8', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: muted, marginBottom: 6 }

  const submit = () => {
    if (!title.trim()) {
      setError('Script title is required')
      return
    }
    onCreate({
      id: `script_${Date.now()}`,
      title: title.trim(),
      hook: hook.trim() || undefined,
      type: type.trim() || undefined,
      stage: 'scripted',
      created_at: new Date().toISOString().slice(0, 10),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#111827', border: `1px solid ${border}` }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <h2 className="text-base font-bold" style={{ color: '#F0F2F8' }}>Add new script</h2>
          <p className="text-xs mt-0.5" style={{ color: muted }}>Create a new creative item and start it in Scripted.</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label style={labelStyle}>Script title</label>
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Bottleneck — founder reviewing everything" />
          </div>
          <div>
            <label style={labelStyle}>Hook / opening line</label>
            <textarea style={{ ...inputStyle, minHeight: 88 }} value={hook} onChange={e => setHook(e.target.value)} placeholder="Optional hook text" />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <input style={inputStyle} value={type} onChange={e => setType(e.target.value)} placeholder="Direct response / Qualifier / Testimonial etc" />
          </div>
          {error && <p className="text-xs font-semibold" style={{ color: pink }}>{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: `1px solid ${border}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: muted }}>Cancel</button>
          <button onClick={submit} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: pink, color: '#fff' }}>Add script</button>
        </div>
      </div>
    </div>
  )
}

function ScriptCard({ item, onAdvance }: { item: ScriptItem; onAdvance: (id: string) => void }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}` }}>
      <div className="flex items-start gap-2 mb-2">
        <GripVertical size={14} style={{ color: muted, marginTop: 2, flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight" style={{ color: '#F0F2F8' }}>{item.title}</p>
          {item.hook && <p className="text-xs mt-1 italic" style={{ color: muted }}>&ldquo;{item.hook}&rdquo;</p>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-3">
        <div className="flex gap-2 flex-wrap">
          {item.type && <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: `${pink}12`, color: pink }}>{item.type}</span>}
          <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: muted }}>{item.created_at}</span>
        </div>
        <button onClick={() => onAdvance(item.id)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', color: '#F0F2F8' }}>
          Move on →
        </button>
      </div>
    </div>
  )
}

export default function CreativeProduction() {
  const [items, setItems] = useState<ScriptItem[]>(INITIAL_ITEMS)
  const [showAdd, setShowAdd] = useState(false)

  const counts = useMemo(() => {
    const out = Object.fromEntries(STAGES.map(stage => [stage.key, 0])) as Record<ScriptStage, number>
    for (const item of items) out[item.stage] += 1
    return out
  }, [items])

  const advanceStage = (id: string) => {
    setItems(current => current.map(item => {
      if (item.id !== id) return item
      const index = STAGES.findIndex(stage => stage.key === item.stage)
      if (index === -1 || index === STAGES.length - 1) return item
      return { ...item, stage: STAGES[index + 1].key }
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Creative Production</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>
            Simple pipeline for taking each script from drafted to uploaded.
          </p>
        </div>

        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold" style={{ background: pink, color: '#fff' }}>
          <Plus size={16} /> Add script
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAGES.map(stage => (
          <div key={stage.key} className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</p>
            <p className="text-2xl font-bold mt-2" style={{ color: '#F0F2F8' }}>{counts[stage.key]}</p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-6 md:grid-cols-2 gap-3">
        {STAGES.map(stage => {
          const stageItems = items.filter(item => item.stage === stage.key)
          return (
            <div key={stage.key} className="rounded-xl p-3 min-h-[360px]" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold" style={{ color: '#F0F2F8' }}>{stage.label}</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${stage.color}15`, color: stage.color }}>{stageItems.length}</span>
              </div>
              <div className="space-y-3">
                {stageItems.length === 0 ? (
                  <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(255,255,255,0.02)', border: `1px dashed ${border}`, color: muted }}>
                    Nothing here.
                  </div>
                ) : stageItems.map(item => (
                  <ScriptCard key={item.id} item={item} onAdvance={advanceStage} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showAdd && <AddScriptModal onClose={() => setShowAdd(false)} onCreate={(item) => setItems(current => [item, ...current])} />}
    </div>
  )
}
