import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { BoardView } from "@/modules/BoardView"
import { SettingsModal } from "@/modules/Settings"
import { useLibrary } from "@/store/LibraryContext"
import { isTauri } from "@/api"

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const { boards, activeBoard, configLoaded } = useLibrary()

  // 首次打开且未配置板块 → 自动弹出设置
  useEffect(() => {
    if (isTauri && configLoaded && boards.length === 0) setSettingsOpen(true)
  }, [configLoaded, boards.length])

  const toggleSettings = (o?: { x: number; y: number }) => {
    if (settingsOpen) {
      setSettingsOpen(false)
    } else {
      setOrigin(o ?? null)
      setSettingsOpen(true)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar settingsOpen={settingsOpen} onToggleSettings={toggleSettings} />
      <main className="flex min-w-0 flex-1 flex-col">
        {activeBoard ? (
          <BoardView board={activeBoard} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
            <p>还没有板块</p>
            <p className="mt-1 text-xs">点左下角「设置」→「板块」添加并扫描</p>
          </div>
        )}
      </main>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        origin={origin}
      />
    </div>
  )
}
