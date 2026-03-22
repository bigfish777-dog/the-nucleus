const muted = '#8891A8'; const border = 'rgba(255,255,255,0.08)'; const surface = '#161B27'

export default function Settings() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: '#F0F2F8' }}>Settings</h1>
      <div className="rounded-xl p-6" style={{ background: surface, border: `1px solid ${border}` }}>
        <p className="text-sm" style={{ color: muted }}>Settings configuration — coming in Phase 6 (availability windows, reminder config, notification preferences, report recipients).</p>
      </div>
    </div>
  )
}
