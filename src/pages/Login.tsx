import { useState } from 'react'

const CORRECT_PASSWORD = import.meta.env.VITE_DASH_PASSWORD || 'ttm2026'
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 60
const STORAGE_KEY = 'nucleus_auth'
const ATTEMPTS_KEY = 'nucleus_attempts'

interface AuthState {
  attempts: number
  lockedUntil: number | null
  lastAttempt: number
}

function getAuthState(): AuthState {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}')
  } catch { return { attempts: 0, lockedUntil: null, lastAttempt: 0 } }
}

function setAuthState(state: AuthState) {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state))
}

export function isAuthenticated(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'authenticated'
}

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const authState = getAuthState()
  const now = Date.now()
  const isLocked = authState.lockedUntil && authState.lockedUntil > now
  const minutesLeft = isLocked ? Math.ceil((authState.lockedUntil! - now) / 60000) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) return

    setLoading(true)
    await new Promise(r => setTimeout(r, 400)) // prevent timing attacks

    if (password === CORRECT_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, 'authenticated')
      setAuthState({ attempts: 0, lockedUntil: null, lastAttempt: now })
      onSuccess()
    } else {
      const newAttempts = (authState.attempts || 0) + 1
      const locked = newAttempts >= MAX_ATTEMPTS
      setAuthState({
        attempts: locked ? 0 : newAttempts,
        lockedUntil: locked ? now + LOCKOUT_MINUTES * 60000 : null,
        lastAttempt: now,
      })

      if (locked) {
        setError(`Too many attempts. Locked for ${LOCKOUT_MINUTES} minutes.`)
        // In production, this would trigger an email notification
        console.warn(`[Nucleus] Lockout triggered at ${new Date().toISOString()}`)
      } else {
        setError(`Incorrect password. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? '' : 's'} remaining.`)
      }
      setPassword('')
    }
    setLoading(false)
  }

  const teal = '#3FEACE'
  const muted = '#8891A8'
  const border = 'rgba(255,255,255,0.08)'
  const surface = '#161B27'

  return (
    <div style={{ minHeight: '100vh', background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚛</div>
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 20, color: '#F0F2F8', marginBottom: 4 }}>The Nucleus</h1>
          <p style={{ fontSize: 13, color: muted }}>Test Tube Marketing · Acquisition Command Centre</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Password"
              disabled={!!isLocked || loading}
              autoFocus
              style={{ width: '100%', padding: '12px 16px', background: surface, border: `1px solid ${error ? '#EF4444' : border}`, borderRadius: 8, color: '#F0F2F8', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {(error || isLocked) && (
            <p style={{ fontSize: 13, color: '#EF4444', marginBottom: 16, textAlign: 'center' }}>
              {isLocked ? `Locked for ${minutesLeft} more minute${minutesLeft === 1 ? '' : 's'}.` : error}
            </p>
          )}

          <button
            type="submit"
            disabled={!!isLocked || loading || !password}
            style={{ width: '100%', padding: '12px 16px', background: isLocked ? '#333' : teal, color: '#0F1117', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: isLocked ? 'not-allowed' : 'pointer', opacity: !password ? 0.6 : 1 }}
          >
            {loading ? '...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: muted }}>
          Private access only · Test Tube Marketing Ltd
        </p>
      </div>
    </div>
  )
}
