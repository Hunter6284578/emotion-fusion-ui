/** 页面1 - 诊断工作台 Dashboard
 *  核心功能: VA空间可视化 + 四模态输入 + 融合结果展示
 */
import { useState, useCallback } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, Cell,
} from 'recharts'
import {
  Brain, Mic, Camera, Heart, Send, Pause,
  AlertTriangle, CheckCircle2, Info, RefreshCw,
} from 'lucide-react'
import type { ModalityResult, FusionResult, VAPoint } from '../types'
import { EMOTION_CONFIG } from '../types'
import { analyzeEmotion } from '../api'

const VA_QUADRANTS = [
  { x: [0.5, 1], y: [0.5, 1], fill: 'rgba(34,197,94,0.06)', label: '快乐', labelPos: [0.85, 0.9] },
  { x: [0, 0.5], y: [0.5, 1], fill: 'rgba(239,68,68,0.06)', label: '恐惧/愤怒', labelPos: [0.15, 0.9] },
  { x: [0, 0.5], y: [0, 0.5], fill: 'rgba(99,102,241,0.06)', label: '悲伤', labelPos: [0.15, 0.12] },
  { x: [0.5, 1], y: [0, 0.5], fill: 'rgba(59,130,246,0.06)', label: '平静', labelPos: [0.85, 0.12] },
]

const QUICK_PHRASES = ['今天感觉不错', '有些焦虑', '没什么精神', '心情很糟糕', '还好，和平时一样']

function VASpace({ currentPoint, history }: { currentPoint: VAPoint | null; history: VAPoint[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-600 mb-3">VA 情绪空间</h3>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" dataKey="valence" name="Valence" domain={[0, 1]}
            label={{ value: '愉悦度 →', position: 'bottom', style: { fontSize: 11, fill: '#64748b' } }}
            tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey="arousal" name="Arousal" domain={[0, 1]}
            label={{ value: '↑ 唤醒度', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
            tick={{ fontSize: 10 }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as VAPoint
              const cfg = EMOTION_CONFIG[d.emotion] || EMOTION_CONFIG['unknown']
              return (
                <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-xs">
                  <p className="font-semibold" style={{ color: cfg.color }}>{d.emotion}</p>
                  <p>V: {d.valence.toFixed(2)} &nbsp; A: {d.arousal.toFixed(2)}</p>
                  <p className="text-slate-400">{d.timestamp}</p>
                </div>
              )
            }}
          />
          {/* Quadrant backgrounds */}
          {VA_QUADRANTS.map((q, i) => (
            <ReferenceArea key={i} x1={q.x[0]} x2={q.x[1]} y1={q.y[0]} y2={q.y[1]}
              fill={q.fill} stroke="none" />
          ))}
          {/* History trajectory */}
          {history.length > 1 && (
            <Scatter name="历史" data={history.slice(0, -1)} line={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 4' }}
              lineType="fitting" shape="circle">
              {history.slice(0, -1).map((_, i) => (
                <Cell key={i} fill="#cbd5e1" opacity={0.4 + (i / history.length) * 0.4}
                  r={3 + (i / history.length) * 2} />
              ))}
            </Scatter>
          )}
          {/* Current point */}
          {currentPoint && (
            <Scatter name="当前" data={[currentPoint]}>
              <Cell r={10} fill={(EMOTION_CONFIG[currentPoint.emotion] || EMOTION_CONFIG['unknown']).color}
                stroke="#fff" strokeWidth={2} />
            </Scatter>
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ModalityInputCard({
  modality: _m, icon: Icon, title, children
}: { modality: string; icon: React.ComponentType<{ size?: number; className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center gap-2">
        <Icon size={18} className="text-sky-500" />
        <span className="font-medium text-sm text-slate-700">{title}</span>
      </div>
      <div className="flex-1 p-4 flex items-center justify-center min-h-[140px]">
        {children}
      </div>
    </div>
  )
}

export default function Dashboard() {
  // State
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

  // Handle face image upload
  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFaceImage(file)
      setFacePreview(URL.createObjectURL(file))
    }
  }

  // Handle ECG file upload
  const handleEcgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setEcgFile(file)
    }
  }

  // Real API analysis
  const runAnalysis = useCallback(async () => {
    setIsLoading(true)
    setWarnings([])

    try {
      const formData = new FormData()
      if (textInput.trim()) {
        formData.append('text', textInput.trim())
      }

      // 如果有上传的人脸图片
      if (faceImage) {
        formData.append('face_file', faceImage)
      }

      // 如果有上传的ECG文件
      if (ecgFile) {
        formData.append('ecg_csv_file', ecgFile)
      }

      // 调用真实后端 API
      const result = await analyzeEmotion(formData)

      // 处理 API 返回的结果
      const fusionResult: FusionResult = {
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

      setFusionResult(fusionResult)
      setModalityResults(fusionResult.modality_table || [])

      // 处理警告
      if (fusionResult.warnings?.length) {
        setWarnings(fusionResult.warnings)
      }

      // Add to VA history
      if (fusionResult.valence !== null && fusionResult.arousal !== null) {
        const newPoint: VAPoint = {
          valence: fusionResult.valence,
          arousal: fusionResult.arousal,
          emotion: fusionResult.final_emotion,
          timestamp: new Date().toLocaleTimeString('zh-CN'),
          confidence: fusionResult.confidence,
        }
        setVaHistory(prev => [...prev.slice(-9), newPoint])
      }
    } catch (err) {
      setWarnings([`后端连接失败: ${err instanceof Error ? err.message : '未知错误'}`])
    } finally {
      setIsLoading(false)
    }
  }, [textInput, faceImage, ecgFile])

  const emotionCfg = fusionResult ? EMOTION_CONFIG[fusionResult.final_emotion] || EMOTION_CONFIG['unknown'] : null

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Top bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain size={28} className="text-sky-500" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">情绪识别系统</h1>
            <p className="text-xs text-slate-400">多模态情绪分析工作台 v2.0</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium">在线</span>
          <span>医生模式</span>
        </div>
      </header>

      {/* VA Space */}
      <VASpace currentPoint={
        fusionResult?.available ? {
          valence: fusionResult.valence!, arousal: fusionResult.arousal!,
          emotion: fusionResult.final_emotion, timestamp: new Date().toLocaleTimeString('zh-CN'),
          confidence: fusionResult.confidence,
        } : null
      } history={vaHistory} />

      {/* Four modality input cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Text */}
        <ModalityInputCard modality="text" icon={Send} title="文本输入">
          <div className="w-full space-y-2">
            <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
              placeholder="描述一下您今天的感受..."
              className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 outline-none resize-none"
            />
            <div className="text-xs text-slate-400">{textInput.length} 字</div>
            <div className="flex flex-wrap gap-1">
              {QUICK_PHRASES.map(p => (
                <button key={p} onClick={() => setTextInput(p)}
                  className="px-2 py-0.5 text-xs bg-slate-100 hover:bg-sky-100 hover:text-sky-700 rounded transition-colors">
                  {p}
                </button>
              ))}
            </div>
          </div>
        </ModalityInputCard>

        {/* Speech */}
        <ModalityInputCard modality="speech" icon={Mic} title="语音输入">
          <button onClick={() => setIsRecording(!isRecording)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-sky-100'
            }`}>
            {isRecording ? <Pause size={26} /> : <Mic size={26} />}
          </button>
          {isRecording && (
            <div className="mt-2 text-xs text-red-500 font-mono">● 录音中...</div>
          )}
        </ModalityInputCard>

        {/* Face */}
        <ModalityInputCard modality="face" icon={Camera} title="人脸识别">
          <div className="text-center space-y-2">
            {facePreview ? (
              <img src={facePreview} alt="人脸预览" className="w-32 h-24 object-cover rounded-lg border border-slate-200" />
            ) : (
              <div className="w-32 h-24 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                <Camera size={28} className="text-slate-300" />
              </div>
            )}
            <label className="px-3 py-1.5 bg-sky-50 text-sky-600 rounded-md hover:bg-sky-100 transition-colors cursor-pointer text-xs inline-block">
              上传图片
              <input type="file" accept="image/*" onChange={handleFaceUpload} className="hidden" />
            </label>
            {faceImage && (
              <button onClick={() => { setFaceImage(null); setFacePreview(null) }}
                className="px-2 py-1 text-xs text-red-500 hover:text-red-700">
                移除
              </button>
            )}
          </div>
        </ModalityInputCard>

        {/* ECG */}
        <ModalityInputCard modality="ecg" icon={Heart} title="ECG/HRV">
          <div className="w-full space-y-2">
            <label className="block w-full cursor-pointer">
              <input type="file" accept=".csv" onChange={handleEcgUpload} className="hidden" />
              <div className={`px-3 py-2 text-xs rounded-lg border text-center transition-colors ${
                ecgFile ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
              }`}>
                {ecgFile ? `已选择: ${ecgFile.name}` : '上传 ECG CSV 文件'}
              </div>
            </label>
            {ecgFile && (
              <button onClick={() => setEcgFile(null)}
                className="w-full px-2 py-1 text-xs text-red-500 hover:text-red-700">
                移除文件
              </button>
            )}
          </div>
        </ModalityInputCard>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button onClick={runAnalysis} disabled={isLoading}
          className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-lg font-medium
            hover:from-sky-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed
            shadow-sm hover:shadow transition-all flex items-center gap-2">
          {isLoading ? (
            <>
              <RefreshCw size={16} className="animate-spin" /> 分析中...
            </>
          ) : ('开始融合分析')}
        </button>
        <button onClick={() => {
            setFusionResult(null); setModalityResults([]); setWarnings([]);
            setFaceImage(null); setFacePreview(null); setEcgFile(null);
          }}
          className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium
            hover:bg-slate-50 transition-colors">
          重置
        </button>
      </div>

      {/* Warnings banner */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <ul className="list-disc list-inside space-y-0.5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Fusion results */}
      {fusionResult?.available && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Main result cards */}
          <div className="grid grid-cols-4 gap-4">
            {/* Emotion display */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold mb-1" style={{ color: emotionCfg?.color }}>
                {fusionResult.final_emotion}
              </div>
              <div className="text-xs text-slate-400">综合判定结果</div>
            </div>

            {/* Valence */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-400 mb-1">Valence (愉悦度)</div>
              <div className="text-2xl font-bold text-slate-800">{fusionResult.valence?.toFixed(2)}</div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(fusionResult.valence || 0) * 100}%`,
                    background: `linear-gradient(to right, #ef4444, #eab308, #22c55e)` }} />
              </div>
            </div>

            {/* Arousal */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="text-xs text-slate-400 mb-1">Arousal (唤醒度)</div>
              <div className="text-2xl font-bold text-slate-800">{fusionResult.arousal?.toFixed(2)}</div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-400 to-orange-400"
                  style={{ width: `${(fusionResult.arousal || 0) * 100}%` }} />
              </div>
            </div>

            {/* Confidence ring */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke={fusionResult.confidence > 0.7 ? '#22c55e' : fusionResult.confidence > 0.45 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3" strokeDasharray={`${fusionResult.confidence * 100}, 100`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-slate-700">{Math.round(fusionResult.confidence * 100)}%</span>
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-1">置信度</div>
            </div>
          </div>

          {/* Evidence table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">模态</th>
                  <th className="px-4 py-2 font-medium">情绪</th>
                  <th className="px-4 py-2 font-medium">Valence</th>
                  <th className="px-4 py-2 font-medium">Arousal</th>
                  <th className="px-4 py-2 font-medium">置信度</th>
                  <th className="px-4 py-2 font-medium">质量</th>
                </tr>
              </thead>
              <tbody>
                {modalityResults.map((r, i) => (
                  <tr key={i} className={`border-t border-slate-100 ${r.available ? '' : 'opacity-40'}`}>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                        r.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.available ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                        {{text:'文本', speech:'语音', face:'人脸', ecg:'ECG'}[r.modality]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{r.emotion || '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.valence !== null ? r.valence.toFixed(2) : '-'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.arousal !== null ? r.arousal.toFixed(2) : '-'}</td>
                    <td className="px-4 py-2.5">{r.confidence > 0 ? `${(r.confidence*100).toFixed(0)}%` : '-'}</td>
                    <td className="px-4 py-2.5">{r.quality > 0 ? r.quality.toFixed(2) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-slate-200 text-sm">
              <Info size={16} className="text-sky-500" />
              <span className="text-slate-500">不确定度:</span>
              <span className={`font-semibold ${
                fusionResult.uncertainty_level === 'low' ? 'text-emerald-600' :
                fusionResult.uncertainty_level === 'medium' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {fusionResult.uncertainty_level.toUpperCase()} ({(fusionResult.uncertainty_score * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-slate-200 text-sm">
              <CheckCircle2 size={16} className="text-sky-500" />
              <span className="text-slate-500">融合模式:</span>
              <span className="font-semibold text-slate-700">{fusionResult.fusion_mode}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-slate-200 text-sm text-slate-600">
              💡 <span>{fusionResult.suggestion}</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no analysis done yet */}
      {!fusionResult && !isLoading && (
        <div className="text-center py-16 text-slate-400">
          <Brain size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">输入任意模态数据后点击"开始融合分析"</p>
        </div>
      )}
    </div>
  )
}
