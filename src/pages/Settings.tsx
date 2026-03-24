import { useState, useEffect } from 'react'

const CLIENT_ID = '701375376868-pshns7bbcbupqqgbvgusnpes6t555nhn.apps.googleusercontent.com'
const REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://dash.testtubemarketing.com'
const SUPABASE_URL = 'https://oirnxlidjgsbcyhtxkse.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcm54bGlkamdzYmN5aHR4a3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTA0NzYsImV4cCI6MjA4OTc4NjQ3Nn0.tonvjgYhT5Y9jlyIMFa11fjc8k_gGj8m11L0UseOe_s'

const teal = '#3FEACE'
const pink = '#FF0D64'
const muted = '#8891A8'
const border = 'rgba(255,255,255,0.08)'
const surface = '#161B27'
const green = '#22C55E'

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '24px 28px', marginBottom: 20 }}>
      {title && <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: muted, marginBottom: 20 }}>{title}</p>}
      {children}
    </div>
  )
}

async function getCalendarToken(): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?key=eq.google_refresh_token&select=value&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  })
  const data = await res.json()
  return data?.[0]?.value || null
}

export default function Settings() {
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [oauthError, setOauthError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  // Check if already connected
  useEffect(() => {
    getCalendarToken().then(token => {
      setCalendarConnected(!!token)
      setCalendarLoading(false)
    })

    // Handle OAuth redirect (when Google sends back the code)
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      handleOAuthCode(code)
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleOAuthCode = async (code: string) => {
    setCalendarLoading(true)
    try {
      // Exchange code for tokens via a proxy (can't do this client-side due to CORS)
      // Store the code in Supabase and the OpenClaw automation will exchange it
      await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ key: 'google_oauth_code', value: code })
      })
      setCalendarConnected(true)
      setSaveSuccess('Google Calendar connected! Availability will sync within a few minutes.')
    } catch {
      setOauthError('Failed to save authorisation. Please try again.')
    }
    setCalendarLoading(false)
  }

  const connectGoogleCalendar = () => {
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly')
    const redirectUri = encodeURIComponent(REDIRECT_URI)
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`
    window.location.href = url
  }

  const disconnectCalendar = async () => {
    await fetch(`${SUPABASE_URL}/rest/v1/settings?key=in.(google_refresh_token,google_access_token,google_oauth_code)`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    })
    setCalendarConnected(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F0F2F8' }}>Settings</h1>
        <p style={{ fontSize: 13, color: muted, marginTop: 4 }}>Configure your integrations and preferences</p>
      </div>

      {/* Google Calendar */}
      <Card title="Google Calendar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>📅</span>
              <p style={{ fontWeight: 600, color: '#F0F2F8', fontSize: 15 }}>Google Calendar</p>
              {!calendarLoading && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: calendarConnected ? `${green}20` : `${pink}15`, color: calendarConnected ? green : pink }}>
                  {calendarConnected ? '✓ Connected' : 'Not connected'}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: muted, maxWidth: 400 }}>
              {calendarConnected
                ? 'Your calendar is connected. The booking page will show your real availability.'
                : 'Connect your Google Calendar so the booking page shows your actual available slots.'}
            </p>
            {saveSuccess && <p style={{ fontSize: 13, color: teal, marginTop: 8 }}>✓ {saveSuccess}</p>}
            {oauthError && <p style={{ fontSize: 13, color: pink, marginTop: 8 }}>✗ {oauthError}</p>}
          </div>
          <div>
            {calendarLoading ? (
              <p style={{ fontSize: 13, color: muted }}>Checking...</p>
            ) : calendarConnected ? (
              <button onClick={disconnectCalendar}
                style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 13, cursor: 'pointer' }}>
                Disconnect
              </button>
            ) : (
              <button onClick={connectGoogleCalendar}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: teal, color: '#0F1117', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Connect Google Calendar
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Account */}
      <Card title="Account">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Name', value: 'Nick Fisher' },
            { label: 'Email', value: 'bigfish@testtubemarketing.com' },
            { label: 'Zoom room', value: 'us06web.zoom.us/j/8792020476' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${border}` }}>
              <span style={{ fontSize: 13, color: muted }}>{label}</span>
              <span style={{ fontSize: 13, color: '#F0F2F8' }}>{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Email automation */}
      <Card title="Email Automation">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Weekly report', value: 'Every Monday 7am → bigfish@ + ad@testtubemarketing.com', status: 'active' },
            { label: '24hr reminder', value: 'Sent to leads the day before their call', status: 'active' },
            { label: '2hr reminder', value: 'Sent to leads 2 hours before their call', status: 'active' },
            { label: 'Confirmation', value: 'Sent when a call is booked via the portal', status: 'active' },
          ].map(({ label, value, status }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${border}` }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#F0F2F8', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 12, color: muted }}>{value}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${green}20`, color: green }}>Active</span>
            </div>
          ))}
        </div>
      </Card>

      {/* API integrations */}
      <Card title="Connected Integrations">
        {[
          { name: 'Meta Ads API', color: green, label: '✓ Connected', detail: 'act_1240226554066627' },
          { name: 'Supabase', color: green, label: '✓ Connected', detail: 'oirnxlidjgsbcyhtxkse.supabase.co' },
          { name: 'Fireflies', color: green, label: '✓ Connected', detail: 'Transcript processing ready' },
          { name: 'Gmail SMTP', color: green, label: '✓ Connected', detail: 'bigfish@testtubemarketing.com' },
          { name: 'WhatsApp Business', color: teal, label: 'Partial', detail: 'Phone ID configured, token needed' },
          { name: 'Calendly', color: pink, label: 'Retiring', detail: 'Being replaced by The Nucleus' },
          { name: 'Perspective Funnels', color: pink, label: 'Retiring', detail: 'Being replaced by book.testtubemarketing.com' },
        ].map(({ name, color, label, detail }) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${border}` }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#F0F2F8', marginBottom: 2 }}>{name}</p>
              <p style={{ fontSize: 12, color: muted }}>{detail}</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${color}20`, color: color }}>
              {label}
            </span>
          </div>
        ))}
      </Card>
    </div>
  )
}
