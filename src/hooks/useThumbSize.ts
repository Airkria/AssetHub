import {
  useCallback,
  useState,
  type CSSProperties,
  type WheelEvent as ReactWheelEvent,
} from "react"

// 缩略图大小控制：网格列数 2~6，支持 Ctrl+滚轮与滑块
export function useThumbSize(initial = 3) {
  const [cols, setCols] = useState(initial)

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  }

  const onWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    setCols((c) => Math.min(6, Math.max(2, c + (e.deltaY > 0 ? 1 : -1))))
  }, [])

  return { cols, setCols, gridStyle, onWheel }
}
