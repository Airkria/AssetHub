import { useEffect, useMemo, useState } from "react"
import { Search, ExternalLink, FolderOpen } from "lucide-react"
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLibrary } from "@/store/LibraryContext"
import { api } from "@/api"
import { inFolder } from "@/lib/path"
import type { Asset } from "@/types"

export function Tutorial() {
  const { assets, activeLibrary, updateMetadata } = useLibrary()
  const tutorialFolder = activeLibrary?.tutorial_folder ?? ""
  const [query, setQuery] = useState("")

  const tutorialAssets = useMemo(
    () => assets.filter((a) => !a.is_preview && inFolder(a.path, tutorialFolder)),
    [assets, tutorialFolder],
  )

  const filtered = useMemo(() => {
    if (!query) return tutorialAssets
    const q = query.toLowerCase()
    return tutorialAssets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q),
    )
  }, [tutorialAssets, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleHeader title="教程" description="各类教程汇总">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索教程..."
            className="w-64 pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </ModuleHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <p>暂无教程</p>
            <p className="mt-1 text-xs">
              {tutorialFolder
                ? "请在该文件夹放入教程文件后重新扫描"
                : "未配置教程文件夹（设置 → 资产库设置）"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => (
              <TutorialCard key={a.id} asset={a} onUpdate={updateMetadata} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TutorialCard({
  asset,
  onUpdate,
}: {
  asset: Asset
  onUpdate: (id: string, patch: { description?: string; link?: string }) => Promise<void>
}) {
  const [desc, setDesc] = useState(asset.description)
  const [link, setLink] = useState(asset.link)

  useEffect(() => {
    setDesc(asset.description)
    setLink(asset.link)
  }, [asset.id, asset.description, asset.link])

  const saveDesc = () => {
    if (desc !== asset.description) onUpdate(asset.id, { description: desc })
  }
  const saveLink = () => {
    if (link !== asset.link) onUpdate(asset.id, { link })
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{asset.name}</span>
        <Badge variant="outline">{asset.ext}</Badge>
      </div>

      <Input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={saveDesc}
        placeholder="说明（内容简介）"
        className="mt-2 h-8 text-sm"
      />

      <div className="mt-2 flex gap-1">
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={saveLink}
          placeholder="教程链接"
          className="h-8 flex-1 text-sm"
        />
        {link && (
          <Button size="sm" variant="outline" onClick={() => api.openUrl(link)}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => api.revealInFolder(asset.path)}
        >
          <FolderOpen className="h-4 w-4" />
          打开位置
        </Button>
      </div>
    </Card>
  )
}
