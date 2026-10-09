import { useEffect, type CSSProperties } from "react"
import { cn } from "@/lib/utils"

export interface ContextMenuItem {
  label: string
  danger?: boolean
  onClick: () => void
}

// 简单的自定义右键菜单：定位到鼠标位置，点击外部 / Esc 关闭。
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}) {
  useEffect(() => {
    const close = () => onClose()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("mousedown", close)
    window.addEventListener("blur", close)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", close)
      window.removeEventListener("blur", close)
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  // 估算尺寸做边界钳制，避免菜单超出视口
  const width = 180
  const height = items.length * 36 + 8
  const style: CSSProperties = {
    position: "fixed",
    left: Math.min(x, window.innerWidth - width),
    top: Math.min(y, window.innerHeight - height),
    zIndex: 100,
  }

  return (
    <div
      style={style}
      className="min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => {
            onClose()
            it.onClick()
          }}
          className={cn(
            "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm",
            it.danger
              ? "text-destructive hover:bg-destructive/10"
              : "hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
