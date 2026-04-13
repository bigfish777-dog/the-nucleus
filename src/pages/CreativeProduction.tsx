import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, Clock3, Mic, PenSquare, Rocket, Video, AlertCircle } from 'lucide-react'

type ProductionStage = 'script_ideas' | 'scripts_ready' | 'recording' | 'editing' | 'ready_to_launch' | 'live' | 'parked'

type ProductionItem = {
  id: string
  title: string
  angle: string
  hookType: 'direct_response' | 'qualifier' | 'testimonial' | 'thought_leadership'
  stage: ProductionStage
  scriptCount: number
  recordedCount: number
  editedCount: number
  owner: string
  nextStep: string
  notes?: string
}

const bg = '#161B27'
const border = 'rgba(255,255,255,0.08)'
const muted = '#8891A8'
const pink = '#FF0D64'
const teal = '#3FEACE'
const amber = '#FFA71A'
const green = '#22C55E'

const STAGES: { key: ProductionStage; label: string; color: string }[] = [
  { key: 'script_ideas', label: 'Script Ideas', color: muted },
  { key: 'scripts_ready', label: 'Scripts Ready', color: pink },
  { key: 'recording', label: 'Recording', color: amber },
  { key: 'editing', label: 'Editing', color: '#60A5FA' },
  { key: 'ready_to_launch', label: 'Ready to Launch', color: teal },
  { key: 'live', label: 'Live', color: green },
  { key: 'parked', label: 'Parked', color: '#6B7280' },
]

const SEED_ITEMS: ProductionItem[] = [
  {
    id: 'cp1',
    title: 'Bottleneck batch',
    angle: 'Founder bottleneck / execution gap',
    hookType: 'direct_response',
    stage: 'recording',
    scriptCount: 8,
    recordedCount: 6,
    editedCount: 0,
    owner: 'Nick',
    nextStep: 'Record final 2 scripts, then hand all 8 into editing',
    notes: 'This is the current active batch and the one most likely to get chaotic first.',
  },
  {
    id: 'cp2',
    title: 'Agency frustration angles',
    angle: 'Agencies disappear after strategy deck',
    hookType: 'direct_response',
    stage: 'scripts_ready',
    scriptCount: 5,
    recordedCount: 0,
    editedCount: 0,
    owner: 'Nick',
    nextStep: 'Choose top 3 to record first',
  },
  {
    id: 'cp3',
    title: '£500k+ qualifier set',
    angle: 'Revenue-qualified founder pain',
    hookType: 'qualifier',
    stage: 'editing',
    scriptCount: 4,
    recordedCount: 4,
    editedCount: 2,
    owner: 'Nick',
    nextStep: 'Review first two edits and approve cut style',
  },
  {
    id: 'cp4',
    title: 'Client result testimonials',
    angle: 'Proof / credibility / transformation',
    hookType: 'testimonial',
    stage: 'script_ideas',
    scriptCount: 3,
    recordedCount: 0,
    editedCount: 0,
    owner: 'Nick',
    nextStep: 'Turn rough notes into final scripts',
  },
  {
    id: 'cp5',
    title: 'Operator / thought-leadership cuts',
    angle: 'Why execution beats another strategy session',
    hookType: 'thought_leadership',
    stage: 'parked',
    scriptCount: 2,
    recordedCount: 0,
    editedCount: 0,
    owner: 'Nick',
    nextStep: 'Park until direct response batch is through',
  },
]

function ProgressPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <div className="flex items-center gap-2 mb-1" style={{ color }}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-bold" style={{ color: '#F0F2F8' }}>{value}</p>
    </div>
  )
}

function StageBadge({ stage }: { stage: ProductionStage }) {
  const match = STAGES.find(s => s.key === stage)!
  return (
    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: `${match.color}15`, color: match.color }}>
      {match.label}
    </span>
  )
}

export default function CreativeProduction() {
  const [stageFilter, setStageFilter] = useState<'All' | ProductionStage>('All')

  const filtered = useMemo(() => {
    return SEED_ITEMS.filter(item => stageFilter === 'All' || item.stage === stageFilter)
  }, [stageFilter])

  const totals = useMemo(() => {
    return SEED_ITEMS.reduce((acc, item) => {
      acc.scripts += item.scriptCount
      acc.recorded += item.recordedCount
      acc.edited += item.editedCount
      return acc
    }, { scripts: 0, recorded: 0, edited: 0 })
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Creative Production</h1>
          <p className="text-sm mt-0.5" style={{ color: muted }}>
            Track new ad creative from script pile to live launch so batches don’t descend into chaos.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <ProgressPill icon={<PenSquare size={12} />} label="Scripts" value={String(totals.scripts)} color={pink} />
          <ProgressPill icon={<Mic size={12} />} label="Recorded" value={String(totals.recorded)} color={amber} />
          <ProgressPill icon={<Video size={12} />} label="Edited" value={String(totals.edited)} color={teal} />
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: muted }}>Suggested workflow</p>
            <p className="text-sm mt-1" style={{ color: '#F0F2F8' }}>Idea → final scripts → recorded → edited → ready to launch → live</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStageFilter('All')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg"
              style={{ background: stageFilter === 'All' ? 'rgba(255,255,255,0.08)' : 'transparent', color: stageFilter === 'All' ? '#F0F2F8' : muted }}
            >
              All
            </button>
            {STAGES.map(stage => (
              <button
                key={stage.key}
                onClick={() => setStageFilter(stage.key)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                style={{ background: stageFilter === stage.key ? `${stage.color}18` : 'transparent', color: stageFilter === stage.key ? stage.color : muted }}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(item => (
            <div key={item.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}` }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#F0F2F8' }}>{item.title}</p>
                  <p className="text-xs mt-1" style={{ color: muted }}>{item.angle}</p>
                </div>
                <StageBadge stage={item.stage} />
              </div>

              <div className="flex gap-2 flex-wrap mb-3">
                <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: `${pink}12`, color: pink }}>{item.hookType.replace('_', ' ')}</span>
                <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: muted }}>Owner: {item.owner}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-[10px] uppercase font-bold" style={{ color: muted }}>Scripts</p>
                  <p className="text-sm font-bold" style={{ color: '#F0F2F8' }}>{item.scriptCount}</p>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-[10px] uppercase font-bold" style={{ color: muted }}>Recorded</p>
                  <p className="text-sm font-bold" style={{ color: '#F0F2F8' }}>{item.recordedCount}</p>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-[10px] uppercase font-bold" style={{ color: muted }}>Edited</p>
                  <p className="text-sm font-bold" style={{ color: '#F0F2F8' }}>{item.editedCount}</p>
                </div>
              </div>

              <div className="rounded-lg p-3 mb-2" style={{ background: `${amber}10`, border: `1px solid ${amber}18` }}>
                <div className="flex items-center gap-2 mb-1" style={{ color: amber }}>
                  <Clock3 size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Next step</span>
                </div>
                <p className="text-sm" style={{ color: '#F0F2F8' }}>{item.nextStep}</p>
              </div>

              {item.notes && (
                <div className="rounded-lg p-3" style={{ background: `${pink}08`, border: `1px solid ${pink}18` }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: pink }}>
                    <AlertCircle size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Watch-out</span>
                  </div>
                  <p className="text-sm" style={{ color: '#F0F2F8' }}>{item.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: muted }}>What this tab should become next</p>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { icon: <Circle size={14} />, title: 'Script bank', body: 'Store every draft script so nothing lives only in notes, Slack or your head.' },
            { icon: <Mic size={14} />, title: 'Recording tracker', body: 'Mark which scripts are recorded, where the raw files live, and what still needs filming.' },
            { icon: <CheckCircle2 size={14} />, title: 'Edit approval', body: 'Track what is awaiting edit, awaiting review, and ready to publish.' },
            { icon: <Rocket size={14} />, title: 'Launch queue', body: 'Keep a clean list of what is approved and ready to turn into live ads.' },
          ].map(card => (
            <div key={card.title} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}` }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: teal }}>{card.icon}<span className="text-sm font-semibold" style={{ color: '#F0F2F8' }}>{card.title}</span></div>
              <p className="text-sm" style={{ color: muted }}>{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
