import {
  useCallback,
  useState,
  type CSSProperties,
  type WheelEvent as ReactWheelEvent,
} from "react"

// 缩略图大小控制：网格列数 2~6，支持 Ctrl+滚轮与滑块。
// onChange 用于把列数写回板块级 UI 状态（切换板块不丢）。
export function useThumbSize(initial = 3, onChange?: (cols: number) => void) {
  const [cols, setColsState] = useState(initial)

  const setCols = useCallback(
    (c: number) => {
      setColsState(c)
      onChange?.(c)
    },
    [onChange],
  )

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  }

  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setCols(Math.min(6, Math.max(2, cols + (e.deltaY > 0 ? 1 : -1))))
    },
    [cols, setCols],
  )

  return { cols, setCols, gridStyle, onWheel }
}
