import { Routes, Route, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, User, Clock, Settings as SettingsIcon,
  Activity, Brain,
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import History from './pages/History'
import Settings from './pages/Settings'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: '诊断工作台' },
  { to: '/profile', icon: User, label: '患者档案' },
  { to: '/history', icon: Clock, label: '历史记录' },
  { to: '/settings', icon: SettingsIcon, label: '系统设置' },
] as const

export default function App() {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Brain size={20} />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">多模态情绪识别</h1>
              <p className="text-[11px] text-slate-400">Fusion Engine v2.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-1">
            <Activity size={16} className="text-emerald-400" />
            <span className="text-xs text-slate-400">后端已连接</span>
            <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
