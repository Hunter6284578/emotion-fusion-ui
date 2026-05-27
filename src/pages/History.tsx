/** 页面3 - 历史记录中心
 *  核心功能: 记录列表 + 多维筛选 + 统计面板 + 批量操作 */
import { useState, useEffect, useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  Search, Filter, Trash2, Download, Eye, RefreshCw,
  ChevronDown, FileText, Calendar, Users, BarChart3,
  AlertCircle, CheckSquare, Square,
} from 'lucide-react'
import type { AssessmentRecord, EmotionLabel, StatisticsData } from '../types'
import { EMOTION_CONFIG } from '../types'
import { fetchAssessments, fetchStatistics, exportCSV, exportJSON } from '../api'

// Mock data generator
function generateMockRecords(n = 30): AssessmentRecord[] {
  const emotions: EmotionLabel[] = ['快乐', '平静', '悲伤', '生气', '害怕', '惊讶']
  const patients = ['P001', 'P002', 'P003', 'P004']
  const names: Record<string, string> = { P001: '张三', P002: '李四', P003: '王五', P004: '赵六' }
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    timestamp: `2026-05-${String(Math.max(1, 26 - Math.floor(i / 3))).padStart(2, '0')}T${8 + (i % 12)}:${(i * 17) % 60}:00`,
    patient_id: patients[i % patients.length],
    patient_name: names[patients[i % patients.length]],
    text_result: i % 3 === 0 ? '今天心情不错' : null,
    speech_result: i % 3 === 1 ? '语音正常' : null,
    face_result: i % 3 === 2 ? '表情自然' : null,
    ecg_result: null,
    final_emotion: emotions[i % emotions.length],
    valence: 0.2 + Math.random() * 0.65,
    arousal: 0.2 + Math.random() * 0.6,
    confidence: 0.6 + Math.random() * 0.35,
    quality: 0.5 + Math.random() * 0.45,
    modality_count: 1 + (i % 4),
    fusion_mode: ['adaptive', 'weighted', 'single'][i % 3],
    uncertainty_level: ['low', 'medium', 'high'][i % 3],
    suggestion: '建议保持当前状态',
    warnings: '',
  }))
}

export default function History() {
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [, setStats] = useState<StatisticsData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEmotion, setFilterEmotion] = useState<string>('all')
  const [filterPatient, setFilterPatient] = useState<string>('all')
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchAssessments().then(d => d.records),
      fetchStatistics().catch(() => null),
    ])
      .then(([data, statsData]) => {
        if (data.length > 0) setRecords(data)
        else setRecords(generateMockRecords(40))
        if (statsData) setStats(statsData)
      })
      .catch(() => setRecords(generateMockRecords(40)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let result = [...records]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        r.patient_name.toLowerCase().includes(q) ||
        r.patient_id.toLowerCase().includes(q) ||
        r.final_emotion.includes(q)
      )
    }
    if (filterEmotion !== 'all') result = result.filter(r => r.final_emotion === filterEmotion)
    if (filterPatient !== 'all') result = result.filter(r => r.patient_id === filterPatient)
    if (filterDateStart) result = result.filter(r => r.timestamp >= filterDateStart)
    if (filterDateEnd) result = result.filter(r => r.timestamp <= filterDateEnd + 'T23:59:59')
    return result
  }, [records, searchQuery, filterEmotion, filterPatient, filterDateStart, filterDateEnd])

  const uniquePatients = useMemo(() => {
    const map = new Map<string, string>()
    records.forEach(r => map.set(r.patient_id, r.patient_name))
    return [...map.entries()]
  }, [records])

  const emotionDist = useMemo(() => {
    const dist: Record<string, number> = {}
    filtered.forEach(r => { dist[r.final_emotion] = (dist[r.final_emotion] || 0) + 1 })
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        color: EMOTION_CONFIG[name as EmotionLabel]?.color || '#94A3B8',
      }))
  }, [filtered])

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)))
    }
  }

  const handleExport = (format: 'csv' | 'json') => {
    format === 'csv' ? exportCSV() : exportJSON()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">历史记录中心</h2>
          <p className="text-sm text-slate-500 mt-0.5">共 {filtered.length} 条评估记录</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <RefreshCw size={14} /> 刷新
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={FileText} label="总记录数" value={filtered.length} color="blue" />
        <StatCard icon={Users} label="患者数" value={uniquePatients.length} color="violet" />
        <StatCard icon={Calendar} label="今日评估" value={filtered.filter(r => r.timestamp.startsWith('2026-05-26')).length} color="emerald" />
        <StatCard icon={AlertCircle} label="高不确定性" value={filtered.filter(r => r.uncertainty_level === 'high').length} color="red" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Record List (spans 2 cols) */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索患者姓名 / ID / 情绪..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={14} /> 筛选 <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-lg">
              <select value={filterEmotion} onChange={e => setFilterEmotion(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="all">全部情绪</option>
                {Object.keys(EMOTION_CONFIG).slice(0, 7).map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <select value={filterPatient} onChange={e => setFilterPatient(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="all">全部患者</option>
                {uniquePatients.map(([id, name]) => (
                  <option key={id} value={id}>{name} ({id})</option>
                ))}
              </select>
              <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="起始日期" />
              <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="结束日期" />
              {(filterEmotion !== 'all' || filterPatient !== 'all' || filterDateStart || filterDateEnd) && (
                <button onClick={() => { setFilterEmotion('all'); setFilterPatient('all'); setFilterDateStart(''); setFilterDateEnd('') }}
                  className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                  清除筛选
                </button>
              )}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="py-16 text-center text-slate-400">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <p>没有匹配的记录</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[420px] rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr>
                    <th className="p-3 text-left w-10">
                      <button onClick={toggleAll}>
                        {selectedIds.size === filtered.length ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-400" />}
                      </button>
                    </th>
                    <th className="p-3 text-left font-medium text-slate-600">时间</th>
                    <th className="p-3 text-left font-medium text-slate-600">患者</th>
                    <th className="p-3 text-left font-medium text-slate-600">情绪</th>
                    <th className="p-3 text-left font-medium text-slate-600">VA</th>
                    <th className="p-3 text-left font-medium text-slate-600">置信度</th>
                    <th className="p-3 text-left font-medium text-slate-600">模态</th>
                    <th className="p-3 text-left font-medium text-slate-600">不确定度</th>
                    <th className="p-3 text-right font-medium text-slate-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <button onClick={() => toggleSelect(record.id)}>
                          {selectedIds.has(record.id) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-300" />}
                        </button>
                      </td>
                      <td className="p-3 text-slate-500 whitespace-nowrap">
                        {new Date(record.timestamp).toLocaleString('zh-CN')}
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-slate-700">{record.patient_name}</span>
                        <span className="text-xs text-slate-400 ml-1">({record.patient_id})</span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${EMOTION_CONFIG[record.final_emotion]?.color || '#94A3B8'}15`,
                            color: EMOTION_CONFIG[record.final_emotion]?.color || '#64748B',
                          }}>
                          <span className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: EMOTION_CONFIG[record.final_emotion]?.color }} />
                          {record.final_emotion}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-xs">V{record.valence.toFixed(2)}</span>
                        <span className="text-slate-300"> / </span>
                        <span className="font-mono text-xs">A{record.arousal.toFixed(2)}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${record.confidence * 100}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{(record.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-500 text-xs">{record.modality_count}模态</td>
                      <td className="p-3">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          record.uncertainty_level === 'low' ? 'bg-emerald-50 text-emerald-700' :
                          record.uncertainty_level === 'medium' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {record.uncertainty_level}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Batch Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-700 font-medium">已选 {selectedIds.size} 项</span>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => handleExport('csv')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-600 hover:bg-blue-50">
                  <Download size={12} /> 导出选中(CSV)
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs text-red-600 hover:bg-red-50">
                  <Trash2 size={12} /> 批量删除
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-blue-500 underline">取消选择</button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Panel */}
        <div className="space-y-5">
          {/* Emotion Distribution Pie */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">情绪分布</h3>
            {emotionDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={emotionDist} cx="50%" cy="50%" innerRadius={45} outerRadius={80}
                    dataKey="value" paddingAngle={2}>
                    {emotionDist.map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">暂无数据</div>
            )}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {emotionDist.slice(0, 5).map(e => (
                <div key={e.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                  <span className="text-slate-500">{e.name}</span>
                  <span className="font-medium text-slate-700">{e.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Uncertainty Bar Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">不确定性分布</h3>
            {(() => {
              const ucDist = { low: 0, medium: 0, high: 0 }
              filtered.forEach(r => { ucDist[r.uncertainty_level as keyof typeof ucDist]++ })
              const data = Object.entries(ucDist).map(([k, v]) => ({
                name: k === 'low' ? '低' : k === 'medium' ? '中' : '高',
                value: v,
                color: k === 'low' ? '#22C55E' : k === 'medium' ? '#F59E0B' : '#EF4444',
              }))
              return (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {data.map((entry, i) => (
                        <Cell key={i} fill={entry.color} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            })()}
          </div>

          {/* Quick Summary */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-blue-400" />
              <h3 className="text-sm font-semibold">统计摘要</h3>
            </div>
            <div className="space-y-2.5">
              {[
                { label: '平均置信度', value: filtered.length > 0 ? (filtered.reduce((s, r) => s + r.confidence, 0) / filtered.length * 100).toFixed(1) + '%' : '-' },
                { label: '平均质量分', value: filtered.length > 0 ? (filtered.reduce((s, r) => s + r.quality, 0) / filtered.length * 100).toFixed(1) + '%' : '-' },
                { label: '高不确定性占比', value: filtered.length > 0 ? (filtered.filter(r => r.uncertainty_level === 'high').length / filtered.length * 100).toFixed(1) + '%' : '-' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="font-mono font-medium text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    violet: 'from-violet-500 to-violet-600',
    emerald: 'from-emerald-500 to-emerald-600',
    red: 'from-red-500 to-red-600',
  }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center shrink-0`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
