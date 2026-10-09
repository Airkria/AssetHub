// 路径工具：Windows 路径比较，兼容 \ 与 /（资源管理器复制粘贴用 \）
export function normPath(s: string) {
  return s.replace(/\\/g, "/")
}

export function inFolder(path: string, folder: string) {
  if (!folder) return false
  const f = normPath(folder).replace(/\/+$/, "")
  return normPath(path).startsWith(f)
}

// 返回 path 相对 folder 的路径（不在 folder 下则返回空串）
export function relativeTo(path: string, folder: string) {
  if (!folder) return ""
  const f = normPath(folder).replace(/\/+$/, "")
  const p = normPath(path)
  if (!p.startsWith(f + "/")) return ""
  return p.slice(f.length + 1)
}
