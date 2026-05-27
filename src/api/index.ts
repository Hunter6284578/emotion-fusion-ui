/** API 层 - 连接后端服务，支持 Vercel 部署 + 本地开发降级 */

import type { FusionResult, AssessmentRecord, StatisticsData } from '../types'

// Vercel 部署时通过环境变量配置后端地址，本地开发用 /api 代理
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

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
    const res = await fetch(`${API_BASE}/analyze_json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: formData.get('text') || '' }),
    })
    if (!res.ok) throw new Error(`API Error: ${res.status}`)
    return res.json()
  }
  
  // 包含文件 → FormData
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
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
    `/assessments${query}`
  )
  
  if (Array.isArray(data)) return { records: data, total: data.length }
  return data
}

// ====== 统计信息 ======
export async function fetchStatistics(): Promise<StatisticsData> {
  return request<StatisticsData>('/statistics')
}

// ====== 数据导出 ======
export function exportCSV(params?: Record<string, string>): void {
  const search = new URLSearchParams(params).toString()
  window.open(`${API_BASE}/export/csv${search ? '?' + search : ''}`, '_blank')
}

export function exportJSON(params?: Record<string, string>): void {
  const search = new URLSearchParams(params).toString()
  window.open(`${API_BASE}/export/json${search ? '?' + search : ''}`, '_blank')
}
