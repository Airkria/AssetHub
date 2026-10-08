import { useEffect, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { ArtDirection } from "@/modules/ArtDirection"
import { AssetLibrary } from "@/modules/AssetLibrary"
import { Tools } from "@/modules/Tools"
import { Tutorial } from "@/modules/Tutorial"
import { Output } from "@/modules/Output"
import { Settings } from "@/modules/Settings"
import { useLibrary } from "@/store/LibraryContext"
import { isTauri } from "@/api"
import type { ModuleKey } from "@/types"

export default function App() {
  const [active, setActive] = useState<ModuleKey>("art-direction")
  const { libraries } = useLibrary()

  // 首次打开且未配置资源库 → 自动进入设置
  useEffect(() => {
    if (isTauri && libraries.length === 0) setActive("settings")
  }, [libraries.length])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar active={active} onChange={setActive} />
      <main className="flex min-w-0 flex-1 flex-col">
        {active === "art-direction" && <ArtDirection />}
        {active === "asset-search" && <AssetLibrary />}
        {active === "tools" && <Tools />}
        {active === "tutorial" && <Tutorial />}
        {active === "output" && <Output />}
        {active === "settings" && <Settings />}
      </main>
    </div>
  )
}
