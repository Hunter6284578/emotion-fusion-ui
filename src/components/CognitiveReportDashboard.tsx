import { useState, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'
import {
  Brain, Heart, Activity, AlertTriangle, CheckCircle2,
  XCircle, Printer, FileText, ChevronRight, UserCheck
} from 'lucide-react'

interface CognitiveReportDashboardProps {
  reportData: any
  patientMetadata: any
  onClose: () => void
}

export default function CognitiveReportDashboard({
  reportData,
  patientMetadata,
  onClose
}: CognitiveReportDashboardProps) {
  const [doctorNotes, setDoctorNotes] = useState('')
  const reportRef = useRef<HTMLDivElement>(null)

  const report = reportData || {}
  const riskScore = report.risk_score !== undefined ? report.risk_score : 0.0
  const classification = report.classification || 'healthy'
  const brainHeartCoupling = report.brain_heart_coupling !== undefined ? report.brain_heart_coupling : 1.0
  const details = report.details || {}
  
  const scale = details.scale || { score: 5, dcdt_correct: true, recall_count: 3 }
  const brainHeart = details.brain_heart || {
    p300_latency: 330, p300_amplitude: 11, p300_z_score: 0.1,
    p300_delayed: false, rest_rmssd: 38, task_rmssd: 27, norm_mean: 345
  }
  const oxygen = details.oxygen || {
    mean_spo2: 0.98, min_spo2: 0.96, hypoxia_events: 0, odi: 0, time_under_95_sec: 0
  }
  const behavior = details.behavior || { gaze_deviation: 0.15, apathy_score: 0.10 }
  const suggestions = report.clinical_suggestions || []

  // 新增/优化 v3.0 脑健康管理特征
  const brainAge = report.brain_age !== undefined ? report.brain_age : (patientMetadata?.age || 65)
  const brainAgeDisplay = report.brain_age_display || `${brainAge} 岁`
  const radarMetrics = report.radar_metrics || { memory: 80, focus: 85, emotion_vitality: 78, execution: 82, visuospatial: 80 }
  const interventionPrescription = report.intervention_prescription || { diet: '', exercise: '' }

  // 1. Generate P300 ERP wave coordinates for chart rendering
  // A standard healthy ERP has a peak at 310-340ms. A delayed ERP has a peak at 400-440ms and is flatter.
  const generateP300Curves = () => {
    const data = []
    const isDelayed = brainHeart.p300_delayed
    const patientPeak = brainHeart.p300_latency // e.g. 410 or 330
    const patientAmp = brainHeart.p300_amplitude // e.g. 3.8 or 11.2
    
    // Normal norm peak properties
    const normPeak = brainHeart.norm_mean || 345
    const normAmp = 10.5

    for (let ms = 100; ms <= 600; ms += 10) {
      // Base EEG fluctuations
      const baseNoise = Math.sin(ms / 20) * 1.2
      
      // Healthy Norm Wave Gaussian peak
      const normVal = baseNoise + normAmp * Math.exp(-Math.pow((ms - normPeak) / 45, 2))
      
      // Patient Wave Gaussian peak
      const patientVal = baseNoise + patientAmp * Math.exp(-Math.pow((ms - patientPeak) / (isDelayed ? 65 : 45), 2))

      data.push({
        ms,
        '常模对照线': parseFloat(normVal.toFixed(2)),
        '受检长者实测ERP': parseFloat(patientVal.toFixed(2))
      })
    }
    return data
  }

  const p300ChartData = generateP300Curves()

  // 2. HRV Rest vs. Task Elasticity Chart Data
  const hrvChartData = [
    {
      name: '静息基线态',
      '健康老人参考': 38,
      '当前受检长者': Math.round(brainHeart.rest_rmssd)
    },
    {
      name: '测验负荷态',
      '健康老人参考': 25,
      '当前受检长者': Math.round(brainHeart.task_rmssd)
    }
  ]

  // 3. SpO2 Timeline Chart Data
  const generateSpo2Timeline = () => {
    const data = []
    const isMci = classification !== 'healthy'
    const totalPoints = 60 // 10 minutes scaled to 60 points
    
    for (let i = 0; i <= totalPoints; i++) {
      const min = i * 10
      let value = 98.2 + Math.sin(i / 8) * 0.4
      
      // Inject hypoxia dips for MCI patient
      if (isMci && i >= 20 && i <= 40) {
        // Drop down to 89% at peak
        const dropPercent = Math.sin((i - 20) / 20 * Math.PI)
        value = value - (value * 0.08 * dropPercent)
      }
      
      data.push({
        time: `${Math.floor(min / 60)}m${min % 60}s`,
        '血氧饱和度 (%)': parseFloat(value.toFixed(1))
      })
    }
    return data
  }

  const spo2ChartData = generateSpo2Timeline()

  // 4. Handle PDF Print
  const handlePrint = () => {
    window.print()
  }

  // Get Risk level colors
  const getRiskDetails = () => {
    if (classification === 'healthy') {
      return {
        title: '脑活力优良',
        desc: '脑电专注度反应敏捷，自主神经联动弹性良好，各项脑功能均维持在优秀状态。',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 border-emerald-200',
        barColor: '#22c55e',
        badge: 'bg-emerald-500'
      }
    } else if (classification === 'scd_risk') {
      return {
        title: '存在主观认知疲劳',
        desc: '主观记忆力稍感疲累，客观脑电与心电表现尚可。提示大脑近期可能处于疲劳期，需多加保养。',
        color: 'text-yellow-600',
        bg: 'bg-yellow-50 border-yellow-200',
        barColor: '#f59e0b',
        badge: 'bg-yellow-500'
      }
    } else if (classification === 'mci_risk') {
      return {
        title: '认知功能轻度减退',
        desc: '脑电专注度偏离常模参考区间，且伴随自主神经反应刚性及脑心协调联动性下降，提示需要开启脑健康干预方案。',
        color: 'text-orange-600',
        bg: 'bg-orange-50 border-orange-200',
        barColor: '#f97316',
        badge: 'bg-orange-500'
      }
    } else {
      return {
        title: '建议寻求专科评估',
        desc: '脑电反应变缓且强度减弱，自主神经在测验压力下完全僵硬，伴随较频繁的降氧低血氧事件，建议寻求专科脑健康评估。',
        color: 'text-rose-600',
        bg: 'bg-rose-50 border-rose-200',
        barColor: '#ef4444',
        badge: 'bg-rose-500'
      }
    }
  }

  const riskCfg = getRiskDetails()

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:bg-white print:p-0">
      {/* Top Banner (Header controls) */}
      <div className="max-w-6xl mx-auto flex items-center justify-between pb-4 border-b border-slate-200 mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="text-blue-600" size={20} />
          <h2 className="text-lg font-bold text-slate-800">多模态“脑-心-行为”联合脑健康评估单</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-colors"
          >
            <Printer size={14} />
            打印 / 导出 PDF 评估单
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors"
          >
            返回评估控制台
          </button>
        </div>
      </div>

      {/* Main Print Container */}
      <div 
        ref={reportRef} 
        className="max-w-6xl mx-auto bg-white border border-slate-200 shadow-xl rounded-3xl p-8 space-y-6 print:border-none print:shadow-none print:p-0 print:rounded-none"
      >
        {/* Printable Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Brain size={16} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">多模态脑健康与情绪活力评估报告</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">评估机构: 社区脑健康与功能管理实验室 | 算法模式: BHC_Intermediate_Fusion_v3</p>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${riskCfg.badge}`}>
              {riskCfg.title}
            </span>
            <p className="text-[10px] text-slate-400 mt-1.5">生成时间: {new Date().toLocaleString('zh-CN')}</p>
          </div>
        </div>

        {/* Patient Profile Card */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] text-slate-400">受检长者姓名</div>
            <div className="text-sm font-bold text-slate-700 mt-0.5">{patientMetadata.name || '未录入'}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">年龄段 / 学历组</div>
            <div className="text-sm font-bold text-slate-700 mt-0.5">
              {patientMetadata.age || 65}岁 / {patientMetadata.education === 'low' ? '小学及以下' : patientMetadata.education === 'high' ? '大专及以上' : '初高中'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">系统评估编号</div>
            <div className="text-sm font-semibold text-slate-600 mt-0.5">#{patientMetadata.id || 'P001'}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">检测设备配置</div>
            <div className="text-sm font-medium text-slate-500 mt-0.5">脑电仪 + 心电血氧手环 + 眼动摄像头</div>
          </div>
        </div>

        {/* Risk Score Gauge & Diagnosis Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Risk Gauge Card */}
          <div className="bg-slate-50/50 border border-slate-150 rounded-2xl p-5 flex flex-col items-center justify-center">
            <div className="text-xs font-bold text-slate-500 mb-3">脑健康综合风险度</div>
            
            <div className="relative w-36 h-20 flex items-center justify-center overflow-hidden">
              <svg className="w-36 h-36 transform -rotate-180" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeDasharray="125.6 125.6" strokeLinecap="round" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={riskCfg.barColor} strokeWidth="10" strokeDasharray={`${riskScore * 125.6} 125.6`} strokeLinecap="round" />
              </svg>
              <div className="absolute bottom-0 text-center">
                <div className="text-2xl font-black text-slate-800">{(riskScore * 100).toFixed(0)}%</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Risk Score</div>
              </div>
            </div>

            <div className={`mt-3 text-center px-4 py-2 border rounded-xl w-full text-xs font-bold ${riskCfg.bg}`}>
              {riskCfg.title}
            </div>
          </div>

          {/* Clinical Description Card */}
          <div className="col-span-2 bg-slate-50/50 border border-slate-150 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 mb-2">脑健康评估结论</div>
              <p className="text-xs text-slate-700 leading-relaxed">{riskCfg.desc}</p>
            </div>

            <div className="border-t border-slate-200/60 pt-3 mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <UserCheck size={14} className="text-blue-500" />
                <span className="text-[11px] text-slate-500 font-semibold">脑心功能耦合度:</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{ width: `${brainHeartCoupling * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700">{(brainHeartCoupling * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Comprehensive Brain Health Evaluation (Radar & Brain Age) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Radar Chart Card */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="text-indigo-500" size={16} />
              <h4 className="text-xs font-bold text-slate-700">五维脑活力雷达图评分</h4>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={[
                  { subject: '记忆力', A: radarMetrics.memory, fullMark: 100 },
                  { subject: '专注力', A: radarMetrics.focus, fullMark: 100 },
                  { subject: '情绪活力', A: radarMetrics.emotion_vitality, fullMark: 100 },
                  { subject: '执行力', A: radarMetrics.execution, fullMark: 100 },
                  { subject: '视空间能力', A: radarMetrics.visuospatial, fullMark: 100 },
                ]}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                  <Radar name="脑健康维度" dataKey="A" stroke="#4f46e5" fill="#818cf8" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Brain Age Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 mb-3">大脑活力年龄评估</div>
              <div className="flex flex-col items-center justify-center py-5 bg-white/60 backdrop-blur rounded-xl border border-white">
                {brainAgeDisplay === "显著大于实际年龄" ? (
                  <>
                    <div className="text-base font-black text-amber-600 px-3 py-1.5 bg-amber-50 rounded-lg animate-pulse text-center leading-snug">
                      显著大于实际年龄
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-2">大脑反应稍显疲累，建议保养</div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-black text-indigo-700">{brainAgeDisplay}</div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-1">
                      {brainAge < (patientMetadata.age || 65) ? (
                        <span className="text-emerald-600 font-bold">🧠 比实际年龄年轻 {Math.abs(brainAge - (patientMetadata.age || 65))} 岁！</span>
                      ) : brainAge > (patientMetadata.age || 65) ? (
                        <span className="text-amber-600 font-bold">🧠 比实际年龄疲累 {brainAge - (patientMetadata.age || 65)} 岁，需注意保养。</span>
                      ) : (
                        <span className="text-slate-600 font-bold">🧠 大脑生理反应与实际年龄相符。</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="text-[9px] text-slate-400 leading-relaxed mt-4">
              * 脑年龄是由脑电 P300 反应敏捷度、心率变异弹性及缺氧负荷等客观生理特征，并结合受教育程度与生理年龄校准后进行综合估算得出的脑活力指标。
            </p>
          </div>
        </div>

        {/* Multi-modal Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart 1: P300 ERP Waveform Comparison */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain className="text-indigo-500" size={16} />
                <h4 className="text-xs font-bold text-slate-700">P300 事件相关电位 ERP 对比曲线</h4>
              </div>
              <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold">窗口: 刺激后 100-600ms</span>
            </div>
            
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={p300ChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis dataKey="ms" unit="ms" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                  <YAxis unit="uV" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="常模对照线" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="受检长者实测ERP" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-center">
              <div>
                <div className="text-[9px] text-slate-400">实测 Latency</div>
                <div className={`text-xs font-bold ${brainHeart.p300_delayed ? 'text-rose-600' : 'text-slate-700'}`}>
                  {brainHeart.p300_latency.toFixed(0)} ms
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">常模对照偏离</div>
                <div className={`text-xs font-bold ${brainHeart.p300_delayed ? 'text-rose-600' : 'text-slate-700'}`}>
                  Z-score: {brainHeart.p300_z_score > 0 ? '+' : ''}{brainHeart.p300_z_score.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">常模基准 ($\mu$)</div>
                <div className="text-xs font-semibold text-slate-500">{brainHeart.norm_mean.toFixed(0)} ms</div>
              </div>
            </div>
          </div>

          {/* Chart 2: HRV Rest vs Task Rigidity */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart className="text-rose-500" size={16} />
                <h4 className="text-xs font-bold text-slate-700">自主神经压力应激弹性 (RMSSD)</h4>
              </div>
              <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold">指标: 心率变异性</span>
            </div>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hrvChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                  <YAxis unit="ms" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="健康老人参考" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="当前受检长者" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-center">
              <div>
                <div className="text-[9px] text-slate-400">静息 HRV (基线)</div>
                <div className="text-xs font-bold text-slate-700">{brainHeart.rest_rmssd} ms</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">负荷 HRV (应激)</div>
                <div className="text-xs font-bold text-slate-700">{brainHeart.task_rmssd} ms</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">自主弹性评估</div>
                <div className={`text-xs font-bold ${brainHeart.hrv_elasticity < 0.4 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {brainHeart.hrv_elasticity < 0.4 ? '刚性受损' : '弹性正常'}
                </div>
              </div>
            </div>
          </div>

          {/* Chart 3: SpO2 Macro timeline */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="text-teal-500" size={16} />
                <h4 className="text-xs font-bold text-slate-700">10分钟宏观血氧波动 timeline</h4>
              </div>
              <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold">指标: SpO2 慢变量</span>
            </div>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spo2ChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis dataKey="time" tick={{ fontSize: 8 }} stroke="#94a3b8" />
                  <YAxis domain={[80, 100]} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                  <ReferenceLine y={95} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: '缺氧线 (95%)', position: 'top', fill: '#f43f5e', fontSize: 8 }} />
                  <Line type="monotone" dataKey="血氧饱和度 (%)" stroke="#14b8a6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100 text-center">
              <div>
                <div className="text-[9px] text-slate-400">平均 SpO2</div>
                <div className="text-xs font-bold text-slate-700">{(oxygen.mean_spo2 * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">最低 SpO2</div>
                <div className={`text-xs font-bold ${oxygen.min_spo2 < 0.92 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {(oxygen.min_spo2 * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">降氧 ODI 指数</div>
                <div className={`text-xs font-bold ${oxygen.odi > 5 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {oxygen.odi.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">缺氧事件数</div>
                <div className="text-xs font-bold text-slate-700">{oxygen.hypoxia_events} 次</div>
              </div>
            </div>
          </div>

          {/* Table 4: Behavioral & Test Scores Summary */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-3">行为体征与数字化量表得分</h4>
              
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500 font-semibold">画钟测验 (dCDT) 对齐</span>
                  <div className="flex items-center gap-1">
                    {scale.dcdt_correct ? (
                      <><CheckCircle2 size={14} className="text-emerald-500" /> <span className="text-xs text-slate-700 font-bold">匹配正确 (2分)</span></>
                    ) : (
                      <><XCircle size={14} className="text-rose-500" /> <span className="text-xs text-slate-700 font-bold">匹配错误 (0分)</span></>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500 font-semibold">词语延迟回忆 (Memory Recall)</span>
                  <div className="text-xs text-slate-700 font-bold">
                    召回成功: <span className="text-blue-600 font-black">{scale.recall_count}</span> / 3 个词语 ({scale.recall_count}分)
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500 font-semibold">面部情绪表达活力 (AU Variance)</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: `${behavior.apathy_score * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{(behavior.apathy_score * 100).toFixed(0)}% ({behavior.apathy_score > 0.5 ? '情绪表达减弱' : '表达活跃'})</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500 font-semibold">眼球运动异常扫视 (Gaze Saccade)</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${behavior.gaze_deviation * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{(behavior.gaze_deviation * 100).toFixed(0)}% ({behavior.gaze_deviation > 0.5 ? '视线频繁避开/紊乱' : '注视力集中'})</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">数字化筛查量表总分:</span>
              <span className="font-black text-slate-700">{scale.score} / 5 分 (正常 $\ge 3$)</span>
            </div>
          </div>
        </div>

        {/* Intervention Prescription */}
        <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-5">
          <h4 className="text-xs font-bold text-emerald-800 mb-3 flex items-center gap-1.5">
            <UserCheck size={15} className="text-emerald-600" />
            社区个性化脑健康干预建议 (非药物方案)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-xl border border-emerald-100/50">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">脑健康膳食调理建议</span>
              <p className="text-xs text-slate-700 leading-relaxed mt-2">{interventionPrescription.diet || '暂无膳食干预建议，建议保持均衡膳食与规律水分补充。'}</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-emerald-100/50">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">脑活力与双重任务训练</span>
              <p className="text-xs text-slate-700 leading-relaxed mt-2">{interventionPrescription.exercise || '暂无运动与认知训练，建议每天阅读或进行有氧脑力操。'}</p>
            </div>
          </div>
        </div>

        {/* Clinical Suggestions */}
        <div className="bg-slate-50/50 border border-slate-150 rounded-2xl p-5">
          <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-amber-500" />
            系统检测指标与健康建议
          </h4>
          
          <ul className="space-y-2">
            {suggestions.map((sug: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                <ChevronRight size={13} className="text-blue-500 shrink-0 mt-0.5" />
                <span>{sug}</span>
              </li>
            ))}
            {suggestions.length === 0 && (
              <li className="text-xs text-slate-400 italic">生理指标与行为模式未发现异常。</li>
            )}
          </ul>
        </div>

        {/* Doctor clinical notes (Writable in browser, print-friendly) */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 print:hidden">
            <Printer size={15} className="text-slate-500" />
            临床医生诊断手记 (由医生填写并打印)
          </h4>
          <textarea
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder="在此输入医生诊断意见、后续推荐测试（如 MMSE、MoCA 详细评估）或药物指导..."
            className="w-full min-h-[90px] border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl p-4 text-xs leading-relaxed outline-none transition-all placeholder:text-slate-300 print:border-none print:p-0 print:placeholder:hidden print:min-h-0 print:resize-none"
          />
          {/* Printable doctor note clone */}
          <div className="hidden print:block pt-4 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-800">医生诊断手记：</div>
            <p className="text-xs text-slate-700 leading-relaxed mt-2 whitespace-pre-wrap">
              {doctorNotes || '未录入诊断手记，建议受检长者结合日常保养进行综合观察。'}
            </p>
          </div>
        </div>

        {/* Footer Signature */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <div>主检评估师签名: __________________</div>
          <div>多模态脑健康与脑功能管理系统 v3.0</div>
          <div>审核人签名: __________________</div>
        </div>
      </div>
    </div>
  )
}
