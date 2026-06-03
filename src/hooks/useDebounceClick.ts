import { useState, useRef } from 'react'

/**
 * 支持 Promise 异步阻塞的状态锁防抖 Hook
 * @param handler 触发的异步或普通处理函数
 * @param minDelay 最小禁用延迟时长 (ms)，默认 1000ms
 * @returns { onClick, loading }
 */
export function useDebounceClick<T extends (...args: any[]) => Promise<any> | void>(
  handler: T,
  minDelay = 1000
) {
  const [loading, setLoading] = useState(false)
  const lockRef = useRef(false)

  const onClick = async (...args: Parameters<T>) => {
    if (lockRef.current || loading) return
    lockRef.current = true
    setLoading(true)

    const startTime = Date.now()
    try {
      await handler(...args)
    } catch (err) {
      console.error("Async execution error in useDebounceClick: ", err)
    } finally {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, minDelay - elapsed)
      setTimeout(() => {
        lockRef.current = false
        setLoading(false)
      }, remaining)
    }
  }

  return { onClick, loading }
}
export default useDebounceClick
