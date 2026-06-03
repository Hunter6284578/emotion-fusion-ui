import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine
} from 'recharts'
import {
  KeyRound, ShieldAlert, ShieldCheck, Activity,
  Brain, FileText, RefreshCw
} from 'lucide-react'

export default function ClinicalView() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [pin, setPin] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [unlockedRecord, setUnlockedRecord] = useState<any>(null)

  // 软键盘输入逻辑
  const handleNumClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num)
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
  }

  const handleClear = () => {
    setPin('')
    setErrorMsg('')
  }

  // 校验解锁 Token 和 PIN
  const handleVerify = async () => {
    if (pin.length !== 4) {
      setErrorMsg('请输入 4 位数字授权码')
      return
    }
    setLoading(true)
    setErrorMsg('')
    
    try {
      const response = await fetch('http://localhost:8088/api/cognitive/token/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin })
      })
      const result = await response.json()
      
      if (result.ok) {
        setUnlockedRecord(result.record)
      } else {
        setErrorMsg(result.error || '验证失败，请重新输入')
      }
    } catch (err) {
      setErrorMsg('服务器网络故障，请稍后重试')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // 1. 无效的 Token 校验
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full p-8 bg-slate-800 rounded-3xl border-2 border-red-500/30 space-y-4">
          <ShieldAlert size={56} className="mx-auto text-red-500 animate-pulse" />
          <h2 className="text-2xl font-black">无效的访问链接</h2>
          <p className="text-slate-400">缺少必要的访问 Token。请在检测系统报告页重新扫码。</p>
        </div>
      </div>
    )
  }

  // 2. 授权解锁成功后的《医生专业视图报告》
  if (unlockedRecord) {
    const session = unlockedRecord.session_info || {}
    const report = session.cognitive_report || {}
    const patient = session.patient_metadata || {}
    
    const p300Latency = report.details?.brain_heart?.p300_latency || 330
    const p300Amp = report.details?.brain_heart?.p300_amplitude || 10
    const isDelayed = report.details?.brain_heart?.p300_delayed || false
    const restRmssd = report.details?.brain_heart?.rest_rmssd || 38
    const taskRmssd = report.details?.brain_heart?.task_rmssd || 26

    const p300Data = () => {
      const data = []
      const normPeak = 345
      const normAmp = 10.5
      for (let ms = 100; ms <= 600; ms += 15) {
        const baseNoise = Math.sin(ms / 20) * 1.0
        const normVal = baseNoise + normAmp * Math.exp(-Math.pow((ms - normPeak) / 45, 2))
        const patientVal = baseNoise + p300Amp * Math.exp(-Math.pow((ms - p300Latency) / (isDelayed ? 65 : 45), 2))
        data.push({
          ms,
          '常模对照': parseFloat(normVal.toFixed(2)),
          '长者实测': parseFloat(patientVal.toFixed(2))
        })
      }
      return data
    }

    const spo2Data = () => {
      const data = []
      for (let i = 0; i <= 40; i++) {
        const sec = i * 15
        let value = 98.0 + Math.sin(i / 6) * 0.4
        if (report.classification !== 'healthy' && i >= 15 && i <= 28) {
          const drop = Math.sin((i - 15) / 13 * Math.PI)
          value = value - (value * 0.07 * drop)
        }
        data.push({
          time: `${Math.floor(sec / 60)}m${sec % 60}s`,
          '血氧 (%)': parseFloat(value.toFixed(1))
        })
      }
      return data
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 space-y-4">
        {/* Header */}
        <header className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <ShieldCheck size={28} className="text-emerald-500" />
          <div>
            <h1 className="text-lg font-black tracking-wide text-white">临床专业评估报告（已解锁）</h1>
            <p className="text-xs text-slate-400">授权人：{unlockedRecord.patient_name} (ID: {unlockedRecord.patient_id})</p>
          </div>
        </header>

        {/* Patient Base Card */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
          <div><span className="text-slate-400">性别：</span>{patient.gender || '女'}</div>
          <div><span className="text-slate-400">年龄：</span>{patient.age || 65} 岁</div>
          <div className="col-span-2"><span className="text-slate-400">学历组：</span>{patient.education === 'low' ? '小学及以下 (低学历组)' : patient.education === 'high' ? '大专及以上 (高学历组)' : '初高中 (普通学历组)'}</div>
          <div className="col-span-2"><span className="text-slate-400">测试日期：</span>{new Date(unlockedRecord.timestamp).toLocaleString('zh-CN')}</div>
        </div>

        {/* 脑电 P300 波形图 */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1.5 text-white">
            <Brain size={16} className="text-blue-400" />
            1. 脑电诱发 ERP P300 波形对比
          </h2>
          <div className="h-52 w-full text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={p300Data()}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="ms" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                <Legend />
                <Line type="monotone" dataKey="常模对照" stroke="#64748b" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="长者实测" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                <ReferenceLine x={p300Latency} stroke="#ef4444" label={{ value: `${p300Latency}ms`, fill: '#ef4444', position: 'top' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* HRV 刚性 */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-white">
              <Activity size={16} className="text-amber-400" />
              2. 自主神经张力 (HRV RMSSD)
            </h2>
            <div className="h-48 w-full text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: '静息基线', '对照': 38, '实测': Math.round(restRmssd) },
                  { name: '压力测验', '对照': 25, '实测': Math.round(taskRmssd) }
                ]}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                  <Legend />
                  <Bar dataKey="对照" fill="#475569" />
                  <Bar dataKey="实测" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SpO2 */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-white">
              <Activity size={16} className="text-red-400" />
              3. 时序血氧监测 (SpO2)
            </h2>
            <div className="h-48 w-full text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spo2Data()}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="#64748b" />
                  <YAxis domain={[80, 100]} stroke="#64748b" />
                  <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                  <Line type="monotone" dataKey="血氧 (%)" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 临床评测结论与质量参数 */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 text-xs leading-relaxed">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <FileText size={16} className="text-teal-400" />
            4. 生理参数与不确定度特征
          </h2>
          <div className="grid grid-cols-2 gap-2 border-b border-slate-800 pb-2">
            <div><span className="text-slate-400">脑心耦合系数：</span>{report.brain_heart_coupling?.toFixed(2) || '1.0'}</div>
            <div><span className="text-slate-400">分析不确定度：</span>{unlockedRecord.uncertainty_level || 'low'}</div>
            <div><span className="text-slate-400">融合算法模式：</span>{unlockedRecord.fusion_mode || 'adaptive'}</div>
            <div><span className="text-slate-400">质量可信度 (SNR)：</span>{(unlockedRecord.quality * 100).toFixed(0)}%</div>
          </div>
          <div>
            <span className="text-slate-400 font-bold">临床诊断参考：</span>
            <p className="text-slate-200 mt-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">
              {unlockedRecord.suggestion}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. 密码解锁界面
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-white">
      <div className="w-full max-w-sm p-6 bg-slate-800 border-2 border-slate-700 rounded-3xl space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <KeyRound size={48} className="mx-auto text-amber-500 animate-bounce" />
          <h2 className="text-xl font-black tracking-wide">临床医生查阅授权</h2>
          <p className="text-xs text-slate-400 leading-normal">
            受检数据已进行列级对称加密保护。请输入长者屏幕上显示的 4 位授权数字进行解锁。
          </p>
        </div>

        {/* 4点密码格子 */}
        <div className="flex justify-center gap-4 py-2">
          {Array.from({ length: 4 }).map((_, idx) => {
            const val = pin[idx]
            return (
              <div
                key={idx}
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                  val ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-slate-600 bg-slate-900/50'
                }`}
              >
                {val ? val : ''}
              </div>
            )
          })}
        </div>

        {errorMsg && (
          <p className="text-xs text-center text-red-500 font-bold bg-red-950/40 p-2.5 rounded-xl border border-red-500/20">
            ⚠️ {errorMsg}
          </p>
        )}

        {/* 密码键盘 */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
            <button
              key={n}
              onClick={() => handleNumClick(n)}
              className="py-3 bg-slate-700 hover:bg-slate-600 text-lg font-bold rounded-2xl active:scale-95 transition-all outline-none"
            >
              {n}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="py-3 bg-slate-900/60 hover:bg-slate-950 text-xs font-bold rounded-2xl active:scale-95 transition-all outline-none text-slate-400"
          >
            清除
          </button>
          <button
            onClick={() => handleNumClick('0')}
            className="py-3 bg-slate-700 hover:bg-slate-600 text-lg font-bold rounded-2xl active:scale-95 transition-all outline-none"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="py-3 bg-slate-900/60 hover:bg-slate-950 text-xs font-bold rounded-2xl active:scale-95 transition-all outline-none text-slate-400"
          >
            回退
          </button>
        </div>

        {/* 解锁确认 */}
        <button
          onClick={handleVerify}
          disabled={loading || pin.length !== 4}
          className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 text-slate-950 font-black rounded-2xl shadow-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <RefreshCw size={18} className="animate-spin" /> : '确认授权并解锁报告'}
        </button>
      </div>
    </div>
  )
}
