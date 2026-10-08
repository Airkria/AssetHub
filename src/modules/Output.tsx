import { Search, History, FolderOpen } from "lucide-react"
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { outputs } from "@/data/mock"

export function Output() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleHeader title="输出" description="阶段性产出，保留版本号方便回溯">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索项目..." className="w-64 pl-8" />
        </div>
      </ModuleHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {outputs.map((o) => (
          <Card key={o.id} className="p-4">
            <div className="flex items-center gap-4">
              <div
                className={`h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br ${o.gradient}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{o.project}</span>
                  <Badge variant={o.status === "进行中" ? "default" : "secondary"}>
                    {o.status}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1">
                  {o.versions.map((v) => (
                    <div key={v.v} className="flex items-center gap-3 text-sm">
                      <Badge variant="outline">{v.v}</Badge>
                      <span className="text-xs text-muted-foreground">{v.date}</span>
                      <span className="text-muted-foreground">{v.note}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm">
                  <History className="h-4 w-4" />
                  版本历史
                </Button>
                <Button variant="outline" size="sm">
                  <FolderOpen className="h-4 w-4" />
                  打开目录
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
