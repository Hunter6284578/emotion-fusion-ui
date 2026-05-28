/** API 层 - 连接后端服务，支持 Vercel 部署 + 本地开发降级
 *  v3.0 临床级升级：视频流API + 精确时间戳打标 + AU特征
 */

import type { FusionResult, AssessmentRecord, StatisticsData, VideoStreamResult, FaceAUResult } from '../types'
import { translateEmotion } from '../types'

// 部署时通过环境变量配置后端地址
// 生产环境(Vercel)使用相对路径，由 vercel.json rewrite 代理到 HF Space
// 本地开发由 .env.development 设置 VITE_API_BASE_URL=http://localhost:8088
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`)
  return res.json()
}

// ====== 情绪分析 ======
export async function analyzeEmotion(formData: FormData): Promise<FusionResult> {
  // 检测是否包含文件
  const hasFiles = formData.get('face_file') || formData.get('speech_file') || formData.get('ecg_csv_file')
  
  if (!hasFiles) {
    // 纯文本分析 → 用 JSON 避免跨域 FormData 编码问题
    const res = await fetch(`${API_BASE}/api/analyze_json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: formData.get('text') || '' }),
    })
    if (!res.ok) throw new Error(`API Error: ${res.status}`)
    const data: FusionResult = await res.json()
    data.final_emotion = translateEmotion(data.final_emotion)
    if (data.modality_table) {
      data.modality_table.forEach(m => m.emotion = translateEmotion(m.emotion))
    }
    return data
  }
  
  // 包含文件 → FormData
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  
  const data: FusionResult = await res.json()
  data.final_emotion = translateEmotion(data.final_emotion)
  if (data.modality_table) {
    data.modality_table.forEach(m => m.emotion = translateEmotion(m.emotion))
  }
  return data
}

// ====== v3.0 临床级视频流分析 ======

/**
 * 发送视频流切片（MediaRecorder录制的.webm blob）进行时序情绪分析
 * 采集频率: 25 FPS滑动窗口，每次1~2秒视频切片
 * 后端管线: MTCNN面部仿射对齐 → 3D-CNN/MobileNetV2时空特征提取 → AU解码 → 张量融合
 */
export async function analyzeVideoStream(
  videoBlob: Blob,
  metadata: {
    fps: number
    frameCount: number
    durationMs: number
    startTimestamp: number  // 毫秒级Unix时间戳，用于跨模态对齐
    windowIndex: number
  }
): Promise<VideoStreamResult> {
  const formData = new FormData()
  formData.append('video_clip', videoBlob, `clip_${metadata.windowIndex}.webm`)
  formData.append('metadata', JSON.stringify(metadata))
  
  const res = await fetch(`${API_BASE}/api/analyze_video_stream`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    try {
      const errJson = await res.json()
      if (errJson && errJson.error) {
        throw new Error(errJson.error)
      }
    } catch (_) {}
    throw new Error(`Video Stream API Error: ${res.status}`)
  }
  
  const data: VideoStreamResult = await res.json()
  data.final_emotion = translateEmotion(data.final_emotion)
  if (data.micro_expression_events) {
    data.micro_expression_events.forEach(ev => {
      ev.emotion = translateEmotion(ev.emotion)
    })
  }
  if (data.frame_details) {
    data.frame_details.forEach(fd => {
      fd.emotion = translateEmotion(fd.emotion)
    })
  }
  return data
}

/**
 * 发送单帧进行快速AU检测（轻量级模式，用于实时预览）
 * 前端使用MediaPipe提取面部关键点后发送裁剪对齐的人脸
 */
export async function analyzeFaceAU(
  faceBlob: Blob,
  timestamp: number
): Promise<FaceAUResult> {
  const formData = new FormData()
  formData.append('face_image', faceBlob, 'face.jpg')
  formData.append('timestamp', String(timestamp))
  
  const res = await fetch(`${API_BASE}/api/analyze_face_au`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`Face AU API Error: ${res.status}`)
  
  const data: FaceAUResult = await res.json()
  data.emotion = translateEmotion(data.emotion)
  return data
}

// ====== 历史记录 ======
export async function fetchAssessments(params?: {
  limit?: number; offset?: number; patient_id?: string
  emotion?: string; start_date?: string; end_date?: string
}): Promise<{ records: AssessmentRecord[]; total: number }> {
  const search = new URLSearchParams()
  if (params) Object.entries(params).forEach(([k, v]) => v && search.set(k, String(v)))
  const query = search.toString() ? `?${search}` : ''
  
  // 兼容后端返回格式 (records, total) 或直接返回数组
  const data = await request<AssessmentRecord[] | { records: AssessmentRecord[]; total: number }>(
    `/api/assessments${query}`
  )
  
  if (Array.isArray(data)) {
    data.forEach(r => r.final_emotion = translateEmotion(r.final_emotion))
    return { records: data, total: data.length }
  }
  if (data.records) {
    data.records.forEach(r => r.final_emotion = translateEmotion(r.final_emotion))
  }
  return data
}

// ====== 统计信息 ======
export async function fetchStatistics(): Promise<StatisticsData> {
  const data = await request<StatisticsData>('/api/statistics')
  if (data.emotion_distribution) {
    const newDist: Record<string, number> = {}
    for (const [k, v] of Object.entries(data.emotion_distribution)) {
      const zhKey = translateEmotion(k)
      newDist[zhKey] = (newDist[zhKey] || 0) + v
    }
    data.emotion_distribution = newDist
  }
  return data
}

// ====== 数据导出 ======
export function exportCSV(params?: Record<string, string>): void {
  const search = new URLSearchParams(params).toString()
  window.open(`${API_BASE}/api/export/csv${search ? '?' + search : ''}`, '_blank')
}

export function exportJSON(params?: Record<string, string>): void {
  const search = new URLSearchParams(params).toString()
  window.open(`${API_BASE}/api/export/json${search ? '?' + search : ''}`, '_blank')
}
