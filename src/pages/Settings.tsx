/** 页面4 - 系统设置
 *  核心功能: 参数配置 + 数据管理 + 系统状态 + 关于信息 */
import { useState } from 'react'
import {
  Save, RotateCcw, Database, HardDrive,
  Upload, Trash2, Info, Server, Shield, Sliders, Bell,
  ExternalLink, AlertTriangle, CheckCircle2,
} from 'lucide-react'

interface SystemConfig {
  // Fusion parameters
  conflict_threshold: number
  uncertainty_low_threshold: number
  uncertainty_medium_threshold: number
  single_modality_penalty: number
  adaptive_weight_exponent: number
  // Display settings
  theme: 'light' | 'dark' | 'auto'
  language: 'zh' | 'en'
  auto_refresh_interval: number
  show_confidence_bars: boolean
  show_va_space_grid: boolean
  // Notifications
  enable_alerts: boolean
  alert_uncertainty_high: boolean
  alert_valence_drop: boolean
}

const DEFAULT_CONFIG: SystemConfig = {
  conflict_threshold: 0.45,
  uncertainty_low_threshold: 0.18,
  uncertainty_medium_threshold: 0.42,
  single_modality_penalty: 0.4,
  adaptive_weight_exponent: 1.2,
  theme: 'light',
  language: 'zh',
  auto_refresh_interval: 0,
  show_confidence_bars: true,
  show_va_space_grid: true,
  enable_alerts: true,
  alert_uncertainty_high: true,
  alert_valence_drop: true,
}

type TabId = 'fusion' | 'display' | 'data' | 'about'

export default function Settings() {
  const [config, setConfig] = useState<SystemConfig>(() => {
    try {
      const saved = localStorage.getItem('emotion-fusion-config')
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG
    } catch { return DEFAULT_CONFIG }
  })
  const [activeTab, setActiveTab] = useState<TabId>('fusion')
  const [saved, setSaved] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)

  const update = <K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const saveConfig = () => {
    localStorage.setItem('emotion-fusion-config', JSON.stringify(config))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const resetConfig = () => {
    setConfig(DEFAULT_CONFIG)
    localStorage.removeItem('emotion-fusion-config')
    setResetConfirm(false)
  }

  const tabs: { id: TabId; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
    { id: 'fusion', icon: Sliders, label: '融合参数' },
    { id: 'display', icon: Bell, label: '显示与通知' },
    { id: 'data', icon: Database, label: '数据管理' },
    { id: 'about', icon: Info, label: '关于系统' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">系统设置</h2>
          <p className="text-sm text-slate-500 mt-0.5">配置融合引擎参数与系统偏好</p>
        </div>
        <div className="flex gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm animate-in fade-in duration-200">
              <CheckCircle2 size={15} /> 已保存
            </span>
          )}
          <button
            onClick={saveConfig}
            disabled={saved}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <Save size={15} /> 保存配置
          </button>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Sidebar Tabs */}
        <nav className="w-48 shrink-0 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </nav>

        {/* Content Panels */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[480px]">
          {activeTab === 'fusion' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-1">多模态融合参数</h3>
                <p className="text-xs text-slate-500 mb-4">调整融合引擎的核心算法阈值和权重计算方式</p>
              </div>

              <SliderSetting
                label="冲突检测阈值"
                description="模态间VA差异超过此值时标记为冲突（范围 0.2 ~ 0.7）"
                value={config.conflict_threshold}
                min={0.2} max={0.7} step={0.05}
                unit=""
                onChange={v => update('conflict_threshold', v)}
              />

              <SliderSetting
                label="低不确定性上限"
                description="不确定性分数低于此值判定为 low（范围 0.1 ~ 0.35）"
                value={config.uncertainty_low_threshold}
                min={0.1} max={0.35} step={0.02}
                unit=""
                onChange={v => update('uncertainty_low_threshold', v)}
              />

              <SliderSetting
                label="中等不确定性上限"
                description="超过此值判定为 high，之间为 medium（范围 0.25 ~ 0.6）"
                value={config.uncertainty_medium_threshold}
                min={0.25} max={0.6} step={0.03}
                unit=""
                onChange={v => update('uncertainty_medium_threshold', v)}
              />

              <SliderSetting
                label="单模态降级系数"
                description="仅一个模态可用时对置信度的惩罚比例（范围 0.2 ~ 0.8）"
                value={config.single_modality_penalty}
                min={0.2} max={0.8} step={0.05}
                unit=""
                onChange={v => update('single_modality_penalty', v)}
              />

              <SliderSetting
                label="自适应权重指数"
                description="置信度对权重的影响程度，越高越敏感（范围 1.0 ~ 2.0）"
                value={config.adaptive_weight_exponent}
                min={1.0} max={2.0} step={0.1}
                unit=""
                onChange={v => update('adaptive_weight_exponent', v)}
              />

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-700 text-xs">
                  <AlertTriangle size={14} />
                  修改融合参数可能影响分析结果的准确性和一致性。请在专业指导下调整。
                </div>
              </div>
            </div>
          )}

          {activeTab === 'display' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-1">显示偏好</h3>
                <p className="text-xs text-slate-500 mb-4">自定义界面外观和行为</p>
              </div>

              <ToggleSetting
                label="显示置信度条"
                description="在历史记录表格中以进度条形式展示各条目的置信度"
                checked={config.show_confidence_bars}
                onChange={v => update('show_confidence_bars', v)}
              />

              <ToggleSetting
                label="显示 VA 空间网格线"
                description="在诊断工作台的 VA 散点图中绘制网格参考线"
                checked={config.show_va_space_grid}
                onChange={v => update('show_va_space_grid', v)}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">界面主题</label>
                <select value={config.theme} onChange={e => update('theme', e.target.value as SystemConfig['theme'])}
                  className="w-full max-w-xs px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="light">浅色模式</option>
                  <option value="dark">深色模式</option>
                  <option value="auto">跟随系统</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">语言</label>
                <select value={config.language} onChange={e => update('language', e.target.value as SystemConfig['language'])}
                  className="w-full max-w-xs px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>

              <SliderSetting
                label="自动刷新间隔"
                description="页面自动刷新数据的间隔时间（秒），0 表示手动刷新"
                value={config.auto_refresh_interval}
                min={0} max={300} step={30}
                unit="秒"
                onChange={v => update('auto_refresh_interval', v)}
              />

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">通知设置</h4>
                <ToggleSetting
                  label="启用系统提醒"
                  description="全局开关，关闭后将不再接收任何系统通知"
                  checked={config.enable_alerts}
                  onChange={v => update('enable_alerts', v)}
                />
                <ToggleSetting
                  label="高不确定性告警"
                  description="当评估结果的不确定性为 high 时弹出警告"
                  checked={config.alert_uncertainty_high}
                  onChange={v => update('alert_uncertainty_high', v)}
                />
                <ToggleSetting
                  label="愉悦度骤降告警"
                  description="当连续两次评估的愉悦度差值超过阈值时告警"
                  checked={config.alert_valence_drop}
                  onChange={v => update('alert_valence_drop', v)}
                />
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-1">数据管理</h3>
                <p className="text-xs text-slate-500 mb-4">导入、导出、备份和清理评估数据</p>
              </div>

              {/* Storage Status */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <HardDrive size={16} className="text-slate-500" /> 存储状态
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-500">总记录数</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">--</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-500">数据库大小</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">-- KB</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-500">最后更新</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">--</p>
                  </div>
                </div>
              </div>

              {/* Export Options */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">导出数据</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => window.open('/api/export/csv', '_blank')}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                    <DownloadIcon /> 导出 CSV
                  </button>
                  <button onClick={() => window.open('/api/export/json', '_blank')}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                    <DownloadIcon /> 导出 JSON
                  </button>
                </div>
              </div>

              {/* Import */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">导入数据</h4>
                <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors text-sm text-slate-500">
                  <Upload size={18} />
                  点击上传 CSV / JSON 文件
                  <input type="file" accept=".csv,.json" className="hidden" />
                </label>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-slate-200">
                <div className="p-4 border border-red-200 bg-red-50 rounded-xl space-y-4">
                  <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> 危险区域
                  </h4>
                  {!resetConfirm ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => setResetConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 rounded-lg text-sm text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <RotateCcw size={14} /> 重置所有配置
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                        <Trash2 size={14} /> 清空所有评估数据
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-red-700">确定要重置所有配置为默认值吗？此操作不可撤销。</p>
                      <div className="flex gap-2">
                        <button onClick={resetConfig} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                          确认重置
                        </button>
                        <button onClick={() => setResetConfirm(false)} className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25">
                  <Server size={36} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">多模态情绪识别系统</h3>
                <p className="text-sm text-slate-500 mt-1">Multimodal Emotion Recognition System</p>
                <span className="mt-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">v2.0.0</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '融合引擎', value: 'Adaptive DQF v2.0', icon: BrainIcon },
                  { label: '支持模态', value: '文本 / 语音 / 人脸 / ECG', icon: ModalityIcon },
                  { label: '前端框架', value: 'React 19 + TypeScript', icon: CodeIcon },
                  { label: '可视化', value: 'Recharts + Tailwind CSS', icon: ChartIcon },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <item.icon size={18} className="text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className="text-sm font-medium text-slate-700">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <InfoRow label="构建日期" value={new Date().toLocaleDateString('zh-CN')} />
                <InfoRow label="后端地址" value="http://localhost:8088" link />
                <InfoRow label="前端端口" value="http://localhost:3000" link />
                <InfoRow label="技术支持" value="查看 GitHub 仓库" link external />
              </div>

              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={15} className="text-blue-500" />
                  <span className="text-sm font-semibold text-slate-700">隐私声明</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  本系统所有情绪分析数据仅存储在本地 SQLite 数据库中。
                  不会将任何个人数据传输至外部服务器。ECG 和语音等生理信号数据经过处理后立即删除原始文件，
                  仅保留提取的特征向量用于统计分析。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ====== Reusable Components ====== */

function SliderSetting({
  label, description, value, min, max, step, unit, onChange,
}: {
  label: string; description: string; value: number;
  min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-mono font-semibold text-blue-600 tabular-nums">
          {value.toFixed(step < 1 ? 2 : 0)}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
      />
      <p className="text-xs text-slate-400">{description}</p>
    </div>
  )
}

function ToggleSetting({
  label, description, checked, onChange,
}: {
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div>
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <button
        role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform translate-x-0.5 mt-0.5 ${
          checked ? 'translate-x-5' : ''
        }`} />
      </button>
    </div>
  )
}

function InfoRow({ label, value, link, external }: { label: string; value: string; link?: boolean; external?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      {link ? (
        <a href="#" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          {value} {external && <ExternalLink size={12} />}
        </a>
      ) : (
        <span className="text-sm text-slate-700 font-medium">{value}</span>
      )}
    </div>
  )
}

/* ====== Icons ====== */
function DownloadIcon(props: any) { /* eslint-disable-next-line react/prop-types */return <Download {...props} /> }
function Download(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function BrainIcon(props: any) { return <Brain {...props} /> }
function Brain(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg> }
function ModalityIcon(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> }
function CodeIcon(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> }
function ChartIcon(props: any) { return <BarChart3 {...props} /> }
function BarChart3(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> }
