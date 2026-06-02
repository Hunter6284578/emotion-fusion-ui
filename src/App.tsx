import { Routes, Route, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, User, Clock, Settings as SettingsIcon,
  Activity, Brain
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import History from './pages/History'
import Settings from './pages/Settings'
import { WebSocketProvider, useWebSocket } from './hooks/useWebSocketBus'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: '诊断工作台' },
  { to: '/profile', icon: User, label: '受检长者档案' },
  { to: '/history', icon: Clock, label: '历史记录' },
  { to: '/settings', icon: SettingsIcon, label: '系统设置' },
] as const

function SidebarStatus() {
  const { connectionState } = useWebSocket()
  
  let label = '实时监测未开启'
  let dotColor = 'bg-slate-400'
  let iconColor = 'text-slate-400'
  
  if (connectionState === 'connecting') {
    label = '正在建立连接...'
    dotColor = 'bg-amber-400'
    iconColor = 'text-amber-500'
  } else if (connectionState === 'connected') {
    label = '双模态网关已连接'
    dotColor = 'bg-emerald-500'
    iconColor = 'text-emerald-500'
  } else if (connectionState === 'error') {
    label = '网关连接失败'
    dotColor = 'bg-rose-500'
    iconColor = 'text-rose-500'
  }

  return (
    <div className="flex items-center gap-2.5 px-2">
      <Activity size={15} className={`${iconColor} transition-all duration-300`} />
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      <span className="relative flex h-2 w-2 ml-auto">
        {connectionState === 'connected' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}></span>
      </span>
    </div>
  )
}

export default function App() {
  return (
    <WebSocketProvider>
      <div className="flex h-screen bg-[#F3F6F8]">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 text-slate-700 flex flex-col shrink-0 z-10">
          <div className="px-6 py-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Brain size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-slate-800 leading-tight">多模态情绪分析</h1>
                <p className="text-xs text-slate-500 font-medium">临床辅助系统 v3.1</p>
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
            <SidebarStatus />
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
    </WebSocketProvider>
  )
}
