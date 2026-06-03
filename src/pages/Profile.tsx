/** 页面2 - 受检长者档案 Profile
 *  核心功能: 受检长者信息卡片 + 情绪时间线 + 趋势图表 + 风险评估 */
import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  User, Calendar, AlertTriangle,
  Heart, Activity, ChevronLeft, ChevronRight, Download, Shield,
} from 'lucide-react'
import type { VAPoint, EmotionLabel } from '../types'
import { EMOTION_CONFIG } from '../types'
import { fetchAssessments, fetchPatients } from '../api'

function generateMockTimeline(patientId: string): VAPoint[] {
  const isScd = patientId === 'P002'
  const isMci = patientId === 'P003'
  const isDementia = patientId === 'P004'
  
  return Array.from({ length: 8 }, (_, i) => {
    let risk = 0.12 + Math.random() * 0.1
    if (isScd) risk = 0.28 + Math.random() * 0.12
    if (isMci) risk = 0.48 + Math.random() * 0.15
    if (isDementia) risk = 0.78 + Math.random() * 0.12
    
    const classification = risk < 0.25 ? 'healthy' : risk < 0.45 ? 'scd_risk' : risk < 0.75 ? 'mci_risk' : 'dementia_risk'
    
    return {
      valence: parseFloat((0.5 - risk * 0.3).toFixed(2)),
      arousal: parseFloat((0.5 + risk * 0.3).toFixed(2)),
      emotion: `Cognitive: ${classification}` as any,
      timestamp: `2026-05-${String(12 + i * 2).padStart(2, '0')}T10:30:00`,
      confidence: 0.85 + Math.random() * 0.10,
    }
  })
}

const RISK_CONFIG = {
  low: { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', label: '脑活力优良' },
  scd: { color: '#eab308', bg: 'bg-yellow-50', text: 'text-yellow-750', border: 'border-yellow-100', label: '主观认知疲劳' },
  moderate: { color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', label: '认知功能轻度减退' },
  high: { color: '#f43f5e', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', label: '建议寻求专科评估' },
}

export default function Profile() {
  const [patients, setPatients] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [timeline, setTimeline] = useState<VAPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await fetchPatients()
        setPatients(data)
        if (data.length > 0) {
          setSelectedPatient(data[0])
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadPatients()
  }, [])

  useEffect(() => {
    if (!selectedPatient) return
    setLoading(true)
    // Try real API first, fall back to mock
    fetchAssessments({ patient_id: selectedPatient.id, limit: 30 })
      .then(({ records }) => {
        if (records.length > 0) {
          setTimeline(records.map(r => ({
            valence: r.valence,
            arousal: r.arousal,
            emotion: r.final_emotion as EmotionLabel,
            timestamp: r.timestamp,
            confidence: r.confidence,
          })))
        } else {
          setTimeline(generateMockTimeline(selectedPatient.id))
        }
      })
      .catch(() => setTimeline(generateMockTimeline(selectedPatient.id)))
      .finally(() => setLoading(false))
  }, [selectedPatient?.id])

  const currentIdx = patients.findIndex(p => p.id === selectedPatient?.id)
  const prevPatient = () => {
    if (patients.length === 0) return
    setSelectedPatient(patients[(currentIdx - 1 + patients.length) % patients.length])
  }
  const nextPatient = () => {
    if (patients.length === 0) return
    setSelectedPatient(patients[(currentIdx + 1) % patients.length])
  }

  // Parse risk
  const patientRisk = selectedPatient?.mock_type === 'dementia' ? 'high' : selectedPatient?.mock_type === 'mci' ? 'moderate' : selectedPatient?.mock_type === 'scd' ? 'scd' : 'low'
  const riskCfg = RISK_CONFIG[patientRisk as keyof typeof RISK_CONFIG]
  const avgValence = timeline.length > 0 ? timeline.reduce((s, t) => s + (t.valence ?? 0.5), 0) / timeline.length : 0
  const avgArousal = timeline.length > 0 ? timeline.reduce((s, t) => s + (t.arousal ?? 0.5), 0) / timeline.length : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">受检长者档案</h2>
          <p className="text-sm text-slate-500 mt-0.5">查看受检长者脑健康趋势与活力评估</p>
        </div>
        <button onClick={() => selectedPatient && window.open('/api/export/csv?patient_id=' + selectedPatient.id)}
          disabled={!selectedPatient}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
          <Download size={15} /> 导出报告
        </button>
      </div>

      {/* Patient Card + Navigation */}
      <div className={`${riskCfg.bg} border ${riskCfg.border} rounded-2xl p-6`}>
        <div className="flex items-start justify-between">
          <div className="flex gap-5">
            <div className={`w-16 h-16 rounded-2xl ${riskCfg.bg.replace('50','100')} flex items-center justify-center`}>
              <User size={28} className={riskCfg.text} />
            </div>
            {selectedPatient ? (
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800">{selectedPatient.name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${riskCfg.bg} ${riskCfg.text}`}>
                    <Shield size={11} /> {riskCfg.label}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  ID: {selectedPatient.id} | {selectedPatient.gender} | {selectedPatient.age}岁 | {selectedPatient.diagnosis}
                </p>
                <div className="flex items-center gap-4 pt-1">
                  <StatBadge icon={Heart} label="平均愉悦度" value={`${(avgValence * 100).toFixed(0)}%`} />
                  <StatBadge icon={Activity} label="平均唤醒度" value={`${(avgArousal * 100).toFixed(0)}%`} />
                  <StatBadge icon={Calendar} label="评估次数" value={`${timeline.length}`} />
                </div>
              </div>
            ) : (
              <div className="space-y-1 py-4 text-slate-400 text-sm italic">
                暂未选择或录入受试长者，请在工作台页面录入测试人。
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={prevPatient} disabled={patients.length === 0} className="p-2 rounded-lg bg-white/70 hover:bg-white transition-colors disabled:opacity-50">
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <button onClick={nextPatient} disabled={patients.length === 0} className="p-2 rounded-lg bg-white/70 hover:bg-white transition-colors disabled:opacity-50">
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Quick patient switcher */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200/50">
          {patients.map(p => {
            const pRisk = p.mock_type === 'dementia' ? 'high' : p.mock_type === 'mci' ? 'moderate' : p.mock_type === 'scd' ? 'scd' : 'low'
            const cfg = RISK_CONFIG[pRisk as keyof typeof RISK_CONFIG]
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedPatient && p.id === selectedPatient.id
                    ? `${cfg.bg} ${cfg.text}`
                    : 'bg-white/60 text-slate-500 hover:bg-white'
                }`}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-5">
        {/* Valence-Arousal Trend Line Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">VA 情绪趋势</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400">加载中...</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timestamp" tickFormatter={(t: string) => t.slice(5, 10)} tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  formatter={(value) => [Number(value).toFixed(2), value === 'valence' ? '愉悦度' : '唤醒度']}
                  labelFormatter={(label) => String(label)}
                />
                <Line type="monotone" dataKey="valence" name="valence" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="arousal" name="arousal" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Emotion Distribution Area */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">情绪分布</h3>
          {timeline.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400">暂无数据</div>
          ) : (() => {
            const dist: Record<string, number> = {}
            timeline.forEach(t => { dist[t.emotion] = (dist[t.emotion] || 0) + 1 })
            const chartData = Object.entries(dist).map(([emotion, count]) => ({
              emotion,
              count,
              color: EMOTION_CONFIG[emotion as EmotionLabel]?.color || '#94A3B8',
            }))
            return (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                  <YAxis type="category" dataKey="emotion" tick={{ fontSize: 12 }} width={60} stroke="#94A3B8" />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          })()}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">认知筛查历史时间线</h3>
        {timeline.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">暂无评估记录</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {timeline.slice().reverse().map((point, i) => {
              let labelText = point.emotion
              let color = '#94A3B8'
              
              if (point.emotion.startsWith('Cognitive:')) {
                const sub = point.emotion.replace('Cognitive: ', '')
                if (sub === 'healthy') {
                  labelText = '脑活力优良' as any
                  color = '#10b981'
                } else if (sub === 'scd_risk') {
                  labelText = '存在主观认知疲劳' as any
                  color = '#eab308'
                } else if (sub === 'mci_risk') {
                  labelText = '认知功能轻度减退' as any
                  color = '#f97316'
                } else {
                  labelText = '建议寻求专科评估' as any
                  color = '#f43f5e'
                }
              } else {
                const cfg = EMOTION_CONFIG[point.emotion]
                color = cfg?.color || '#94A3B8'
              }

              return (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium text-slate-700 w-24">{labelText}</span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(point.valence ?? 0.5) * 100}%`,
                          backgroundColor: point.valence > 0.45 ? '#22C55E' : '#EF4444',
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-10">
                      {point.valence !== null && point.valence !== undefined ? `V:${point.valence.toFixed(2)}` : 'V:-'}
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(point.arousal ?? 0.5) * 100}%`,
                          backgroundColor: '#8B5CF6',
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-10">
                      {point.arousal !== null && point.arousal !== undefined ? `A:${point.arousal.toFixed(2)}` : 'A:-'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 w-32 text-right shrink-0">
                    {new Date(point.timestamp).toLocaleString('zh-CN')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Risk Assessment Panel */}
      {selectedPatient && patientRisk !== 'low' && (
        <div className={`border rounded-xl p-5 ${patientRisk === 'high' ? 'border-rose-200 bg-rose-50' : patientRisk === 'scd' ? 'border-yellow-200 bg-yellow-50' : 'border-orange-200 bg-orange-50'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className={`${patientRisk === 'high' ? 'text-rose-600' : patientRisk === 'scd' ? 'text-yellow-750' : 'text-orange-600'} shrink-0 mt-0.5`} />
            <div>
              <h4 className={`font-semibold ${patientRisk === 'high' ? 'text-rose-800' : patientRisk === 'scd' ? 'text-yellow-750' : 'text-orange-800'}`}>脑健康活力温馨提示</h4>
              <p className={`text-sm mt-1 ${patientRisk === 'high' ? 'text-rose-700' : patientRisk === 'scd' ? 'text-yellow-700' : 'text-orange-700'}`}>
                {patientRisk === 'high'
                  ? `检测提示 ${selectedPatient.name} 脑电反应速率与心率变异弹性下降，建议寻求专科脑健康评估，并开启精细化的日常脑活力管理。`
                  : patientRisk === 'scd'
                  ? `检测提示 ${selectedPatient.name} 存在轻微的主观认知疲劳，建议合理休息，补充脑健康膳食，避免连续高强度用脑。`
                  : `检测提示 ${selectedPatient.name} 存在轻度认知减退倾向，建议开启社区非药物干预（如双重任务认知训练与膳食调理），并定期复测脑健康。`
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StatBadge({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Icon size={14} />
      <span className="text-slate-500">{label}:</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  )
}
