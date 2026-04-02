import { useState } from 'react'

const SUPABASE_URL = 'https://oirnxlidjgsbcyhtxkse.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s'

const teal = '#3FEACE'
const pink = '#FF0D64'
const muted = '#8891A8'
const border = 'rgba(255,255,255,0.08)'
const surface = '#161B27'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function Proposals() {
  const [docUrl, setDocUrl] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docUrl || !slug) return

    setStatus('submitting')
    setMessage('')

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-proposal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ doc_url: docUrl, slug: slug.replace(/^\/+/, '').replace(/\/+$/, '') }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setMessage(data.error || 'Something went wrong')
        return
      }

      setStatus('success')
      setMessage(data.url || `https://proposals.testtubemarketing.com/${slug}`)
      setDocUrl('')
      setSlug('')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Network error')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${border}`,
    borderRadius: 8,
    color: '#F0F2F8',
    fontSize: 14,
    fontFamily: 'Inter, system-ui, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F0F2F8', marginBottom: 4 }}>Proposals</h1>
      <p style={{ fontSize: 13, color: muted, marginBottom: 28 }}>Generate and publish a new proposal from a Google Doc.</p>

      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '28px 32px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Google Doc URL
            </label>
            <input
              type="url"
              placeholder="https://docs.google.com/document/d/..."
              value={docUrl}
              onChange={e => setDocUrl(e.target.value)}
              required
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = teal)}
              onBlur={e => (e.currentTarget.style.borderColor = border)}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Proposal Slug
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${border}`,
                borderRight: 'none',
                borderRadius: '8px 0 0 8px',
                color: muted,
                fontSize: 14,
                whiteSpace: 'nowrap',
              }}>
                proposals.testtubemarketing.com/
              </span>
              <input
                type="text"
                placeholder="client-name"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                required
                style={{ ...inputStyle, borderRadius: '0 8px 8px 0' }}
                onFocus={e => (e.currentTarget.style.borderColor = teal)}
                onBlur={e => (e.currentTarget.style.borderColor = border)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'submitting' || !docUrl || !slug}
            style={{
              width: '100%',
              padding: '12px 24px',
              background: status === 'submitting' ? 'rgba(255,255,255,0.06)' : pink,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'opacity 0.15s',
              opacity: (!docUrl || !slug) ? 0.5 : 1,
            }}
          >
            {status === 'submitting' ? 'Generating proposal...' : 'Generate & Publish'}
          </button>
        </form>

        {status === 'success' && (
          <div style={{
            marginTop: 20,
            padding: '14px 18px',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 8,
            fontSize: 13,
            color: '#22C55E',
            lineHeight: 1.6,
          }}>
            Proposal published successfully.<br />
            <a
              href={message}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: teal, fontWeight: 600 }}
            >
              {message}
            </a>
          </div>
        )}

        {status === 'error' && (
          <div style={{
            marginTop: 20,
            padding: '14px 18px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            fontSize: 13,
            color: '#EF4444',
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
