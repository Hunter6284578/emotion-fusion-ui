import { useRef, useCallback, useState } from 'react'
import { Stethoscope, User as UserIcon, CheckCircle, RefreshCw } from 'lucide-react'
import type { VideoStreamResult } from '../types'
import { analyzeEmotion } from '../api'

import ClinicalNoteEditor from '../components/ClinicalNoteEditor'
import type { ClinicalNoteEditorRef } from '../components/ClinicalNoteEditor'
import CameraStreamEngine from '../components/CameraStreamEngine'
import QuietMonitorPanel from '../components/QuietMonitorPanel'
import type { QuietMonitorPanelRef } from '../components/QuietMonitorPanel'

export default function Dashboard() {
  const noteEditorRef = useRef<ClinicalNoteEditorRef>(null)
  const monitorPanelRef = useRef<QuietMonitorPanelRef>(null)
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [ecgFile, setEcgFile] = useState<File | null>(null)

  // 接收到摄像头的每 1.5s 的切片结果
  const handleVideoStreamResult = useCallback((result: VideoStreamResult) => {
    // 强制发送给右侧监控面板（直接调用实例方法，避免 Dashboard 重新渲染）
    monitorPanelRef.current?.appendStreamResult(result)
  }, [])

  // 手动触发一个全局结算分析
  const handleFinalReport = async () => {
    setIsGenerating(true)
    try {
      const text = noteEditorRef.current?.getText() || ''
      const formData = new FormData()
      if (text.trim()) formData.append('text', text.trim())
      if (ecgFile) formData.append('ecg_csv_file', ecgFile)
      
      // 在这里可以传更多的最终汇总数据
      const result = await analyzeEmotion(formData)
      monitorPanelRef.current?.setStaticFusionResult(result)
    } catch (err) {
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#F3F6F8]">
      <header className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <Stethoscope size={24} className="text-blue-600" />
          <h2 className="text-[17px] font-bold text-slate-800">临床心理诊断工作台</h2>
          <span className="px-2.5 py-1 bg-teal-50 text-teal-600 rounded-full text-[11px] font-bold ml-2">专注模式</span>
        </div>
        <button 
          onClick={handleFinalReport}
          disabled={isGenerating}
          className="px-5 py-2 bg-blue-600 text-white rounded-xl text-[13px] font-bold hover:bg-blue-700 shadow-sm shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {isGenerating ? <><RefreshCw size={14} className="animate-spin" /> 生成中...</> : <><CheckCircle size={14} /> 生成本次会话诊断单</>}
        </button>
      </header>

      <div className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-12 gap-6 h-full">
          
          {/* 左栏：辅助与静默监控 */}
          <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <UserIcon size={24} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-800">匿名来访者</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">首次心理评估</p>
                </div>
              </div>
            </div>

            {/* 高频摄像头采集引擎（完全隔离状态） */}
            <CameraStreamEngine onAnalysisResult={handleVideoStreamResult} />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h4 className="text-[12px] font-bold text-slate-700 mb-3">辅助生理设备 (可选)</h4>
              <label className="block cursor-pointer">
                <input type="file" accept=".csv" onChange={e => setEcgFile(e.target.files?.[0] || null)} className="hidden" />
                <div className={`w-full px-4 py-3 text-[12px] rounded-xl border text-center transition-colors font-medium ${
                  ecgFile ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}>
                  {ecgFile ? `已加载: ${ecgFile.name}` : '上传 ECG 心电 CSV'}
                </div>
              </label>
            </div>
          </div>

          {/* 中栏：大屏沉浸式打字 */}
          <div className="col-span-5 flex flex-col h-full overflow-hidden">
            <ClinicalNoteEditor ref={noteEditorRef} />
          </div>

          {/* 右栏：纯净监控与报告图表 */}
          <div className="col-span-4 flex flex-col h-full overflow-hidden">
            <QuietMonitorPanel ref={monitorPanelRef} />
          </div>

        </div>
      </div>
    </div>
  )
}
