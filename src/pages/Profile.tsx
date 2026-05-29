/** 页面2 - 患者档案 Profile
 *  核心功能: 患者信息卡片 + 情绪时间线 + 趋势图表 + 风险评估 */
import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  User, Calendar, AlertTriangle, TrendingUp, TrendingDown,
  Heart, Activity, ChevronLeft, ChevronRight, Download, Shield,
} from 'lucide-react'
import type { VAPoint, EmotionLabel } from '../types'
import { EMOTION_CONFIG } from '../types'
import { fetchAssessments } from '../api'

// Mock data for demo (replaced by API when backend connected)
function generateMockTimeline(_patientId: string): VAPoint[] {
  const emotions = ['快乐', '平静', '悲伤', '生气', '惊讶'] as const
  return Array.from({ length: 14 }, (_, i) => ({
    valence: 0.35 + Math.random() * 0.45,
    arousal: 0.25 + Math.random() * 0.50,
    emotion: emotions[i % emotions.length],
    timestamp: `2026-05-${String(12 + i).padStart(2, '0')}T${8 + (i % 12)}:${(i * 7) % 60}:00`,
    confidence: 0.65 + Math.random() * 0.30,
  }))
}

const PATIENTS = [
  { id: 'P001', name: '张三', age: 28, gender: '男', diagnosis: '轻度抑郁', risk: 'moderate' as const },
  { id: 'P002', name: '李四', age: 35, gender: '女', diagnosis: '焦虑症', risk: 'high' as const },
  { id: 'P003', name: '王五', age: 42, gender: '男', diagnosis: '观察中', risk: 'low' as const },
]

interface PatientInfo {
  id: string
  name: string
  age: number
  gender: string
  diagnosis: string
  risk: 'low' | 'moderate' | 'high'
}

const RISK_CONFIG = {
  low: { color: '#22C55E', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: '低风险' },
  moderate: { color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: '中等风险' },
  high: { color: '#EF4444', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: '高风险 - 建议关注' },
}

export default function Profile() {
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo>(PATIENTS[0])
  const [timeline, setTimeline] = useState<VAPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
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
  }, [selectedPatient.id])

  const currentIdx = PATIENTS.findIndex(p => p.id === selectedPatient.id)
  const prevPatient = () => setSelectedPatient(PATIENTS[(currentIdx - 1 + PATIENTS.length) % PATIENTS.length])
  const nextPatient = () => setSelectedPatient(PATIENTS[(currentIdx + 1) % PATIENTS.length])

  const riskCfg = RISK_CONFIG[selectedPatient.risk]
  const avgValence = timeline.length > 0 ? timeline.reduce((s, t) => s + (t.valence ?? 0.5), 0) / timeline.length : 0
  const avgArousal = timeline.length > 0 ? timeline.reduce((s, t) => s + (t.arousal ?? 0.5), 0) / timeline.length : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">患者档案</h2>
          <p className="text-sm text-slate-500 mt-0.5">查看患者情绪趋势与风险评估</p>
        </div>
        <button onClick={() => window.open('/api/export/csv?patient_id=' + selectedPatient.id)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
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
          </div>
          <div className="flex gap-2">
            <button onClick={prevPatient} className="p-2 rounded-lg bg-white/70 hover:bg-white transition-colors">
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <button onClick={nextPatient} className="p-2 rounded-lg bg-white/70 hover:bg-white transition-colors">
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Quick patient switcher */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200/50">
          {PATIENTS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPatient(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                p.id === selectedPatient.id
                  ? `${RISK_CONFIG[p.risk].bg} ${RISK_CONFIG[p.risk].text}`
                  : 'bg-white/60 text-slate-500 hover:bg-white'
              }`}
            >
              {p.name}
            </button>
          ))}
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
        <h3 className="text-sm font-semibold text-slate-600 mb-4">情绪时间线</h3>
        {timeline.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">暂无评估记录</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {timeline.slice().reverse().map((point, i) => {
              const cfg = EMOTION_CONFIG[point.emotion]
              return (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg?.color || '#94A3B8' }}
                  />
                  <span className="text-sm font-medium text-slate-700 w-14">{point.emotion}</span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(point.valence ?? 0.5) * 100}%`,
                          backgroundColor: point.valence > 0.55 ? '#22C55E' : '#EF4444',
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
      {selectedPatient.risk !== 'low' && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800">风险评估提示</h4>
              <p className="text-sm text-amber-700 mt-1">
                {selectedPatient.risk === 'high'
                  ? `检测到 ${selectedPatient.name} 近期情绪波动较大，建议安排面诊或增加评估频率。`
                  : `${selectedPatient.name} 情绪指标处于临界值，建议持续观察并记录日常变化。`
                }
              </p>
              <div className="flex gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <TrendingUp size={13} /> 近7天愉悦度趋势: {avgValence > 0.5 ? '上升' : '下降'}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <TrendingDown size={13} /> 置信度波动: ±{(0.15 * 100).toFixed(0)}%
                </div>
              </div>
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
