import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Save, Database, HardDrive,
  Info, Sliders, Bell,
  AlertTriangle, CheckCircle2, Shield, Brain
} from 'lucide-react'
import { useImmersiveMode } from '../App'

interface SystemConfig {
  conflict_threshold: number
  uncertainty_low_threshold: number
  uncertainty_medium_threshold: number
  single_modality_penalty: number
  adaptive_weight_exponent: number
  language: 'zh' | 'en'
  auto_refresh_interval: number
  show_confidence_bars: boolean
  show_va_space_grid: boolean
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
  const navigate = useNavigate()
  const { theme, setTheme, fontScale, setFontScale } = useImmersiveMode()
  
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
    setTimeout(() => setSaved(false), 2000)
  }

  const resetConfig = () => {
    setConfig(DEFAULT_CONFIG)
    localStorage.removeItem('emotion-fusion-config')
    setTheme('warm')
    setFontScale(1.0)
    setResetConfirm(false)
  }

  const tabs: { id: TabId; icon: any; label: string }[] = [
    { id: 'fusion', icon: Sliders, label: '融合参数' },
    { id: 'display', icon: Bell, label: '显示与通知' },
    { id: 'data', icon: Database, label: '数据管理' },
    { id: 'about', icon: Info, label: '关于系统' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      
      {/* 头部大字号面包屑/返回按钮 */}
      <div className="flex items-center gap-4 print:hidden">
        <button
          onClick={() => navigate('/')}
          className="btn-elderly bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] text-[var(--color-text-primary)]"
        >
          ← 返回主检测台
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[var(--color-border-theme)] pb-4">
        <div>
          <h2 className="text-3xl font-black text-[var(--color-text-primary)]">系统设置与偏好</h2>
          <p className="text-base text-[var(--color-text-secondary)] font-bold mt-1">配置脑认知评估引擎的各项运行参数与显示习惯</p>
        </div>
        <div className="flex gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-base font-bold border border-emerald-200">
              <CheckCircle2 size={18} /> 已保存配置
            </span>
          )}
          <button
            onClick={saveConfig}
            className="btn-elderly bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow"
          >
            <Save size={18} /> 保存当前配置
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-stretch">
        {/* 左侧大尺寸 Tab 侧边栏 */}
        <nav className="w-56 shrink-0 space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-lg font-black text-left border-2 transition-all ${
                activeTab === tab.id
                  ? 'bg-[var(--color-bg-card-alt)] text-[var(--color-accent)] border-[var(--color-border-theme)] shadow-inner'
                  : 'text-[var(--color-text-secondary)] border-transparent hover:bg-[var(--color-bg-card-alt)]'
              }`}
            >
              <tab.icon size={20} /> {tab.label}
            </button>
          ))}
        </nav>

        {/* 右侧主设置面板 */}
        <div className="flex-grow bg-[var(--color-bg-card)] rounded-3xl border-2 border-[var(--color-border-theme)] p-8 shadow-sm min-h-[500px]">
          
          {/* 1. 融合算法参数面板 */}
          {activeTab === 'fusion' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">多模态融合模型调优</h3>
                <p className="text-base text-[var(--color-text-secondary)]">调整多模态认知状态引擎在融合生理参数时的核心决策阈值</p>
              </div>

              <SliderSetting
                label="冲突检测警戒阈值"
                description="不同模态生理特征偏离系数超过此值时标记为模态间冲突（通常推荐 0.45）"
                value={config.conflict_threshold}
                min={0.2} max={0.7} step={0.05}
                onChange={v => update('conflict_threshold', v)}
              />

              <SliderSetting
                label="低置信度不确定上限"
                description="生理特征不确定性指数低于此值时判定为低不确定度状态"
                value={config.uncertainty_low_threshold}
                min={0.1} max={0.35} step={0.02}
                onChange={v => update('uncertainty_low_threshold', v)}
              />

              <SliderSetting
                label="高置信度不确定界限"
                description="不确定性指标超过此值时激活高警惕判定，进入模态缺失ProLF补偿"
                value={config.uncertainty_medium_threshold}
                min={0.25} max={0.6} step={0.03}
                onChange={v => update('uncertainty_medium_threshold', v)}
              />

              <SliderSetting
                label="单模态缺失惩罚系数"
                description="测试中仅单个模态指标可用时，对最终融合可信度施加的惩罚比率"
                value={config.single_modality_penalty}
                min={0.2} max={0.8} step={0.05}
                onChange={v => update('single_modality_penalty', v)}
              />

              <div className="pt-4 border-t border-[var(--color-border-theme)]">
                <div className="flex items-start gap-2.5 p-4 bg-amber-50 rounded-2xl text-amber-800 text-sm font-bold border border-amber-200">
                  <AlertTriangle size={20} className="shrink-0 text-amber-600" />
                  修改融合参数可能影响筛查评测报告的敏感度和准确度。请在医护专业人员指导下进行修改。
                </div>
              </div>
            </div>
          )}

          {/* 2. 适老化显示与通知面板 */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">无障碍显示与系统通知</h3>
                <p className="text-base text-[var(--color-text-secondary)]">针对高龄老年人进行视觉与听觉辅助体验设置</p>
              </div>

              {/* 界面高对比度主题预设（代替无级滑块） */}
              <div className="space-y-3">
                <label className="text-lg font-black text-[var(--color-text-primary)] block">无障碍高对比度主题</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'warm', title: '① 默认护眼', desc: '米黄背景 + 藏青文字', style: 'bg-[#F5EFE4] text-[#1A2332] border-[#D5CAB5]' },
                    { id: 'high-contrast', title: '② 强对比度', desc: '纯白背景 + 纯黑文字', style: 'bg-white text-black border-black' },
                    { id: 'low-vision', title: '③ 视弱模式', desc: '纯黑背景 + 亮黄文字', style: 'bg-black text-[#FFFF00] border-[#FFFF00]' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id as any)}
                      className={`p-4 border-2 rounded-2xl text-left transition-all ${t.style} ${
                        theme === t.id ? 'ring-4 ring-blue-500 scale-[1.02] shadow-md' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="font-black text-lg">{t.title}</div>
                      <div className="text-xs mt-1 font-bold">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 适老字号缩放比例 (限幅在 1.0 到 1.5) */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-baseline">
                  <label className="text-lg font-black text-[var(--color-text-primary)]">大字号调节比例</label>
                  <span className="text-lg font-black text-[var(--color-accent)]">{fontScale.toFixed(2)}x 倍字号</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.5"
                  step="0.05"
                  value={fontScale}
                  onChange={e => setFontScale(parseFloat(e.target.value))}
                  className="w-full h-3 bg-[var(--color-bg-card-alt)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] font-bold">字号限幅在 1.0x 到 1.5x 之间，以保证界面在超大字号下不发生重叠和换行崩溃。</p>
              </div>

              <div className="pt-4 border-t border-[var(--color-border-theme)] space-y-4">
                <h4 className="text-lg font-black text-[var(--color-text-primary)]">系统提醒与辅助警报</h4>
                
                <ToggleSetting
                  label="启用系统异常气泡提醒"
                  description="在检测到严重冲突或极端疲劳指征时在侧边弹出紧急红灯气泡"
                  checked={config.enable_alerts}
                  onChange={v => update('enable_alerts', v)}
                />
                
                <ToggleSetting
                  label="低氧及Hypoxia指征警告"
                  description="在长者连续血氧低于 93% 时自动播放低氧长鸣音"
                  checked={config.alert_uncertainty_high}
                  onChange={v => update('alert_uncertainty_high', v)}
                />
              </div>
            </div>
          )}

          {/* 3. 数据管理面板 */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-[var(--color-text-primary)] mb-1">数据库与信息安全</h3>
                <p className="text-base text-[var(--color-text-secondary)]">对脱敏加密存储的本地 SQLite 数据库进行管理</p>
              </div>

              {/* 存储状态 */}
              <div className="p-5 bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-lg font-black text-[var(--color-text-primary)]">
                  <HardDrive size={20} className="text-[var(--color-text-secondary)]" /> 数据库本地指标
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-[var(--color-bg-card)] rounded-xl p-3 border border-[var(--color-border-theme)]">
                    <p className="text-xs text-[var(--color-text-muted)] font-bold">记录数</p>
                    <p className="text-xl font-black text-[var(--color-text-primary)] mt-1">42 条</p>
                  </div>
                  <div className="bg-[var(--color-bg-card)] rounded-xl p-3 border border-[var(--color-border-theme)]">
                    <p className="text-xs text-[var(--color-text-muted)] font-bold">已用存储</p>
                    <p className="text-xl font-black text-[var(--color-text-primary)] mt-1">128 KB</p>
                  </div>
                  <div className="bg-[var(--color-bg-card)] rounded-xl p-3 border border-[var(--color-border-theme)]">
                    <p className="text-xs text-[var(--color-text-muted)] font-bold">对称密钥</p>
                    <p className="text-xl font-black text-emerald-600 mt-1">已激活</p>
                  </div>
                </div>
              </div>

              {/* 数据导出 */}
              <div className="space-y-3">
                <h4 className="text-lg font-black text-[var(--color-text-primary)]">导出历史数据表</h4>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => window.open('http://localhost:8088/api/export/csv', '_blank')}
                    className="btn-elderly bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-alt)]">
                    导出 CSV 文件
                  </button>
                  <button onClick={() => window.open('http://localhost:8088/api/export/json', '_blank')}
                    className="btn-elderly bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-alt)]">
                    导出 JSON 备份
                  </button>
                </div>
              </div>

              {/* 危险区 */}
              <div className="pt-4 border-t border-[var(--color-border-theme)]">
                <div className="p-5 border-2 border-red-500/30 bg-red-50/50 rounded-2xl space-y-4">
                  <h4 className="text-lg font-black text-red-700 flex items-center gap-2">
                    <AlertTriangle size={20} /> 系统数据重置危险区
                  </h4>
                  {!resetConfirm ? (
                    <button
                      onClick={() => setResetConfirm(true)}
                      className="btn-elderly bg-red-100 hover:bg-red-200 text-red-700 border border-red-300"
                    >
                      重置所有配置为默认
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-base text-red-700 font-bold">确定要重置所有系统设置吗？这还会恢复默认护眼暖色主题和1.0x字号。</p>
                      <div className="flex gap-3">
                        <button onClick={resetConfig} className="btn-elderly bg-red-600 hover:bg-red-700 text-white">
                          确认重置
                        </button>
                        <button onClick={() => setResetConfirm(false)} className="btn-elderly bg-[var(--color-bg-card)] border border-[var(--color-border-theme)] text-[var(--color-text-primary)]">
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. 关于系统面板 */}
          {activeTab === 'about' && (
            <div className="space-y-6 text-center md:text-left">
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-24 h-24 rounded-3xl bg-[var(--color-accent)] flex items-center justify-center mb-4 shadow">
                  <Brain size={44} className="text-white" />
                </div>
                <h3 className="text-2xl font-black text-[var(--color-text-primary)]">脑心行为联合认知筛查系统</h3>
                <p className="text-base text-[var(--color-text-secondary)] mt-1">适老化无障碍健康管理版</p>
                <span className="mt-3 px-4 py-1.5 bg-[var(--color-bg-card-alt)] text-[var(--color-accent)] border border-[var(--color-border-theme)] rounded-full text-sm font-bold">v3.2.0</span>
              </div>

              <div className="p-5 border-2 border-[var(--color-border-theme)] rounded-2xl bg-[var(--color-bg-card-alt)]">
                <div className="flex items-center gap-2 mb-2 font-black text-[var(--color-text-primary)]">
                  <Shield size={18} className="text-[var(--color-accent)]" />
                  临床数据隐私声明
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed font-bold">
                  为了最大化保障受试长者的隐私，本系统已在后台激活 AES-256 列级加解密层。
                  受检人姓名、干预处方建议等所有敏感健康信息 (PHI) 在本地 SQLite 数据库中均已加密存储。
                  生成的医生扫码二维码采用 15 分钟失效的访问 Token + PIN 提取授权机制，链接过期或验证码错误将完全无法访问，保障医患数据闭环。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ====== Helper Components ====== */

function SliderSetting({
  label, description, value, min, max, step, onChange,
}: {
  label: string; description: string; value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-lg font-black text-[var(--color-text-primary)]">{label}</label>
        <span className="text-lg font-black text-[var(--color-accent)]">
          {value.toFixed(step < 1 ? 2 : 0)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-3 bg-[var(--color-bg-card-alt)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
      />
      <p className="text-xs text-[var(--color-text-muted)] font-bold">{description}</p>
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
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--color-border-theme)] pb-3">
      <div>
        <label className="text-lg font-black text-[var(--color-text-primary)]">{label}</label>
        <p className="text-xs text-[var(--color-text-muted)] font-bold mt-1">{description}</p>
      </div>
      <button
        role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-8 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors outline-none cursor-pointer ${
          checked ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
        }`}
      >
        <span className={`inline-block h-7 w-7 rounded-full bg-white shadow transform transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`} />
      </button>
    </div>
  )
}
