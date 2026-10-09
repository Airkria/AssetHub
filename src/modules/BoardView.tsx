import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react"
import { Search, FolderOpen } from "lucide-react"
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VirtualGrid } from "@/components/VirtualGrid"
import { Thumbnail, FullImage } from "@/components/Thumbnail"
import { ContextMenu } from "@/components/ContextMenu"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TagEditor } from "@/components/TagEditor"
import { useLibrary } from "@/store/LibraryContext"
import { api, askConfirm } from "@/api"
import { IMAGE_EXTS } from "@/lib/formats"
import { cn } from "@/lib/utils"
import { useThumbSize } from "@/hooks/useThumbSize"
import type { Asset, BoardConfig } from "@/types"

const FALLBACKS = [
  "from-slate-600 to-slate-800",
  "from-violet-500 to-fuchsia-600",
  "from-orange-500 to-red-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-700",
  "from-rose-500 to-pink-500",
]

function fallbackGradient(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return FALLBACKS[h % FALLBACKS.length]
}

export function BoardView({ board }: { board: BoardConfig }) {
  const { assets, updateMetadata, deleteAsset } = useLibrary()
  const { cols, setCols, onWheel } = useThumbSize(3)
  const [query, setQuery] = useState("")
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [detailWidth, setDetailWidth] = useState(288)
  const [menu, setMenu] = useState<{ x: number; y: number; asset: Asset } | null>(null)

  const filtered = useMemo(() => {
    if (!query) return assets
    const q = query.toLowerCase()
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [assets, query])

  const current = useMemo(
    () => assets.find((a) => a.id === currentId) ?? null,
    [assets, currentId],
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
      <ModuleHeader title={board.name} description={board.folder}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索名称或标签..."
            className="w-64 pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </ModuleHeader>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-end border-b px-4 py-2">
            <input
              type="range"
              min={2}
              max={6}
              step={1}
              value={8 - cols}
              onChange={(e) => setCols(8 - Number(e.target.value))}
              className="w-24 accent-primary"
              title="缩略图大小（Ctrl+滚轮也可调整）"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
              <p>暂无资产</p>
              <p className="mt-1 text-xs">请在「设置 → 显示设置」配置板块并扫描</p>
            </div>
          ) : (
            <VirtualGrid
              count={filtered.length}
              cols={cols}
              className="flex-1 min-w-0 overflow-auto px-6 py-4"
              onWheel={onWheel}
              renderItem={(i) => {
                const a = filtered[i]
                const imgPath =
                  a.preview_paths[0] ?? (IMAGE_EXTS.has(a.ext) ? a.path : null)
                return (
                  <Card
                    key={a.id}
                    className={cn(
                      "cursor-pointer overflow-hidden",
                      currentId === a.id && "ring-2 ring-ring",
                    )}
                    draggable
                    onDragStart={(e) => {
                      e.preventDefault()
                      api.startDrag([a.path])
                    }}
                    onClick={() => setCurrentId(a.id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setMenu({ x: e.clientX, y: e.clientY, asset: a })
                    }}
                  >
                    {imgPath ? (
                      <Thumbnail
                        path={imgPath}
                        alt={a.name}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div
                        className={cn(
                          "aspect-square bg-gradient-to-br",
                          fallbackGradient(a.id),
                        )}
                      />
                    )}
                    <div className="p-3">
                      <div className="truncate text-sm font-medium">{a.name}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge variant="outline">{a.category || "未分类"}</Badge>
                        <span className="text-xs text-muted-foreground">{a.ext}</span>
                      </div>
                    </div>
                  </Card>
                )
              }}
            />
          )}
        </div>

        <div
          onMouseDown={startDrag}
          className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/50"
        />

        <aside
          style={{ width: detailWidth }}
          className="shrink-0 border-l bg-card p-4"
        >
          {current ? (
            <AssetDetail asset={current} onUpdate={updateMetadata} />
          ) : (
            <p className="text-sm text-muted-foreground">点击左侧资产查看详情</p>
          )}
        </aside>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "打开文件位置",
              onClick: () => api.revealInFolder(menu.asset.path),
            },
            {
              label: "复制文件路径",
              onClick: () => navigator.clipboard.writeText(menu.asset.path),
            },
            {
              label: "删除资产",
              danger: true,
              onClick: async () => {
                const ok = await askConfirm(
                  `确定删除「${menu.asset.name}」吗？文件将从磁盘移除。`,
                  "删除资产",
                )
                if (ok) await deleteAsset(menu.asset.id)
              },
            },
          ]}
        />
      )}
    </div>
  )
}

function AssetDetail({
  asset,
  onUpdate,
}: {
  asset: Asset
  onUpdate: (id: string, patch: { tags?: string[] }) => Promise<void>
}) {
  const [imgIdx, setImgIdx] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const previews = asset.preview_paths
  const idx = Math.min(imgIdx, Math.max(0, previews.length - 1))
  const currentImg = previews[idx] ?? (IMAGE_EXTS.has(asset.ext) ? asset.path : null)

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">资产详情</div>
      {currentImg ? (
        <Thumbnail
          path={currentImg}
          alt={asset.name}
          className="max-h-80 w-full cursor-zoom-in rounded-lg object-contain"
          onClick={() => setZoomed(true)}
        />
      ) : (
        <div
          className={cn(
            "h-40 w-full rounded-lg bg-gradient-to-br",
            fallbackGradient(asset.id),
          )}
        />
      )}

      {previews.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {previews.map((p, i) => (
            <Thumbnail
              key={p}
              path={p}
              alt={`${asset.name} 预览 ${i + 1}`}
              onClick={() => setImgIdx(i)}
              className={cn(
                "h-12 w-12 shrink-0 cursor-pointer rounded object-cover",
                i === idx ? "ring-2 ring-ring" : "opacity-60 hover:opacity-100",
              )}
            />
          ))}
        </div>
      )}

      <div className="break-all text-base font-semibold">{asset.name}</div>
      <div className="flex items-center gap-2">
        <Badge>{asset.category || "未分类"}</Badge>
        <span className="text-xs text-muted-foreground">{asset.ext}</span>
      </div>
      <Separator />
      <Row label="路径" value={asset.path} />
      <Row label="大小" value={formatSize(asset.size)} />
      <div>
        <div className="mb-1 text-xs text-muted-foreground">标签</div>
        <TagEditor
          tags={asset.tags}
          suggested={[]}
          onChange={(tags) => onUpdate(asset.id, { tags })}
        />
      </div>
      <Button
        size="sm"
        className="w-full"
        onClick={() => api.revealInFolder(asset.path)}
      >
        <FolderOpen className="h-4 w-4" />
        打开文件位置
      </Button>

      {zoomed && currentImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
          onClick={() => setZoomed(false)}
        >
          <FullImage path={currentImg} alt={asset.name} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all text-right text-xs">{value}</span>
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
