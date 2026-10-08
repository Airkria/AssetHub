import { useEffect, useState } from "react"
import { api, assetUrl } from "@/api"
import { cn } from "@/lib/utils"

// 懒加载缩略图：优先用本地缓存的缩略图（快，且能解 TGA/EXR/HDR/DDS），生成失败回退原图
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
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setSrc(null)
    api
      .getThumbnail(path)
      .then((thumb) => {
        if (mounted) setSrc(assetUrl(thumb))
      })
      .catch(() => {
        if (mounted) setSrc(assetUrl(path))
      })
    return () => {
      mounted = false
    }
  }, [path])

  if (!src) {
    return <div className={cn("animate-pulse bg-muted", className)} onClick={onClick} />
  }
  return <img src={src} alt={alt} className={className} onClick={onClick} />
}
