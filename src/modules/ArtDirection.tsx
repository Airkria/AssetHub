import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react"
import { Search, PenLine, Check, X } from "lucide-react"
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { TagEditor } from "@/components/TagEditor"
import { useLibrary } from "@/store/LibraryContext"
import { assetUrl } from "@/api"
import { inFolder } from "@/lib/path"
import { cn } from "@/lib/utils"
import { useThumbSize } from "@/hooks/useThumbSize"
import type { Asset } from "@/types"

const DISPLAYABLE = new Set(["png", "jpg", "jpeg", "webp", "bmp", "gif"])

export function ArtDirection() {
  const { assets, config, updateMetadata, renameAsset } = useLibrary()
  const { cols, setCols, gridStyle, onWheel } = useThumbSize(3)
  const [query, setQuery] = useState("")
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [detailWidth, setDetailWidth] = useState(288)

  const artAssets = useMemo(() => {
    return assets.filter((a) => {
      if (a.is_preview) return false
      if (config.art_folder) return inFolder(a.path, config.art_folder)
      return DISPLAYABLE.has(a.ext)
    })
  }, [assets, config.art_folder])

  const suggested = useMemo(() => {
    const s = new Set<string>()
    for (const a of artAssets) for (const t of a.tags) s.add(t)
    return Array.from(s)
  }, [artAssets])

  const filtered = useMemo(() => {
    if (!query) return artAssets
    const q = query.toLowerCase()
    return artAssets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [artAssets, query])

  const current = useMemo(
    () => artAssets.find((a) => a.id === currentId) ?? null,
    [artAssets, currentId],
  )

  const startDrag = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const onMove = (ev: MouseEvent) => {
      const w = window.innerWidth - ev.clientX
      setDetailWidth(Math.min(520, Math.max(220, w)))
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleHeader title="美术设定" description="审美累计与灵感搜索">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索名称或标签..."
            className="w-64 pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <input
          type="range"
          min={2}
          max={6}
          step={1}
          value={cols}
          onChange={(e) => setCols(Number(e.target.value))}
          className="w-24 accent-primary"
          title="缩略图大小（Ctrl+滚轮也可调整）"
        />
      </ModuleHeader>

      <div className="flex min-h-0 flex-1">
        <ScrollArea className="flex-1 px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <p>暂无美术参考</p>
              <p className="mt-1 text-xs">
                {config.art_folder
                  ? "请在该文件夹放入参考图后重新扫描"
                  : "未配置美术设定文件夹（设置 → 路径设置）"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4" style={gridStyle} onWheel={onWheel}>
              {filtered.map((a) => (
                <Card
                  key={a.id}
                  className={cn(
                    "cursor-pointer overflow-hidden",
                    currentId === a.id && "ring-2 ring-ring",
                  )}
                  onClick={() => setCurrentId(a.id)}
                >
                  {DISPLAYABLE.has(a.ext) || a.preview_paths[0] ? (
                    <img
                      src={assetUrl(a.preview_paths[0] ?? a.path)}
                      alt={a.name}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[4/3] bg-gradient-to-br from-slate-600 to-slate-800" />
                  )}
                  <div className="p-2">
                    <div className="truncate text-sm">{a.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] text-muted-foreground">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        <div
          onMouseDown={startDrag}
          className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/50"
        />

        <aside
          style={{ width: detailWidth }}
          className="shrink-0 border-l bg-card p-4"
        >
          {current ? (
            <ArtDetail
              asset={current}
              suggested={suggested}
              onUpdate={updateMetadata}
              onRename={renameAsset}
            />
          ) : (
            <p className="text-sm text-muted-foreground">点击左侧图片查看详情</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function ArtDetail({
  asset,
  suggested,
  onUpdate,
  onRename,
}: {
  asset: Asset
  suggested: string[]
  onUpdate: (id: string, patch: { tags?: string[] }) => Promise<void>
  onRename: (id: string, newStem: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [stem, setStem] = useState(asset.stem)
  const [zoomed, setZoomed] = useState(false)

  const commitRename = async () => {
    const s = stem.trim()
    if (s && s !== asset.stem) await onRename(asset.id, s)
    setEditing(false)
  }

  const img = asset.preview_paths[0] ?? (DISPLAYABLE.has(asset.ext) ? asset.path : null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">详情</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setStem(asset.stem)
            setEditing(true)
          }}
        >
          <PenLine className="h-4 w-4" />
          重命名
        </Button>
      </div>

      {img ? (
        <img
          src={assetUrl(img)}
          alt={asset.name}
          className="aspect-video w-full cursor-zoom-in rounded-lg object-cover"
          onClick={() => setZoomed(true)}
        />
      ) : (
        <div className="aspect-video w-full rounded-lg bg-gradient-to-br from-slate-600 to-slate-800" />
      )}

      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            className="h-8 text-xs"
            autoFocus
          />
          <span className="text-xs text-muted-foreground">.{asset.ext}</span>
          <Button size="sm" onClick={commitRename}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="break-all text-base font-semibold">{asset.name}</div>
      )}

      <div>
        <div className="mb-1 text-xs text-muted-foreground">标签</div>
        <TagEditor
          tags={asset.tags}
          suggested={suggested}
          onChange={(tags) => onUpdate(asset.id, { tags })}
        />
      </div>

      {zoomed && img && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
          onClick={() => setZoomed(false)}
        >
          <img src={assetUrl(img)} alt={asset.name} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}
