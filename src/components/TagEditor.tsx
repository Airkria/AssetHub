import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLibrary } from "@/store/LibraryContext"

export function TagEditor({
  tags,
  suggested,
  onChange,
}: {
  tags: string[]
  suggested: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState("")

  // 共识标签词表 + 现有标签 → 建议列表（去重）
  const { config } = useLibrary()
  const allSuggested = useMemo(() => {
    const vocab = config.match_rules.tag_vocabulary ?? []
    return Array.from(new Set([...vocab, ...suggested]))
  }, [config.match_rules.tag_vocabulary, suggested])

  const add = (t: string) => {
    const tag = t.trim()
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
    setInput("")
  }

  const remove = (t: string) => onChange(tags.filter((x) => x !== t))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1">
            {t}
            <button
              onClick={() => remove(t)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add(input)}
          placeholder="添加标签"
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" onClick={() => add(input)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {allSuggested.filter((s) => !tags.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allSuggested
            .filter((s) => !tags.includes(s))
            .slice(0, 12)
            .map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => add(s)}
              >
                {s}
              </Badge>
            ))}
        </div>
      )}
    </div>
  )
}
