import { useState, forwardRef, useImperativeHandle } from 'react'
import { FileText } from 'lucide-react'

const QUICK_PHRASES = ['今天感觉不错', '有些焦虑', '没什么精神', '心情很糟糕', '还好，和平时一样', '患者表现出防御性', '回避关键问题']

export interface ClinicalNoteEditorRef {
  getText: () => string;
  clear: () => void;
}

const ClinicalNoteEditor = forwardRef<ClinicalNoteEditorRef>((_, ref) => {
  const [text, setText] = useState('')

  useImperativeHandle(ref, () => ({
    getText: () => text,
    clear: () => setText('')
  }))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-1 flex flex-col min-h-[300px]">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-teal-500" />
        <h3 className="text-[13px] font-bold text-slate-700">临床笔记与主诉记录</h3>
      </div>
      <textarea 
        value={text} 
        onChange={e => setText(e.target.value)}
        placeholder="在此记录患者的主诉内容与您的临床观察。此处的输入独立于监控系统，保证流畅无卡顿..."
        className="flex-1 w-full p-4 text-[13px] rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-all leading-relaxed bg-slate-50/50 focus:bg-white"
      />
      <div className="mt-4 flex flex-wrap gap-1.5">
        {QUICK_PHRASES.map(p => (
          <button key={p} onClick={() => setText(prev => prev + (prev ? '，' : '') + p)}
            className="px-2.5 py-1 text-[11px] bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors border border-slate-100">
            {p}
          </button>
        ))}
      </div>
    </div>
  )
})

export default ClinicalNoteEditor
