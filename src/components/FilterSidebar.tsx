import {
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react"
import { ChevronDown, ChevronRight, Folder, Menu } from "lucide-react"
import { useBoardUiValue } from "@/store/boardUi"
import { cn } from "@/lib/utils"
import type { Asset, FilterMode } from "@/types"

// 筛选模式（可扩展）：新增模式 = 往数组加一项 + 内容区加渲染分支 + BoardView 加过滤逻辑
const FILTER_MODES: { id: FilterMode; label: string }[] = [
  { id: "folder", label: "文件夹" },
  { id: "tag", label: "标签" },
]

function ModeSelector({
  mode,
  setMode,
}: {
  mode: FilterMode
  setMode: (m: FilterMode) => void
}) {
  const [open, setOpen] = useState(false)
  const current = FILTER_MODES.find((m) => m.id === mode) ?? FILTER_MODES[0]
  return (
    <div className="relative border-b px-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{current.label}</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="切换筛选方式"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-2 top-full z-20 mt-1 w-32 rounded-md border bg-popover p-1 shadow-md">
            {FILTER_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center rounded px-2 py-1.5 text-sm",
                  m.id === mode ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function FilterSidebar({
  boardId,
  assets,
  filterMode,
  setFilterMode,
  tagFilter,
  setTagFilter,
  folderFilter,
  setFolderFilter,
}: {
  boardId: string
  assets: Asset[]
  filterMode: FilterMode
  setFilterMode: (m: FilterMode) => void
  tagFilter: string
  setTagFilter: (t: string) => void
  folderFilter: string
  setFolderFilter: (f: string) => void
}) {
  const [width, setWidth] = useBoardUiValue(boardId, "sidebarWidth")
  const asideRef = useRef<HTMLElement | null>(null)

  const startResize = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = asideRef.current?.getBoundingClientRect().width ?? 176
    const onMove = (ev: MouseEvent) => {
      setWidth(Math.min(360, Math.max(120, startW + (ev.clientX - startX))))
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  const tags = useMemo(() => {
    const s = new Set<string>()
    for (const a of assets) for (const t of a.tags) s.add(t)
    return Array.from(s).sort()
  }, [assets])

  const folderTree = useMemo(() => {
    const dirs = new Set<string>()
    for (const a of assets) if (a.rel_dir) dirs.add(a.rel_dir)
    return buildFolderTree(Array.from(dirs))
  }, [assets])

  return (
    <div className="flex shrink-0">
      <aside
        ref={asideRef}
        style={{ width }}
        className="flex shrink-0 flex-col border-r"
      >
        <ModeSelector mode={filterMode} setMode={setFilterMode} />
        <div className="flex-1 overflow-y-auto p-2">
          {filterMode === "folder" ? (
            <div className="space-y-0.5">
              <button
                onClick={() => setFolderFilter("")}
                className={cn(
                  "flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm",
                  folderFilter === "" ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <span>全部</span>
              </button>
              {folderTree.map((n) => (
                <FolderTreeNode
                  key={n.path}
                  node={n}
                  depth={0}
                  folderFilter={folderFilter}
                  setFolderFilter={setFolderFilter}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              <button
                onClick={() => setTagFilter("全部")}
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm",
                  tagFilter === "全部" ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <span>全部</span>
              </button>
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter(t)}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm",
                    tagFilter === t ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="truncate">{t}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
      <div
        onMouseDown={startResize}
        className="w-1 shrink-0 cursor-col-resize border-r bg-border hover:bg-primary/50"
      />
    </div>
  )
}

interface FolderNode {
  name: string
  path: string
  children: FolderNode[]
}

function buildFolderTree(folders: string[]): FolderNode[] {
  const root: FolderNode[] = []
  const map = new Map<string, FolderNode>()
  for (const f of folders) {
    const segs = f.split("/").filter(Boolean)
    let curPath = ""
    let children = root
    for (const seg of segs) {
      curPath = curPath ? `${curPath}/${seg}` : seg
      let node = map.get(curPath)
      if (!node) {
        node = { name: seg, path: curPath, children: [] }
        map.set(curPath, node)
        children.push(node)
      }
      children = node.children
    }
  }
  const sort = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    for (const n of nodes) sort(n.children)
  }
  sort(root)
  return root
}

function FolderTreeNode({
  node,
  depth,
  folderFilter,
  setFolderFilter,
}: {
  node: FolderNode
  depth: number
  folderFilter: string
  setFolderFilter: (f: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  return (
    <div>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-left text-sm",
          folderFilter === node.path ? "bg-accent text-accent-foreground" : "hover:bg-muted",
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => setFolderFilter(node.path)}
      >
        {hasChildren ? (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </div>
      {expanded &&
        hasChildren &&
        node.children.map((c) => (
          <FolderTreeNode
            key={c.path}
            node={c}
            depth={depth + 1}
            folderFilter={folderFilter}
            setFolderFilter={setFolderFilter}
          />
        ))}
    </div>
  )
}
