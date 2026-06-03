import { Routes, Route, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, User, Clock, Settings as SettingsIcon,
  Activity, Brain, AlertTriangle, RefreshCw
} from 'lucide-react'
import { Component, type ReactNode } from 'react'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import History from './pages/History'
import Settings from './pages/Settings'
import { WebSocketProvider, useWebSocket } from './hooks/useWebSocketBus'

// ====== 全局错误边界：防止组件崩溃导致白屏 ======
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-10">
          <div className="text-center max-w-md space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">页面加载出现问题</h2>
            <p className="text-sm text-slate-500">
              当前页面遇到了意外错误，您的数据不会受影响。
            </p>
            <pre className="text-xs text-left bg-slate-50 rounded-lg p-3 text-slate-600 overflow-auto max-h-32">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={15} /> 刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

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
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </WebSocketProvider>
  )
}
