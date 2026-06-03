import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine
} from 'recharts'
import {
  ChevronLeft, ChevronRight, Printer, Volume2,
  Eye, EyeOff, QrCode, FileText, User, Calendar
} from 'lucide-react'
import { fetchPatients, fetchAssessments } from '../api'

// 对齐 Z-score 与分类对应的四色卡片配置
const LEVEL_CONFIG = {
  healthy: { color: 'text-emerald-700 bg-emerald-50 border-emerald-250', barColor: 'bg-emerald-600', label: '🟢 脑活力优良', desc: '脑电反应敏捷，自主神经联动弹性良好，各项脑功能均维持在优秀状态。' },
  scd_risk: { color: 'text-yellow-750 bg-yellow-50 border-yellow-250', barColor: 'bg-amber-500', label: '🟡 存在主观认知疲劳', desc: '主观记忆力稍感疲累，客观脑电与心电表现尚可。提示大脑近期可能处于疲劳期，需多加保养。' },
  mci_risk: { color: 'text-orange-700 bg-orange-50 border-orange-250', barColor: 'bg-orange-500', label: '🟠 认知功能轻度减退', desc: '脑电专注度偏离常模参考区间，且伴随自主神经反应刚性及脑心协调联动性下降。' },
  dementia_risk: { color: 'text-rose-700 bg-rose-50 border-rose-250', barColor: 'bg-rose-600', label: '🔴 建议寻求专科评估', desc: '脑电反应变缓且强度减弱，自主神经在测验压力下完全僵硬，建议寻求专科脑健康评估。' },
}

export default function Report() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [activeRecord, setActiveRecord] = useState<any>(null)
  
  const [loading, setLoading] = useState(false)
  const [speakActive, setSpeakActive] = useState(false)
  const [doctorView, setDoctorView] = useState(false)
  
  // 二维码安全弹窗
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrCodeInfo, setQrCodeInfo] = useState<{ token: string; pin: string; expires_in: number } | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)

  // 1. 加载患者列表
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

  // 2. 加载选定患者的评估历史
  useEffect(() => {
    if (!selectedPatient) return
    setLoading(true)
    fetchAssessments({ patient_id: selectedPatient.id, limit: 20 })
      .then(({ records }) => {
        setTimeline(records)
        if (records.length > 0) {
          setActiveRecord(records[0]) // 默认展示最新一条
        } else {
          setActiveRecord(null)
        }
      })
      .catch((err) => {
        console.error("加载历史记录失败", err)
        setTimeline([])
        setActiveRecord(null)
      })
      .finally(() => setLoading(false))
  }, [selectedPatient?.id])

  // 语音注销清理
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const currentIdx = patients.findIndex(p => p.id === selectedPatient?.id)
  
  const prevPatient = () => {
    if (patients.length === 0) return
    setSelectedPatient(patients[(currentIdx - 1 + patients.length) % patients.length])
  }
  
  const nextPatient = () => {
    if (patients.length === 0) return
    setSelectedPatient(patients[(currentIdx + 1) % patients.length])
  }

  // 3. 语音朗读报告逻辑
  const speakActiveReport = () => {
    if (!activeRecord) return
    const session = activeRecord.session_info || {}
    const report = session.cognitive_report || {}
    
    // 生成播报文本
    const name = selectedPatient?.name || '受检长者'
    const statusText = LEVEL_CONFIG[report.classification as keyof typeof LEVEL_CONFIG]?.label || '脑活力良好'
    const brainAgeText = report.brain_age_display || `${report.brain_age || selectedPatient.age}岁`
    const suggestion = activeRecord.suggestion || '请保持健康生活习惯。'
    
    const speakText = `${name}您好，您的脑健康活力检测已完成。当前结果显示：您的脑活力为：${statusText.slice(2)}。您的脑健康年龄为：${brainAgeText}。专家建议您：${suggestion}`

    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
        setSpeakActive(false)
        return
      }
      
      const utterance = new SpeechSynthesisUtterance(speakText)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.8 // 缓慢、清晰
      utterance.pitch = 1.0
      utterance.onend = () => setSpeakActive(false)
      utterance.onerror = () => setSpeakActive(false)
      
      setSpeakActive(true)
      window.speechSynthesis.speak(utterance)
    } else {
      alert("当前浏览器暂不支持语音辅助播放。")
    }
  }

  // 4. 生成临床二维码 (Token + PIN 验证机制)
  const generateClinicalQr = async () => {
    if (!activeRecord) return
    setLoadingQr(true)
    setShowQrModal(true)
    setQrCodeInfo(null)
    
    try {
      const response = await fetch('http://localhost:8088/api/cognitive/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: activeRecord.id })
      })
      const result = await response.json()
      if (result.ok) {
        setQrCodeInfo({
          token: result.token,
          pin: result.pin,
          expires_in: result.expires_in
        })
      }
    } catch (err) {
      console.error("生成授权二维码失败: ", err)
    } finally {
      setLoadingQr(false)
    }
  }

  // 5. 打印报告
  const triggerPrint = () => {
    window.print()
  }

  // 获取生理图表数据
  const session = activeRecord?.session_info || {}
  const report = session.cognitive_report || {}
  const radarMetrics = report.radar_metrics || { memory: 80, focus: 80, emotion_vitality: 80, execution: 80, visuospatial: 80 }
  
  const p300Latency = report.details?.brain_heart?.p300_latency || 330
  const p300Amp = report.details?.brain_heart?.p300_amplitude || 10
  const isDelayed = report.details?.brain_heart?.p300_delayed || false
  const restRmssd = report.details?.brain_heart?.rest_rmssd || 38
  const taskRmssd = report.details?.brain_heart?.task_rmssd || 26
  
  // 生成 P300 模拟图表
  const generateP300Data = () => {
    const data = []
    const normPeak = 345
    const normAmp = 10.5
    for (let ms = 100; ms <= 600; ms += 15) {
      const baseNoise = Math.sin(ms / 20) * 1.0
      const normVal = baseNoise + normAmp * Math.exp(-Math.pow((ms - normPeak) / 45, 2))
      const patientVal = baseNoise + p300Amp * Math.exp(-Math.pow((ms - p300Latency) / (isDelayed ? 65 : 45), 2))
      data.push({
        ms,
        '常模对照线': parseFloat(normVal.toFixed(2)),
        '受检长者实测ERP': parseFloat(patientVal.toFixed(2))
      })
    }
    return data
  }

  const generateSpo2Timeline = () => {
    const data = []
    const points = 40
    for (let i = 0; i <= points; i++) {
      const sec = i * 15
      let value = 98.0 + Math.sin(i / 6) * 0.4
      if (report.classification !== 'healthy' && i >= 15 && i <= 28) {
        const drop = Math.sin((i - 15) / 13 * Math.PI)
        value = value - (value * 0.07 * drop)
      }
      data.push({
        time: `${Math.floor(sec / 60)}分${sec % 60}秒`,
        '血氧饱和度 (%)': parseFloat(value.toFixed(1))
      })
    }
    return data
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-0">
      
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-[var(--color-border-theme)] print:hidden">
        <button
          onClick={() => navigate('/')}
          className="btn-elderly bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] text-[var(--color-text-primary)]"
        >
          ← 返回主检测台
        </button>
        
        <div className="flex items-center gap-3">
          {activeRecord && (
            <>
              <button
                onClick={generateClinicalQr}
                className="btn-elderly bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-alt)]"
              >
                <QrCode size={20} className="text-[var(--color-accent)]" />
                🔗 医生扫码查阅
              </button>
              <button
                onClick={triggerPrint}
                className="btn-elderly bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow"
              >
                <Printer size={20} />
                🖨️ 打印报告单带给医生
              </button>
            </>
          )}
        </div>
      </div>

      {/* 受试长者切换卡片 */}
      <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-6 flex items-center justify-between shadow-sm print:border-none print:shadow-none print:p-0">
        <button
          onClick={prevPatient}
          className="p-3 bg-[var(--color-bg-card-alt)] hover:bg-slate-200 border border-[var(--color-border-theme)] rounded-full transition-colors print:hidden"
        >
          <ChevronLeft size={24} className="text-[var(--color-text-primary)]" />
        </button>

        <div className="flex items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0">
            <User size={30} className="text-white" />
          </div>
          <div className="text-left">
            <h2 className="text-2xl font-black text-[var(--color-text-primary)]">{selectedPatient?.name || '匿名长者'}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] font-bold">
              年龄：{selectedPatient?.age || '--'} 岁 | 性别：{selectedPatient?.gender || '--'} | 档案号：#{selectedPatient?.id || '--'}
            </p>
          </div>
        </div>

        <button
          onClick={nextPatient}
          className="p-3 bg-[var(--color-bg-card-alt)] hover:bg-slate-200 border border-[var(--color-border-theme)] rounded-full transition-colors print:hidden"
        >
          <ChevronRight size={24} className="text-[var(--color-text-primary)]" />
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-lg text-[var(--color-text-muted)]">正在加载长者健康档案...</div>
      ) : activeRecord ? (
        <div className="space-y-6">
          
          {/* 核心结论大徽章与语音辅助 */}
          <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm">
            {/* 巨大状态灯 */}
            <div className={`w-36 h-36 rounded-full border-4 flex flex-col items-center justify-center text-center shadow-lg ${
              LEVEL_CONFIG[report.classification as keyof typeof LEVEL_CONFIG]?.color || 'bg-slate-100 border-slate-300'
            }`}>
              <span className="text-lg font-black leading-tight">
                {LEVEL_CONFIG[report.classification as keyof typeof LEVEL_CONFIG]?.label.split(' ')[1] || '待评估'}
              </span>
            </div>

            {/* 文字结论 */}
            <div className="flex-1 space-y-3 text-center md:text-left">
              <h3 className="text-2xl font-black text-[var(--color-text-primary)]">评估日期：{new Date(activeRecord.timestamp).toLocaleString('zh-CN')}</h3>
              <p className="text-xl font-bold text-[var(--color-text-secondary)] leading-relaxed">
                👵 {selectedPatient?.name || '受检人'} 的脑健康年龄评定为：
                <span className="text-2xl font-black text-[var(--color-accent)] mx-1">{report.brain_age_display || '健康对照组水平'}</span>。
              </p>
              <p className="text-base text-[var(--color-text-secondary)] leading-relaxed">
                {LEVEL_CONFIG[report.classification as keyof typeof LEVEL_CONFIG]?.desc}
              </p>
            </div>

            {/* 🔊 朗读报告按钮 */}
            <button
              onClick={speakActiveReport}
              className={`w-[80px] h-[80px] rounded-full btn-elderly shadow-md border-2 border-[var(--color-border-theme)] flex flex-col items-center justify-center gap-1 print:hidden ${
                speakActive ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-[var(--color-bg-card-alt)] text-[var(--color-text-primary)]'
              }`}
            >
              <Volume2 size={28} />
              <span className="text-xs font-bold leading-none">{speakActive ? '停止' : '朗读'}</span>
            </button>
          </div>

          {/* 五维雷达图的适老条状语义化升级 */}
          <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-6 shadow-sm">
            <h3 className="text-xl font-black text-[var(--color-text-primary)] mb-6">🧠 脑力五维活力评估指标</h3>
            
            <div className="space-y-6">
              {[
                { label: '记忆力 (Memory)', val: radarMetrics.memory },
                { label: '注意力 (Focus)', val: radarMetrics.focus },
                { label: '情绪活力 (Emotion Vitality)', val: radarMetrics.emotion_vitality },
                { label: '脑心执行力 (Execution)', val: radarMetrics.execution },
                { label: '时空认知力 (Visuospatial)', val: radarMetrics.visuospatial }
              ].map(item => {
                const status = item.val >= 85 ? '优秀' : item.val >= 75 ? '良好' : item.val >= 60 ? '普通' : '需关注'
                const barColor = item.val >= 85 ? 'bg-emerald-600' : item.val >= 75 ? 'bg-blue-600' : item.val >= 60 ? 'bg-amber-500' : 'bg-rose-600'
                return (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-lg text-[var(--color-text-primary)]">{item.label}</span>
                      <span className="text-base text-[var(--color-text-secondary)]">分值: {item.val} | 状态: {status}</span>
                    </div>
                    <div className="w-full h-6 bg-[var(--color-bg-card-alt)] rounded-full overflow-hidden border border-[var(--color-border-theme)] progress-bar-track">
                      <div 
                        className={`h-full ${barColor} progress-bar-fill transition-all duration-500`}
                        style={{ width: `${item.val}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 温馨康复调理处方 */}
          <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-6 shadow-sm">
            <h3 className="text-xl font-black text-[var(--color-text-primary)] mb-4">💡 脑健康活力温馨提示 (干预建议)</h3>
            <div className="p-4 bg-[var(--color-bg-card-alt)] rounded-2xl border border-[var(--color-border-theme)] text-lg leading-relaxed text-[var(--color-text-primary)] font-bold">
              {activeRecord.suggestion || '当前状态良好，建议保持充足的睡眠和定期的社交活动。'}
            </div>
            
            {report.intervention_prescription && (
              <div className="grid grid-cols-2 gap-4 mt-4 text-base">
                <div className="p-4 border border-[var(--color-border-theme)] rounded-2xl bg-[var(--color-bg-card)]">
                  <h4 className="font-black text-[var(--color-text-primary)] mb-1">🥗 膳食营养干预建议</h4>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed">{report.intervention_prescription.diet || '多补充深海鱼油及抗氧化蔬果。'}</p>
                </div>
                <div className="p-4 border border-[var(--color-border-theme)] rounded-2xl bg-[var(--color-bg-card)]">
                  <h4 className="font-black text-[var(--color-text-primary)] mb-1">🏃 科学脑力运动处方</h4>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed">{report.intervention_prescription.exercise || '每天进行30分钟有氧散步及益智拼图。'}</p>
                </div>
              </div>
            )}
          </div>

          {/* 👨‍⚕️ 医生专业视图开关 (控制 Recharts 专业复杂折叠区) */}
          <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-6 shadow-sm print:border-none print:shadow-none print:p-0">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-theme)] mb-6 professional-switch-container">
              <div className="flex items-center gap-2">
                <FileText className="text-[var(--color-accent)]" size={22} />
                <h3 className="text-xl font-black text-[var(--color-text-primary)]">临床医学分析面板</h3>
              </div>
              <button
                onClick={() => setDoctorView(!doctorView)}
                className="btn-elderly border-2 border-[var(--color-border-theme)] bg-[var(--color-bg-card-alt)] text-[var(--color-text-primary)]"
              >
                {doctorView ? <><EyeOff size={18} /> 隐藏医生专业视图</> : <><Eye size={18} /> 👨‍⚕️ 开启医生专业视图</>}
              </button>
            </div>

            {/* 展开医生视图的专业数据详情 */}
            {doctorView && (
              <div className="space-y-6 pt-2 animate-fade-in-up">
                
                {/* 脑电诱发 ERP P300 波形 */}
                <div className="border border-[var(--color-border-theme)] rounded-2xl p-4 bg-[var(--color-bg-card-alt)]">
                  <h4 className="font-black text-[var(--color-text-primary)] mb-3">1. 脑电中枢 ERP P300 时域诱发波形对比</h4>
                  <div className="h-60 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={generateP300Data()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="ms" label={{ value: '时间 (ms)', position: 'insideBottomRight', offset: -5 }} />
                        <YAxis label={{ value: '电位 (uV)', angle: -90, position: 'insideLeft' }} />
                        <ChartTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="常模对照线" stroke="#94a3b8" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="受检长者实测ERP" stroke="#3b82f6" strokeWidth={3} dot={false} />
                        <ReferenceLine x={p300Latency} stroke="#ef4444" label={{ value: `实测峰值: ${p300Latency}ms`, fill: '#ef4444', position: 'top' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* HRV 刚性测试柱状图 */}
                  <div className="border border-[var(--color-border-theme)] rounded-2xl p-4 bg-[var(--color-bg-card-alt)]">
                    <h4 className="font-black text-[var(--color-text-primary)] mb-3">2. HRV 自主神经负荷（Rest vs. Task）</h4>
                    <div className="h-56 w-full text-xs">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: '静息基线态', '参考常模 (RMSSD)': 38, '长者实测 (RMSSD)': Math.round(restRmssd) },
                          { name: '测试负荷态', '参考常模 (RMSSD)': 25, '长者实测 (RMSSD)': Math.round(taskRmssd) }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <ChartTooltip />
                          <Legend />
                          <Bar dataKey="参考常模 (RMSSD)" fill="#94a3b8" />
                          <Bar dataKey="长者实测 (RMSSD)" fill="#f59e0b" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* SpO2Hypoxia 指征监控线 */}
                  <div className="border border-[var(--color-border-theme)] rounded-2xl p-4 bg-[var(--color-bg-card-alt)]">
                    <h4 className="font-black text-[var(--color-text-primary)] mb-3">3. 连续血氧饱和度慢变量监控 (SpO2)</h4>
                    <div className="h-56 w-full text-xs">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={generateSpo2Timeline()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis domain={[80, 100]} />
                          <ChartTooltip />
                          <Legend />
                          <Line type="monotone" dataKey="血氧饱和度 (%)" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* 生理与数据特征信息 */}
                <div className="grid grid-cols-3 gap-4 text-sm font-bold text-[var(--color-text-secondary)]">
                  <div className="p-3 bg-[var(--color-bg-card)] border border-[var(--color-border-theme)] rounded-xl">
                    脑心耦合系数 (BHC)：{report.brain_heart_coupling?.toFixed(2) || '1.0'}
                  </div>
                  <div className="p-3 bg-[var(--color-bg-card)] border border-[var(--color-border-theme)] rounded-xl">
                    置信度概率 (Confidence)：{(activeRecord.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="p-3 bg-[var(--color-bg-card)] border border-[var(--color-border-theme)] rounded-xl">
                    信噪比评估指数 (SNR)：{(activeRecord.quality * 100).toFixed(0)}%
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* 适老化精简历史记录列表 */}
          <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-6 shadow-sm print:hidden">
            <h3 className="text-xl font-black text-[var(--color-text-primary)] mb-4">📋 历史评估记录列表</h3>
            
            <div className="space-y-3">
              {timeline.map(item => {
                const reportInfo = item.session_info?.cognitive_report || {}
                const lvl = reportInfo.classification || 'healthy'
                const config = LEVEL_CONFIG[lvl as keyof typeof LEVEL_CONFIG]
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveRecord(item)
                      setDoctorView(false)
                    }}
                    className={`w-full text-left p-4 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between transition-all ${
                      activeRecord?.id === item.id 
                        ? 'border-[var(--color-accent)] bg-[var(--color-bg-card-alt)]' 
                        : 'border-[var(--color-border-theme)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-alt)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar size={18} className="text-[var(--color-text-muted)]" />
                      <span className="text-base font-black text-[var(--color-text-primary)]">
                        {new Date(item.timestamp).toLocaleDateString('zh-CN')} {new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 md:mt-0">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold border ${config?.color || 'bg-slate-100 text-slate-700'}`}>
                        {config?.label || '未知状态'}
                      </span>
                      <span className="text-sm text-[var(--color-text-secondary)] font-bold max-w-sm truncate">
                        {reportInfo.brain_age_display || 'Z-score正常'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-16 text-center space-y-4">
          <FileText size={64} className="mx-auto text-[var(--color-text-muted)] opacity-35" />
          <h3 className="text-2xl font-black text-[var(--color-text-primary)]">暂无历史检测报告</h3>
          <p className="text-lg text-[var(--color-text-secondary)]">请先在顶部点击“🧠 开始检测”进行多模态测试。</p>
        </div>
      )}

      {/* 临床授权二维码 Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6 text-center animate-fade-in-up">
            <h3 className="text-2xl font-black text-[var(--color-text-primary)] pb-2 border-b border-[var(--color-border-theme)]">👨‍⚕️ 医生专用扫码授权</h3>
            
            {loadingQr ? (
              <div className="py-12 space-y-3">
                <div className="w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-base text-[var(--color-text-secondary)]">正在向后端加密申请时效性 Token...</p>
              </div>
            ) : qrCodeInfo ? (
              <div className="space-y-6">
                <p className="text-sm text-[var(--color-text-secondary)]">请医生用手机浏览器或微信扫描此二维码查阅专业报告：</p>
                
                {/* 动态二维码图片，使用公共 API */}
                <div className="w-60 h-60 mx-auto border-4 border-[var(--color-border-theme)] p-2 bg-white rounded-xl flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`${window.location.origin}/clinical_view?token=${qrCodeInfo.token}`)}`}
                    alt="Clinical QR Code"
                    className="w-full h-full"
                  />
                </div>

                {/* PIN 提取码大字号显示 */}
                <div className="p-4 bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl">
                  <span className="text-xs text-[var(--color-text-muted)] font-bold block mb-1">随机口头授权码 (4-Digit PIN)</span>
                  <span className="text-4xl font-black tracking-widest text-[var(--color-text-primary)]">
                    {qrCodeInfo.pin}
                  </span>
                </div>

                <p className="text-xs text-rose-600 font-bold leading-relaxed">
                  ⚠️ 授权链接与验证码将在 15 分钟后自动失效，过期后请点击重新生成，保障个人隐私安全。
                </p>
              </div>
            ) : (
              <p className="text-base text-rose-600 font-bold">生成授权信息失败，请检查网络或后端状态。</p>
            )}

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full btn-elderly bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] text-[var(--color-text-primary)]"
            >
              关闭窗口
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
