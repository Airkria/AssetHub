import { useEffect, useState, type ReactNode } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { ArtDirection } from "@/modules/ArtDirection"
import { AssetLibrary } from "@/modules/AssetLibrary"
import { Tools } from "@/modules/Tools"
import { Tutorial } from "@/modules/Tutorial"
import { Output } from "@/modules/Output"
import { SettingsModal } from "@/modules/Settings"
import { useLibrary } from "@/store/LibraryContext"
import { isTauri } from "@/api"
import type { ModuleKey } from "@/types"

export default function App() {
  const [active, setActive] = useState<ModuleKey>("art-direction")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const { libraries, configLoaded } = useLibrary()

  // 首次打开且未配置资源库 → 自动弹出设置（等 config 加载完再判断，避免刷新误跳）
  useEffect(() => {
    if (isTauri && configLoaded && libraries.length === 0) setSettingsOpen(true)
  }, [configLoaded, libraries.length])

  const toggleSettings = (o?: { x: number; y: number }) => {
    if (settingsOpen) {
      setSettingsOpen(false)
    } else {
      setOrigin(o ?? null)
      setSettingsOpen(true)
    }
  }

  const wrapper = (key: ModuleKey, node: ReactNode) => (
    <div
      className={
        active === key
          ? "flex min-h-0 flex-1 flex-col"
          : "invisible absolute inset-0 flex flex-col"
      }
    >
      {node}
    </div>
  )

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        active={active}
        onChange={setActive}
        settingsOpen={settingsOpen}
        onToggleSettings={toggleSettings}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {wrapper("art-direction", <ArtDirection />)}
        {wrapper("asset-search", <AssetLibrary />)}
        {wrapper("tools", <Tools />)}
        {wrapper("tutorial", <Tutorial />)}
        {wrapper("output", <Output />)}
      </main>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        origin={origin}
      />
    </div>
  )
}
