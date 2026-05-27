/** 核心类型定义 - 多模态情绪识别系统 */

export type ModalityType = 'text' | 'speech' | 'face' | 'ecg'

export type EmotionLabel = '快乐' | '平静' | '悲伤' | '生气' | '害怕' | '惊讶' | '厌恶' | 'unknown'

export interface ModalityResult {
  modality: ModalityType
  available: boolean
  valence: number | null   // [0, 1] 愉悦度
  arousal: number | null   // [0, 1] 唤醒度
  confidence: number       // [0, 1]
  quality: number          // [0, 1]
  emotion: string
  evidence: string[]
  warning?: string
  error_code?: string
}

export interface FusionResult {
  available: boolean
  final_emotion: EmotionLabel
  valence: number | null
  arousal: number | null
  confidence: number
  quality?: number
  uncertainty_level: 'low' | 'medium' | 'high'
  uncertainty_score: number
  fusion_mode: string
  suggestion: string
  warnings: string[]
  modality_table: ModalityResult[] | null
  explanation?: string
}

export interface AssessmentRecord {
  id: number
  timestamp: string
  patient_id: string
  patient_name: string
  text_result: string | null
  speech_result: string | null
  face_result: string | null
  ecg_result: string | null
  final_emotion: EmotionLabel
  valence: number
  arousal: number
  confidence: number
  quality: number
  modality_count: number
  fusion_mode: string
  uncertainty_level: string
  suggestion: string
  warnings: string
}

export interface StatisticsData {
  total_records: number
  recent_30d: number
  avg_valence: number
  avg_arousal: number
  avg_confidence: number
  avg_quality: number
  emotion_distribution: Record<string, number>
  uncertainty_distribution: Record<string, number>
}

/** VA空间坐标点 */
export interface VAPoint {
  valence: number
  arousal: number
  emotion: EmotionLabel
  timestamp: string
  confidence: number
}

export const EMOTION_CONFIG: Record<EmotionLabel, { color: string; va: [number, number]; label: string }> = {
  '快乐':    { color: '#22C55E', va: [0.78, 0.62], label: 'Happy' },
  '平静':    { color: '#3B82F6', va: [0.55, 0.35], label: 'Calm' },
  '悲伤':    { color: '#6366F1', va: [0.28, 0.38], label: 'Sad' },
  '生气':    { color: '#EF4444', va: [0.22, 0.78], label: 'Angry' },
  '害怕':    { color: '#F97316', va: [0.32, 0.72], label: 'Fear' },
  '惊讶':    { color: '#A855F7', va: [0.52, 0.75], label: 'Surprised' },
  '厌恶':    { color: '#78716C', va: [0.18, 0.58], label: 'Disgusted' },
  'unknown': { color: '#94A3B8', va: [0.50, 0.50], label: 'Unknown' },
}
