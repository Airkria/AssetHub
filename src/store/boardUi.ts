import { useCallback, useEffect, useRef, useState } from "react"

// 每个板块独立的 UI 状态（会话内内存保留，键 = 板块 id）。
// BoardView 切换板块时会被卸载重挂（App.tsx 的 key），这些状态从 store 恢复；
// 搜索词 / 标签筛选等「内容相关」状态仍随切换重置。
export interface BoardUiState {
  cols: number
  detailWidth: number
  sidebarWidth: number
  scrollTop: number
}

const DEFAULTS: BoardUiState = {
  cols: 3,
  detailWidth: 374, // 288 × 1.3 ≈ 374：详情边栏默认宽度比原来宽 30%
  sidebarWidth: 176,
  scrollTop: 0,
}

const store = new Map<string, BoardUiState>()

export function readBoardUi(boardId: string, key: keyof BoardUiState): number {
  return store.get(boardId)?.[key] ?? DEFAULTS[key]
}

export function writeBoardUi(
  boardId: string,
  key: keyof BoardUiState,
  value: number,
) {
  const prev = store.get(boardId) ?? { ...DEFAULTS }
  store.set(boardId, { ...prev, [key]: value })
}

// 绑定一个板块级 UI 值：挂载时从 store 读初值，改动时写回。
export function useBoardUiValue(
  boardId: string,
  key: keyof BoardUiState,
): [number, (v: number) => void] {
  const [value, setValue] = useState<number>(() => readBoardUi(boardId, key))
  const update = useCallback(
    (v: number) => {
      setValue(v)
      writeBoardUi(boardId, key, v)
    },
    [boardId, key],
  )
  return [value, update]
}

// 滚动保存（不恢复）：挂到滚动容器，滚动时把 scrollTop 写回 store。
// 虚拟化容器（瀑布流）用它保存，恢复交给 virtualizer 的 initialOffset。
// ready 用于跳过「板块切换瞬间还显示上一板块数据」时的滚动事件，避免把错误位置写回。
export function useScrollSave(boardId: string, ready: boolean) {
  const elRef = useRef<HTMLDivElement | null>(null)

  const onScroll = useCallback(() => {
    if (!ready) return
    const el = elRef.current
    if (el) writeBoardUi(boardId, "scrollTop", el.scrollTop)
  }, [boardId, ready])

  const ref = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el
  }, [])

  return { ref, onScroll }
}

// 滚动位置记忆：保存 + 恢复（非虚拟化布局，内容高度同步可知，直接设 scrollTop 即可）。
export function useScrollMemory(boardId: string, ready: boolean) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current || !ready) return
    const el = elRef.current
    if (!el) return
    restored.current = true
    el.scrollTop = readBoardUi(boardId, "scrollTop")
  }, [boardId, ready])

  const onScroll = useCallback(() => {
    const el = elRef.current
    if (el) writeBoardUi(boardId, "scrollTop", el.scrollTop)
  }, [boardId])

  // 回调 ref，便于在 VirtualGrid 等内部组件中组合到同一元素
  const ref = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el
  }, [])

  return { ref, onScroll }
}
