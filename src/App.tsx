import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Settings as SettingsIcon, FileText,
  Activity, Brain, AlertTriangle, RefreshCw
} from 'lucide-react'
import { Component, type ReactNode, createContext, useContext, useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Report from './pages/Report'
import Settings from './pages/Settings'
import ClinicalView from './pages/ClinicalView'
import { WebSocketProvider, useWebSocket } from './hooks/useWebSocketBus'

// ====== 全局适老化主题与沉浸模式 Context ======
interface ImmersiveModeContextType {
  isImmersiveMode: boolean
  setImmersiveMode: (v: boolean) => void
  theme: 'warm' | 'high-contrast' | 'low-vision'
  setTheme: (t: 'warm' | 'high-contrast' | 'low-vision') => void
  fontScale: number
  setFontScale: (s: number) => void
}

export const ImmersiveModeContext = createContext<ImmersiveModeContextType>({
  isImmersiveMode: false,
  setImmersiveMode: () => {},
  theme: 'warm',
  setTheme: () => {},
  fontScale: 1.0,
  setFontScale: () => {},
})

export const useImmersiveMode = () => useContext(ImmersiveModeContext)

// ====== 全局错误边界 ======
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
        <div className="flex-1 flex items-center justify-center p-10 bg-[var(--color-bg-primary)]">
          <div className="text-center max-w-md space-y-4 p-8 bg-[var(--color-bg-card)] rounded-2xl border-2 border-[var(--color-border-theme)]">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 flex items-center justify-center">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">页面加载出现问题</h2>
            <p className="text-lg text-[var(--color-text-secondary)]">
              当前页面遇到了意外错误，您的数据不会受影响。
            </p>
            <pre className="text-xs text-left bg-[var(--color-bg-card-alt)] rounded-lg p-3 text-[var(--color-text-muted)] overflow-auto max-h-32">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              className="btn-elderly bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
            >
              <RefreshCw size={18} /> 刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// 顶部大号 Tab 项
const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: '🧠 开始检测' },
  { to: '/report', icon: FileText, label: '📋 我的报告' },
  { to: '/settings', icon: SettingsIcon, label: '⚙️ 系统设置' },
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
    <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[var(--color-bg-card-alt)] rounded-xl border border-[var(--color-border-theme)]">
      <Activity size={18} className={`${iconColor} transition-all duration-300`} />
      <span className="text-sm font-bold text-[var(--color-text-secondary)]">{label}</span>
      <span className="relative flex h-2.5 w-2.5 ml-2">
        {connectionState === 'connected' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`}></span>
      </span>
    </div>
  )
}

function MainAppLayout() {
  const { isImmersiveMode, theme, fontScale } = useImmersiveMode()
  const location = useLocation()
  
  // 隐藏顶部导航：处于沉浸测试模式，或者是医生的独立扫码查看页
  const isClinicalRoute = location.pathname.startsWith('/clinical_view')
  const hideHeader = isImmersiveMode || isClinicalRoute

  useEffect(() => {
    // 动态同步全局 CSS 变量与类
    document.documentElement.classList.remove('theme-warm', 'theme-high-contrast', 'theme-low-vision')
    document.documentElement.classList.add(`theme-${theme}`)
    document.documentElement.style.setProperty('--font-scale', fontScale.toString())
  }, [theme, fontScale])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)] transition-colors duration-200">
      {/* 头部大 Tab 导航栏 */}
      {!hideHeader && (
        <header className="flex items-center justify-between px-6 py-4 bg-[var(--color-bg-card)] border-b-2 border-[var(--color-border-theme)] shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
              <Brain size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[var(--color-text-primary)] leading-tight tracking-wide">脑心行为联合评估</h1>
              <p className="text-sm text-[var(--color-text-secondary)] font-bold">适老化健康管理系统 v3.2</p>
            </div>
          </div>

          <nav className="flex items-center gap-4">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-6 py-3.5 rounded-2xl text-lg font-black border-2 transition-all ${
                    isActive
                      ? 'bg-[var(--color-bg-card-alt)] text-[var(--color-accent)] border-[var(--color-border-theme)] shadow-inner'
                      : 'text-[var(--color-text-secondary)] border-transparent hover:bg-[var(--color-bg-card-alt)]'
                  }`
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <SidebarStatus />
          </div>
        </header>
      )}

      {/* 页面主视图 */}
      <main className="flex-1 overflow-auto flex flex-col">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/report" element={<Report />} />
            <Route path="/clinical_view" element={<ClinicalView />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default function App() {
  const [isImmersiveMode, setImmersiveMode] = useState(false)
  
  const [theme, setTheme] = useState<'warm' | 'high-contrast' | 'low-vision'>(() => {
    try {
      const saved = localStorage.getItem('emotion-fusion-theme')
      return (saved as any) || 'warm'
    } catch { return 'warm' }
  })
  
  const [fontScale, setFontScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('emotion-fusion-fontscale')
      return saved ? parseFloat(saved) : 1.0
    } catch { return 1.0 }
  })

  // 同步本地存储
  const handleSetTheme = (t: 'warm' | 'high-contrast' | 'low-vision') => {
    setTheme(t)
    localStorage.setItem('emotion-fusion-theme', t)
  }

  const handleSetFontScale = (s: number) => {
    const scale = Math.max(1.0, Math.min(1.5, s))
    setFontScale(scale)
    localStorage.setItem('emotion-fusion-fontscale', scale.toString())
  }

  return (
    <WebSocketProvider>
      <ImmersiveModeContext.Provider value={{
        isImmersiveMode,
        setImmersiveMode,
        theme,
        setTheme: handleSetTheme,
        fontScale,
        setFontScale: handleSetFontScale
      }}>
        <MainAppLayout />
      </ImmersiveModeContext.Provider>
    </WebSocketProvider>
  )
}
