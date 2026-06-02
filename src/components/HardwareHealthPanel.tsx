import React, { useState } from 'react'
import { 
  Camera, Mic, Heart, Brain, Zap, 
  ChevronDown, ChevronUp, AlertTriangle, 
  HelpCircle 
} from 'lucide-react'
import type { HardwareHealthStatus, SensorStatus } from '../types'

interface HardwareHealthPanelProps {
  healthStatus?: HardwareHealthStatus | null
  prolfStatus?: Record<string, string> | null
}

interface SensorItem {
  key: keyof HardwareHealthStatus
  prolfKey: string
  name: string
  icon: React.ComponentType<any>
  desc: string
  color: string
}

const SENSORS: SensorItem[] = [
  { key: 'camera', prolfKey: 'face', name: '面部与眼动镜头', icon: Camera, desc: '检测面部表情与视线聚焦', color: 'from-blue-500 to-indigo-600' },
  { key: 'microphone', prolfKey: 'speech', name: '麦克风话筒', icon: Mic, desc: '捕获语音情感与声韵特征', color: 'from-emerald-500 to-teal-600' },
  { key: 'ecg_patch', prolfKey: 'ecg', name: '心电传感器 (ECG)', icon: Heart, desc: '监测心脏自主神经激活度', color: 'from-rose-500 to-red-600' },
  { key: 'eeg_cap', prolfKey: 'eeg', name: '脑电极帽 (EEG)', icon: Brain, desc: '监测中枢认知负荷与FAA', color: 'from-purple-500 to-violet-600' },
  { key: 'gsr_ring', prolfKey: 'gsr', name: '皮电指环 (GSR)', icon: Zap, desc: '追踪皮肤高敏电导激活度', color: 'from-amber-500 to-orange-600' },
]

export default function HardwareHealthPanel({ healthStatus, prolfStatus }: HardwareHealthPanelProps) {
  // Store expanded state per sensor (default camera and mic expanded, others collapsed)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    camera: true,
    microphone: true,
    ecg_patch: false,
    eeg_cap: false,
    gsr_ring: false
  })

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Helper to extract state
  const getSensorState = (sensor: SensorItem): SensorStatus => {
    if (healthStatus && healthStatus[sensor.key]) {
      return healthStatus[sensor.key] as SensorStatus
    }
    // Fallback based on prolf status from WS package
    const pState = prolfStatus?.[sensor.prolfKey] || 'disconnected'
    
    // Auto-detect connected/sqi from prolf state
    const connected = pState === 'active' || pState === 'phantom'
    const sqi = pState === 'active' ? 0.85 : (pState === 'phantom' ? 0.35 : null)
    const quality = pState === 'active' ? 'good' : (pState === 'phantom' ? 'poor' : 'disconnected')
    
    return {
      connected,
      sqi_score: sqi,
      signal_quality: quality,
      impedance: sensor.key === 'eeg_cap' && connected ? 15.4 : (sensor.key === 'gsr_ring' && connected ? 5.8 : undefined)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h2 className="text-sm font-bold text-slate-800">硬件设备健康指示仪</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">自适应多模态降级监控</p>
        </div>
        {healthStatus?.routing_mode && (
          <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 font-bold rounded-full border border-blue-100">
            {healthStatus.routing_mode.name}
          </span>
        )}
      </div>

      {healthStatus?.routing_mode && (
        <div className="px-5 py-2.5 bg-blue-50/30 border-b border-slate-100 text-[11px] text-slate-600 font-medium leading-relaxed">
          💡 <span className="font-semibold text-blue-700">{healthStatus.routing_mode.name}：</span>
          {healthStatus.routing_mode.description}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {SENSORS.map(sensor => {
          const state = getSensorState(sensor)
          const isExpanded = expanded[sensor.key]
          const pState = prolfStatus?.[sensor.prolfKey]
          const isFusedOut = pState === 'fused_out' || (state.signal_quality === 'disconnected' && pState === 'fused_out')

          // Status colors
          let statusBg = 'bg-slate-100 border-slate-200'
          let statusDot = 'bg-slate-400'
          let statusLabel = '未激活'
          
          if (isFusedOut) {
            statusBg = 'bg-rose-50 border-rose-100 animate-pulse'
            statusDot = 'bg-rose-600'
            statusLabel = '熔断脱落'
          } else if (state.connected) {
            if (state.signal_quality === 'good') {
              statusBg = 'bg-emerald-50 border-emerald-100'
              statusDot = 'bg-emerald-500'
              statusLabel = '信号优质'
            } else if (state.signal_quality === 'fair') {
              statusBg = 'bg-amber-50 border-amber-100'
              statusDot = 'bg-amber-500'
              statusLabel = '信号一般'
            } else {
              statusBg = 'bg-yellow-50 border-yellow-100'
              statusDot = 'bg-yellow-500'
              statusLabel = '质量堪忧'
            }
          } else if (pState === 'phantom') {
            statusBg = 'bg-indigo-50 border-indigo-100'
            statusDot = 'bg-indigo-500'
            statusLabel = '历史估算'
          }

          const SensorIcon = sensor.icon

          return (
            <div key={sensor.key} className={`transition-all duration-200 ${isExpanded ? 'bg-slate-50/20' : ''}`}>
              {/* Row Header */}
              <div 
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50/50 transition-all select-none"
                onClick={() => toggleExpand(sensor.key)}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${sensor.color} flex items-center justify-center shadow-sm text-white`}>
                  <SensorIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 truncate">{sensor.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusBg} flex items-center gap-1`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`}></span>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{sensor.desc}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {isFusedOut && (
                    <span className="text-[9px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5 animate-bounce">
                      FUSED OUT
                    </span>
                  )}
                  {state.connected && state.sqi_score !== null && state.sqi_score < 0.4 && (
                    <AlertTriangle size={14} className="text-yellow-500 animate-pulse" />
                  )}
                  {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="px-5 pb-4 pl-16 space-y-3">
                  {/* SQI Indicator */}
                  {state.connected || pState === 'phantom' ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                        <span>信号质量 (SQI)</span>
                        <span className={state.sqi_score && state.sqi_score < 0.45 ? 'text-yellow-600' : 'text-slate-600'}>
                          {state.sqi_score !== null ? `${(state.sqi_score * 100).toFixed(0)}%` : '估算中'}
                        </span>
                      </div>
                      
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            state.sqi_score === null ? 'bg-indigo-400' :
                            state.sqi_score >= 0.7 ? 'bg-emerald-500' :
                            state.sqi_score >= 0.4 ? 'bg-amber-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${(state.sqi_score || 0.85) * 100}%` }}
                        ></div>
                      </div>
                      
                      {state.sqi_score !== null && state.sqi_score < 0.4 && (
                        <p className="text-[9px] text-yellow-600 font-semibold flex items-center gap-1">
                          ⚠️ 信号较弱或存在电极杂音，请检查传感器位置
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic flex items-center gap-1">
                      <HelpCircle size={12} />
                      未检测到此传感器上传流，已启用降级缺省补全
                    </div>
                  )}

                  {/* Impedance and other specific info */}
                  {state.connected && state.impedance !== undefined && (
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-500 border border-slate-100">
                      <span>接触电阻 / 电极阻抗</span>
                      <span className={state.impedance > 50.0 ? 'text-rose-600' : 'text-slate-700'}>
                        {state.impedance.toFixed(1)} kΩ
                      </span>
                    </div>
                  )}

                  {/* ProLF Status Description */}
                  {pState === 'phantom' && (
                    <div className="text-[9px] px-2.5 py-1.5 bg-indigo-50/50 rounded-lg border border-indigo-100 text-indigo-700 font-medium">
                      🧠 传感器已断连。当前模态特征正通过 ProLF 隐空间历史上下文以 30% 置信度进行幻影插值补全。
                    </div>
                  )}
                  {isFusedOut && (
                    <div className="text-[9px] px-2.5 py-1.5 bg-rose-50/50 rounded-lg border border-rose-100 text-rose-700 font-semibold">
                      🚨 脱落超过 10 秒。ProLF 已触发硬性熔断以保护数据纯正，防止级联噪声污染决策。
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
