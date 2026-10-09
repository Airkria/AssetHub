import { useEffect, useState } from "react"
import { api, assetUrl } from "@/api"
import { useLibrary } from "@/store/LibraryContext"
import { NATIVE_IMAGE_EXTS } from "@/lib/formats"
import { cn } from "@/lib/utils"

// —— 缩略图前端缓存 ——
// 已解析过的路径直接命中，避免每次挂载都走 IPC + 后端 NAS stat。
const urlCache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

// 并发闸门：限制同时进行的解码 IPC 数，防止快速滚动时的请求风暴。
const MAX_CONCURRENT = 8
let active = 0
const waiters: Array<() => void> = []

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++
    return Promise.resolve()
  }
  return new Promise((resolve) => waiters.push(resolve))
}

function release() {
  const next = waiters.shift()
  if (next) next()
  else active--
}

// 返回缓存命中（同步 string）或进行中的 promise（去重）。
function resolveThumb(path: string): string | Promise<string> {
  const hit = urlCache.get(path)
  if (hit !== undefined) return hit
  let p = inflight.get(path)
  if (!p) {
    p = (async () => {
      await acquire()
      try {
        const url = assetUrl(await api.getThumbnail(path))
        urlCache.set(path, url)
        return url
      } catch {
        const url = assetUrl(path)
        urlCache.set(path, url)
        return url
      } finally {
        release()
      }
    })()
    inflight.set(path, p)
    p.finally(() => inflight.delete(path))
  }
  return p
}

// 懒加载缩略图：优先本地缓存的缩略图（快，且能解 TGA/EXR/HDR/DDS），生成失败回退原图
export function Thumbnail({
  path,
  className,
  alt,
  onClick,
}: {
  path: string
  className?: string
  alt?: string
  onClick?: () => void
}) {
  const [src, setSrc] = useState<string | null>(() => urlCache.get(path) ?? null)

  useEffect(() => {
    let mounted = true
    const r = resolveThumb(path)
    if (typeof r === "string") {
      setSrc(r)
    } else {
      r.then((u) => {
        if (mounted) setSrc(u)
      })
    }
    return () => {
      mounted = false
    }
  }, [path])

  if (!src) {
    return <div className={cn("animate-pulse bg-muted", className)} onClick={onClick} />
  }
  return <img src={src} alt={alt} className={className} onClick={onClick} draggable={false} />
}

// 视频首帧缩略图：隐藏 video + canvas 取帧，前端缓存；失败回退深色占位
const videoThumbCache = new Map<string, string>()

export function VideoThumbnail({ path, className }: { path: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(() => videoThumbCache.get(path) ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const hit = videoThumbCache.get(path)
    if (hit) {
      setSrc(hit)
      return
    }

    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.preload = "auto"
    video.crossOrigin = "anonymous"
    video.src = assetUrl(path)

    const capture = (): string | null => {
      try {
        const w = video.videoWidth || 320
        const h = video.videoHeight || 180
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) return null
        ctx.drawImage(video, 0, 0, w, h)
        return canvas.toDataURL("image/jpeg", 0.7)
      } catch {
        return null
      }
    }

    const apply = (url: string | null) => {
      if (cancelled) return
      if (url) {
        videoThumbCache.set(path, url)
        setSrc(url)
      } else {
        setFailed(true)
      }
    }

    video.onloadeddata = () => {
      if (video.duration > 0.1) {
        video.currentTime = 0.1
      } else {
        apply(capture())
        video.remove()
      }
    }
    video.onseeked = () => {
      apply(capture())
      video.remove()
    }
    video.onerror = () => {
      if (!cancelled) setFailed(true)
      video.remove()
    }

    return () => {
      cancelled = true
      video.remove()
    }
  }, [path])

  if (src) {
    return <img src={src} className={cn("object-cover", className)} />
  }
  if (failed) {
    return <div className={cn("bg-gradient-to-br from-slate-600 to-slate-800", className)} />
  }
  return <div className={cn("animate-pulse bg-muted", className)} />
}

// 文件关联图标（exe 等非图片文件）：后端提取系统图标，前端缓存
const iconCache = new Map<string, string>()

export function FileIcon({ path, className }: { path: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(() => iconCache.get(path) ?? null)

  useEffect(() => {
    let mounted = true
    const hit = iconCache.get(path)
    if (hit) {
      setSrc(hit)
      return
    }
    api
      .getFileIcon(path)
      .then((p) => {
        if (!p) return
        const url = assetUrl(p)
        iconCache.set(path, url)
        if (mounted) setSrc(url)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [path])

  if (!src) {
    return <div className={cn("bg-muted", className)} />
  }
  return <img src={src} className={cn("object-contain", className)} />
}

// 全尺寸图（放大预览用）：web 可解码的格式直读原图；tga/exr/hdr/dds/psd/tif 由后端按 zoom_max_px 解码
export function FullImage({
  path,
  className,
  alt,
}: {
  path: string
  className?: string
  alt?: string
}) {
  const { config } = useLibrary()
  const maxPx = config.zoom_max_px || 2048
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  const isNative = NATIVE_IMAGE_EXTS.has(ext)
  const [src, setSrc] = useState<string | null>(isNative ? assetUrl(path) : null)

  useEffect(() => {
    if (isNative) return
    let mounted = true
    api
      .getFullImage(path, maxPx)
      .then((u) => {
        if (mounted) setSrc(assetUrl(u))
      })
      .catch(() => {
        if (mounted) setSrc(assetUrl(path))
      })
    return () => {
      mounted = false
    }
  }, [path, isNative, maxPx])

  if (!src) {
    return <div className={cn("animate-pulse bg-muted", className)} />
  }
  return <img src={src} alt={alt} className={className} draggable={false} />
}
