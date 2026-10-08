import { useEffect, useMemo, useState } from "react"
import {
  Search,
  PenLine,
  Check,
  X,
  Trash2,
  ExternalLink,
  FolderOpen,
} from "lucide-react"
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLibrary } from "@/store/LibraryContext"
import { api } from "@/api"
import { inFolder } from "@/lib/path"
import type { Asset } from "@/types"

export function Tools() {
  const { assets, config, updateMetadata, renameAsset, deleteAsset } = useLibrary()
  const [query, setQuery] = useState("")

  const toolAssets = useMemo(() => {
    return assets.filter((a) => !a.is_preview && inFolder(a.path, config.tools_folder))
  }, [assets, config.tools_folder])

  const filtered = useMemo(() => {
    if (!query) return toolAssets
    const q = query.toLowerCase()
    return toolAssets.filter((a) => a.name.toLowerCase().includes(q))
  }, [toolAssets, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleHeader title="工具" description="集中管理的可用工具与安装包">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索工具..."
            className="w-64 pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </ModuleHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <p>暂无工具</p>
            <p className="mt-1 text-xs">
              {config.tools_folder
                ? "请把 exe / 安装包放入工具文件夹后重新扫描"
                : "未配置工具文件夹（设置 → 路径设置）"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => (
              <ToolCard
                key={a.id}
                asset={a}
                onUpdate={updateMetadata}
                onRename={renameAsset}
                onDelete={deleteAsset}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCard({
  asset,
  onUpdate,
  onRename,
  onDelete,
}: {
  asset: Asset
  onUpdate: (id: string, patch: { description?: string; link?: string }) => Promise<void>
  onRename: (id: string, newName: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [desc, setDesc] = useState(asset.description)
  const [link, setLink] = useState(asset.link)
  const [stem, setStem] = useState(asset.stem)
  const [editingName, setEditingName] = useState(false)

  useEffect(() => {
    setDesc(asset.description)
    setLink(asset.link)
    setStem(asset.stem)
  }, [asset.id, asset.description, asset.link, asset.stem])

  const saveDesc = () => {
    if (desc !== asset.description) onUpdate(asset.id, { description: desc })
  }
  const saveLink = () => {
    if (link !== asset.link) onUpdate(asset.id, { link })
  }

  const commitRename = () => {
    const s = stem.trim()
    if (s && s !== asset.stem) onRename(asset.id, s)
    setEditingName(false)
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        {editingName ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              className="h-7 text-sm"
              autoFocus
            />
            <span className="text-xs text-muted-foreground">.{asset.ext}</span>
            <Button size="sm" onClick={commitRename}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate font-medium">{asset.name}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStem(asset.stem)
                setEditingName(true)
              }}
            >
              <PenLine className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(asset.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <Input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={saveDesc}
        placeholder="说明（用途）"
        className="mt-2 h-8 text-sm"
      />

      <div className="mt-2 flex gap-1">
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={saveLink}
          placeholder="官网链接"
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
