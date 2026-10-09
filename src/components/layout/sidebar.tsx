import { useRef } from "react"
import {
  Palette,
  Search,
  Wrench,
  GraduationCap,
  FolderGit2,
  Settings,
  Boxes,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useLibrary, type ConnStatus } from "@/store/LibraryContext"
import type { ModuleKey } from "@/types"

const NAV: { key: ModuleKey; name: string; icon: LucideIcon }[] = [
  { key: "art-direction", name: "美术设定", icon: Palette },
  { key: "asset-search", name: "资产库", icon: Search },
  { key: "tools", name: "工具", icon: Wrench },
  { key: "tutorial", name: "教程", icon: GraduationCap },
  { key: "output", name: "输出", icon: FolderGit2 },
]

const STATUS_DOT: Record<ConnStatus, string> = {
  none: "bg-muted-foreground/50",
  connected: "bg-emerald-500",
  error: "bg-red-500",
}

const STATUS_TEXT: Record<ConnStatus, string> = {
  none: "未连接",
  connected: "已连接",
  error: "路径不可访问",
}

export function Sidebar({
  active,
  onChange,
  settingsOpen,
  onToggleSettings,
}: {
  active: ModuleKey
  onChange: (key: ModuleKey) => void
  settingsOpen: boolean
  onToggleSettings: (origin?: { x: number; y: number }) => void
}) {
  const { libraries, activeLibrary, status, setActiveLibrary } = useLibrary()
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
          {NAV.map(({ key, name, icon: Icon }) => (
            <Button
              key={key}
              variant={active === key ? "secondary" : "ghost"}
              className={cn(
                "justify-start",
                active === key && "bg-accent text-accent-foreground",
              )}
              onClick={() => onChange(key)}
            >
              <Icon className="h-4 w-4" />
              {name}
            </Button>
          ))}
        </nav>
      </ScrollArea>
      <Separator />
      <div className="flex flex-col gap-1.5 p-2">
        <div className="flex items-center gap-2 px-1">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[status])}
          />
          <select
            value={activeLibrary?.id ?? ""}
            onChange={(e) => e.target.value && setActiveLibrary(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {libraries.length === 0 ? (
              <option value="" disabled>
                未添加资源库
              </option>
            ) : (
              libraries.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="truncate px-1 text-[10px] text-muted-foreground">
          {activeLibrary ? activeLibrary.path : STATUS_TEXT[status]}
        </div>
        <Button
          ref={settingsBtnRef}
          variant={settingsOpen ? "secondary" : "ghost"}
          className={cn(
            "justify-start",
            settingsOpen
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground",
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
