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

// 益智康复：逻辑词汇联想库
const ASSOCIATION_QUESTIONS = [
  { target: "夜晚", options: ["太阳", "月亮与星星", "雨伞", "汽车"], correctIdx: 1 },
  { target: "夏天", options: ["雪人", "冰镇西瓜", "长城", "厚毛衣"], correctIdx: 1 },
  { target: "医生", options: ["黑板", "医用听诊器", "铁锤", "家用炒锅"], correctIdx: 1 },
  { target: "海洋", options: ["沙漠", "遨游游鱼", "高山", "绿色森林"], correctIdx: 1 },
  { target: "书本", options: ["羽毛球", "精美文字", "清洁牙刷", "肥沃泥土"], correctIdx: 1 },
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
          className="relative btn-elderly bg-rose-100 hover:bg-rose-200 text-rose-700 min-w-[200px] h-[52px] select-none active:scale-95 overflow-hidden transition-all shadow-sm border-none"
        >
          {/* 进度背景条 */}
          <div 
            className="absolute left-0 top-0 bottom-0 bg-rose-300/40 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
          <span className="z-10 flex items-center gap-2">
            <Square size={16} fill="currentColor" />
            {progress > 0 ? `按住 ${Math.ceil((100 - progress) / 50 * 10) / 10}s` : '长按 2s 退出'}
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
              <h3 className="text-2xl font-black text-[var(--color-text-primary)]">确定要中断返回吗？</h3>
              <p className="text-lg text-[var(--color-text-secondary)]">
                当前进行的测试或训练未完成，现在退出将不会保存当前数据。
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
                继续进行
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  onExit()
                }}
                className="flex-grow btn-elderly bg-rose-600 hover:bg-rose-700 text-white border-none"
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

  // ====== 益智康复训练大厅相关状态 ======
  const [activeTab, setActiveTab] = useState<'sop' | 'games'>('sop')
  const [gameMode, setGameMode] = useState<'lobby' | 'fluency' | 'association' | 'digit' | null>(null)
  const [gameScore, setGameScore] = useState(0)
  const [gameTimer, setGameTimer] = useState(0)
  const [recognizedWords, setRecognizedWords] = useState<string[]>([])
  const [asrTranscript, setAsrTranscript] = useState('')
  const [recognition, setRecognition] = useState<any>(null)

  // 词汇配对状态
  const [associationRound, setAssociationRound] = useState(0)
  const [associationSelectedIdx, setAssociationSelectedIdx] = useState<number | null>(null)
  const [associationFeedback, setAssociationFeedback] = useState<string | null>(null)

  // 数字工作记忆状态
  const [digitLength, setDigitLength] = useState(3)
  const [digitSequence, setDigitSequence] = useState<number[]>([])
  const [digitInput, setDigitInput] = useState<number[]>([])
  const [digitFailCount, setDigitFailCount] = useState(0)
  const [digitState, setDigitState] = useState<'show' | 'input' | 'feedback' | 'stepdown'>('show')
  const [digitShowIdx, setDigitShowIdx] = useState(0)

  // WebSocket 实时数据流
  const { connect, disconnect, connectionState, sendJSON } = useWebSocket()
  const [liveMetrics, setLiveMetrics] = useState<any>({
    eeg_load: 0.15,
    hrv_rmssd: 38.0,
    spo2: 0.98,
    gaze_score: 0.12,
    au_variance: 0.18
  })

  // 监听测试与游戏状态并激活沉浸模式
  useEffect(() => {
    if (sopStep > 0 || gameMode !== null) {
      setImmersiveMode(true)
    } else {
      setImmersiveMode(false)
    }
    return () => setImmersiveMode(false)
  }, [sopStep, gameMode, setImmersiveMode])

  // ASR cleanup
  useEffect(() => {
    return () => {
      if (recognition) {
        try {
          recognition.stop()
        } catch (e) {
          console.error(e)
        }
      }
    }
  }, [recognition])

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

  // 计时器逻辑 (SOP 阶段 1 和 阶段 2)
  useEffect(() => {
    if (sopStep !== 1 && sopStep !== 2) return
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          if (sopStep === 1) {
            setSopStep(2)
            setTimer(30) // 阶段二怀旧轮播
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

  // 游戏一：一分钟流畅性挑战倒计时
  useEffect(() => {
    if (gameMode !== 'fluency' || gameTimer <= 0) return
    const interval = setInterval(() => {
      setGameTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          stopAsr()
          speakPrompt(`流畅性训练完成，共回答正确了${gameScore}个词语。您真棒！`)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [gameMode, gameTimer])

  // 游戏一：流畅性大类每15秒切换语音播报
  useEffect(() => {
    if (gameMode !== 'fluency' || gameTimer <= 0) return
    if (gameTimer > 0 && gameTimer % 15 === 0) {
      const isFruit = Math.floor(gameTimer / 15) % 2 === 1
      const cat = isFruit ? '水果' : '动物'
      speakPrompt(`现在请说出：${cat}的名称`)
    }
  }, [gameTimer, gameMode])

  // 游戏三：数字倒计时逐步显示逻辑
  useEffect(() => {
    if (gameMode !== 'digit' || digitState !== 'show') return
    
    const currentDigit = digitSequence[digitShowIdx]
    if (currentDigit !== undefined) {
      speakPrompt(String(currentDigit))
    }

    const timerId = setTimeout(() => {
      if (digitShowIdx < digitSequence.length - 1) {
        setDigitShowIdx(prev => prev + 1)
      } else {
        setDigitState('input')
      }
    }, 1500)

    return () => clearTimeout(timerId)
  }, [gameMode, digitState, digitShowIdx, digitSequence])

  // WebSocket 模拟串流 (支持 SOP 态 与 游戏态)
  useEffect(() => {
    if (connectionState !== 'connected' || (sopStep === 0 && gameMode === null)) return

    const interval = setInterval(() => {
      const ts = Date.now()
      const mockType = selectedPatient?.mock_type || 'healthy'
      
      let eegLoad = 0.25 + Math.random() * 0.1
      let rmssd = 35.0 + Math.random() * 3
      let spo2 = 0.982 + Math.random() * 0.003
      let gaze = 0.12 + Math.random() * 0.05
      let auVar = 0.15 + Math.random() * 0.04

      const activePhase = sopStep > 0 ? sopStep : 3 // 游戏属于激活态负荷

      if (activePhase === 1) {
        if (mockType === 'dementia') {
          eegLoad = 0.45; rmssd = 23.0; spo2 = 0.958
        } else if (mockType === 'mci') {
          eegLoad = 0.35; rmssd = 29.0; spo2 = 0.972
        }
      } else if (activePhase === 2) {
        if (mockType === 'dementia') {
          eegLoad = 0.48; rmssd = 22.0; spo2 = 0.951; auVar = 0.03; gaze = 0.58
        } else if (mockType === 'mci') {
          eegLoad = 0.38; rmssd = 28.0; spo2 = 0.965; auVar = 0.08; gaze = 0.32
        }
      } else {
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
        features: { RMSSD: rmssd, SDNN: rmssd * 1.15, LFHF: activePhase === 3 ? 2.3 : 1.3, hr_mean: activePhase === 3 ? 78.0 : 70.0 },
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
  }, [connectionState, sopStep, gameMode, selectedPatient, sendJSON])

  // SOP 激活时播报 TTS
  useEffect(() => {
    if (sopStep !== 3) return
    let text = ''
    if (activeSubStep === 1) {
      text = '请记住这三个词语：苹果，手表，钥匙。请在脑海中重复几遍。'
    } else if (activeSubStep === 2) {
      text = '请问，右侧的哪一个表盘的时间指向的是十一点十分？请帮长者点击对应的选项。'
    } else if (activeSubStep === 3) {
      text = '请让长者说出刚才记住的三个词语，并在屏幕上勾选出长者回答正确的词语。'
    }
    
    if (text) {
      speakPrompt(text)
    }
  }, [sopStep, activeSubStep])

  // SpeechSynthesis 播放辅助函数 (0.8倍慢速播放)
  const speakPrompt = (text: string) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = 'zh-CN'
        utter.rate = 0.8
        window.speechSynthesis.speak(utter)
      } catch (e) {
        console.error('SpeechSynthesis error:', e)
      }
    }
  }

  // 自动播放破解 (Autoplay Bypass)
  const unlockAudioChannel = () => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const silentUtterance = new SpeechSynthesisUtterance("")
        window.speechSynthesis.speak(silentUtterance)
        console.log("SpeechSynthesis unlocked successfully via user gesture click.")
      } catch (e) {
        console.error(e)
      }
    }
  }

  const startSopScreening = () => {
    if (!selectedPatient) return
    unlockAudioChannel()
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
    setGameMode(null)
  }

  // ====== 益智游戏大厅及游戏事件处理器 ======
  const startGame = (mode: 'fluency' | 'association' | 'digit') => {
    if (!selectedPatient) return
    unlockAudioChannel()
    connect()

    if (mode === 'fluency') {
      startFluencyGame()
    } else if (mode === 'association') {
      startAssociationGame()
    } else if (mode === 'digit') {
      startDigitGame()
    }
  }

  const startFluencyGame = () => {
    setGameScore(0)
    setGameTimer(60)
    setRecognizedWords([])
    setAsrTranscript('')
    setGameMode('fluency')
    speakPrompt("流畅性挑战开始。请在一分钟内，根据屏幕提示，尽可能多地说出水果或动物的名称。")
    setTimeout(() => {
      startAsr()
    }, 2000)
  }

  const startAssociationGame = () => {
    setGameScore(0)
    setAssociationRound(0)
    setAssociationSelectedIdx(null)
    setAssociationFeedback(null)
    setGameMode('association')
    speakPrompt("词汇逻辑联想匹配挑战开始。请找出与目标词汇关联最紧密的词语。")
  }

  const startDigitGame = () => {
    setGameScore(0)
    setDigitLength(3)
    setDigitFailCount(0)
    setGameMode('digit')
    speakPrompt("数字工作记忆挑战开始。请听好数字，并倒序输入它们。")
    generateDigitSequence(3)
  }

  const generateDigitSequence = (length: number) => {
    const seq = Array.from({ length }, () => Math.floor(Math.random() * 10))
    setDigitSequence(seq)
    setDigitInput([])
    setDigitState('show')
    setDigitShowIdx(0)
  }

  const startAsr = () => {
    const SpeechReg = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechReg) {
      try {
        const rec = new SpeechReg()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = 'zh-CN'
        rec.onresult = (event: any) => {
          let interim = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const resultText = event.results[i][0].transcript.trim()
              if (resultText) {
                setRecognizedWords(prev => {
                  if (!prev.includes(resultText)) {
                    setGameScore(s => s + 1)
                    return [...prev, resultText]
                  }
                  return prev
                })
              }
            } else {
              interim += event.results[i][0].transcript
            }
          }
          setAsrTranscript(interim)
        }
        rec.onerror = (e: any) => {
          console.error(e)
        }
        rec.start()
        setRecognition(rec)
      } catch (err) {
        console.error(err)
      }
    }
  }

  const stopAsr = () => {
    if (recognition) {
      try {
        recognition.stop()
      } catch (e) {
        console.error(e)
      }
      setRecognition(null)
    }
  }

  const handleManualAddScore = () => {
    setGameScore(s => s + 1)
    setRecognizedWords(prev => [...prev, "💬 辅助加分项"])
  }

  const handleAssociationSelect = (idx: number) => {
    const currentQ = ASSOCIATION_QUESTIONS[associationRound]
    setAssociationSelectedIdx(idx)
    if (idx === currentQ.correctIdx) {
      setGameScore(s => s + 10)
      setAssociationFeedback("正确！太棒了 ⭐")
      speakPrompt("回答正确！太棒了。")
    } else {
      setAssociationFeedback(`别灰心，正确词语是：${currentQ.options[currentQ.correctIdx]}。`)
      speakPrompt("别灰心，我们继续下一题吧。")
    }
  }

  const handleAssociationNext = () => {
    setAssociationSelectedIdx(null)
    setAssociationFeedback(null)
    setAssociationRound(prev => prev + 1)
  }

  const handleDigitInputPress = (num: number) => {
    if (digitInput.length < digitLength) {
      setDigitInput(prev => [...prev, num])
    }
  }

  const handleDigitBackspace = () => {
    setDigitInput(prev => prev.slice(0, -1))
  }

  const handleDigitClear = () => {
    setDigitInput([])
  }

  const handleDigitSubmit = () => {
    const expected = [...digitSequence].reverse()
    const isCorrect = digitInput.length === expected.length && digitInput.every((v, i) => v === expected[i])

    if (isCorrect) {
      setGameScore(s => s + 10)
      setDigitFailCount(0)
      setDigitState('feedback')
      speakPrompt("回答正确，真棒！")
      setDigitLength(l => Math.min(6, l + 1))
    } else {
      const nextFailCount = digitFailCount + 1
      setDigitFailCount(nextFailCount)
      if (nextFailCount >= 2) {
        // 自适应难度降级 (Step-down adaptive logic)
        speakPrompt("您做得很好！我们来试一组轻松一点的")
        if (digitLength > 3) {
          setDigitLength(l => l - 1)
          setDigitState('stepdown')
        } else {
          setDigitState('stepdown') // 到最低位后展示降级说明，点击继续后转到词汇配对
        }
        setDigitFailCount(0)
      } else {
        speakPrompt("很接近了，我们再来试一次这道题吧！")
        generateDigitSequence(digitLength)
      }
    }
  }

  const handleDigitFeedbackContinue = () => {
    if (digitState === 'stepdown' && digitLength === 3) {
      startAssociationGame()
    } else {
      generateDigitSequence(digitLength)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-bg-primary)]">
      {/* 沉浸式测试顶栏 (大标题，在沉浸模式下只显示受检者信息，隐藏全部导航) */}
      {(sopStep > 0 || gameMode !== null) && (
        <header className="px-6 py-4 flex items-center justify-between border-b-2 border-[var(--color-border-theme)] bg-[var(--color-bg-card)] print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <Stethoscope size={24} className="text-[var(--color-accent)] animate-pulse" />
            <h2 className="text-xl font-black text-[var(--color-text-primary)]">
              {sopStep > 0 ? "脑认知与活力检测进行中" : "脑活力益智脑康复训练进行中"}
            </h2>
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
        <div className="grid grid-cols-12 gap-6 items-stretch min-h-full">
          
          {/* 左侧测试主体区 */}
          <div className="col-span-8 bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-3xl p-6 flex flex-col justify-between min-h-[520px]">
            
            {gameMode === null ? (
              <>
                {/* 准备阶段 0 */}
                {sopStep === 0 && (
                  <div className="flex-grow flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      {/* Tabs 选择器 */}
                      <div className="flex gap-6 border-b-2 border-[var(--color-border-theme)] pb-2 mb-4">
                        <button
                          onClick={() => { setActiveTab('sop'); setSubmitSuccessMsg(''); }}
                          className={`pb-2 px-4 text-xl font-black transition-all border-b-4 ${
                            activeTab === 'sop' 
                              ? 'border-[var(--color-accent)] text-[var(--color-accent)]' 
                              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                          }`}
                        >
                          📋 脑健康联合筛查 (SOP)
                        </button>
                        <button
                          onClick={() => { setActiveTab('games'); setSubmitSuccessMsg(''); }}
                          className={`pb-2 px-4 text-xl font-black transition-all border-b-4 ${
                            activeTab === 'games' 
                              ? 'border-[var(--color-accent)] text-[var(--color-accent)]' 
                              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                          }`}
                        >
                          🎮 益智康复训练中心
                        </button>
                      </div>

                      {submitSuccessMsg && (
                        <div className="p-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-lg font-bold rounded-2xl animate-fade-in-up">
                          {submitSuccessMsg}
                        </div>
                      )}

                      {/* Tab 1: SOP 联合筛查 */}
                      {activeTab === 'sop' && (
                        <div className="space-y-4">
                          <h3 className="text-2xl font-black text-[var(--color-text-primary)]">1. 选择或录入受试长者</h3>
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
                                  className={`text-left p-5 rounded-2xl border-2 transition-all cursor-pointer ${
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
                                className="p-5 rounded-2xl border-2 border-dashed border-[var(--color-border-theme)] hover:bg-[var(--color-bg-card-alt)] transition-all flex flex-col items-center justify-center min-h-[140px] text-[var(--color-text-secondary)] cursor-pointer bg-transparent"
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
                                <div className="font-black text-[var(--color-text-primary)]">① 呼吸基线采集</div>
                                <p className="text-[var(--color-text-secondary)] text-xs mt-1.5">闭眼1分钟/开眼1分钟，平稳呼呼吸建立生理标尺。</p>
                              </div>
                              <div className="bg-[var(--color-bg-card)] p-4 border border-[var(--color-border-theme)] rounded-xl">
                                <div className="font-black text-[var(--color-text-primary)]">② 被动情绪活力</div>
                                <p className="text-[var(--color-text-secondary)] text-xs mt-1.5">Ken Burns温馨怀旧画面投影，捕捉生理与微表情变异度。</p>
                              </div>
                              <div className="bg-[var(--color-bg-card)] p-4 border border-[var(--color-border-theme)] rounded-xl">
                                <div className="font-black text-[var(--color-text-primary)]">③ 主动任务负荷</div>
                                <p className="text-[var(--color-text-secondary)] text-xs mt-1.5">词语记忆回忆与 dCDT 画钟测验，评估认知执行能力。</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: 益智康复小游戏 */}
                      {activeTab === 'games' && (
                        <div className="space-y-6">
                          <div className="bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl p-5 space-y-2">
                            <div className="flex items-center gap-3">
                              <Brain className="text-[var(--color-accent)]" size={28} />
                              <h3 className="text-2xl font-black text-[var(--color-text-primary)]">益智康复训练中心</h3>
                            </div>
                            <p className="text-base text-[var(--color-text-secondary)]">
                              点击下方卡片选择对应认知大类游戏，难度将根据答题情况智能升降。
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            {/* Game 1 */}
                            <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-2xl p-5 flex flex-col justify-between space-y-4">
                              <div className="space-y-2">
                                <span className="inline-block px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-lg">语言流畅</span>
                                <h4 className="text-lg font-black text-[var(--color-text-primary)]">流畅性挑战</h4>
                                <p className="text-xs text-[var(--color-text-secondary)]">60秒大挑战，交替说出水果与动物，训练概念检索脑区。</p>
                              </div>
                              <button
                                onClick={() => startGame('fluency')}
                                disabled={!selectedPatient}
                                className="w-full btn-elderly bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-sm disabled:opacity-50 border-none"
                              >
                                进入训练
                              </button>
                            </div>

                            {/* Game 2 */}
                            <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-2xl p-5 flex flex-col justify-between space-y-4">
                              <div className="space-y-2">
                                <span className="inline-block px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-lg">前额叶区</span>
                                <h4 className="text-lg font-black text-[var(--color-text-primary)]">概念逻辑配对</h4>
                                <p className="text-xs text-[var(--color-text-secondary)]">从逻辑选项中找出关联最强的词汇，保护神经通路突触活力。</p>
                              </div>
                              <button
                                onClick={() => startGame('association')}
                                disabled={!selectedPatient}
                                className="w-full btn-elderly bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-sm disabled:opacity-50 border-none"
                              >
                                进入训练
                              </button>
                            </div>

                            {/* Game 3 */}
                            <div className="bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] rounded-2xl p-5 flex flex-col justify-between space-y-4">
                              <div className="space-y-2">
                                <span className="inline-block px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg">工作记忆</span>
                                <h4 className="text-lg font-black text-[var(--color-text-primary)]">数字倒序记忆</h4>
                                <p className="text-xs text-[var(--color-text-secondary)]">看数字并倒着输入，失败时智能温和降低位数或转换关卡。</p>
                              </div>
                              <button
                                onClick={() => startGame('digit')}
                                disabled={!selectedPatient}
                                className="w-full btn-elderly bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-sm disabled:opacity-50 border-none"
                              >
                                进入训练
                              </button>
                            </div>
                          </div>
                          {!selectedPatient && (
                            <p className="text-base text-rose-700 font-bold text-center bg-rose-50 border border-rose-200 p-3 rounded-xl">
                              ⚠️ 请先在左侧选择或录入受试长者，再开始康复训练。
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {activeTab === 'sop' && (
                      <div className="pt-6 border-t border-[var(--color-border-theme)] flex items-center justify-between">
                        <div className="text-sm text-[var(--color-text-muted)]">开始前，请协助老人坐姿平稳并戴好传感器。</div>
                        <button
                          onClick={startSopScreening}
                          disabled={!selectedPatient}
                          className="btn-elderly bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow disabled:opacity-50 border-none"
                        >
                          <Play size={18} fill="currentColor" /> 开始联合认知筛查
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 阶段 1：呼吸引导基线采集 */}
                {sopStep === 1 && (
                  <div className="flex-grow flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-bold">
                          阶段一: 呼吸引导与静息基线采集
                        </span>
                        <span className="text-3xl font-black text-[var(--color-text-primary)]">{timer} 秒</span>
                      </div>

                      <div className="border-2 border-[var(--color-border-theme)] rounded-2xl p-8 bg-[var(--color-bg-card-alt)] flex flex-col items-center justify-center text-center space-y-6">
                        {/* 呼吸花朵动画 */}
                        <div className="w-40 h-40 flex items-center justify-center relative">
                          <div className="absolute inset-0 rounded-full border-4 border-dashed border-[var(--color-accent)] opacity-20 animate-spin" style={{ animationDuration: '24s' }} />
                          <svg className="w-32 h-32 text-[var(--color-accent)] animate-breathing-flower" viewBox="0 0 100 100" fill="currentColor">
                            <circle cx="50" cy="50" r="14" className="text-amber-400" />
                            <path d="M50 15 C55 30, 45 30, 50 15 Z" />
                            <path d="M50 85 C55 70, 45 70, 50 85 Z" />
                            <path d="M15 50 C30 55, 30 45, 15 50 Z" />
                            <path d="M85 50 C70 55, 70 45, 85 50 Z" />
                            <path d="M25 25 C37 37, 33 39, 25 25 Z" />
                            <path d="M75 75 C63 63, 67 61, 75 75 Z" />
                            <path d="M25 75 C37 63, 33 61, 25 75 Z" />
                            <path d="M75 25 C63 37, 67 39, 75 25 Z" />
                          </svg>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-2xl font-black text-[var(--color-text-primary)]">
                            身体放松，靠在椅背上，静静看着屏幕深呼吸
                          </h4>
                          <p className="text-xl font-bold text-[var(--color-accent)] animate-pulse h-8">
                            { (timer % 8 >= 4) ? "吸气...（缓缓吸气，腹部微微隆起）" : "呼气...（慢慢呼气，吐出身体疲惫）" }
                          </p>
                          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto leading-relaxed">
                            系统正在后台提取您的 Alpha/Theta 脑波比例以及静息心率与 HRV 变异，以此建立个体的生理基线数据。
                          </p>
                        </div>
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

                {/* 阶段 2：怀旧共鸣刺激 */}
                {sopStep === 2 && (() => {
                  const nostalgicImages = ['/retro_radio.png', '/retro_street.png']
                  const currentImageIdx = Math.floor((30 - timer) / 7.5) % nostalgicImages.length
                  return (
                    <div className="flex-grow flex flex-col justify-between">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <span className="px-4 py-1.5 bg-teal-50 border border-teal-200 rounded-full text-teal-700 text-sm font-bold">
                            阶段二: 被动情绪活力视频刺激
                          </span>
                          <span className="text-3xl font-black text-[var(--color-text-primary)]">{timer} 秒</span>
                        </div>

                        <div className="relative aspect-video rounded-2xl bg-slate-950 overflow-hidden border-2 border-[var(--color-border-theme)] shadow-lg">
                          <img 
                            key={currentImageIdx}
                            src={nostalgicImages[currentImageIdx]} 
                            alt="怀旧画面"
                            className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
                          />
                          <div className="absolute inset-0 bg-black/35" />
                          
                          <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                            <div className="text-center space-y-2 text-white">
                              <h4 className="text-xl font-bold tracking-wide">📽️ 怀旧经典画面播映中 ({currentImageIdx + 1}/{nostalgicImages.length})</h4>
                              <p className="text-sm text-slate-200">
                                正在为您播放经典怀旧暖心场景。请身体放松，静静观看。
                              </p>
                            </div>
                          </div>

                          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-emerald-500 rounded-xl p-2.5 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-xs font-bold text-white">生理与面部表情静默追踪中</span>
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
                  )
                })()}

                {/* 阶段 3：主动测验负荷 */}
                {sopStep === 3 && (
                  <div className="flex-grow flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-theme)]">
                        <span className="px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-bold">
                          阶段三: 主动测验负荷激发 (请辅助长者)
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
                              speakPrompt("请记住三个词语：苹果，手表，钥匙。")
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
                                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all cursor-pointer ${
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
                                  className={`px-6 py-3 border-2 rounded-full text-base font-black transition-all cursor-pointer ${
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
                              className={`btn-elderly shadow border-none ${
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
                            className="btn-elderly bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow border-none"
                          >
                            下一步 <ChevronRight size={18} />
                          </button>
                        ) : (
                          <button 
                            onClick={handleScaleSubmit}
                            disabled={isSubmitting}
                            className="btn-elderly bg-emerald-600 hover:bg-emerald-700 text-white shadow disabled:opacity-50 border-none"
                          >
                            {isSubmitting ? '报告生成中...' : <><CheckCircle size={18} /> 提交生成诊断报告</>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // ====== 康复游戏进行中的视图 ======
              <>
                {/* 游戏 1: 流畅性挑战 */}
                {gameMode === 'fluency' && (
                  <div className="flex-grow flex flex-col justify-between min-h-[480px]">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-theme)]">
                        <span className="px-4 py-1.5 bg-green-50 border border-green-200 rounded-full text-green-700 text-sm font-bold">
                          流畅性脑力挑战 (60秒限时)
                        </span>
                        <span className="text-3xl font-black text-[var(--color-text-primary)]">
                          {gameTimer} 秒
                        </span>
                      </div>

                      {gameTimer > 0 ? (
                        <div className="space-y-6">
                          <div className="bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl p-6 text-center space-y-4">
                            <span className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                              请在大声说出以下种类的词语
                            </span>
                            {(() => {
                              const isFruit = Math.floor(gameTimer / 15) % 2 === 1
                              return (
                                <div className="text-4xl font-black text-[var(--color-accent)] py-2 animate-pulse">
                                  当前要求说出：{isFruit ? '🍉 水果类' : '🦁 动物类'}
                                </div>
                              )
                            })()}
                            <p className="text-base text-[var(--color-text-secondary)]">
                              可以包含方言。如果听筒未识别，可请旁边的陪同家属点击加分。
                            </p>
                          </div>

                          <div className="flex justify-between items-center bg-[var(--color-bg-card)] border-2 border-[var(--color-border-theme)] p-4 rounded-xl">
                            <span className="text-lg font-bold text-[var(--color-text-primary)]">正确个数：</span>
                            <span className="text-3xl font-black text-emerald-600">{gameScore} 个</span>
                          </div>

                          <div className="bg-[var(--color-bg-card-alt)] p-4 rounded-xl border border-[var(--color-border-theme)] min-h-[100px] flex flex-wrap gap-2 items-center">
                            <span className="text-xs text-[var(--color-text-muted)] w-full font-bold">已答对词云：</span>
                            {recognizedWords.length === 0 ? (
                              <span className="text-sm text-[var(--color-text-muted)] italic">请按大类说话，或让家属直接手动加分</span>
                            ) : (
                              recognizedWords.map((w, idx) => (
                                <span key={idx} className="px-3 py-1 bg-[var(--color-bg-card)] border border-[var(--color-border-theme)] rounded-full text-base font-bold text-[var(--color-text-primary)]">
                                  {w}
                                </span>
                              ))
                            )}
                            {asrTranscript && (
                              <span className="text-sm text-blue-600 animate-pulse w-full mt-2 block font-bold">
                                🎙️ 听到："{asrTranscript}"
                              </span>
                            )}
                          </div>

                          <div className="pt-2">
                            <button
                              onClick={handleManualAddScore}
                              className="btn-elderly bg-amber-500 hover:bg-amber-600 text-white text-xl py-6 px-10 rounded-3xl w-full shadow-lg flex items-center justify-center gap-3 active:scale-95 border-none"
                              style={{ minHeight: '64px' }}
                            >
                              <span>👪 家属/社工辅助计分 (+1)</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10 space-y-6">
                          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                            <Award size={48} className="text-emerald-600 animate-bounce" />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-3xl font-black text-[var(--color-text-primary)]">🎉 挑战完成！</h4>
                            <p className="text-lg text-[var(--color-text-secondary)]">
                              受检长者今天非常棒！在本轮流畅性挑战中一共正确回答了：
                            </p>
                            <div className="text-5xl font-black text-emerald-600 py-3">{gameScore} 个词</div>
                          </div>
                          <div className="flex gap-4 justify-center max-w-md mx-auto pt-4">
                            <button
                              onClick={startFluencyGame}
                              className="flex-grow btn-elderly bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border-none"
                            >
                              再练一次
                            </button>
                            <button
                              onClick={() => setGameMode(null)}
                              className="flex-grow btn-elderly bg-[var(--color-bg-card-alt)] border-[var(--color-border-theme)] text-[var(--color-text-primary)]"
                            >
                              返回训练大厅
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {gameTimer > 0 && (
                      <div className="pt-6 border-t border-[var(--color-border-theme)] flex justify-between items-center">
                        <SafeExitButton onExit={() => { stopAsr(); setGameMode(null); }} />
                      </div>
                    )}
                  </div>
                )}

                {/* 游戏 2: 词汇逻辑配对 */}
                {gameMode === 'association' && (
                  <div className="flex-grow flex flex-col justify-between min-h-[480px]">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-theme)]">
                        <span className="px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-bold">
                          前额叶词汇关联脑力游戏
                        </span>
                        <span className="text-lg font-black text-[var(--color-text-primary)]">
                          得分: <span className="text-emerald-600 text-2xl">{gameScore}</span> 分 | 进度: {associationRound + 1}/5
                        </span>
                      </div>

                      {associationRound < 5 ? (
                        (() => {
                          const currentQ = ASSOCIATION_QUESTIONS[associationRound]
                          return (
                            <div className="space-y-6">
                              <div className="bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl p-6 text-center space-y-4">
                                <span className="text-sm font-bold text-[var(--color-text-muted)] tracking-wider block">
                                  请找出与此词语关联性最密切的答案
                                </span>
                                <div className="inline-block px-8 py-3 bg-[var(--color-accent)] text-white text-3xl font-black rounded-2xl shadow-md">
                                  {currentQ.target}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                {currentQ.options.map((opt, idx) => {
                                  const isSelected = associationSelectedIdx === idx
                                  const isCorrect = idx === currentQ.correctIdx
                                  let btnClass = "border-[var(--color-border-theme)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-alt)] text-[var(--color-text-primary)]"
                                  
                                  if (associationSelectedIdx !== null) {
                                    if (isCorrect) {
                                      btnClass = "bg-emerald-100 border-emerald-500 text-emerald-800 font-bold shadow-md"
                                    } else if (isSelected) {
                                      btnClass = "bg-rose-100 border-rose-500 text-rose-800 font-bold"
                                    } else {
                                      btnClass = "opacity-60 border-[var(--color-border-theme)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)]"
                                    }
                                  }

                                  return (
                                    <button
                                      key={idx}
                                      disabled={associationSelectedIdx !== null}
                                      onClick={() => handleAssociationSelect(idx)}
                                      className={`p-6 rounded-2xl border-2 text-xl font-bold transition-all text-center flex items-center justify-center min-h-[72px] cursor-pointer ${btnClass}`}
                                    >
                                      {opt}
                                    </button>
                                  )
                                })}
                              </div>

                              {associationFeedback && (
                                <div className="p-4 bg-[var(--color-bg-card-alt)] border border-[var(--color-border-theme)] rounded-xl flex items-center justify-between animate-fade-in-up">
                                  <span className="text-xl font-black text-[var(--color-text-primary)] flex items-center gap-2">
                                    {associationSelectedIdx === currentQ.correctIdx ? "🟢 " : "🔴 "}
                                    {associationFeedback}
                                  </span>
                                  <button
                                    onClick={handleAssociationNext}
                                    className="btn-elderly bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border-none"
                                  >
                                    继续下一题 <ChevronRight size={18} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })()
                      ) : (
                        <div className="text-center py-10 space-y-6">
                          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                            <Award size={48} className="text-emerald-600 animate-bounce" />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-3xl font-black text-[var(--color-text-primary)]">🎉 联想匹配训练结束！</h4>
                            <p className="text-lg text-[var(--color-text-secondary)]">
                              概念映射与逻辑分析思维非常棒！本次得分：
                            </p>
                            <div className="text-5xl font-black text-emerald-600 py-3">{gameScore} 分</div>
                          </div>
                          <div className="flex gap-4 justify-center max-w-md mx-auto pt-4">
                            <button
                              onClick={startAssociationGame}
                              className="flex-grow btn-elderly bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border-none"
                            >
                              再练一次
                            </button>
                            <button
                              onClick={() => setGameMode(null)}
                              className="flex-grow btn-elderly bg-[var(--color-bg-card-alt)] border-[var(--color-border-theme)] text-[var(--color-text-primary)]"
                            >
                              返回训练大厅
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {associationRound < 5 && (
                      <div className="pt-6 border-t border-[var(--color-border-theme)] flex justify-between items-center">
                        <SafeExitButton onExit={() => setGameMode(null)} />
                      </div>
                    )}
                  </div>
                )}

                {/* 游戏 3: 数字工作记忆倒背 */}
                {gameMode === 'digit' && (
                  <div className="flex-grow flex flex-col justify-between min-h-[480px]">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-theme)]">
                        <span className="px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-amber-700 text-sm font-bold">
                          工作记忆数字倒背挑战
                        </span>
                        <span className="text-lg font-black text-[var(--color-text-primary)]">
                          当前难度: <span className="text-amber-600 text-2xl">{digitLength}</span> 位数 | 本轮得分: {gameScore}
                        </span>
                      </div>

                      {/* 展示状态 */}
                      {digitState === 'show' && (
                        <div className="bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl p-10 text-center space-y-6">
                          <span className="text-sm font-bold text-[var(--color-text-muted)] tracking-wider block">
                            请听声音并记住出现的每个数字
                          </span>
                          <div className="w-28 h-28 rounded-full bg-[var(--color-accent)] text-white text-6xl font-black flex items-center justify-center mx-auto shadow-lg animate-pulse">
                            {digitSequence[digitShowIdx]}
                          </div>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            正在展示第 {digitShowIdx + 1} / {digitSequence.length} 个数字...
                          </p>
                        </div>
                      )}

                      {/* 输入状态 */}
                      {digitState === 'input' && (
                        <div className="space-y-6">
                          <div className="bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl p-4 text-center space-y-3">
                            <span className="text-sm font-bold text-[var(--color-text-muted)] tracking-wider block">
                              请【倒序】输入刚才显示的数字
                            </span>
                            
                            <div className="flex justify-center items-center gap-4 py-2">
                              {Array.from({ length: digitLength }).map((_, idx) => {
                                const val = digitInput[idx]
                                return (
                                  <div key={idx} className="w-14 h-14 border-b-4 border-[var(--color-accent)] text-3xl font-black text-[var(--color-text-primary)] flex items-center justify-center">
                                    {val !== undefined ? val : "_"}
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* 虚拟大键盘 */}
                          <div className="grid grid-cols-5 gap-3 max-w-md mx-auto">
                            {[1, 2, 3, 4, 5].map(n => (
                              <button
                                key={n}
                                onClick={() => handleDigitInputPress(n)}
                                className="w-full h-16 rounded-xl border-2 border-[var(--color-border-theme)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-alt)] text-[var(--color-text-primary)] font-black text-2xl active:scale-95 transition-all cursor-pointer"
                              >
                                {n}
                              </button>
                            ))}
                            {[6, 7, 8, 9, 0].map(n => (
                              <button
                                key={n}
                                onClick={() => handleDigitInputPress(n)}
                                className="w-full h-16 rounded-xl border-2 border-[var(--color-border-theme)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-alt)] text-[var(--color-text-primary)] font-black text-2xl active:scale-95 transition-all cursor-pointer"
                              >
                                {n}
                              </button>
                            ))}
                          </div>

                          <div className="flex gap-4 max-w-md mx-auto">
                            <button
                              onClick={handleDigitBackspace}
                              className="flex-grow btn-elderly bg-rose-100 hover:bg-rose-200 text-rose-700 border-none"
                            >
                              回退
                            </button>
                            <button
                              onClick={handleDigitClear}
                              className="flex-grow btn-elderly bg-[var(--color-bg-card-alt)] border-[var(--color-border-theme)] text-[var(--color-text-primary)]"
                            >
                              重来
                            </button>
                            <button
                              onClick={handleDigitSubmit}
                              disabled={digitInput.length < digitLength}
                              className="flex-grow btn-elderly bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 border-none"
                            >
                              提交
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 答对反馈 */}
                      {digitState === 'feedback' && (
                        <div className="bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl p-8 text-center space-y-6">
                          <div className="text-5xl font-black text-emerald-600">
                            🎉 答对啦！
                          </div>
                          <p className="text-lg text-[var(--color-text-secondary)]">
                            数字反向倒背输入完全正确，挑战成功！
                          </p>
                          <button
                            onClick={handleDigitFeedbackContinue}
                            className="btn-elderly bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] mx-auto border-none"
                          >
                            开始下一关
                          </button>
                        </div>
                      )}

                      {/* 自适应降级反馈 */}
                      {digitState === 'stepdown' && (
                        <div className="bg-[var(--color-bg-card-alt)] border-2 border-[var(--color-border-theme)] rounded-2xl p-8 text-center space-y-6">
                          <div className="text-5xl">
                            😊
                          </div>
                          <div className="text-2xl font-black text-[var(--color-text-primary)]">
                            {digitLength === 3 ? "您做得很好！接下来我们来做一组词汇关联" : "您做得很好！我们来试一组轻松一点的"}
                          </div>
                          <p className="text-base text-[var(--color-text-secondary)]">
                            {digitLength === 3 
                              ? "数字倒背挑战已完成。接下来请和我们一起做词汇联想，放松一下大脑吧！" 
                              : "没关系，刚才的位数稍微有一点点长，我们把难度降低一位数，放松心态继续游戏。"}
                          </p>
                          <button
                            onClick={handleDigitFeedbackContinue}
                            className="btn-elderly bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] mx-auto border-none"
                          >
                            {digitLength === 3 ? "进入词汇配对 🎮" : "重新开始本关"}
                          </button>
                        </div>
                      )}
                    </div>

                    {digitState !== 'feedback' && digitState !== 'stepdown' && (
                      <div className="pt-6 border-t border-[var(--color-border-theme)] flex justify-between items-center">
                        <SafeExitButton onExit={() => setGameMode(null)} />
                      </div>
                    )}
                  </div>
                )}
              </>
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

                {sopStep === 0 && gameMode === null ? (
                  <div className="py-20 text-center text-[var(--color-text-muted)] flex flex-col items-center justify-center space-y-3">
                    <Brain size={44} className="opacity-30" />
                    <p className="text-sm font-bold">生理通道未开启</p>
                    <p className="text-xs max-w-[200px] leading-relaxed">请选择长者并开始筛查/游戏，系统将开启脑电及心电变异监测。</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <IndicatorCard
                      icon={Brain}
                      label="脑电中枢负荷 (EEG)"
                      value={(liveMetrics.eeg_load * 100).toFixed(0) + '%'}
                      sub={`P300: ${liveMetrics.eeg_load > 0.6 ? '延迟脑波' : '正常激发'}`}
                      status={connectionState === 'connected' ? 'active' : 'disconnected'}
                    />
                    
                    <IndicatorCard
                      icon={Heart}
                      label="心率变异应激 (HRV)"
                      value={Math.round(liveMetrics.hrv_rmssd) + ' ms'}
                      sub={`弹性: ${liveMetrics.hrv_rmssd < 30.0 ? '心脑负荷过高' : '活力状态良好'}`}
                      status={connectionState === 'connected' ? 'active' : 'disconnected'}
                    />

                    <IndicatorCard
                      icon={Activity}
                      label="血氧饱和度 (SpO2)"
                      value={(liveMetrics.spo2 * 100).toFixed(1) + '%'}
                      sub={liveMetrics.spo2 < 0.95 ? '偏低请注意吸氧' : '供氧饱和正常'}
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

              {(sopStep > 0 || gameMode !== null) && (
                <div className="border-t border-[var(--color-border-theme)] pt-4 mt-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    时序流高精锁频 (32Hz)
                  </span>
                  <span>采样差 &lt; 1ms</span>
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
                  className="btn-elderly bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white border-none"
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
