import { useMemo, useState } from "react"
import { Search, FolderOpen } from "lucide-react"
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLibrary } from "@/store/LibraryContext"
import { api } from "@/api"
import { inFolder, relativeTo } from "@/lib/path"
import type { Asset } from "@/types"

function formatDate(sec: number) {
  if (!sec) return ""
  return new Date(sec * 1000).toLocaleDateString()
}

export function Output() {
  const { assets, activeLibrary } = useLibrary()
  const outputFolder = activeLibrary?.output_folder ?? ""
  const [query, setQuery] = useState("")

  const outputAssets = useMemo(
    () => assets.filter((a) => !a.is_preview && inFolder(a.path, outputFolder)),
    [assets, outputFolder],
  )

  // 按输出文件夹下的一级目录分组为「项目」，目录内文件视为「版本」
  const projects = useMemo(() => {
    const map = new Map<string, Asset[]>()
    for (const a of outputAssets) {
      const rel = relativeTo(a.path, outputFolder)
      const project = rel.split("/").filter(Boolean)[0] || "未命名"
      if (!map.has(project)) map.set(project, [])
      map.get(project)!.push(a)
    }
    return [...map.entries()]
      .map(([project, items]) => ({
        project,
        items: items.sort((a, b) => b.mtime - a.mtime),
      }))
      .sort((a, b) => a.project.localeCompare(b.project))
  }, [outputAssets, outputFolder])

  const filtered = useMemo(() => {
    if (!query) return projects
    const q = query.toLowerCase()
    return projects
      .map((p) => ({
        ...p,
        items: p.items.filter((i) => i.name.toLowerCase().includes(q)),
      }))
      .filter((p) => p.project.toLowerCase().includes(q) || p.items.length > 0)
  }, [projects, query])

  const openProject = (items: Asset[]) => {
    if (items[0]) api.revealInFolder(items[0].path)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleHeader title="输出" description="阶段性产出，保留版本号方便回溯">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索项目或版本..."
            className="w-64 pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </ModuleHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <p>暂无输出</p>
            <p className="mt-1 text-xs">
              {outputFolder
                ? "请在该文件夹放入产出后重新扫描"
                : "未配置输出文件夹（设置 → 资产库设置）"}
            </p>
          </div>
        ) : (
          filtered.map((p) => (
            <Card key={p.project} className="p-4">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.project}</div>
                  <div className="mt-2 space-y-1">
                    {p.items.map((v) => (
                      <div key={v.id} className="flex items-center gap-3 text-sm">
                        <span className="min-w-0 truncate text-foreground">{v.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(v.mtime)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => openProject(p.items)}>
                    <FolderOpen className="h-4 w-4" />
                    打开目录
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
