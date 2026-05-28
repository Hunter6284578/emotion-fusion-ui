/** 页面1 - 诊断工作台 Dashboard (Clean Medical Minimalist v3.0)
 *  核心功能: VA空间可视化 + 四模态输入 + 融合结果展示
 *  布局: 三栏式结构化医疗工作台
 */
import { useState, useCallback } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceArea, Cell,
} from 'recharts'
import {
  Brain, Mic, Camera, Heart, Pause,
  AlertTriangle, Info, RefreshCw, FileText, User as UserIcon, Activity, Stethoscope
} from 'lucide-react'
import type { ModalityResult, FusionResult, VAPoint, EmotionLabel } from '../types'
import { EMOTION_CONFIG } from '../types'
import { analyzeEmotion } from '../api'

const VA_QUADRANTS = [
  { x: [0.5, 1], y: [0.5, 1], fill: 'rgba(34,197,94,0.06)', label: '快乐' },
  { x: [0, 0.5], y: [0.5, 1], fill: 'rgba(239,68,68,0.06)', label: '恐惧/愤怒' },
  { x: [0, 0.5], y: [0, 0.5], fill: 'rgba(99,102,241,0.06)', label: '悲伤' },
  { x: [0.5, 1], y: [0, 0.5], fill: 'rgba(59,130,246,0.06)', label: '平静' },
]

const QUICK_PHRASES = ['今天感觉不错', '有些焦虑', '没什么精神', '心情很糟糕', '还好，和平时一样']

function VASpace({ currentPoint, history }: { currentPoint: VAPoint | null; history: VAPoint[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-teal-500" />
        <h3 className="text-[13px] font-bold text-slate-700">VA 情绪空间</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" dataKey="valence" name="Valence" domain={[0, 1]}
            tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
          <YAxis type="number" dataKey="arousal" name="Arousal" domain={[0, 1]}
            tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
          <RechartsTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as VAPoint
              const cfg = EMOTION_CONFIG[d.emotion] || EMOTION_CONFIG['unknown']
              return (
                <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-3 py-2 shadow-xl text-[11px]">
                  <p className="font-bold mb-1" style={{ color: cfg.color }}>{d.emotion}</p>
                  <p className="text-slate-500">V: {d.valence.toFixed(2)} &nbsp; A: {d.arousal.toFixed(2)}</p>
                  <p className="text-slate-400 mt-1 text-[10px]">{d.timestamp}</p>
                </div>
              )
            }}
          />
          {VA_QUADRANTS.map((q, i) => (
            <ReferenceArea key={i} x1={q.x[0]} x2={q.x[1]} y1={q.y[0]} y2={q.y[1]}
              fill={q.fill} stroke="none" />
          ))}
          {history.length > 1 && (
            <Scatter name="历史" data={history.slice(0, -1)} line={{ stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '4 4' }}
              lineType="fitting" shape="circle">
              {history.slice(0, -1).map((_, i) => (
                <Cell key={i} fill="#94a3b8" opacity={0.3 + (i / history.length) * 0.4}
                  r={2 + (i / history.length) * 2} />
              ))}
            </Scatter>
          )}
          {currentPoint && (
            <Scatter name="当前" data={[currentPoint]}>
              <Cell r={8} fill={(EMOTION_CONFIG[currentPoint.emotion] || EMOTION_CONFIG['unknown']).color}
                stroke="#fff" strokeWidth={2} />
            </Scatter>
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function Dashboard() {
  const [textInput, setTextInput] = useState('')
  const [faceImage, setFaceImage] = useState<File | null>(null)
  const [facePreview, setFacePreview] = useState<string | null>(null)
  const [ecgFile, setEcgFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [fusionResult, setFusionResult] = useState<FusionResult | null>(null)
  const [modalityResults, setModalityResults] = useState<ModalityResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [vaHistory, setVaHistory] = useState<VAPoint[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFaceImage(file)
      setFacePreview(URL.createObjectURL(file))
    }
  }

  const handleEcgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setEcgFile(file)
    }
  }

  const runAnalysis = useCallback(async () => {
    setIsLoading(true)
    setWarnings([])

    try {
      const formData = new FormData()
      if (textInput.trim()) formData.append('text', textInput.trim())
      if (faceImage) formData.append('face_file', faceImage)
      if (ecgFile) formData.append('ecg_csv_file', ecgFile)

      const result = await analyzeEmotion(formData)

      const formattedResult: FusionResult = {
        available: result.available as boolean,
        final_emotion: result.final_emotion as FusionResult['final_emotion'] || 'unknown',
        valence: typeof result.valence === 'number' ? result.valence : null,
        arousal: typeof result.arousal === 'number' ? result.arousal : null,
        confidence: typeof result.confidence === 'number' ? result.confidence : 0,
        quality: typeof result.quality === 'number' ? result.quality : undefined,
        uncertainty_level: (result.uncertainty_level as 'low' | 'medium' | 'high') || 'high',
        uncertainty_score: typeof result.uncertainty_score === 'number' ? result.uncertainty_score
          : typeof (result as unknown as Record<string, unknown>).score === 'number' ? (result as unknown as Record<string, unknown>).score as number : 0.5,
        fusion_mode: (result.fusion_mode as string) || 'adaptive_v2',
        suggestion: (result.suggestion as string) || '',
        warnings: (result.warnings as string[]) || [],
        modality_table: (result.modality_table as ModalityResult[]) || null,
        explanation: result.explanation as string,
      }

      setFusionResult(formattedResult)
      setModalityResults(formattedResult.modality_table || [])
      if (formattedResult.warnings?.length) setWarnings(formattedResult.warnings)

      if (formattedResult.valence !== null && formattedResult.arousal !== null) {
        const newPoint: VAPoint = {
          valence: formattedResult.valence,
          arousal: formattedResult.arousal,
          emotion: formattedResult.final_emotion,
          timestamp: new Date().toLocaleTimeString('zh-CN'),
          confidence: formattedResult.confidence,
        }
        setVaHistory(prev => [...prev.slice(-9), newPoint])
      }
    } catch (err) {
      setWarnings([`分析失败: ${err instanceof Error ? err.message : '未知错误'}`])
    } finally {
      setIsLoading(false)
    }
  }, [textInput, faceImage, ecgFile])

  const emotionCfg = fusionResult ? EMOTION_CONFIG[fusionResult.final_emotion] || EMOTION_CONFIG['unknown'] : null

  return (
    <div className="h-full flex flex-col bg-[#F3F6F8]">
      {/* 顶部简易信息栏 */}
      <header className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <Stethoscope size={24} className="text-blue-600" />
          <h2 className="text-[17px] font-bold text-slate-800">当前诊断会话</h2>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-[11px] font-medium ml-2">Session #8921</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            setFusionResult(null); setModalityResults([]); setWarnings([]);
            setFaceImage(null); setFacePreview(null); setEcgFile(null); setTextInput('');
          }} className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[13px] font-medium hover:bg-slate-50 transition-colors">
            结束并清空
          </button>
        </div>
      </header>

      {/* 主体三栏布局 */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-12 gap-6 h-full">
          
          {/* ===================== 左侧栏: 患者信息与问询 ===================== */}
          <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* 模拟患者卡片 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <UserIcon size={24} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800">张医生</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">心理科 主治医师</p>
                  <div className="mt-3 flex gap-2 text-[11px] text-slate-400">
                    <span className="px-2 py-1 bg-slate-50 rounded-md">时长 14:02</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 文本问询录入 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-teal-500" />
                <h3 className="text-[13px] font-bold text-slate-700">主诉与文本记录</h3>
              </div>
              <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                placeholder="记录患者的主诉内容..."
                className="flex-1 w-full p-3 text-[13px] rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-all"
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {QUICK_PHRASES.map(p => (
                  <button key={p} onClick={() => setTextInput(p)}
                    className="px-2.5 py-1 text-[11px] bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors border border-slate-100">
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 全局建议 */}
            {fusionResult?.suggestion && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-[13px] mb-1">
                  <Info size={16} /> 医疗辅助建议
                </div>
                <p className="text-[12px] text-blue-800 leading-relaxed mt-2">
                  {fusionResult.suggestion}
                </p>
              </div>
            )}
          </div>

          {/* ===================== 中侧栏: 核心采集与分析操作 ===================== */}
          <div className="col-span-5 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* 视觉采集 (人脸) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col items-center justify-center min-h-[220px] relative">
              <div className="absolute top-4 left-5 flex items-center gap-2 text-[13px] font-bold text-slate-700">
                <Camera size={16} className="text-teal-500" /> 视觉表情捕捉
              </div>
              <div className="mt-6 w-full flex flex-col items-center">
                {facePreview ? (
                  <div className="relative group">
                    <img src={facePreview} alt="人脸预览" className="w-48 h-36 object-cover rounded-xl border border-slate-200 shadow-sm" />
                    <button onClick={() => { setFaceImage(null); setFacePreview(null) }}
                      className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity text-[13px] font-medium">
                      移除图片
                    </button>
                  </div>
                ) : (
                  <label className="w-48 h-36 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all">
                    <Camera size={28} className="text-slate-300 mb-2" />
                    <span className="text-[12px] text-slate-500 font-medium">点击上传患者图像</span>
                    <input type="file" accept="image/*" onChange={handleFaceUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* 语音采集 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col items-center justify-center min-h-[160px] relative">
              <div className="absolute top-4 left-5 flex items-center gap-2 text-[13px] font-bold text-slate-700">
                <Mic size={16} className="text-teal-500" /> 语音声学分析
              </div>
              <button onClick={() => setIsRecording(!isRecording)}
                className={`mt-4 w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-sm border ${
                  isRecording 
                    ? 'bg-red-500 text-white border-red-500 animate-pulse-ring' 
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200'
                }`}>
                {isRecording ? <Pause size={24} /> : <Mic size={24} />}
              </button>
              <div className="mt-3 text-[12px] font-medium h-4">
                {isRecording ? <span className="text-red-500">正在录音...</span> : <span className="text-slate-400">点击麦克风采集语音</span>}
              </div>
            </div>

            {/* ECG 采集 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col min-h-[120px] relative">
              <div className="flex items-center gap-2 text-[13px] font-bold text-slate-700 mb-4">
                <Heart size={16} className="text-teal-500" /> 生理信号 (ECG/HRV)
              </div>
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept=".csv" onChange={handleEcgUpload} className="hidden" />
                  <div className={`w-full px-4 py-3 text-[12px] rounded-xl border text-center transition-colors font-medium ${
                    ecgFile ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-500'
                  }`}>
                    {ecgFile ? `已加载: ${ecgFile.name}` : '上传设备导出的 CSV'}
                  </div>
                </label>
                {ecgFile && (
                  <button onClick={() => setEcgFile(null)}
                    className="px-4 py-3 text-[12px] font-medium text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                    移除
                  </button>
                )}
              </div>
            </div>

            {/* 触发分析按钮 */}
            <button onClick={runAnalysis} disabled={isLoading}
              className="mt-auto w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-[15px]
                hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
              {isLoading ? (
                <><RefreshCw size={18} className="animate-spin" /> 数据融合分析中...</>
              ) : (
                <><Brain size={18} /> 执行多模态融合诊断</>
              )}
            </button>
          </div>

          {/* ===================== 右侧栏: 分析报告单 ===================== */}
          <div className="col-span-4 flex flex-col gap-4 overflow-y-auto pr-1 pb-4">
            {/* 预警信息 */}
            {warnings.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-[12px] text-red-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <ul className="list-disc list-inside space-y-1">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {!fusionResult && !isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-white/50 border border-dashed border-slate-200 rounded-2xl">
                <FileText size={48} className="mb-4 opacity-50" />
                <p className="text-[13px] font-medium">分析报告单将显示在这里</p>
              </div>
            ) : fusionResult && (
              <>
                {/* 核心诊断结果 */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
                  <div className="text-[12px] text-slate-400 font-medium mb-2 uppercase tracking-wider">综合情绪判定</div>
                  <div className="text-5xl font-extrabold mb-1" style={{ color: emotionCfg?.color }}>
                    {fusionResult.final_emotion}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-6 w-full px-4">
                    <div className="flex-1 text-center">
                      <div className="text-[11px] text-slate-400 mb-1">融合可信度</div>
                      <div className="text-[18px] font-bold text-slate-700">{Math.round(fusionResult.confidence * 100)}%</div>
                    </div>
                    <div className="w-px h-8 bg-slate-100"></div>
                    <div className="flex-1 text-center">
                      <div className="text-[11px] text-slate-400 mb-1">不确定性预警</div>
                      <div className={`text-[13px] font-bold mt-1.5 ${
                        fusionResult.uncertainty_level === 'low' ? 'text-teal-500' :
                        fusionResult.uncertainty_level === 'medium' ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {fusionResult.uncertainty_level.toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* V/A 详细指标 */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[11px] text-slate-500 font-medium">Valence (愉悦度)</span>
                      <span className="text-[15px] font-bold text-slate-700">{fusionResult.valence?.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${(fusionResult.valence || 0) * 100}%`,
                          background: `linear-gradient(to right, #ef4444, #eab308, #22c55e)` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[11px] text-slate-500 font-medium">Arousal (唤醒度)</span>
                      <span className="text-[15px] font-bold text-slate-700">{fusionResult.arousal?.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-blue-400 to-orange-400"
                        style={{ width: `${(fusionResult.arousal || 0) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* VA 空间图 */}
                <VASpace currentPoint={{
                    valence: fusionResult.valence!, arousal: fusionResult.arousal!,
                    emotion: fusionResult.final_emotion, timestamp: new Date().toLocaleTimeString('zh-CN'),
                    confidence: fusionResult.confidence,
                }} history={vaHistory} />

                {/* 模态证据表 */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <span className="text-[13px] font-bold text-slate-700">各模态证据链</span>
                    <span className="text-[11px] text-slate-400">Mode: {fusionResult.fusion_mode}</span>
                  </div>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] text-slate-400 border-b border-slate-100 uppercase tracking-wider">
                        <th className="px-4 py-2 font-medium">模态</th>
                        <th className="px-2 py-2 font-medium">预测情绪</th>
                        <th className="px-2 py-2 font-medium text-right">可信度</th>
                      </tr>
                    </thead>
                    <tbody className="text-[12px]">
                      {modalityResults.map((r, i) => (
                        <tr key={i} className={`border-b last:border-0 border-slate-50 ${r.available ? '' : 'opacity-30'}`}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 font-medium text-slate-600">
                              <span className={`w-1.5 h-1.5 rounded-full ${r.available ? 'bg-teal-400' : 'bg-slate-300'}`} />
                              {{text:'文本', speech:'语音', face:'视觉', ecg:'生理'}[r.modality]}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 font-bold" style={{ color: EMOTION_CONFIG[r.emotion as EmotionLabel]?.color || '#94a3b8' }}>
                            {r.emotion || '-'}
                          </td>
                          <td className="px-2 py-2.5 font-mono text-slate-500 text-right">
                            {r.confidence > 0 ? `${(r.confidence*100).toFixed(0)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
