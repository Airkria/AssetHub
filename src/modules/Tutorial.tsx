import { Search } from "lucide-react"
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { tutorials } from "@/data/mock"

export function Tutorial() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleHeader title="教程" description="各类教程汇总">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索教程..." className="w-64 pl-8" />
        </div>
      </ModuleHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tutorials.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div className={`aspect-video bg-gradient-to-br ${t.gradient}`} />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.title}</span>
                  <Badge variant="outline">{t.platform}</Badge>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${t.progress}%` }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  进度 {t.progress}%
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
