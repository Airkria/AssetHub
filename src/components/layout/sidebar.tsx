import { useRef } from "react"
import { LayoutGrid, Settings, Boxes } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useLibrary } from "@/store/LibraryContext"

export function Sidebar({
  settingsOpen,
  onToggleSettings,
}: {
  settingsOpen: boolean
  onToggleSettings: (origin?: { x: number; y: number }) => void
}) {
  const { boards, activeBoardId, setActiveBoard } = useLibrary()
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 px-4">
        <Boxes className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">AssetHub</span>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {boards.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              还没有板块，去设置里添加
            </p>
          ) : (
            boards.map((b) => (
              <Button
                key={b.id}
                variant={activeBoardId === b.id ? "secondary" : "ghost"}
                className={cn(
                  "justify-start",
                  activeBoardId === b.id && "bg-accent text-accent-foreground",
                )}
                onClick={() => setActiveBoard(b.id)}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="truncate">{b.name}</span>
              </Button>
            ))
          )}
        </nav>
      </ScrollArea>
      <Separator />
      <div className="flex flex-col gap-1.5 p-2">
        <Button
          ref={settingsBtnRef}
          variant={settingsOpen ? "secondary" : "ghost"}
          className={cn(
            "justify-start",
            settingsOpen ? "bg-accent text-accent-foreground" : "text-muted-foreground",
          )}
          onClick={() => {
            const rect = settingsBtnRef.current?.getBoundingClientRect()
            onToggleSettings(
              rect
                ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                : undefined,
            )
          }}
        >
          <Settings className="h-4 w-4" />
          设置
        </Button>
      </div>
    </aside>
  )
}
