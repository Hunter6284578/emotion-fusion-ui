import { useState, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react'
import {
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, ReferenceDot, AreaChart, Area
} from 'recharts'
import { Activity, AlertTriangle, FileText } from 'lucide-react'
import type { EmotionLabel, MicroExpressionEvent } from '../types'
import { EMOTION_CONFIG } from '../types'

export interface QuietMonitorPanelRef {
  appendFusedPacket: (packet: any) => void;
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
  const [timeline, setTimeline] = useState<MergedTimelinePoint[]>([])
  const [staticResult, setStaticResult] = useState<any | null>(null)
  const [prolfStatus, setProlfStatus] = useState<{ face: string; speech: string; ecg: string }>({
    face: 'disconnected',
    speech: 'disconnected',
    ecg: 'disconnected'
  })
  
  useImperativeHandle(ref, () => ({
    appendFusedPacket: (packet: any) => {
      // 1. Update ProLF status
      if (packet.prolf_status) {
        setProlfStatus(packet.prolf_status)
      } else if (packet.status) {
        setProlfStatus(packet.status)
      }
      
      // If it's a heartbeat, do not add a point to the chart timeline
      if (packet.type === 'heartbeat') {
        return
      }

      // 2. Append new fusion point
      setTimeline(prev => {
        const newPoint: MergedTimelinePoint = {
          timestamp: packet.timestamp,
          displayTime: new Date(packet.timestamp).toLocaleTimeString('zh-CN', { hour12: false }),
          valence: packet.valence,
          arousal: packet.arousal,
          emotion: (packet.emotion as EmotionLabel) || 'unknown',
        }
        
        if (packet.micro_expression_events?.length > 0) {
          const topME = [...packet.micro_expression_events].sort((a, b) => b.duration_ms - a.duration_ms)[0]
          newPoint.microExpression = topME
        }

        const newTimeline = [...prev, newPoint]
        newTimeline.sort((a, b) => a.timestamp - b.timestamp)
        
        // Keep last 60 points (~1.5 minutes)
        return newTimeline.slice(-60)
      })
    },
    setStaticFusionResult: (res: any) => {
      setStaticResult(res)
    },
    clear: () => {
      setTimeline([])
      setStaticResult(null)
      setProlfStatus({ face: 'disconnected', speech: 'disconnected', ecg: 'disconnected' })
    }
  }))

  const latestPoint = timeline[timeline.length - 1]
  const currentEmotionCfg = latestPoint 
    ? (EMOTION_CONFIG[latestPoint.emotion] || EMOTION_CONFIG['unknown'])
    : null

  const mePoints = useMemo(() => {
    return timeline.filter(p => p.microExpression)
  }, [timeline])

  const renderStatusPill = useCallback((name: string, status: string) => {
    let bgClass = 'bg-slate-100 text-slate-500 border-slate-200'
    let dotClass = 'bg-slate-400'
    let label = 'Disconnected'

    if (status === 'active') {
      bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      dotClass = 'bg-emerald-500'
      label = 'Active'
    } else if (status === 'phantom') {
      bgClass = 'bg-amber-50 text-amber-700 border-amber-200'
      dotClass = 'bg-amber-500'
      label = 'Phantom'
    }

    return (
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-all ${bgClass}`}>
        <span className="relative flex h-1.5 w-1.5">
          {status === 'active' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          {status === 'phantom' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotClass}`}></span>
        </span>
        <span>{name}: {label}</span>
      </div>
    )
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col h-full">
      {/* Header with ProLF state indicator */}
      <div className="flex flex-col gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-teal-500 animate-pulse" />
            <h3 className="text-[13px] font-bold text-slate-700">实时端到端融合监控</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">情感反馈:</span>
            <div 
              className="w-2.5 h-2.5 rounded-full shadow-sm transition-colors duration-1000" 
              style={{ 
                backgroundColor: currentEmotionCfg?.color || '#e2e8f0',
                boxShadow: currentEmotionCfg ? `0 0 8px ${currentEmotionCfg.color}80` : 'none'
              }}
            />
            {latestPoint && (
              <span className="text-[11px] font-bold text-slate-700">{latestPoint.emotion}</span>
            )}
          </div>
        </div>

        {/* ProLF Status Indicator Capsule Lights */}
        <div className="flex items-center gap-2 text-[10px] bg-slate-50 p-1.5 rounded-xl border border-slate-100 flex-wrap">
          <span className="text-[10px] text-slate-400 font-semibold mr-1">ProLF 状态感知:</span>
          {renderStatusPill('Face', prolfStatus.face)}
          {renderStatusPill('Speech', prolfStatus.speech)}
          {renderStatusPill('ECG', prolfStatus.ecg)}
        </div>
      </div>

      {!latestPoint && !staticResult ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
          <FileText size={48} className="mb-4 opacity-30" />
          <p className="text-[13px] font-medium">暂无监控数据</p>
          <p className="text-[11px] mt-1">在页面顶部开启监测，即可实时观测情绪多模态融合微波</p>
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
                        <div className="text-[10px] text-blue-600">愉悦度 (Valence): {d.valence.toFixed(2)}</div>
                        <div className="text-[10px] text-amber-600">唤醒度 (Arousal): {d.arousal.toFixed(2)}</div>
                        <div className="text-[10px] text-teal-600">融合情绪: {d.emotion}</div>
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
