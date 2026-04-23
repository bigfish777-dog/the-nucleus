import { useEffect, useMemo, useState } from 'react'
import { Plus, GripVertical, Trash2 } from 'lucide-react'
import { deleteCreativeProductionItem, fetchCreativeProductionItems, updateCreativeProductionStage, upsertCreativeProductionItem } from '../lib/supabase'

type ScriptStage = 'scripted' | 'recorded' | 'sent_to_editor' | 'proof_received' | 'approved' | 'uploaded'

type ScriptItem = {
  id: string
  title: string
  script: string
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
  {
    id: 'script_hook_3b_reshoot',
    title: 'HOOK 3B (Reshoot)',
    script: `Most agencies send you a strategy doc and then fuck off.\n\nCoaching programmes tell you what you should be doing, but then leave you to do all the work.\n\nWe don’t do either.\n\nWe work as your fractional marketing department. Copy, tech, funnels, design. Everything you need. Done for you. Not just taught.\n\nIf that sounds like what you’re looking for, apply below.`,
    stage: 'recorded',
    created_at: '2026-04-13',
  },
  {
    id: 'script_hook_17_founder_led_chaos',
    title: 'Hook 17 - Founder-Led Chaos',
    script: `If your marketing still depends on you…\n\nApproving everything, rewriting everything, chasing everyone, holding it all together…\n\nYou haven’t got a marketing function. You’ve got founder-led chaos.\n\nWe can fix that. We’ll work as your fractional marketing department. Everything you need. Done for you. Not just taught.\n\nIf that sounds like what you’re looking for, hit the link below.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_hook_18_execution_problem',
    title: 'Hook 18 - Execution Problem',
    script: `You probably already know what your marketing should be doing.\n\nThe problem’s not your knowledge. It’s that you’ve got no fucker actually doing it to a high standard.\n\nThat’s where we can help.\n\nWe’ll work as your fractional marketing department. Take your strategy. And do it all for you.\n\nClick the link below to book a call if that sounds like what you’re looking for.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_hook_19_three_freelancers',
    title: 'Hook 19 - Three Freelancers',
    script: `If your current marketing “team” is half a dozen freelancers and your “strategy” is whatever you come up with on Monday morning every week…\n\nThat’s a problem.\n\nYou don’t need more people to manage. You need a marketing department.\n\nThat’s where we can help.\n\nWe can fix that. We’ll work as your fractional marketing department. Everything you need. Done for you, by our experienced team.\n\nClick the link below to see how it works.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_hook_20_vanity_metrics',
    title: 'Hook 20 - Vanity metrics',
    script: `If you’ve worked with a marketing agency before, you’ve probably been sent a monthly report telling you how many clicks, impressions or views you’ve been getting.\n\nBut you can’t pay your team with clicks. Or cover your mortgage with views.\n\nWe don’t bog our clients down with vanity metrics. We just show the amount of revenue we’ve generated and how many new clients we’ve helped them acquire.\n\nIncome and impact.\n\nAnd because of that, most of our clients have been with us for over 2 years, even though they’re on monthly rolling contracts.\n\nIf you’re curious to see what sort of impact we could have on your marketing efforts, hit the link below and let’s have a chat.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_hook_21_no_reports',
    title: 'Hook 21 - No reports',
    script: `Most of our clients have been with us for over 2 years, even though they could cancel with just 30 days notice.\n\nThat’s because we’ve fucked off likes and clicks and views and tracked the numbers that matter.\n\nLeads generated. Clients acquired. Cash collected.\n\nIf you’re interested in having us do the same for your business, hit the link below and you and I can have a chat.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_hook_22_full_transparency',
    title: 'Hook 22 - Full transparency',
    script: `Full transparency: we’re not a cheap marketing agency.\n\nBut most of our clients have been with us for over 24 months now.\n\nNot because we’ve got them tied into long contracts or because we’re devilishly handsome…\n\nBut because we make them more money than we cost them.\n\nThat’s our simple formula for success.\n\nIf you’d like to have us actually DO all of your marketing for you, so you can be one of our future success stories, just hit the link below and let’s have a conversation.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_hook_23_it_makes_me_cringe',
    title: 'HOOK 23: “It Makes Me Cringe”',
    script: `I was on a call last week with a business owner doing over £5 million a year.\nThirty years in his industry. Two thousand customers. A product that works.\nAnd he said - his exact words — “I look at our marketing and it makes me cringe.”\n\nThis is a guy with a brilliant business. And his marketing makes him embarrassed.\n\nIf that sounds familiar — if you’ve built something genuinely good but your marketing doesn’t reflect it — that’s what we fix.\n\nWe work as your fractional marketing department. Strategy, copy, ads, funnels, emails. Done for you. Not just taught.\n\nHit the link below if your marketing doesn’t match the level of what you actually deliver.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_hook_v24_trees_are_blowing',
    title: 'HOOK V24: “Which way the trees are blowing”',
    script: `One of the business owners I spoke to recently said something that stuck with me.\n\n“When it comes to marketing, I look outside and see which way the trees are blowing... and then I decide to post or not.”\n\nHer words, not mine. “There is literally no strategy whatsoever.”\n\nGreat business. Strong conversion rate. Clients love her. But not enough of the right people are walking through the door. Because nobody’s driving the marketing. There’s no plan. No rhythm. No system.\n\nCoaching programmes would tell her what to do. But she’d still be the one doing it.\nA consultant would send her a strategy doc. And then fuck off.\n\nWe don’t do either.\n\nWe work as your fractional marketing department. The strategy AND the people who do the work. Done for you. Not just taught.\n\nIf your marketing is “see which way the wind’s blowing” — hit the link below and let’s fix that.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_hook_25_person_number_10',
    title: 'HOOK 25: “Person Number 10”',
    script: `A business owner told me recently I was marketing agency 10 she’d spoken to.\n\nNot because she was indecisive. But because every agency tried to sell her on the specific thing they do.\n\nThe Google Ads guy wants to sell you Google Ads. The social media person wants to sell you social media. The funnel guy wants to sell you a funnel.\n\nNobody asks what you actually need. They just fit you into whatever box they sell.\n\nThat’s not how we work.\n\nWe build a strategy around your business and your objectives, and then we actually execute on it for you.\n\nIf you’re sick of being sold pieces when you need the whole thing — apply below.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_hook_26_outside_the_bubble',
    title: 'HOOK 26: Outside the bubble',
    script: `A founder said something on a call recently that I think a lot of business owners feel but don’t say out loud.\n\nHe said: “All I really want is someone who’s outside the business looking in. We just live in our little bubble.”\n\nHe wasn’t asking for a course. He wasn’t asking for a coaching programme. He wasn’t even asking for a strategy doc.\n\nHe wanted someone who could see what he couldn’t see — because he’s too deep inside it — and then actually DO something about it.\n\nThat’s the difference between us and everyone else.\n\nCoaching gives you perspective. But you’re still the one implementing.\nAgencies give you deliverables. But they don’t understand your business.\n\nWe sit on the outside, look in, build the strategy, AND execute it. Every week.\n\nYour fractional marketing department. Done for you. Not just taught.\n\nIf you’ve been living in your own bubble too long — hit the link below.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
  {
    id: 'script_thank_you_page',
    title: 'Thank you page',
    script: `Hey - Fish here. Quick video because you just did something that most people don’t.\n\nYou actually booked the call.\n\nThat sounds simple, but honestly? Most people watch that video, think “yeah, that’s exactly what I need,” and then go back to doing everything themselves for another six months. So the fact that you’ve taken action already tells me something about you.\n\nNow, here’s what’s going to happen.\n\nYou’ll get a confirmation email with the date, time, and a Zoom link. Add it to your calendar.\n\nSeriously — add it now, while you’re thinking about it and before someone else books something else in.\n\nOn the call, you’ll speak with me directly. Not a sales rep. Not a junior. Me.\n\nIt’ll take about 40 minutes. We’ll talk about where your business is, what your marketing looks like right now, what’s working, what isn’t, and where you’re trying to get to.\n\nI’ll be honest with you. If I think we can help, I’ll tell you how. If I don’t think we’re the right fit, I’ll tell you that too — and I’ll point you somewhere better. That’s happened before. It’ll happen again. I’d rather do that than waste both our time.\n\nA few things that’ll help us make the most of the call:\n\nHave a rough idea of what you’re currently spending on marketing — even if it’s just your time. Most people underestimate this, and it matters.\n\nThink about what’s frustrated you most about the marketing you’ve tried so far. Not so I can slag off your last agency — but so I can understand what you actually need, not just what you think you need.\n\nAnd if you’ve got a specific goal — a revenue target, an event to fill, a product to launch — bring that. It helps me give you something useful even if we don’t end up working together.\n\nOne more thing. This isn’t a pitch. You literally can’t buy anything on this call. Mainly because i need to know what you need before I can try and sell you something.\n\nSo don’t come in with your guard up. If I think we can help, I’ll go away and put a proposal together than you can review in your own time, so you don’t feel forced into making a decision!\n\nAnyway, I’m looking forward to it.\n\nI’ll see you on the call.`,
    stage: 'scripted',
    created_at: '2026-04-14',
  },
]

function AddScriptModal({ onClose, onCreate }: { onClose: () => void; onCreate: (item: ScriptItem) => Promise<void> | void }) {
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [error, setError] = useState('')

  const inputStyle = { width: '100%', padding: '10px 12px', background: surface, border: `1px solid ${border}`, borderRadius: 8, color: '#F0F2F8', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: muted, marginBottom: 6 }

  const submit = async () => {
    if (!title.trim()) {
      setError('Script title is required')
      return
    }
    await onCreate({
      id: `script_${Date.now()}`,
      title: title.trim(),
      script: script.trim(),
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
            <label style={labelStyle}>Full script</label>
            <textarea style={{ ...inputStyle, minHeight: 180 }} value={script} onChange={e => setScript(e.target.value)} placeholder="Paste the full script here" />
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

function ScriptCard({ item, onAdvance, onDelete }: { item: ScriptItem; onAdvance: (id: string) => void; onDelete: (item: ScriptItem) => void }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}` }}>
      <div className="flex items-start gap-2 mb-2">
        <GripVertical size={14} style={{ color: muted, marginTop: 2, flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-tight" style={{ color: '#F0F2F8' }}>{item.title}</p>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="inline-flex items-center justify-center rounded-lg p-1.5"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#F87171' }}
              aria-label={`Delete ${item.title}`}
              title="Delete script"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <p className="text-xs mt-1 whitespace-pre-line" style={{ color: muted }}>{item.script}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-3">
        <div className="flex gap-2 flex-wrap">
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
  const [loading, setLoading] = useState(true)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await fetchCreativeProductionItems()
        if (!error && data && data.length > 0) {
          setItems(data as ScriptItem[])
          return
        }

        for (const item of INITIAL_ITEMS) {
          await upsertCreativeProductionItem(item)
        }
        setItems(INITIAL_ITEMS)
      } catch {
        setItems(INITIAL_ITEMS)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const counts = useMemo(() => {
    const out = Object.fromEntries(STAGES.map(stage => [stage.key, 0])) as Record<ScriptStage, number>
    for (const item of items) out[item.stage] += 1
    return out
  }, [items])

  const advanceStage = async (id: string) => {
    const currentItem = items.find(item => item.id === id)
    if (!currentItem) return

    const index = STAGES.findIndex(stage => stage.key === currentItem.stage)
    if (index === -1 || index === STAGES.length - 1) return

    const nextStage = STAGES[index + 1].key

    setItems(current => current.map(item => item.id === id ? { ...item, stage: nextStage } : item))

    try {
      const { data } = await updateCreativeProductionStage(id, nextStage)
      if (data) {
        setItems(current => current.map(item => item.id === id ? data as ScriptItem : item))
      }
    } catch {
      setItems(current => current.map(item => item.id === id ? currentItem : item))
    }
  }

  const createItem = async (item: ScriptItem) => {
    setItems(current => [item, ...current])
    try {
      const { data } = await upsertCreativeProductionItem(item)
      if (data) {
        setItems(current => current.map(existing => existing.id === item.id ? data as ScriptItem : existing))
      }
    } catch {
      // keep optimistic local item if Supabase write fails
    }
  }

  const removeItem = async (item: ScriptItem) => {
    const confirmed = window.confirm(`Delete "${item.title}"? This can't be undone.`)
    if (!confirmed) return

    setDeleteError('')
    const previousItems = items
    setItems(current => current.filter(existing => existing.id !== item.id))

    try {
      const { error } = await deleteCreativeProductionItem(item.id)
      if (error) throw error
    } catch {
      setItems(previousItems)
      setDeleteError('Could not delete that script. Please try again.')
    }
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

      {loading && (
        <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${border}`, color: muted }}>
          Loading saved script stages...
        </div>
      )}

      {deleteError && (
        <div className="rounded-xl p-4 text-sm font-semibold" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#FCA5A5' }}>
          {deleteError}
        </div>
      )}

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
                  <ScriptCard key={item.id} item={item} onAdvance={advanceStage} onDelete={removeItem} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showAdd && <AddScriptModal onClose={() => setShowAdd(false)} onCreate={createItem} />}
    </div>
  )
}
