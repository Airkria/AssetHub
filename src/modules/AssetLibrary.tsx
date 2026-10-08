import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react"
import { Search, FolderOpen, LayoutGrid, Tags } from "lucide-react"
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { VirtualGrid } from "@/components/VirtualGrid"
import { Thumbnail } from "@/components/Thumbnail"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TagEditor } from "@/components/TagEditor"
import { useLibrary } from "@/store/LibraryContext"
import { api } from "@/api"
import { inFolder } from "@/lib/path"
import { cn } from "@/lib/utils"
import { useThumbSize } from "@/hooks/useThumbSize"
import type { Asset } from "@/types"

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

export function AssetLibrary() {
  const { assets, config, updateMetadata } = useLibrary()
  const { cols, setCols, onWheel } = useThumbSize(3)
  const [mode, setMode] = useState<"category" | "tag">("category")
  const [category, setCategory] = useState("全部")
  const [tag, setTag] = useState("全部")
  const [query, setQuery] = useState("")
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [detailWidth, setDetailWidth] = useState(288)

  const mainAssets = useMemo(
    () =>
      assets.filter((a) => {
        if (a.is_preview) return false
        if (config.art_folder && inFolder(a.path, config.art_folder)) return false
        if (config.tools_folder && inFolder(a.path, config.tools_folder)) return false
        return true
      }),
    [assets, config.art_folder, config.tools_folder],
  )

  const categories = useMemo(() => {
    const s = new Set<string>()
    for (const a of mainAssets) if (a.category) s.add(a.category)
    return ["全部", ...Array.from(s).sort()]
  }, [mainAssets])

  const tags = useMemo(() => {
    const s = new Set<string>()
    for (const a of mainAssets) for (const t of a.tags) s.add(t)
    return ["全部", ...Array.from(s).sort()]
  }, [mainAssets])

  const filtered = useMemo(() => {
    return mainAssets.filter((a) => {
      if (query) {
        const q = query.toLowerCase()
        const hit =
          a.name.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
        if (!hit) return false
      }
      if (mode === "category") {
        if (category !== "全部" && a.category !== category) return false
      } else {
        if (tag !== "全部" && !a.tags.includes(tag)) return false
      }
      return true
    })
  }, [mainAssets, mode, category, tag, query])

  const current = useMemo(
    () => mainAssets.find((a) => a.id === currentId) ?? null,
    [mainAssets, currentId],
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
      <ModuleHeader title="资产库" description="浏览、搜索、拿取素材">
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
        <aside className="w-48 shrink-0 border-r p-3">
          <div className="mb-2 flex gap-1">
            <Button
              size="sm"
              variant={mode === "category" ? "secondary" : "ghost"}
              className="flex-1"
              onClick={() => setMode("category")}
            >
              <LayoutGrid className="h-4 w-4" />
              类别
            </Button>
            <Button
              size="sm"
              variant={mode === "tag" ? "secondary" : "ghost"}
              className="flex-1"
              onClick={() => setMode("tag")}
            >
              <Tags className="h-4 w-4" />
              标签
            </Button>
          </div>
          <ScrollArea className="h-full">
            <div className="space-y-0.5">
              {(mode === "category" ? categories : tags).map((c) => (
                <button
                  key={c}
                  onClick={() => (mode === "category" ? setCategory(c) : setTag(c))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
                    (mode === "category" ? category : tag) === c
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="truncate">{c}</span>
                  <span className="text-xs text-muted-foreground">
                    {c === "全部"
                      ? mainAssets.length
                      : mode === "category"
                        ? mainAssets.filter((a) => a.category === c).length
                        : mainAssets.filter((a) => a.tags.includes(c)).length}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-end border-b px-4 py-2">
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
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
              <p>暂无资产</p>
              <p className="mt-1 text-xs">请先在「设置」中配置资源库并扫描</p>
            </div>
          ) : (
            <VirtualGrid
              count={filtered.length}
              cols={cols}
              rowHeight={250}
              className="flex-1 min-w-0 overflow-auto px-6 py-4"
              onWheel={onWheel}
              renderItem={(i) => {
                const a = filtered[i]
                return (
                  <Card
                    key={a.id}
                    className={cn(
                      "cursor-pointer overflow-hidden",
                      currentId === a.id && "ring-2 ring-ring",
                    )}
                    onClick={() => setCurrentId(a.id)}
                  >
                    {a.preview_paths[0] ? (
                      <Thumbnail
                        path={a.preview_paths[0]}
                        alt={a.name}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div
                        className={cn(
                          "h-40 bg-gradient-to-br",
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
            <AssetDetail
              asset={current}
              suggested={tags.filter((t) => t !== "全部")}
              onUpdate={updateMetadata}
            />
          ) : (
            <p className="text-sm text-muted-foreground">点击左侧资产查看详情</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function AssetDetail({
  asset,
  suggested,
  onUpdate,
}: {
  asset: Asset
  suggested: string[]
  onUpdate: (id: string, patch: { tags?: string[] }) => Promise<void>
}) {
  const [imgIdx, setImgIdx] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const previews = asset.preview_paths
  const idx = Math.min(imgIdx, Math.max(0, previews.length - 1))
  const currentImg = previews[idx] ?? null

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">资产详情</div>
      {currentImg ? (
        <Thumbnail
          path={currentImg}
          alt={asset.name}
          className="aspect-video w-full cursor-zoom-in rounded-lg object-cover"
          onClick={() => setZoomed(true)}
        />
      ) : (
        <div
          className={cn(
            "aspect-video w-full rounded-lg bg-gradient-to-br",
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
          suggested={suggested}
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
          <Thumbnail path={currentImg} alt={asset.name} className="max-h-full max-w-full object-contain" />
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
