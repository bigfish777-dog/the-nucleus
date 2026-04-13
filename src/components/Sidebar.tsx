import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Kanban, BarChart2, Film, Settings, Menu, X, Funnel, FileText, Clapperboard } from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/ads', icon: BarChart2, label: 'Ad Performance' },
  { to: '/creatives', icon: Film, label: 'Creative Library' },
  { to: '/creative-production', icon: Clapperboard, label: 'Creative Production' },
  { to: '/tracking', icon: Funnel, label: 'Tracking' },
  { to: '/proposals', icon: FileText, label: 'Proposals' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

const sidebarBg = '#0F1117'
const border = 'rgba(255,255,255,0.06)'
const muted = '#8891A8'

function NavItems({ onClose, onSignOut }: { onClose?: () => void; onSignOut?: () => void }) {
  return (
    <>
      <div style={{ padding: '28px 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚛</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#F0F2F8', margin: 0 }}>The Nucleus</p>
            <p style={{ fontSize: 10, color: '#FF0D64', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>TTM</p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '0 12px' }}>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={onClose}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8, marginBottom: 2,
              textDecoration: 'none', fontSize: 14, fontWeight: 500,
              color: isActive ? '#F0F2F8' : muted,
              background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              transition: 'all 0.15s',
            })}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '16px 24px 20px', borderTop: `1px solid ${border}` }}>
        <p style={{ fontSize: 11, color: muted, marginBottom: onSignOut ? 8 : 0 }}>Test Tube Marketing</p>
        {onSignOut && (
          <button onClick={onSignOut}
            style={{ fontSize: 11, color: muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={e => (e.currentTarget.style.color = muted)}>
            Sign out
          </button>
        )}
      </div>
    </>
  )
}

export function Sidebar({ onSignOut, isMobile }: { onSignOut?: () => void; isMobile?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!isMobile) {
    // Desktop: fixed sidebar
    return (
      <aside style={{
        position: 'fixed', left: 0, top: 0, height: '100vh', width: 224,
        background: sidebarBg, borderRight: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column', zIndex: 30,
      }}>
        <NavItems onSignOut={onSignOut} />
      </aside>
    )
  }

  // Mobile: top bar + slide-out drawer
  return (
    <>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: sidebarBg, borderBottom: `1px solid ${border}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚛</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#F0F2F8' }}>The Nucleus</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F0F2F8', padding: 4 }}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 45 }}
          onClick={() => setMobileOpen(false)} />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: '100%', width: 260,
        background: sidebarBg, zIndex: 55, display: 'flex', flexDirection: 'column',
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s ease',
      }}>
        <NavItems onClose={() => setMobileOpen(false)} onSignOut={onSignOut} />
      </div>
    </>
  )
}
