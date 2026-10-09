// 图片扩展名（可作为预览图，也可作为独立贴图资产）
export const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "tga",
  "exr",
  "hdr",
  "dds",
  "psd",
  "tif",
  "tiff",
])

// webview 原生可解码的图片格式（其余 IMAGE_EXTS 放大时需后端解码）
export const NATIVE_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"])

// 视频格式（webview 原生 <video> 可播放）
export const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "m4v"])
