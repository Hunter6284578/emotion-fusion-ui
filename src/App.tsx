import { Routes, Route, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, User, Clock, Settings as SettingsIcon,
  Activity, Brain
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
    <div className="flex h-screen bg-[#F3F6F8]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 text-slate-700 flex flex-col shrink-0 z-10">
        <div className="px-6 py-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Brain size={20} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-slate-800 leading-tight">多模态情绪分析</h1>
              <p className="text-xs text-slate-500 font-medium">临床辅助系统 v3.0</p>
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
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 px-2">
            <Activity size={16} className="text-teal-500" />
            <span className="text-xs font-medium text-slate-500">已连接后端服务</span>
            <span className="ml-auto w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
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
