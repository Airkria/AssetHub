import { useRef, type ReactNode, type WheelEvent as ReactWheelEvent } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

// 虚拟化网格：只渲染可视区域的行，行高按内容动态测量（配合 aspect 比例卡片）。
export function VirtualGrid({
  count,
  cols,
  renderItem,
  className,
  onWheel,
}: {
  count: number
  cols: number
  renderItem: (index: number) => ReactNode
  className?: string
  onWheel?: (e: ReactWheelEvent<HTMLDivElement>) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowCount = Math.ceil(count / cols)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 240,
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
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                columnGap: "1rem",
                paddingBottom: "1rem",
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
