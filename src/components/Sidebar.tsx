import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Kanban, BarChart2, Film, Settings } from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/ads', icon: BarChart2, label: 'Ad Performance' },
  { to: '/creatives', icon: Film, label: 'Creative Library' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 flex flex-col z-30"
      style={{ background: '#0F1117', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Logo */}
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚛</span>
          <div>
            <p className="font-bold text-sm tracking-tight" style={{ color: '#F0F2F8' }}>The Nucleus</p>
            <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#FF0D64' }}>TTM</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white bg-white/8'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/4'
              }`
            }>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[11px] font-medium" style={{ color: '#8891A8' }}>Test Tube Marketing</p>
        <p className="text-[10px]" style={{ color: '#8891A8' }}>Acquisition Command Centre</p>
      </div>
    </aside>
  )
}
