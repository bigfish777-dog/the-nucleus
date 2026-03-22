import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Pipeline from './pages/Pipeline'
import AdPerformance from './pages/AdPerformance'
import CreativeLibrary from './pages/CreativeLibrary'
import Settings from './pages/Settings'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen" style={{ background: '#111827' }}>
        <Sidebar />
        <main className="ml-56 flex-1 min-h-screen overflow-y-auto p-8"
          style={{ background: '#111827' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/ads" element={<AdPerformance />} />
            <Route path="/creatives" element={<CreativeLibrary />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
