/** 核心类型定义 - 多模态情绪识别系统 v3.0
 *  临床级升级：视频流分析、面部动作单元(AU)、时序对齐时间戳
 */

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

export const EMOTION_EN_TO_ZH: Record<string, EmotionLabel> = {
  'happy': '快乐',
  'calm': '平静',
  'neutral': '平静',
  'sad': '悲伤',
  'angry': '生气',
  'fear': '害怕',
  'surprise': '惊讶',
  'surprised': '惊讶',
  'disgust': '厌恶',
  'disgusted': '厌恶',
  'unknown': 'unknown'
}

export function translateEmotion(en: string | undefined | null): EmotionLabel {
  if (!en) return 'unknown'
  const key = en.trim().toLowerCase()
  // If it's already a known Chinese label
  if (EMOTION_CONFIG[en as EmotionLabel] && en !== 'unknown') {
    return en as EmotionLabel
  }
  return EMOTION_EN_TO_ZH[key] || 'unknown'
}

// ============================================================
// v3.0 临床级视频流分析类型
// ============================================================

/** 面部动作单元 (Facial Action Units)
 *  参考 OpenFace 2.0 标准，捕获底层微表情线索
 */
export interface FaceActionUnits {
  AU1_inner_brow_raiser: number     // 眉心抬起
  AU2_outer_brow_raiser: number     // 眉梢抬起
  AU4_brow_lowerer: number          // 眉毛压低
  AU5_upper_lid_raiser: number      // 上眼睑抬起
  AU6_cheek_raiser: number          // 脸颊抬起
  AU7_lid_tightener: number         // 眼睑收紧
  AU9_nose_wrinkler: number         // 皱鼻
  AU10_upper_lip_raiser: number     // 上唇抬起
  AU12_lip_corner_puller: number    // 嘴角拉起（微笑关键AU）
  AU14_dimpler: number              // 酒窝
  AU15_lip_corner_depressor: number // 嘴角下压
  AU17_chin_raiser: number          // 下巴抬起
  AU20_lip_stretcher: number        // 嘴唇拉伸
  AU23_lip_tightener: number        // 嘴唇收紧
  AU25_lips_part: number            // 双唇分开
  AU26_jaw_drop: number             // 下颌下坠
  AU45_blink: number                // 眨眼
}

/** 头部姿态与注视方向 */
export interface HeadPose {
  pitch: number    // 俯仰角 (度)
  yaw: number      // 偏航角 (度)
  roll: number     // 翻滚角 (度)
}

export interface GazeDirection {
  gaze_x: number   // 注视方向X [-1, 1]
  gaze_y: number   // 注视方向Y [-1, 1]
  gaze_z: number   // 注视方向Z [-1, 1]
}

/** 单帧AU分析结果 */
export interface FaceAUResult {
  available: boolean
  timestamp: number              // 毫秒级Unix时间戳
  face_detected: boolean
  face_count: number             // 检测到的人脸数量（多面孔抗干扰）
  target_face_index: number      // 目标对象的面部索引（主动说话者检测）
  aligned: boolean               // 是否通过仿射变换对齐
  emotion: string
  valence: number
  arousal: number
  confidence: number
  action_units: FaceActionUnits
  head_pose: HeadPose
  gaze: GazeDirection
  eye_blink_rate: number         // 眨眼频率 (次/秒)
  face_box: [number, number, number, number]  // [x, y, w, h]
  warning?: string
}

/** 视频流分析结果（滑动窗口批量处理） */
export interface VideoStreamResult {
  available: boolean
  window_index: number
  start_timestamp: number        // 窗口起始时间戳
  end_timestamp: number          // 窗口结束时间戳
  duration_ms: number
  fps: number
  total_frames: number
  detected_frames: number        // 成功检测到人脸的帧数
  
  // 聚合情绪结果
  final_emotion: string
  valence_mean: number
  valence_std: number
  arousal_mean: number
  arousal_std: number
  confidence_mean: number
  
  // 时序AU特征（每帧的AU值序列，用于时序可视化）
  au_timeline: {
    timestamps: number[]
    AU12_lip_corner_puller: number[]   // 微笑肌肉时序
    AU4_brow_lowerer: number[]         // 皱眉时序
    AU6_cheek_raiser: number[]
    AU45_blink: number[]
  }
  
  // 头部姿态时序
  head_pose_timeline: {
    timestamps: number[]
    pitch: number[]
    yaw: number[]
    roll: number[]
  }
  
  // 每帧详情
  frame_details: FaceAUResult[]
  
  // 微表情检测
  micro_expression_events: MicroExpressionEvent[]
  
  warning?: string
  error_code?: string
}

/** 微表情事件（持续时间 < 500ms 的情绪闪现） */
export interface MicroExpressionEvent {
  timestamp: number
  duration_ms: number
  emotion: string
  peak_intensity: number
  trigger_aus: string[]  // 触发的动作单元列表
}

/** 滑动窗口配置 */
export interface VideoWindowConfig {
  fps: number              // 采集帧率 (推荐 25 FPS)
  windowDurationMs: number // 窗口时长 (推荐 1000~2000 ms)
  windowStrideMs: number   // 窗口步长 (推荐 500 ms，50% 重叠)
}

/** 摄像头实时分析状态 */
export type CameraStatus = 'idle' | 'starting' | 'streaming' | 'analyzing' | 'error'
