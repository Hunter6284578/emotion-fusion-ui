import { useState, forwardRef, useImperativeHandle, useMemo } from 'react'
import {
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, ReferenceDot, AreaChart, Area
} from 'recharts'
import { Activity, AlertTriangle, FileText } from 'lucide-react'
import type { VideoStreamResult, MicroExpressionEvent, EmotionLabel } from '../types'
import { EMOTION_CONFIG } from '../types'

export interface QuietMonitorPanelRef {
  appendStreamResult: (result: VideoStreamResult) => void;
  setStaticFusionResult: (result: any) => void;
  clear: () => void;
}

export interface MergedTimelinePoint {
  timestamp: number;     // unix timestamp
  displayTime: string;   // HH:mm:ss
  valence: number;
  arousal: number;
  emotion: EmotionLabel;
  microExpression?: MicroExpressionEvent; // the most intense ME at this point if any
}

const QuietMonitorPanel = forwardRef<QuietMonitorPanelRef>((_, ref) => {
  // We keep timeline data in local state so only this panel re-renders when data arrives
  const [timeline, setTimeline] = useState<MergedTimelinePoint[]>([])
  const [staticResult, setStaticResult] = useState<any | null>(null)
  
  useImperativeHandle(ref, () => ({
    appendStreamResult: (result: VideoStreamResult) => {
      setTimeline(prev => {
        // Construct new points
        const newPoint: MergedTimelinePoint = {
          timestamp: result.start_timestamp,
          displayTime: new Date(result.start_timestamp).toLocaleTimeString('zh-CN', { hour12: false }),
          valence: result.valence_mean || 0,
          arousal: result.arousal_mean || 0,
          emotion: (result.final_emotion as EmotionLabel) || 'unknown',
        }
        
        // Find if there's a micro-expression in this window
        if (result.micro_expression_events?.length > 0) {
          // Sort by intensity and pick the top one to show as a hover dot
          const topME = [...result.micro_expression_events].sort((a, b) => b.peak_intensity - a.peak_intensity)[0]
          newPoint.microExpression = topME
        }

        const newTimeline = [...prev, newPoint]
        // Resolve out-of-order execution by sorting
        newTimeline.sort((a, b) => a.timestamp - b.timestamp)
        
        // Keep last 60 points (approx 1.5 minutes if 1.5s slice)
        return newTimeline.slice(-60)
      })
    },
    setStaticFusionResult: (res: any) => {
      setStaticResult(res)
    },
    clear: () => {
      setTimeline([])
      setStaticResult(null)
    }
  }))

  const latestPoint = timeline[timeline.length - 1]
  const currentEmotionCfg = latestPoint 
    ? (EMOTION_CONFIG[latestPoint.emotion] || EMOTION_CONFIG['unknown'])
    : null

  // Collect points with micro-expressions for ReferenceDots
  const mePoints = useMemo(() => {
    return timeline.filter(p => p.microExpression)
  }, [timeline])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-teal-500" />
          <h3 className="text-[13px] font-bold text-slate-700">实时情绪微波监控</h3>
        </div>
        
        {/* Soft breathing indicator instead of jumping text */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">系统感知状态</span>
          <div 
            className="w-2.5 h-2.5 rounded-full shadow-sm transition-colors duration-1000" 
            style={{ 
              backgroundColor: currentEmotionCfg?.color || '#e2e8f0',
              boxShadow: currentEmotionCfg ? `0 0 8px ${currentEmotionCfg.color}80` : 'none'
            }}
          />
        </div>
      </div>

      {!latestPoint && !staticResult ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
          <FileText size={48} className="mb-4 opacity-30" />
          <p className="text-[13px] font-medium">暂无监控数据</p>
          <p className="text-[11px] mt-1">在左侧开启录制后，此区域将以静默方式绘制分析折线</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-5">
          {/* V/A Smooth Line Chart */}
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="colorValence" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorArousal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="displayTime" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as MergedTimelinePoint
                    return (
                      <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-3 py-2 shadow-xl">
                        <div className="text-[11px] font-bold text-slate-700 mb-1">{d.displayTime}</div>
                        <div className="text-[10px] text-blue-600">V: {d.valence.toFixed(2)}</div>
                        <div className="text-[10px] text-amber-600">A: {d.arousal.toFixed(2)}</div>
                        {d.microExpression && (
                          <div className="mt-2 pt-2 border-t border-slate-100 max-w-[150px]">
                            <div className="text-[10px] font-bold text-red-500 mb-0.5 flex items-center gap-1">
                              <AlertTriangle size={10} /> 微表情闪现
                            </div>
                            <div className="text-[10px] text-slate-600 leading-tight">
                              检测到高强度动作单元: {d.microExpression.trigger_aus.join(', ')} 
                              (情绪倾向: {d.microExpression.emotion})
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                
                {/* Smooth areas instead of jagged lines */}
                <Area type="monotone" dataKey="valence" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorValence)" activeDot={{ r: 4 }} animationDuration={300} />
                <Area type="monotone" dataKey="arousal" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorArousal)" activeDot={{ r: 4 }} animationDuration={300} />
                
                {/* Micro-expression Hover Dots */}
                {mePoints.map((p, i) => (
                  <ReferenceDot 
                    key={`me-${i}`}
                    x={p.displayTime} 
                    y={p.arousal} 
                    r={3} 
                    fill="#ef4444" 
                    stroke="#fff" 
                    strokeWidth={1}
                    className="animate-pulse"
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Current Static Indicators */}
          {latestPoint && (
            <div className="grid grid-cols-2 gap-3 mt-auto">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] text-slate-400 mb-1">平滑愉悦度 (Valence)</div>
                <div className="text-[16px] font-bold text-blue-600">{latestPoint.valence.toFixed(2)}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] text-slate-400 mb-1">平滑唤醒度 (Arousal)</div>
                <div className="text-[16px] font-bold text-amber-500">{latestPoint.arousal.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default QuietMonitorPanel
