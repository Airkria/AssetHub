// 路径工具：Windows 路径比较，兼容 \ 与 /（资源管理器复制粘贴用 \）
export function normPath(s: string) {
  return s.replace(/\\/g, "/")
}

export function inFolder(path: string, folder: string) {
  if (!folder) return false
  const f = normPath(folder).replace(/\/+$/, "")
  return normPath(path).startsWith(f)
}
