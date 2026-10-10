import { useState } from "react"
import { Play, Maximize, ExternalLink, FolderOpen, PenLine, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Thumbnail, FullImage, FileIcon } from "@/components/Thumbnail"
import { TagEditor } from "@/components/TagEditor"
import { api, assetUrl } from "@/api"
import { IMAGE_EXTS, VIDEO_EXTS } from "@/lib/formats"
import { cn } from "@/lib/utils"
import type { Asset } from "@/types"

export function AssetDetail({
  asset,
  onUpdate,
  onRename,
}: {
  asset: Asset
  onUpdate: (id: string, patch: { tags?: string[] }) => Promise<void>
  onRename: (asset: Asset) => void
}) {
  const [imgIdx, setImgIdx] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const isVideo = VIDEO_EXTS.has(asset.ext)
  const previews = asset.preview_paths
  const idx = Math.min(imgIdx, Math.max(0, previews.length - 1))
  const currentImg = previews[idx] ?? (IMAGE_EXTS.has(asset.ext) ? asset.path : null)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">资产详情</span>
        <Button size="sm" variant="ghost" onClick={() => onRename(asset)}>
          <PenLine className="h-4 w-4" />
          重命名
        </Button>
      </div>

      {/* 预览区：填满详情面板剩余高度，媒体居中 */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        {isVideo ? (
          <>
            {playing && (
              <video
                src={assetUrl(asset.path)}
                controls
                controlsList="nofullscreen"
                className="max-h-full max-w-full rounded-lg bg-black object-contain"
              />
            )}
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" onClick={() => setPlaying((p) => !p)}>
                <Play className="h-4 w-4" />
                {playing ? "收起" : "播放"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFullscreen(true)}>
                <Maximize className="h-4 w-4" />
                全屏
              </Button>
              <Button size="sm" variant="ghost" onClick={() => api.openUrl(asset.path)}>
                <ExternalLink className="h-4 w-4" />
                外部播放器
              </Button>
            </div>
          </>
        ) : currentImg ? (
          <Thumbnail
            path={currentImg}
            alt={asset.name}
            className="max-h-full max-w-full cursor-zoom-in rounded-lg object-contain"
            onClick={() => setZoomed(true)}
          />
        ) : (
          <FileIcon path={asset.path} className="h-40 rounded-lg" />
        )}
      </div>

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
        {asset.category && asset.category !== "未分类" ? (
          <Badge>{asset.category}</Badge>
        ) : (
          <Badge variant="outline" className="border-transparent bg-muted font-normal text-muted-foreground">未分类</Badge>
        )}
        <span className="text-xs text-muted-foreground">{asset.ext}</span>
      </div>
      <Separator />
      <Row label="路径" value={asset.path} />
      <Row label="大小" value={formatSize(asset.size)} />
      <div className="rounded-md border border-dashed border-border p-2">
        <div className="mb-1.5 text-sm font-medium text-muted-foreground">标签</div>
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

      {fullscreen && isVideo && (
        <div
          className="fixed inset-0 z-50 bg-black"
          onClick={() => setFullscreen(false)}
        >
          <video
            src={assetUrl(asset.path)}
            controls
            controlsList="nofullscreen"
            className="h-full w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-3 top-3 z-10 text-white"
            onClick={() => setFullscreen(false)}
          >
            <X className="h-4 w-4" />
            退出全屏
          </Button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </div>
  )
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
