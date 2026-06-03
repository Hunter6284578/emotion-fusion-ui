import { useState, useEffect, useRef } from 'react'
import {
  Stethoscope, User, Play, Square, Brain, Heart, Activity,
  ChevronRight, Volume2, Award, CheckCircle, AlertTriangle
} from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocketBus'
import { fetchPatients, addPatient } from '../api'
import { useImmersiveMode } from '../App'

// dCDT 数字化画钟测验选项
const CLOCK_OPTIONS = [
  { id: 'A', label: '表盘 A', hourAngle: 335, minuteAngle: 60, isCorrect: true }, // 11:10
  { id: 'B', label: '表盘 B', hourAngle: 300, minuteAngle: 330, isCorrect: false }, // 10:55
  { id: 'C', label: '表盘 C', hourAngle: 0, minuteAngle: 60, isCorrect: false }, // 12:10
  { id: 'D', label: '表盘 D', hourAngle: 335, minuteAngle: 300, isCorrect: false }  // 11:50
]

// ====== 防误触长按安全退出按钮 ======
function SafeExitButton({ onExit }: { onExit: () => void }) {
  const [progress, setProgress] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const timerRef = useRef<any>(null)
  const intervalRef = useRef<any>(null)

  const startPress = () => {
    setProgress(0)
    const startTime = Date.now()
    
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const p = Math.min(100, (elapsed / 2000) * 100)
      setProgress(p)
    }, 30)

    timerRef.current = setTimeout(() => {
      clearInterval(intervalRef.current)
      setProgress(100)
      setShowConfirm(true) // 长按满2秒触发二次确认
    }, 2000)
  }

  const endPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setProgress(0)
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          className="relative btn-elderly bg-rose-100 hover:bg-rose-200 text-rose-700 min-w-[200px] h-[52px] select-none active:scale-95 overflow-hidden transition-all shadow-sm"
        >
          {/* 进度背景条 */}
          <div 
            className="absolute left-0 top-0 bottom-0 bg-rose-300/40 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
          <span className="z-10 flex items-center gap-2">
            <Square size={16} fill="currentColor" />
            {progress > 0 ? `按住 ${Math.ceil((100 - progress) / 50 * 10) / 10}s` : '长按 2s 退出检测'}
          </span>
        </button>
      </div>

      {/* 二次确认对话框 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6 text-center animate-fade-in-up">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={32} className="text-amber-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-[var(--color-text-primary)]">确定要中断检测吗？</h3>
              <p className="text-lg text-[var(--color-text-secondary)]">
                检测正在进行中，现在退出将不会保存当前测试结果。
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowConfirm(false)
                  endPress()
                }}
                className="flex-grow btn-elderly bg-[var(--color-bg-card-alt)] text-[var(--color-text-primary)] border-[var(--color-border-theme)]"
              >
                继续检测
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  onExit()
                }}
                className="flex-grow btn-elderly bg-rose-600 hover:bg-rose-700 text-white"
              >
                确定退出
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function Dashboard() {
  const { setImmersiveMode } = useImmersiveMode()
  const [patients, setPatients] = useState<any[]>([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [newAge, setNewAge] = useState(65)
  const [newGender, setNewGender] = useState('女')
  const [newEducation, setNewEducation] = useState('medium')
  const [newMockType, setNewMockType] = useState('healthy')
  const [addingError, setAddingError] = useState('')
  
  const [sopStep, setSopStep] = useState<0 | 1 | 2 | 3>(0) // 0: Select, 1: Rest, 2: Stim, 3: Active
  const [timer, setTimer] = useState(0)
  
  const [activeSubStep, setActiveSubStep] = useState<1 | 2 | 3>(1) // 1: word show, 2: dcdt, 3: recall
  const [selectedClock, setSelectedClock] = useState<string | null>(null)
  const [recallWords, setRecallWords] = useState<string[]>([])
  const [isRecordingRecall, setIsRecordingRecall] = useState(false)
  
  const [spo2History, setSpo2History] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState('')

  // WebSocket 实时数据流
  const { connect, disconnect, connectionState, sendJSON } = useWebSocket()
  const [liveMetrics, setLiveMetrics] = useState<any>({
    eeg_load: 0.15,
    hrv_rmssd: 38.0,
    spo2: 0.98,
    gaze_score: 0.12,
    au_variance: 0.18
  })

  // 监听测试状态并激活沉浸模式
  useEffect(() => {
    if (sopStep > 0) {
      setImmersiveMode(true)
    } else {
      setImmersiveMode(false)
    }
    return () => setImmersiveMode(false)
  }, [sopStep, setImmersiveMode])

  const loadPatientsList = async () => {
    setLoadingPatients(true)
    try {
      const data = await fetchPatients()
      setPatients(data)
      if (data.length > 0) {
        setSelectedPatient(data[0])
      } else {
        setSelectedPatient(null)
      }
    } catch (err) {
      console.error('Failed to load patients:', err)
    } finally {
      setLoadingPatients(false)
    }
  }

  useEffect(() => {
    loadPatientsList()
  }, [])

  useEffect(() => {
    if (showAddModal && !newId) {
      setNewId('P' + Math.floor(100 + Math.random() * 900) + String(Date.now()).slice(-3))
    }
  }, [showAddModal])

  const handleAddPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingError('')
    if (!newId.trim() || !newName.trim() || !newAge) {
      setAddingError('请填入完整的受试者个人信息')
      return
    }
    
    let diagnosis = '脑活力状态优良，建议保持健康作息'
    if (newMockType === 'scd') diagnosis = '存在主观认知疲劳，建议加强规律休息'
    if (newMockType === 'mci') diagnosis = '认知功能轻度减退，建议开启脑力与膳食调理'
    if (newMockType === 'dementia') diagnosis = '建议寻求专科评估，进行深入脑健康观察'

    try {
      const res = await addPatient({
        id: newId.trim(),
        name: newName.trim(),
        age: Number(newAge),
        gender: newGender,
        education: newEducation,
        diagnosis,
        mock_type: newMockType
      })
      if (res.ok) {
        setShowAddModal(false)
        setNewId('')
        setNewName('')
        setNewAge(65)
        await loadPatientsList()
      }
    } catch (err: any) {
      setAddingError(err.message || '添加失败')
    }
  }

  // 计时器逻辑 (阶段 1 和 阶段 2)
  useEffect(() => {
    if (sopStep !== 1 && sopStep !== 2) return
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          if (sopStep === 1) {
            setSopStep(2)
            setTimer(30) // 阶段二怀旧视频
          } else if (sopStep === 2) {
            setSopStep(3)
            setActiveSubStep(1)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [sopStep])

  // WebSocket 模拟串流
  useEffect(() => {
    if (connectionState !== 'connected' || sopStep === 0) return

    const interval = setInterval(() => {
      const ts = Date.now()
      const mockType = selectedPatient?.mock_type || 'healthy'
      
      let eegLoad = 0.25 + Math.random() * 0.1
      let rmssd = 35.0 + Math.random() * 3
      let spo2 = 0.982 + Math.random() * 0.003
      let gaze = 0.12 + Math.random() * 0.05
      let auVar = 0.15 + Math.random() * 0.04

      if (sopStep === 1) {
        if (mockType === 'dementia') {
          eegLoad = 0.45; rmssd = 23.0; spo2 = 0.958
        } else if (mockType === 'mci') {
          eegLoad = 0.35; rmssd = 29.0; spo2 = 0.972
        }
      } else if (sopStep === 2) {
        if (mockType === 'dementia') {
          eegLoad = 0.48; rmssd = 22.0; spo2 = 0.951; auVar = 0.03; gaze = 0.58
        } else if (mockType === 'mci') {
          eegLoad = 0.38; rmssd = 28.0; spo2 = 0.965; auVar = 0.08; gaze = 0.32
        }
      } else if (sopStep === 3) {
        if (mockType === 'dementia') {
          eegLoad = 0.78; rmssd = 22.2; spo2 = 0.931; gaze = 0.68; auVar = 0.04
        } else if (mockType === 'mci') {
          eegLoad = 0.65; rmssd = 28.2; spo2 = 0.952; gaze = 0.45; auVar = 0.09
        } else {
          eegLoad = 0.45; rmssd = 25.5; spo2 = 0.981; gaze = 0.15
        }
      }

      setSpo2History(prev => {
        const next = [...prev, spo2]
        return next.slice(-600)
      })

      sendJSON({
        type: 'eeg',
        client_timestamp: ts,
        data: Array.from({ length: 8 }, () => Array.from({ length: 250 }, () => (Math.random() - 0.5) * 50)),
        channels: ["FP1", "FP2", "F3", "F4", "T7", "T8", "Pz", "O1"],
        impedance: [12.2, 11.5, 13.0, 10.8, 14.2, 12.0, 9.8, 11.0]
      })

      sendJSON({
        type: 'ecg',
        client_timestamp: ts,
        features: { RMSSD: rmssd, SDNN: rmssd * 1.15, LFHF: sopStep === 3 ? 2.3 : 1.3, hr_mean: sopStep === 3 ? 78.0 : 70.0 },
        spo2: spo2
      })

      setLiveMetrics({
        eeg_load: eegLoad,
        hrv_rmssd: rmssd,
        spo2: spo2,
        gaze_score: gaze,
        au_variance: auVar
      })
    }, 1500)

    return () => clearInterval(interval)
  }, [connectionState, sopStep, selectedPatient, sendJSON])

  const startSopScreening = () => {
    if (!selectedPatient) return
    connect()
    setSpo2History([])
    setSelectedClock(null)
    setRecallWords([])
    setSopStep(1)
    setTimer(20) // 静息态采集

    setTimeout(() => {
      sendJSON({
        type: 'client_metadata',
        metadata: {
          age: selectedPatient?.age || 65,
          education: selectedPatient?.education || 'medium',
          name: selectedPatient?.name || 'Anonymous',
          id: selectedPatient?.id || 'P001',
          baseline_hrv: { RMSSD: selectedPatient?.mock_type === 'healthy' ? 38.0 : 25.0 }
        }
      })
      sendJSON({ type: 'sop_state', phase: 1 })
    }, 500)
  }

  const changeSopPhase = (phase: number) => {
    sendJSON({ type: 'sop_state', phase: phase })
  }

  const handleScaleSubmit = async () => {
    const isClockCorrect = CLOCK_OPTIONS.find(c => c.id === selectedClock)?.isCorrect || false
    const countRecall = recallWords.length

    sendJSON({
      type: 'scale_performance',
      performance: { dcdt_correct: isClockCorrect, delayed_recall_count: countRecall }
    })

    setIsSubmitting(true)
    try {
      const mockType = selectedPatient?.mock_type || 'healthy'
      const payload = {
        patient_metadata: {
          id: selectedPatient?.id || 'P001',
          name: selectedPatient?.name || 'Anonymous',
          age: selectedPatient?.age || 65,
          education: selectedPatient?.education || 'medium'
        },
        eeg_data: Array.from({ length: 8 }, () => Array.from({ length: 2500 }, () => (Math.random() - 0.5) * 30)),
        eeg_channels: ["FP1", "FP2", "F3", "F4", "T7", "T8", "Pz", "O1"],
        ecg_data_task: {
          RMSSD: mockType === 'healthy' ? 26.0 : mockType === 'mci' ? 28.0 : 22.0,
          SDNN: mockType === 'healthy' ? 32.0 : mockType === 'mci' ? 29.0 : 24.0,
          LFHF: mockType === 'healthy' ? 2.1 : mockType === 'mci' ? 2.4 : 2.6,
          hr_mean: mockType === 'healthy' ? 76.0 : 78.0
        },
        ecg_data_rest: {
          RMSSD: mockType === 'healthy' ? 38.0 : mockType === 'mci' ? 34.0 : 25.0,
          SDNN: mockType === 'healthy' ? 45.0 : mockType === 'mci' ? 40.0 : 28.0,
          LFHF: 1.3,
          hr_mean: 70.0
        },
        spo2_data: spo2History.length > 0 ? spo2History : Array.from({ length: 120 }, () => 0.98),
        gaze_score: mockType === 'healthy' ? 0.15 : mockType === 'mci' ? 0.45 : 0.68,
        face_au_variance: mockType === 'healthy' ? 0.18 : mockType === 'mci' ? 0.08 : 0.03,
        scale_performance: { dcdt_correct: isClockCorrect, delayed_recall_count: countRecall },
        doctor_notes: ''
      }

      const response = await fetch('http://localhost:8088/api/cognitive/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const result = await response.json()
      
      if (result.ok) {
        setSubmitSuccessMsg('诊断报告生成成功！请点击顶部“我的报告”查看。')
        setSopStep(0)
        disconnect()
      }
    } catch (err) {
      console.error('Failed to compile report: ', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleRecallWord = (word: string) => {
    setRecallWords(prev =>
      prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word]
    )
  }

  const renderCSSClock = (hourAngle: number, minAngle: number) => {
    return (
      <div className="relative w-24 h-24 rounded-full border-4 border-slate-700 bg-white flex items-center justify-center shadow-inner">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-800 z-10" />
        <div 
          className="absolute w-1 h-8 bg-slate-800 origin-bottom rounded" 
          style={{ transform: `rotate(${hourAngle}deg)`, top: '20px', transformOrigin: '50% 100%' }}
        />
        <div 
          className="absolute w-0.5 h-10 bg-slate-500 origin-bottom rounded" 
          style={{ transform: `rotate(${minAngle}deg)`, top: '10px', transformOrigin: '50% 100%' }}
        />
        <span className="absolute top-1 text-[10px] font-bold text-slate-400">12</span>
        <span className="absolute right-1.5 text-[10px] font-bold text-slate-400">3</span>
        <span className="absolute bottom-1 text-[10px] font-bold text-slate-400">6</span>
        <span className="absolute left-1.5 text-[10px] font-bold text-slate-400">9</span>
      </div>
    )
  }

  const stopSession = () => {
    disconnect()
    setSopStep(0)
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-bg-primary)]">
      {/* 沉浸式测试顶栏 (大标题，在沉浸模式下只显示受检者信息，隐藏全部导航) */}
      {sopStep > 0 && (
        <header className="px-6 py-4 flex items-center justify-between border-b-2 border-[var(--color-border-theme)] bg-[var(--color-bg-card)] print:hidden">
          <div className="flex items-center gap-3">
            <Stethoscope size={24} className="text-[var(--color-accent)] animate-pulse" />
            <h2 className="text-xl font-black text-[var(--color-text-primary)]">脑认知与活力检测进行中</h2>
          </div>
          {selectedPatient && (
            <div className="px-4 py-1.5 bg-[var(--color-bg-card-alt)] border border-[var(--color-border-theme)] rounded-xl text-lg font-bold text-[var(--color-text-primary)]">
              当前受试长者：{selectedPatient.name} ({selectedPatient.age}岁)
            </div>
          )}
        </header>
      )}

      {/* 主工作区 */}
      <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
        <div className="grid grid-cols-12 gap-6 items-stretch">
          
          {/* 左侧测试主体区 */}
          <div className="col-span-8 bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-6 flex flex-col justify-between min-h-[480px]">
            
            {/* 准备阶段 0 */}
            {sopStep === 0 && (
              <div className="flex-grow flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <h3 className="text-2xl font-black text-[var(--color-text-primary)]">1. 选择或录入受试长者</h3>
                  {submitSuccessMsg && (
                    <div className="p-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-lg font-bold rounded-2xl animate-fade-in-up">
                      {submitSuccessMsg}
                    </div>
                  )}
                  {loadingPatients ? (
                    <div className="py-10 text-center text-lg text-[var(--color-text-muted)]">正在加载长者列表...</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {patients.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient(p)
                            setSubmitSuccessMsg('')
                          }}
                          className={`text-left p-5 rounded-2xl border-2 transition-all ${
                            selectedPatient && selectedPatient.id === p.id 
                              ? 'border-[var(--color-accent)] bg-[var(--color-bg-card-alt)] shadow' 
                              : 'border-[var(--color-border-theme)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-alt)]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              selectedPatient && selectedPatient.id === p.id ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-card-alt)] text-[var(--color-text-secondary)]'
                            }`}>
                              <User size={24} />
                            </div>
                            <div>
                              <div className="text-lg font-black text-[var(--color-text-primary)]">{p.name}</div>
                              <div className="text-xs text-[var(--color-text-muted)]">年龄: {p.age} 岁 | #{p.id}</div>
                            </div>
                          </div>
                          <p className="text-sm text-[var(--color-text-secondary)] font-bold mt-4 border-t border-[var(--color-border-theme)] pt-3 line-clamp-2">
                            {p.diagnosis}
                          </p>
                        </button>
                      ))}
                      
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="p-5 rounded-2xl border-2 border-dashed border-[var(--color-border-theme)] hover:bg-[var(--color-bg-card-alt)] transition-all flex flex-col items-center justify-center min-h-[140px] text-[var(--color-text-secondary)] cursor-pointer"
                      >
                        <span className="w-10 h-10 rounded-full bg-[var(--color-bg-card-alt)] flex items-center justify-center mb-2 font-bold text-2xl shrink-0">+</span>
                        <div className="text-base font-black">录入受试长者</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">录入必要病理与学历背景</div>
                      </button>
                    </div>
                  )}

                  <div className="bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl p-5 space-y-3 mt-6">
                    <div className="flex items-center gap-2 text-[var(--color-text-primary)] font-black text-lg">
                      <Award size={20} className="text-[var(--color-accent)]" />
                      认知筛查测试流程 (10分钟 SOP 规范)
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm leading-relaxed">
                      <div className="bg-[var(--color-bg-card)] p-4 border border-[var(--color-border-theme)] rounded-xl">
                        <div className="font-black text-[var(--color-text-primary)]">① 静息基线采集</div>
                        <p className="text-[var(--color-text-secondary)] text-xs mt-1.5">保持平静，闭眼1分钟/开眼1分钟，测算个体生理基线。</p>
                      </div>
                      <div className="bg-[var(--color-bg-card)] p-4 border border-[var(--color-border-theme)] rounded-xl">
                        <div className="font-black text-[var(--color-text-primary)]">② 被动老歌视频</div>
                        <p className="text-[var(--color-text-secondary)] text-xs mt-1.5">播放怀旧老歌短片，无接触量化长者面部表情活跃度AU方差。</p>
                      </div>
                      <div className="bg-[var(--color-bg-card)] p-4 border border-[var(--color-border-theme)] rounded-xl">
                        <div className="font-black text-[var(--color-text-primary)]">③ 主动测验负荷</div>
                        <p className="text-[var(--color-text-secondary)] text-xs mt-1.5">数字画钟 CDT 判定与回忆测试，调取脑电 P300 脑心特征。</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[var(--color-border-theme)] flex items-center justify-between">
                  <div className="text-sm text-[var(--color-text-muted)]">检测前，请确保受检老人戴好手环与电极。</div>
                  <button
                    onClick={startSopScreening}
                    disabled={!selectedPatient}
                    className="btn-elderly bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow disabled:opacity-50"
                  >
                    <Play size={18} fill="currentColor" /> 开始联合认知筛查
                  </button>
                </div>
              </div>
            )}

            {/* 阶段 1：静息态基线采集 */}
            {sopStep === 1 && (
              <div className="flex-grow flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-bold">
                      阶段一: 静息态基线采集 (当前建立个体基线)
                    </span>
                    <span className="text-3xl font-black text-[var(--color-text-primary)]">{timer} 秒</span>
                  </div>

                  <div className="border-2 border-[var(--color-border-theme)] rounded-2xl p-8 bg-[var(--color-bg-card-alt)] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center animate-bounce">
                      <Brain size={32} className="text-blue-600" />
                    </div>
                    <h4 className="text-xl font-black text-[var(--color-text-primary)]">
                      {timer > 10 ? '👵 爷爷奶奶请闭上双眼，保持平静' : '👴 爷爷奶奶请睁开双眼，平视屏幕'}
                    </h4>
                    <p className="text-base text-[var(--color-text-secondary)] max-w-md leading-relaxed">
                      系统正在提取您的 Alpha/Theta 脑波比例以及静息心率与 HRV 变异，以此建立个体的生理基线数据。
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-[var(--color-border-theme)] flex justify-between items-center">
                  <SafeExitButton onExit={stopSession} />
                  <button 
                    onClick={() => { setSopStep(2); setTimer(30); changeSopPhase(2) }}
                    className="btn-elderly bg-[var(--color-bg-card-alt)] border-[var(--color-border-theme)] text-[var(--color-text-primary)]"
                  >
                    跳过基线 <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* 阶段 2：怀旧视频刺激 */}
            {sopStep === 2 && (
              <div className="flex-grow flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="px-4 py-1.5 bg-teal-50 border border-teal-200 rounded-full text-teal-700 text-sm font-bold">
                      阶段二: 被动情绪活力视频刺激
                    </span>
                    <span className="text-3xl font-black text-[var(--color-text-primary)]">{timer} 秒</span>
                  </div>

                  <div className="relative aspect-video rounded-2xl bg-slate-950 overflow-hidden flex flex-col items-center justify-center border-2 border-[var(--color-border-theme)] shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-slate-950 to-indigo-900/20 opacity-75 animate-pulse" />
                    
                    <div className="z-10 text-center space-y-3 p-6">
                      <Volume2 size={44} className="text-amber-400 mx-auto animate-pulse" />
                      <h4 className="text-xl font-bold text-white tracking-wide">📽️ 怀旧老歌视频播放中...</h4>
                      <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                        正在播放经典老歌，请受试老人跟着老歌放松体验。摄像头将无感知记录面部表情变化。
                      </p>
                    </div>

                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm border border-emerald-500 rounded-xl p-2.5 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-bold text-white">面部活跃度 & 眼动跟踪中</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[var(--color-border-theme)] flex justify-between items-center">
                  <SafeExitButton onExit={stopSession} />
                  <button 
                    onClick={() => { setSopStep(3); setActiveSubStep(1); changeSopPhase(3) }}
                    className="btn-elderly bg-[var(--color-bg-card-alt)] border-[var(--color-border-theme)] text-[var(--color-text-primary)]"
                  >
                    跳过视频 <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* 阶段 3：主动测验负荷 */}
            {sopStep === 3 && (
              <div className="flex-grow flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-theme)]">
                    <span className="px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-bold">
                      阶段三: 主动测验负荷激发 (请辅助老人完成)
                    </span>
                    <div className="flex gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full ${activeSubStep >= 1 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-card-alt)] border border-[var(--color-border-theme)]'}`} />
                      <span className={`w-3.5 h-3.5 rounded-full ${activeSubStep >= 2 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-card-alt)] border border-[var(--color-border-theme)]'}`} />
                      <span className={`w-3.5 h-3.5 rounded-full ${activeSubStep >= 3 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-card-alt)] border border-[var(--color-border-theme)]'}`} />
                    </div>
                  </div>

                  {/* 3.1 词语记忆 */}
                  {activeSubStep === 1 && (
                    <div className="space-y-6 text-center py-6">
                      <h4 className="text-xl font-black text-[var(--color-text-primary)]">第一步：词语记忆（请辅助让老人记住以下三个词语）</h4>
                      
                      <div className="flex items-center justify-center gap-6">
                        {['苹果', '手表', '钥匙'].map((w, idx) => (
                          <div key={idx} className="w-32 py-8 rounded-2xl bg-[var(--color-bg-card-alt)] border border-[var(--color-border-theme)] shadow flex flex-col items-center justify-center space-y-2">
                            <span className="text-3xl font-black text-[var(--color-text-primary)]">{w}</span>
                            <span className="text-xs text-[var(--color-text-muted)]">词组 {idx + 1}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          const utter = new SpeechSynthesisUtterance("请记住三个词语：苹果，手表，钥匙。")
                          utter.lang = 'zh-CN'
                          utter.rate = 0.8
                          window.speechSynthesis.cancel()
                          window.speechSynthesis.speak(utter)
                        }}
                        className="mx-auto mt-4 btn-elderly border-[var(--color-border-theme)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-alt)] bg-[var(--color-bg-card)]"
                      >
                        <Volume2 size={18} className="text-[var(--color-accent)]" />
                        📢 语音读词播报
                      </button>
                    </div>
                  )}

                  {/* 3.2 数字化表盘选择 */}
                  {activeSubStep === 2 && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <h4 className="text-xl font-black text-[var(--color-text-primary)]">第二步：数字化画钟测验 (dCDT)</h4>
                        <p className="text-base text-[var(--color-text-secondary)] mt-1">请询问老人：哪一个表盘的时间指向的是 **11点10分**？并帮其点击选择：</p>
                      </div>

                      <div className="grid grid-cols-4 gap-4 pt-2">
                        {CLOCK_OPTIONS.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedClock(c.id)}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${
                              selectedClock === c.id 
                                ? 'border-[var(--color-accent)] bg-[var(--color-bg-card-alt)] shadow'
                                : 'border-[var(--color-border-theme)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-alt)]'
                            }`}
                          >
                            <span className="text-sm font-black text-[var(--color-text-primary)]">{c.label}</span>
                            {renderCSSClock(c.hourAngle, c.minuteAngle)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3.3 延迟词语回忆 */}
                  {activeSubStep === 3 && (
                    <div className="space-y-6 text-center py-4">
                      <div>
                        <h4 className="text-xl font-black text-[var(--color-text-primary)]">第三步：延迟记忆回忆 (Delayed Recall)</h4>
                        <p className="text-base text-[var(--color-text-secondary)] mt-1">请让老人说出第一步学习的三个词语，并在下方勾选老人口述正确的词语：</p>
                      </div>

                      <div className="flex flex-wrap justify-center gap-3 max-w-md mx-auto pt-3">
                        {['苹果', '香蕉', '手表', '钢笔', '钥匙', '雨伞'].map(w => {
                          const checked = recallWords.includes(w)
                          return (
                            <button
                              key={w}
                              onClick={() => toggleRecallWord(w)}
                              className={`px-6 py-3 border-2 rounded-full text-base font-black transition-all ${
                                checked 
                                  ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow'
                                  : 'bg-[var(--color-bg-card)] border-[var(--color-border-theme)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-alt)]'
                              }`}
                            >
                              {w}
                            </button>
                          )
                        })}
                      </div>

                      <div className="pt-4 flex items-center justify-center">
                        <button
                          onClick={() => {
                            setIsRecordingRecall(!isRecordingRecall)
                            if (!isRecordingRecall) {
                              setTimeout(() => {
                                setRecallWords(['苹果', '手表', '钥匙']) // 模拟语音识别成功
                                setIsRecordingRecall(false)
                              }, 2500)
                            }
                          }}
                          className={`btn-elderly shadow ${
                            isRecordingRecall 
                              ? 'bg-rose-600 text-white animate-pulse' 
                              : 'bg-[var(--color-bg-card-alt)] text-[var(--color-text-primary)] border-[var(--color-border-theme)]'
                          }`}
                        >
                          <Volume2 size={18} />
                          {isRecordingRecall ? '正在录音匹配中...' : '🎙️ 开启语音智能识别匹配'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 底部控制 */}
                <div className="pt-6 border-t border-[var(--color-border-theme)] flex justify-between items-center">
                  <SafeExitButton onExit={stopSession} />
                  
                  <div className="flex gap-3">
                    {activeSubStep > 1 && (
                      <button 
                        onClick={() => setActiveSubStep(prev => (prev - 1) as any)}
                        className="btn-elderly bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-alt)]"
                      >
                        上一步
                      </button>
                    )}

                    {activeSubStep < 3 ? (
                      <button 
                        onClick={() => setActiveSubStep(prev => (prev + 1) as any)}
                        className="btn-elderly bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow"
                      >
                        下一步 <ChevronRight size={18} />
                      </button>
                    ) : (
                      <button 
                        onClick={handleScaleSubmit}
                        disabled={isSubmitting}
                        className="btn-elderly bg-emerald-600 hover:bg-emerald-700 text-white shadow disabled:opacity-50"
                      >
                        {isSubmitting ? '报告生成中...' : <><CheckCircle size={18} /> 提交生成诊断报告</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右侧实时指标反馈栏 */}
          <div className="col-span-4 flex flex-col gap-5 overflow-y-auto">
            {/* 长者基本信息卡 */}
            <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-5">
              <h3 className="text-base font-black text-[var(--color-text-primary)] mb-3 pb-2 border-b border-[var(--color-border-theme)]">受检长者</h3>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[var(--color-bg-card-alt)] border border-[var(--color-border-theme)] flex items-center justify-center shrink-0">
                  <User size={28} className="text-[var(--color-text-secondary)]" />
                </div>
                {selectedPatient ? (
                  <div className="space-y-1">
                    <div className="text-lg font-black text-[var(--color-text-primary)]">{selectedPatient.name}</div>
                    <p className="text-xs text-[var(--color-text-secondary)]">年龄：{selectedPatient.age} 岁 | 性别: {selectedPatient.gender || '女'}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">学历：{selectedPatient.education === 'low' ? '小学及以下' : selectedPatient.education === 'high' ? '大专及以上' : '初高中'}</p>
                  </div>
                ) : (
                  <div className="text-xs text-[var(--color-text-muted)] italic py-2">
                    暂未选择或录入受试长者
                  </div>
                )}
              </div>
            </div>

            {/* 实时多模态指示器 */}
            <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-5 flex-grow flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-[var(--color-text-primary)] mb-4 pb-2 border-b border-[var(--color-border-theme)] flex items-center gap-2">
                  <Activity size={18} className="text-[var(--color-accent)] animate-pulse" />
                  信号实时通道监测
                </h3>

                {sopStep === 0 ? (
                  <div className="py-20 text-center text-[var(--color-text-muted)] flex flex-col items-center justify-center space-y-3">
                    <Brain size={44} className="opacity-30" />
                    <p className="text-sm font-bold">生理通道未开启</p>
                    <p className="text-xs max-w-[200px] leading-relaxed">请选择长者并点击下方按钮，系统将开启脑电及心电变异监测。</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <IndicatorCard
                      icon={Brain}
                      label="脑电中枢负荷 (EEG)"
                      value={(liveMetrics.eeg_load * 100).toFixed(0) + '%'}
                      sub={`P300: ${liveMetrics.eeg_load > 0.6 ? '延迟衰减' : '正常激发'}`}
                      status={connectionState === 'connected' ? 'active' : 'disconnected'}
                    />
                    
                    <IndicatorCard
                      icon={Heart}
                      label="心率变异应激 (HRV)"
                      value={Math.round(liveMetrics.hrv_rmssd) + ' ms'}
                      sub={`弹性: ${liveMetrics.hrv_rmssd < 30.0 ? '刚性僵硬' : '反应良好'}`}
                      status={connectionState === 'connected' ? 'active' : 'disconnected'}
                    />

                    <IndicatorCard
                      icon={Activity}
                      label="血氧饱和度 (SpO2)"
                      value={(liveMetrics.spo2 * 100).toFixed(1) + '%'}
                      sub={liveMetrics.spo2 < 0.95 ? '存在低氧指征' : '氧合正常'}
                      status={connectionState === 'connected' ? 'active' : 'disconnected'}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[var(--color-bg-card-alt)] border border-[var(--color-border-theme)] rounded-xl p-3 text-center">
                        <span className="text-xs text-[var(--color-text-muted)] font-bold">表情活力度</span>
                        <div className="text-base font-black text-[var(--color-text-primary)] mt-1">
                          {(liveMetrics.au_variance * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="bg-[var(--color-bg-card-alt)] border border-[var(--color-border-theme)] rounded-xl p-3 text-center">
                        <span className="text-xs text-[var(--color-text-muted)] font-bold">眼球异常扫视</span>
                        <div className="text-base font-black text-[var(--color-text-primary)] mt-1">
                          {(liveMetrics.gaze_score * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {sopStep > 0 && (
                <div className="border-t border-[var(--color-border-theme)] pt-4 mt-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    时序流高精锁频 (32Hz)
                  </span>
                  <span>偏差 &lt; 1ms</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 录入新测试受试长者 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-fade-in-up">
            <h3 className="text-xl font-black text-[var(--color-text-primary)] mb-4 pb-2 border-b border-[var(--color-border-theme)] flex items-center gap-2">
              <User size={22} className="text-[var(--color-accent)]" />
              录入新测试长者信息
            </h3>
            
            <form onSubmit={handleAddPatientSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1">受试者姓名 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如：张奶奶"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full input-elderly outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1">年龄 *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={newAge}
                    onChange={e => setNewAge(Number(e.target.value))}
                    className="w-full input-elderly outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1">性别</label>
                  <select
                    value={newGender}
                    onChange={e => setNewGender(e.target.value)}
                    className="w-full input-elderly bg-[var(--color-bg-card)] outline-none"
                  >
                    <option value="女">女</option>
                    <option value="男">男</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1">系统编号 (ID) *</label>
                  <input
                    type="text"
                    required
                    value={newId}
                    onChange={e => setNewId(e.target.value)}
                    className="w-full input-elderly outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1">受教育程度</label>
                  <select
                    value={newEducation}
                    onChange={e => setNewEducation(e.target.value)}
                    className="w-full input-elderly bg-[var(--color-bg-card)] outline-none"
                  >
                    <option value="low">小学及以下 (低学历组)</option>
                    <option value="medium">初高中 (普通学历组)</option>
                    <option value="high">大专及以上 (高学历组)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1">模拟测试指征类型</label>
                <select
                  value={newMockType}
                  onChange={e => setNewMockType(e.target.value)}
                  className="w-full input-elderly bg-[var(--color-bg-card)] outline-none font-bold text-[var(--color-accent)]"
                >
                  <option value="healthy">🟢 脑活力优良 (模拟健康长者组)</option>
                  <option value="scd">🟡 存在主观认知疲劳 (模拟SCD组)</option>
                  <option value="mci">🟠 认知功能轻度减退 (模拟MCI组)</option>
                  <option value="dementia">🔴 建议寻求专科脑评估 (建议评估组)</option>
                </select>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 leading-relaxed">
                  * 录入此类型后，系统后台将在 WebSocket 串流中自动生成对应的脑电/心电/血氧时变异常指征数据。
                </p>
              </div>

              {addingError && (
                <div className="text-sm text-red-600 font-bold bg-red-50 p-3 rounded-xl border border-red-200">
                  ⚠️ {addingError}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-elderly bg-[var(--color-bg-card-alt)] border-[var(--color-border-theme)] text-[var(--color-text-primary)]"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-elderly bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
                >
                  录入并保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function IndicatorCard({
  icon: Icon,
  label,
  value,
  sub,
  status
}: {
  icon: any
  label: string
  value: string
  sub: string
  status: 'active' | 'disconnected'
}) {
  const active = status === 'active'
  return (
    <div className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
      active ? 'bg-[var(--color-bg-card-alt)] border-[var(--color-border-theme)]' : 'bg-[var(--color-bg-card)] border-dashed border-[var(--color-border-theme)] opacity-50'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          active ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-card-alt)] text-[var(--color-text-muted)]'
        }`}>
          <Icon size={20} />
        </div>
        <div>
          <div className="text-sm font-black text-[var(--color-text-primary)]">{label}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-black text-[var(--color-text-primary)]">{value}</div>
        <div className="flex items-center gap-1 justify-end mt-0.5">
          <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-[10px] text-[var(--color-text-muted)] font-bold">{active ? 'Live' : 'Off'}</span>
        </div>
      </div>
    </div>
  )
}
