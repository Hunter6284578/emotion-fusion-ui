import { useState, useEffect } from 'react'
import {
  Stethoscope, User, Play, Square, Brain, Heart, Activity,
  ChevronRight, Volume2, Award, CheckCircle
} from 'lucide-react'
import { useWebSocket } from '../hooks/useWebSocketBus'
import CognitiveReportDashboard from '../components/CognitiveReportDashboard'
import { fetchPatients, addPatient } from '../api'

// Interactive dCDT clock options (Target Time: 11:10)
const CLOCK_OPTIONS = [
  { id: 'A', label: '表盘 A', hourAngle: 335, minuteAngle: 60, isCorrect: true }, // 11:10
  { id: 'B', label: '表盘 B', hourAngle: 300, minuteAngle: 330, isCorrect: false }, // 10:55
  { id: 'C', label: '表盘 C', hourAngle: 0, minuteAngle: 60, isCorrect: false }, // 12:10
  { id: 'D', label: '表盘 D', hourAngle: 335, minuteAngle: 300, isCorrect: false }  // 11:50
]

export default function Dashboard() {
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

  const [sopStep, setSopStep] = useState<0 | 1 | 2 | 3 | 4>(0) // 0: Select, 1: Rest, 2: Stim, 3: Active, 4: Report
  const [timer, setTimer] = useState(0)
  
  // Phase 3 quantities
  const [activeSubStep, setActiveSubStep] = useState<1 | 2 | 3>(1) // 1: word show, 2: dcdt, 3: recall
  const [selectedClock, setSelectedClock] = useState<string | null>(null)
  const [recallWords, setRecallWords] = useState<string[]>([])
  const [isRecordingRecall, setIsRecordingRecall] = useState(false)
  
  // Accumulated data for final report submit
  const [spo2History, setSpo2History] = useState<number[]>([])
  const [reportResult, setReportResult] = useState<any | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const doctorNotes = ''

  // WebSocket downstream packet (real-time stream)
  const { connect, disconnect, connectionState, sendJSON } = useWebSocket()
  const [liveMetrics, setLiveMetrics] = useState<any>({
    eeg_load: 0.15,
    hrv_rmssd: 38.0,
    spo2: 0.98,
    gaze_score: 0.12,
    au_variance: 0.18
  })

  // Timer logic for Phase 1 & 2
  useEffect(() => {
    if (sopStep !== 1 && sopStep !== 2) return
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          // Automatically step forward
          if (sopStep === 1) {
            setSopStep(2)
            setTimer(30) // 30s emotional stimulation video demo (real is 3min)
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

  // simulated live streaming packet over websocket
  useEffect(() => {
    if (connectionState !== 'connected' || sopStep === 0 || sopStep === 4) return

    const interval = setInterval(() => {
      const ts = Date.now()
      const mockType = selectedPatient?.mock_type || 'healthy'
      
      // Calculate phase-specific features
      let eegLoad = 0.25 + Math.random() * 0.1
      let rmssd = 35.0 + Math.random() * 3
      let spo2 = 0.982 + Math.random() * 0.003
      let gaze = 0.12 + Math.random() * 0.05
      let auVar = 0.15 + Math.random() * 0.04

      // EEG slow-wave/P300 and HRV rigidity simulations based on patient disease model
      if (sopStep === 1) { // Rest
        if (mockType === 'dementia') {
          eegLoad = 0.45; rmssd = 23.0; spo2 = 0.958
        } else if (mockType === 'mci') {
          eegLoad = 0.35; rmssd = 29.0; spo2 = 0.972
        }
      } else if (sopStep === 2) { // Emotion video stim
        if (mockType === 'dementia') {
          eegLoad = 0.48; rmssd = 22.0; spo2 = 0.951; auVar = 0.03 // severe face apathy
          gaze = 0.58 // scanpath avoidance
        } else if (mockType === 'mci') {
          eegLoad = 0.38; rmssd = 28.0; spo2 = 0.965; auVar = 0.08
          gaze = 0.32
        }
      } else if (sopStep === 3) { // Active cognitive task (stress response)
        if (mockType === 'dementia') {
          eegLoad = 0.78; rmssd = 22.2; spo2 = 0.931; gaze = 0.68; auVar = 0.04
        } else if (mockType === 'mci') {
          eegLoad = 0.65; rmssd = 28.2; spo2 = 0.952; gaze = 0.45; auVar = 0.09
        } else {
          // Healthy: rmssd drops from 38 to 26 (healthy stress elasticity)
          eegLoad = 0.45; rmssd = 25.5; spo2 = 0.981; gaze = 0.15
        }
      }

      // Append SpO2 macro-logging
      setSpo2History(prev => {
        const next = [...prev, spo2]
        // Cap at 600 points (10 minutes)
        return next.slice(-600)
      })

      // Send sensor packet over WebSocket with forced client_timestamp
      sendJSON({
        type: 'eeg',
        client_timestamp: ts,
        data: Array.from({ length: 8 }, () => 
          Array.from({ length: 250 }, () => (Math.random() - 0.5) * 50)
        ),
        channels: ["FP1", "FP2", "F3", "F4", "T7", "T8", "Pz", "O1"],
        impedance: [12.2, 11.5, 13.0, 10.8, 14.2, 12.0, 9.8, 11.0]
      })

      sendJSON({
        type: 'ecg',
        client_timestamp: ts,
        features: {
          RMSSD: rmssd,
          SDNN: rmssd * 1.15,
          LFHF: sopStep === 3 ? 2.3 : 1.3,
          hr_mean: sopStep === 3 ? 78.0 : 70.0
        },
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

  // Stepper Controller: Trigger connection and update states
  const startSopScreening = () => {
    if (!selectedPatient) return
    connect()
    setSpo2History([])
    setReportResult(null)
    setSelectedClock(null)
    setRecallWords([])
    setSopStep(1)
    setTimer(20) // 20s resting baseline demo (real is 2min)

    // Notify backend about client metadata and start of session
    setTimeout(() => {
      sendJSON({
        type: 'client_metadata',
        metadata: {
          age: selectedPatient?.age || 65,
          education: selectedPatient?.education || 'medium',
          name: selectedPatient?.name || 'Anonymous',
          id: selectedPatient?.id || 'P001',
          baseline_hrv: {
            RMSSD: selectedPatient?.mock_type === 'healthy' ? 38.0 : 25.0
          }
        }
      })
      sendJSON({
        type: 'sop_state',
        phase: 1
      })
    }, 500)
  }

  // Update SOP phase state on backend
  const changeSopPhase = (phase: number) => {
    sendJSON({
      type: 'sop_state',
      phase: phase
    })
  }

  // Handle cognitive test submissions
  const handleScaleSubmit = () => {
    const isClockCorrect = CLOCK_OPTIONS.find(c => c.id === selectedClock)?.isCorrect || false
    const countRecall = recallWords.length

    sendJSON({
      type: 'scale_performance',
      performance: {
        dcdt_correct: isClockCorrect,
        delayed_recall_count: countRecall
      }
    })

    // Prepare HTTP JSON payload to compile the final report
    compileFinalReport(isClockCorrect, countRecall)
  }

  const compileFinalReport = async (isClockCorrect: boolean, countRecall: number) => {
    setIsSubmitting(true)
    try {
      const mockType = selectedPatient?.mock_type || 'healthy'
      
      // Calculate mock metrics for submit matching the patient disease profile
      const eeg_data_mock = Array.from({ length: 8 }, () => 
        Array.from({ length: 250 * 10 }, () => (Math.random() - 0.5) * 30)
      )
      
      const payload = {
        patient_metadata: {
          id: selectedPatient?.id || 'P001',
          name: selectedPatient?.name || 'Anonymous',
          age: selectedPatient?.age || 65,
          education: selectedPatient?.education || 'medium'
        },
        eeg_data: eeg_data_mock,
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
        scale_performance: {
          dcdt_correct: isClockCorrect,
          delayed_recall_count: countRecall
        },
        doctor_notes: doctorNotes
      }

      const response = await fetch('http://localhost:8088/api/cognitive/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      const result = await response.json()
      
      if (result.ok) {
        setReportResult(result.report)
        setSopStep(4) // View report
        disconnect()
      }
    } catch (err) {
      console.error('Failed to compile report: ', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle words in recall test
  const toggleRecallWord = (word: string) => {
    setRecallWords(prev =>
      prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word]
    )
  }

  // Render CSS clocks for dCDT options
  const renderCSSClock = (hourAngle: number, minAngle: number) => {
    return (
      <div className="relative w-20 h-20 rounded-full border-2 border-slate-700 bg-white flex items-center justify-center shadow-inner">
        {/* Clock center dot */}
        <div className="w-1.5 h-1.5 rounded-full bg-slate-800 z-10" />
        
        {/* Hour Hand */}
        <div 
          className="absolute w-0.5 h-6 bg-slate-800 origin-bottom rounded" 
          style={{ 
            transform: `rotate(${hourAngle}deg)`, 
            top: '20px',
            transformOrigin: '50% 100%' 
          }}
        />

        {/* Minute Hand */}
        <div 
          className="absolute w-0.5 h-8 bg-slate-500 origin-bottom rounded" 
          style={{ 
            transform: `rotate(${minAngle}deg)`, 
            top: '10px',
            transformOrigin: '50% 100%' 
          }}
        />

        {/* Basic Clock Markers */}
        <span className="absolute top-0.5 text-[7px] font-bold text-slate-400">12</span>
        <span className="absolute right-1 text-[7px] font-bold text-slate-400">3</span>
        <span className="absolute bottom-0.5 text-[7px] font-bold text-slate-400">6</span>
        <span className="absolute left-1 text-[7px] font-bold text-slate-400">9</span>
      </div>
    )
  }

  // Terminate session
  const stopSession = () => {
    disconnect()
    setSopStep(0)
  }

  if (sopStep === 4) {
    return (
      <CognitiveReportDashboard 
        reportData={reportResult}
        patientMetadata={selectedPatient}
        onClose={() => setSopStep(0)}
      />
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#F3F6F8]">
      {/* Top Header */}
      <header className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <Stethoscope size={24} className="text-blue-600 animate-pulse" />
          <h2 className="text-[17px] font-bold text-slate-800">“脑-心-行为”联合老年人认知筛查工作台</h2>
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-bold ml-2">v4.0 时序同步&脑心中间融合版</span>
        </div>

        {sopStep > 0 && (
          <button
            onClick={stopSession}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Square size={10} fill="currentColor" /> 中断筛查
          </button>
        )}
      </header>

      {/* Main Grid Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-12 gap-6 h-full">
          
          {/* LEFT PANEL: SOP Stepper Workspace */}
          <div className="col-span-8 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between overflow-y-auto">
            {/* Phase 0: Patient Selection & Onboarding */}
            {sopStep === 0 && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">1. 选择或录入受试老年人</h3>
                  {loadingPatients ? (
                    <div className="py-10 text-center text-xs text-slate-400">正在加载长者列表...</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {patients.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPatient(p)}
                          className={`text-left p-4 rounded-2xl border transition-all ${
                            selectedPatient && selectedPatient.id === p.id 
                              ? 'border-blue-500 bg-blue-50/50 shadow-md shadow-blue-500/5' 
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                              selectedPatient && selectedPatient.id === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <User size={18} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800">{p.name}</div>
                              <div className="text-[10px] text-slate-400">年龄: {p.age} 岁 | #{p.id}</div>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium mt-3 border-t border-slate-100 pt-2 line-clamp-2">
                            {p.diagnosis}
                          </p>
                        </button>
                      ))}
                      
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="text-center p-4 rounded-2xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-slate-50/55 transition-all flex flex-col items-center justify-center min-h-[120px] text-slate-500 hover:text-blue-600 cursor-pointer"
                      >
                        <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2 font-bold text-lg text-slate-400 shrink-0">
                          +
                        </span>
                        <div className="text-xs font-bold">录入新测试受试长者</div>
                        <div className="text-[10px] text-slate-400 mt-1">添加年龄、学历及病理模拟类型</div>
                      </button>
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3 mt-6">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                      <Award size={16} className="text-indigo-500" />
                      筛查测试流程 (10分钟 SOP 规范)
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div className="bg-white p-3 border border-slate-150 rounded-xl">
                        <div className="font-bold text-slate-700">阶段一：静息基线采集</div>
                        <p className="text-slate-400 text-[10px] mt-1">戴好脑电仪与心电血氧手环，闭眼1分钟/睁眼1分钟，建立个体生理基线。</p>
                      </div>
                      <div className="bg-white p-3 border border-slate-150 rounded-xl">
                        <div className="font-bold text-slate-700">阶段二：被动怀旧刺激</div>
                        <p className="text-slate-400 text-[10px] mt-1">播放温馨怀旧老歌短片，摄像头实时量化视线回避与面部情绪表达活力AU方差。</p>
                      </div>
                      <div className="bg-white p-3 border border-slate-150 rounded-xl">
                        <div className="font-bold text-slate-700">阶段三：主动测验负荷</div>
                        <p className="text-slate-400 text-[10px] mt-1">数字化 Mini-Cog 测试：词语记忆、表盘 dCDT 选择及延迟语音回忆，激发 P300 脑心调控。</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-400">检测前，请确保老人已端坐，并贴好电极或戴好手环。</div>
                  <button
                    onClick={startSopScreening}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
                  >
                    <Play size={14} fill="currentColor" /> 开始联合认知筛查
                  </button>
                </div>
              </div>
            )}

            {/* Phase 1: Resting Baseline */}
            {sopStep === 1 && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-indigo-50 border border-indigo-150 rounded-full text-indigo-600 text-[10px] font-bold">
                      阶段一: 静息态基线采集 (2分钟)
                    </span>
                    <span className="text-2xl font-black text-slate-800">{timer} 秒</span>
                  </div>

                  <div className="border border-slate-150 rounded-2xl p-6 bg-slate-50 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center animate-bounce">
                      <Brain size={24} className="text-indigo-600" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">
                      {timer > 10 ? '受试老人请闭上双眼，保持平静' : '受试老人请睁开双眼，平视屏幕'}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm">
                      系统正在静息态下提取老人的基础 Alpha/Theta 脑电比例以及静息心率与 HRV 变异，以此建立个体的生理基线数据。
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-400">基线采集完成后，系统会自动切换至下一阶段</span>
                  <button 
                    onClick={() => { setSopStep(2); setTimer(30); changeSopPhase(2) }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    跳过基线 <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Phase 2: Passive Video Stimulation */}
            {sopStep === 2 && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-teal-50 border border-teal-150 rounded-full text-teal-600 text-[10px] font-bold">
                      阶段二: 被动情绪活力视频刺激 (3分钟)
                    </span>
                    <span className="text-2xl font-black text-slate-800">{timer} 秒</span>
                  </div>

                  {/* Mock nostalgic video container */}
                  <div className="relative aspect-video rounded-2xl bg-slate-900 overflow-hidden flex flex-col items-center justify-center border-2 border-slate-800 shadow-lg">
                    {/* Background mock visualizer representing warm vintage projection */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-slate-950 to-indigo-900/20 opacity-75 animate-pulse" />
                    
                    <div className="z-10 text-center space-y-2.5 p-6">
                      <Volume2 size={36} className="text-amber-400 mx-auto animate-pulse" />
                      <h4 className="text-sm font-bold text-white tracking-wide">怀旧怀念短视频播放中...</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        屏幕正在播放怀旧老歌（如《茉莉花》或《夜上海》配画面），摄像头正在提取老人的面部动作单元方差，并跟踪眼球的扫视与凝视点。
                      </p>
                    </div>

                    {/* Simulating facial bounding box overlay */}
                    <div className="absolute top-4 left-4 bg-black/40 backdrop-blur border border-emerald-500 rounded-lg p-2 flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">人脸表情 & 眼动跟踪中</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-400">视频播放完毕，系统会自动过渡至测试界面</span>
                  <button 
                    onClick={() => { setSopStep(3); setActiveSubStep(1); changeSopPhase(3) }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    跳过视频 <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Phase 3: Active Cognitive Load Stepper */}
            {sopStep === 3 && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="px-3 py-1 bg-blue-50 border border-blue-150 rounded-full text-blue-600 text-[10px] font-bold">
                      阶段三: 主动测验负荷与脑电 P300 激发 (3-5分钟)
                    </span>
                    <div className="flex gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${activeSubStep >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                      <span className={`w-2.5 h-2.5 rounded-full ${activeSubStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                      <span className={`w-2.5 h-2.5 rounded-full ${activeSubStep >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                    </div>
                  </div>

                  {/* Sub Step 3.1: Word Memory */}
                  {activeSubStep === 1 && (
                    <div className="space-y-5 text-center py-6">
                      <h4 className="text-sm font-bold text-slate-800">第一步：词语学习（请让老人记住以下三个词语）</h4>
                      
                      <div className="flex items-center justify-center gap-6">
                        {['苹果', '手表', '钥匙'].map((w, idx) => (
                          <div key={idx} className="w-28 py-6 rounded-2xl bg-slate-50 border border-slate-150 shadow-sm flex flex-col items-center justify-center space-y-1">
                            <span className="text-2xl font-black text-slate-800">{w}</span>
                            <span className="text-[10px] text-slate-400">词语 {idx + 1}</span>
                          </div>
                        ))}
                      </div>

                      <button className="mx-auto mt-4 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-1.5 hover:bg-slate-50">
                        <Volume2 size={14} className="text-blue-500" />
                        TTS 语音读词播报
                      </button>
                    </div>
                  )}

                  {/* Sub Step 3.2: dCDT Clock Dial Choice */}
                  {activeSubStep === 2 && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <h4 className="text-sm font-bold text-slate-800">第二步：数字化画钟测验 (dCDT)</h4>
                        <p className="text-xs text-slate-400 mt-1">请询问并让老人指出：哪一个表盘的时间指向的是 **11点10分**？</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        {CLOCK_OPTIONS.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedClock(c.id)}
                            className={`p-3 rounded-2xl border flex flex-col items-center gap-3 transition-all ${
                              selectedClock === c.id 
                                ? 'border-blue-500 bg-blue-50/50 shadow'
                                : 'border-slate-150 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-xs font-bold text-slate-700">{c.label}</span>
                            {renderCSSClock(c.hourAngle, c.minuteAngle)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub Step 3.3: Word Delayed Recall */}
                  {activeSubStep === 3 && (
                    <div className="space-y-4 text-center py-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">第三步：延迟记忆回忆 (Delayed Recall)</h4>
                        <p className="text-xs text-slate-400 mt-1">请让老人说出刚才学习的三个词语，并在下方勾选老人口述出的词语：</p>
                      </div>

                      <div className="flex flex-wrap justify-center gap-3 max-w-md mx-auto pt-3">
                        {['苹果', '香蕉', '手表', '钢笔', '钥匙', '雨伞'].map(w => {
                          const checked = recallWords.includes(w)
                          return (
                            <button
                              key={w}
                              onClick={() => toggleRecallWord(w)}
                              className={`px-4 py-2 border rounded-full text-xs font-bold transition-all ${
                                checked 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {w}
                            </button>
                          )
                        })}
                      </div>

                      <div className="pt-4 flex items-center justify-center">
                        <button
                          onClick={() => setIsRecordingRecall(!isRecordingRecall)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1.5 ${
                            isRecordingRecall 
                              ? 'bg-red-500 text-white animate-pulse' 
                              : 'bg-slate-100 hover:bg-slate-250 text-slate-600'
                          }`}
                        >
                          <Volume2 size={14} />
                          {isRecordingRecall ? '正在录音识别...' : '点此录音并匹配 (麦克风ASR)'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Controls for Phase 3 */}
                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-400">
                    {activeSubStep === 1 && '读完词语后，请切换到下一步'}
                    {activeSubStep === 2 && '请点击选择一个表盘时间'}
                    {activeSubStep === 3 && '勾选完毕后，即可提交融合分析并生成报告'}
                  </span>
                  
                  <div className="flex gap-2">
                    {activeSubStep > 1 && (
                      <button 
                        onClick={() => setActiveSubStep(prev => (prev - 1) as any)}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all"
                      >
                        上一步
                      </button>
                    )}

                    {activeSubStep < 3 ? (
                      <button 
                        onClick={() => setActiveSubStep(prev => (prev + 1) as any)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1"
                      >
                        下一步 <ChevronRight size={14} />
                      </button>
                    ) : (
                      <button 
                        onClick={handleScaleSubmit}
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow disabled:opacity-50 flex items-center gap-1 transition-colors"
                      >
                        {isSubmitting ? '报告生成中...' : <><CheckCircle size={14} /> 提交生成诊断报告</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR: Sensors Live Status Feed */}
          <div className="col-span-4 flex flex-col gap-5 overflow-y-auto">
            {/* Active Patient Details */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5">
              <h3 className="text-xs font-bold text-slate-700 mb-3.5 pb-2 border-b border-slate-100">正在检查受试者信息</h3>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-150 flex items-center justify-center shrink-0">
                  <User size={24} className="text-slate-600" />
                </div>
                {selectedPatient ? (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-800">{selectedPatient.name}</div>
                    <p className="text-[10px] text-slate-400 font-medium">年 龄：{selectedPatient.age} 岁 | 性别: {selectedPatient.gender || '女'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">受教育组：{selectedPatient.education === 'low' ? '小学及以下' : selectedPatient.education === 'high' ? '大专及以上' : '初高中'}</p>
                  </div>
                ) : (
                  <div className="space-y-1 py-1 text-slate-400 text-xs italic">
                    暂未选择或录入受试长者
                  </div>
                )}
              </div>
            </div>

            {/* Live Modality Indicators */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 flex-1 flex flex-col">
              <h3 className="text-xs font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center gap-1.5">
                <Activity size={14} className="text-blue-500 animate-pulse" />
                多模态信号实时通道监测
              </h3>

              {sopStep === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-350 p-6">
                  <Brain size={40} className="opacity-30 mb-2" />
                  <p className="text-xs font-semibold">信号通道未开启</p>
                  <p className="text-[10px] mt-1">选择受检长者并点击“开始筛查”，即可观测传感器实时串流数值。</p>
                </div>
              ) : (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  {/* Indicators list */}
                  <div className="space-y-3">
                    <IndicatorCard
                      icon={Brain}
                      label="脑电中枢负荷 (EEG)"
                      value={(liveMetrics.eeg_load * 100).toFixed(0) + '%'}
                      sub={`P300峰: ${liveMetrics.eeg_load > 0.6 ? '延迟衰减' : '正常爆发'}`}
                      status={connectionState === 'connected' ? 'active' : 'disconnected'}
                    />
                    
                    <IndicatorCard
                      icon={Heart}
                      label="心率变异应激 (HRV)"
                      value={Math.round(liveMetrics.hrv_rmssd) + ' ms'}
                      sub={`RMSSD 状态: ${liveMetrics.hrv_rmssd < 30.0 ? '失去弹性' : '反应活跃'}`}
                      status={connectionState === 'connected' ? 'active' : 'disconnected'}
                    />

                    <IndicatorCard
                      icon={Activity}
                      label="慢变量血氧 (SpO2)"
                      value={(liveMetrics.spo2 * 100).toFixed(1) + '%'}
                      sub={liveMetrics.spo2 < 0.95 ? '间歇性低氧警告' : '常氧'}
                      status={connectionState === 'connected' ? 'active' : 'disconnected'}
                    />

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                        <span className="text-[9px] text-slate-400 font-semibold">情绪表达活力</span>
                        <div className="text-xs font-bold text-slate-700 mt-1">
                          {(liveMetrics.au_variance * 100).toFixed(0)}%
                        </div>
                        <span className="text-[8px] text-slate-400 mt-0.5 block">{liveMetrics.au_variance < 0.1 ? '面部活跃低' : '微表情活跃'}</span>
                      </div>
                      
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                        <span className="text-[9px] text-slate-400 font-semibold">眼球异常扫视</span>
                        <div className="text-xs font-bold text-slate-700 mt-1">
                          {(liveMetrics.gaze_score * 100).toFixed(0)}%
                        </div>
                        <span className="text-[8px] text-slate-400 mt-0.5 block">{liveMetrics.gaze_score > 0.4 ? '异常扫视偏多' : '眼动正常'}</span>
                      </div>
                    </div>
                  </div>

                  {/* NTP Status */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[9px] text-slate-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Client Timestamp 同步已强制锁定
                    </span>
                    <span>精度: &lt;1.5ms</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-fade-in-up">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <User size={18} className="text-blue-600" />
              录入新测试受试长者 (必要个人信息)
            </h3>
            
            <form onSubmit={handleAddPatientSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">受试者姓名 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如：张奶奶"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">年龄 *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={newAge}
                    onChange={e => setNewAge(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">性别</label>
                  <select
                    value={newGender}
                    onChange={e => setNewGender(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="女">女</option>
                    <option value="男">男</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">系统编号 (ID) *</label>
                  <input
                    type="text"
                    required
                    value={newId}
                    onChange={e => setNewId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">受教育程度</label>
                  <select
                    value={newEducation}
                    onChange={e => setNewEducation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="low">小学及以下 (低学历组)</option>
                    <option value="medium">初高中 (普通学历组)</option>
                    <option value="high">大专及以上 (高学历组)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">生理及病理模拟测试类型</label>
                <select
                  value={newMockType}
                  onChange={e => setNewMockType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-blue-600 font-bold"
                >
                  <option value="healthy">🟢 脑活力优良 (模拟健康对照组)</option>
                  <option value="scd">🟡 存在主观认知疲劳 (模拟SCD组)</option>
                  <option value="mci">🟠 认知功能轻度减退 (模拟MCI组)</option>
                  <option value="dementia">🔴 建议寻求专科脑健康评估 (建议评估组)</option>
                </select>
                <p className="text-[9px] text-slate-400 mt-1">
                  * 录入此类型用于系统后台 WebSocket 生理流模拟器发射对应的时变 EEG/HRV/SpO2 指征数据。
                </p>
              </div>

              {addingError && (
                <div className="text-[11px] text-red-500 font-semibold bg-red-50 px-3 py-2 rounded-xl border border-red-100">
                  ⚠️ {addingError}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/10 transition-all"
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
    <div className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
      active ? 'bg-slate-50 border-slate-150' : 'bg-slate-100/50 border-slate-200 opacity-60'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center ${
          active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'
        }`}>
          <Icon size={16} />
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-700">{label}</div>
          <div className="text-[9px] text-slate-400 mt-0.5">{sub}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-black text-slate-700">{value}</div>
        <div className="flex items-center gap-1 justify-end mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-[8px] text-slate-400 font-semibold">{active ? 'Live' : 'Off'}</span>
        </div>
      </div>
    </div>
  )
}
