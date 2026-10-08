import { useRef, type ReactNode, type WheelEvent as ReactWheelEvent } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

// 虚拟化网格：只渲染可视区域的行，支持数万项流畅滚动。
// 卡片需有确定高度（固定图片高度 + 单行文字），行高 = 卡片高 + 间距。
export function VirtualGrid({
  count,
  cols,
  rowHeight,
  renderItem,
  className,
  onWheel,
}: {
  count: number
  cols: number
  rowHeight: number
  renderItem: (index: number) => ReactNode
  className?: string
  onWheel?: (e: ReactWheelEvent<HTMLDivElement>) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowCount = Math.ceil(count / cols)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  })

  return (
    <div ref={parentRef} onWheel={onWheel} className={className}>
      <div
        style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((vRow) => {
          const start = vRow.index * cols
          const idxs: number[] = []
          for (let i = 0; i < cols; i++) {
            const idx = start + i
            if (idx < count) idxs.push(idx)
          }
          return (
            <div
              key={vRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: vRow.size,
                transform: `translateY(${vRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                columnGap: "1rem",
                alignContent: "start",
              }}
            >
              {idxs.map((i) => renderItem(i))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
