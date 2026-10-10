import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react"
import {
  Search,
  FolderOpen,
  ExternalLink,
  Play,
  Maximize,
  CheckSquare,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  PenLine,
  X,
} from "lucide-react"
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VirtualGrid } from "@/components/VirtualGrid"
import { Thumbnail, FullImage, FileIcon, VideoThumbnail } from "@/components/Thumbnail"
import { ContextMenu } from "@/components/ContextMenu"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TagEditor } from "@/components/TagEditor"
import { useLibrary } from "@/store/LibraryContext"
import { api, askConfirm, assetUrl } from "@/api"
import { IMAGE_EXTS, VIDEO_EXTS } from "@/lib/formats"
import { cn } from "@/lib/utils"
import { useThumbSize } from "@/hooks/useThumbSize"
import { readBoardUi, writeBoardUi, useBoardUiValue, useScrollMemory, useScrollSave } from "@/store/boardUi"
import type { Asset, BoardConfig } from "@/types"

const FALLBACKS = [
  "from-slate-600 to-slate-800",
  "from-violet-500 to-fuchsia-600",
  "from-orange-500 to-red-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-700",
  "from-rose-500 to-pink-500",
]

function fallbackGradient(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return FALLBACKS[h % FALLBACKS.length]
}

function extractVersion(name: string): string | null {
  const m = name.match(/(?:v|V)?(\d+(?:\.\d+){1,3})/)
  return m ? m[1] : null
}

export function BoardView({ board }: { board: BoardConfig }) {
  const { assets, assetsBoardId, updateMetadata, deleteAsset, renameAsset } = useLibrary()
  const persistCols = useCallback(
    (c: number) => writeBoardUi(board.id, "cols", c),
    [board.id],
  )
  const { cols, setCols, onWheel } = useThumbSize(readBoardUi(board.id, "cols"), persistCols)
  const [query, setQuery] = useState("")
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [detailWidth, setDetailWidth] = useBoardUiValue(board.id, "detailWidth")
  const [menu, setMenu] = useState<{ x: number; y: number; mode: "single" | "batch"; asset?: Asset } | null>(null)
  const [tagFilter, setTagFilter] = useState("全部")
  const [folderFilter, setFolderFilter] = useState("")
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = assets
    if (board.layout === "tree") {
      if (folderFilter) {
        list = list.filter(
          (a) => a.rel_dir === folderFilter || a.rel_dir.startsWith(folderFilter + "/"),
        )
      }
    } else if (tagFilter !== "全部") {
      list = list.filter((a) => a.tags.includes(tagFilter))
    }
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }
    return list
  }, [assets, query, tagFilter, folderFilter, board.layout])

  const current = useMemo(
    () => assets.find((a) => a.id === currentId) ?? null,
    [assets, currentId],
  )

  const startDrag = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const onMove = (ev: MouseEvent) => {
      const w = window.innerWidth - ev.clientX
      setDetailWidth(Math.min(520, Math.max(220, w)))
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLastSelectedId(id)
  }

  const rangeSelect = (fromId: string, toId: string) => {
    const ids = filtered.map((x) => x.id)
    const lo = ids.indexOf(fromId)
    const hi = ids.indexOf(toId)
    if (lo >= 0 && hi >= 0) {
      const [s, t] = lo < hi ? [lo, hi] : [hi, lo]
      setSelected(new Set(ids.slice(s, t + 1)))
    }
    setLastSelectedId(toId)
  }

  const exitSelect = () => {
    setSelectMode(false)
    setSelected(new Set())
    setLastSelectedId(null)
  }

  const toggleSelectAll = () => {
    const ids = filtered.map((a) => a.id)
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
    setSelected(allSelected ? new Set() : new Set(ids))
    setLastSelectedId(allSelected ? null : (ids[ids.length - 1] ?? null))
  }

  const onCardClick = (a: Asset, e: ReactMouseEvent<HTMLDivElement>) => {
    const modifier = e.ctrlKey || e.metaKey || e.shiftKey
    if (!selectMode && !modifier) {
      setCurrentId(a.id)
      return
    }
    let anchor = lastSelectedId
    if (!selectMode) {
      // 自动进入多选：把当前详情图也纳入选区
      anchor = currentId && currentId !== a.id ? currentId : null
      if (anchor) setSelected(new Set([anchor]))
      setSelectMode(true)
    }
    if (e.shiftKey && anchor) {
      rangeSelect(anchor, a.id)
    } else {
      toggleOne(a.id)
    }
  }

  const onMenu = (a: Asset, e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (selectMode) {
      setMenu({ x: e.clientX, y: e.clientY, mode: "batch" })
    } else {
      setCurrentId(a.id)
      setMenu({ x: e.clientX, y: e.clientY, mode: "single", asset: a })
    }
  }
  const onDrag = (a: Asset, e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault()
    api.startDrag([a.path])
  }

  const renameOne = async (asset: Asset) => {
    const newName = window.prompt("重命名", asset.stem)
    if (!newName || newName === asset.stem) return
    await renameAsset(asset.id, newName)
  }

  const batchRename = async () => {
    const base = window.prompt("批量重命名：输入基础名称（自动加序号）", "")
    if (!base) return
    const list = filtered.filter((a) => selected.has(a.id))
    let i = 0
    for (const a of list) {
      i++
      await renameAsset(a.id, `${base}_${String(i).padStart(2, "0")}`)
    }
    exitSelect()
  }

  const batchDelete = async () => {
    const ok = await askConfirm(`确定删除选中的 ${selected.size} 个文件吗？文件将从磁盘移除。`, "批量删除")
    if (!ok) return
    for (const id of Array.from(selected)) await deleteAsset(id)
    exitSelect()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleHeader title={board.name} description={board.folder}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索名称或标签..."
            className="w-64 pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </ModuleHeader>

      <div className="flex min-h-0 flex-1">
        <FilterSidebar
          boardId={board.id}
          layout={board.layout}
          assets={assets}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          folderFilter={folderFilter}
          setFolderFilter={setFolderFilter}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={selectMode ? "secondary" : "ghost"}
                onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              >
                <CheckSquare className="h-4 w-4" />
                选择
              </Button>
              {selectMode && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleSelectAll}
                  className="gap-1.5"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      filtered.length > 0 && selected.size === filtered.length
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {filtered.length > 0 && selected.size === filtered.length && (
                      <Check className="h-3 w-3" />
                    )}
                  </span>
                  全选
                </Button>
              )}
            </div>
            {board.layout !== "detail" && (
              <input
                type="range"
                min={2}
                max={6}
                step={1}
                value={8 - cols}
                onChange={(e) => setCols(8 - Number(e.target.value))}
                className="w-24 accent-primary"
                title="缩略图大小（Ctrl+滚轮也可调整）"
              />
            )}
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
              <p>暂无资产</p>
              <p className="mt-1 text-xs">请在「设置 → 板块」配置并扫描</p>
            </div>
          ) : (
            <LayoutRenderer
              boardId={board.id}
              ready={assetsBoardId === board.id}
              layout={board.layout}
              assets={filtered}
              cols={cols}
              onWheel={onWheel}
              currentId={currentId}
              selectMode={selectMode}
              selected={selected}
              anchorId={lastSelectedId}
              onCardClick={onCardClick}
              onMenu={onMenu}
              onDrag={onDrag}
              onUpdate={updateMetadata}
            />
          )}
        </div>

        <div
          onMouseDown={startDrag}
          className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/50"
        />

        <aside
          style={{ width: detailWidth }}
          className="shrink-0 border-l bg-card p-4"
        >
          {selectMode ? (
            <div className="space-y-3">
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="text-sm font-semibold">多选模式</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  已选 {selected.size} 项，右键可批量操作
                </div>
              </div>
              {current && (
                <AssetDetail asset={current} onUpdate={updateMetadata} onRename={renameOne} />
              )}
            </div>
          ) : current ? (
            <AssetDetail asset={current} onUpdate={updateMetadata} onRename={renameOne} />
          ) : (
            <p className="text-sm text-muted-foreground">点击左侧资产查看详情</p>
          )}
        </aside>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={
            menu.mode === "batch"
              ? [
                  { label: "批量重命名", onClick: batchRename },
                  { label: "批量删除", danger: true, onClick: batchDelete },
                ]
              : [
                  {
                    label: "打开文件位置",
                    onClick: () => api.revealInFolder(menu.asset!.path),
                  },
                  {
                    label: "复制文件路径",
                    onClick: () => navigator.clipboard.writeText(menu.asset!.path),
                  },
                  { label: "重命名", onClick: () => renameOne(menu.asset!) },
                  {
                    label: "删除资产",
                    danger: true,
                    onClick: async () => {
                      const ok = await askConfirm(
                        `确定删除「${menu.asset!.name}」吗？文件将从磁盘移除。`,
                        "删除资产",
                      )
                      if (ok) await deleteAsset(menu.asset!.id)
                    },
                  },
                ]
          }
        />
      )}
    </div>
  )
}

// 分类筛选侧栏：树状模式显示文件夹层级树，其他模式显示标签列表；宽度可拖动
function FilterSidebar({
  boardId,
  layout,
  assets,
  tagFilter,
  setTagFilter,
  folderFilter,
  setFolderFilter,
}: {
  boardId: string
  layout: string
  assets: Asset[]
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
        className="shrink-0 overflow-y-auto border-r p-2"
      >
        {layout === "tree" ? (
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

// —— 布局组件（可插拔）：每种布局只负责「怎么排列卡片」 ——

interface LayoutProps {
  boardId: string
  ready: boolean
  assets: Asset[]
  cols: number
  onWheel?: (e: ReactWheelEvent<HTMLDivElement>) => void
  currentId: string | null
  selectMode: boolean
  selected: Set<string>
  anchorId: string | null
  onCardClick: (a: Asset, e: ReactMouseEvent<HTMLDivElement>) => void
  onMenu: (a: Asset, e: ReactMouseEvent<HTMLDivElement>) => void
  onDrag: (a: Asset, e: ReactDragEvent<HTMLDivElement>) => void
  onUpdate: (id: string, patch: { description?: string }) => Promise<void>
}

function AssetCard({
  asset,
  active,
  checked,
  selectMode,
  anchorId,
  onClick,
  onMenu,
  onDrag,
}: {
  asset: Asset
  active: boolean
  checked: boolean
  selectMode: boolean
  anchorId: string | null
  onClick: (e: ReactMouseEvent<HTMLDivElement>) => void
  onMenu: (e: ReactMouseEvent<HTMLDivElement>) => void
  onDrag: (e: ReactDragEvent<HTMLDivElement>) => void
}) {
  const isVideo = VIDEO_EXTS.has(asset.ext)
  const imgPath =
    asset.preview_paths[0] ?? (IMAGE_EXTS.has(asset.ext) ? asset.path : null)
  const ring = selectMode
    ? checked
      ? anchorId === asset.id
        ? "ring-2 ring-orange-500"
        : "ring-2 ring-ring"
      : ""
    : active
      ? "ring-2 ring-ring"
      : ""
  return (
    <Card
      className={cn("relative cursor-pointer overflow-hidden", ring)}
      draggable
      onDragStart={onDrag}
      onClick={onClick}
      onContextMenu={onMenu}
    >
      {selectMode && (
        <div
          className={cn(
            "absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background/80",
          )}
        >
          {checked && <Check className="h-3 w-3" />}
        </div>
      )}
      {isVideo ? (
        <VideoThumbnail
          path={asset.path}
          className="aspect-square w-full object-cover"
        />
      ) : imgPath ? (
        <Thumbnail
          path={imgPath}
          alt={asset.name}
          className="aspect-square w-full object-cover"
        />
      ) : (
        <div
          className={cn("aspect-square bg-gradient-to-br", fallbackGradient(asset.id))}
        />
      )}
      <div className="p-3">
        <div className="truncate text-sm font-medium">{asset.name}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <Badge variant="outline">{asset.category || "未分类"}</Badge>
          <span className="text-xs text-muted-foreground">{asset.ext}</span>
        </div>
      </div>
    </Card>
  )
}

function MasonryLayout({ boardId, ready, assets, cols, onWheel, currentId, selectMode, selected, anchorId, onCardClick, onMenu, onDrag }: LayoutProps) {
  const { ref, onScroll } = useScrollSave(boardId, ready)
  const initialOffset = useMemo(() => readBoardUi(boardId, "scrollTop"), [boardId])
  return (
    <VirtualGrid
      count={assets.length}
      cols={cols}
      className="flex-1 min-w-0 overflow-auto px-6 py-4"
      onWheel={onWheel}
      onScroll={onScroll}
      scrollRef={ref}
      initialOffset={initialOffset}
      renderItem={(i) => {
        const a = assets[i]
        return (
          <AssetCard
            key={a.id}
            asset={a}
            active={currentId === a.id}
            checked={selected.has(a.id)}
            selectMode={selectMode}
            anchorId={anchorId}
            onClick={(e) => onCardClick(a, e)}
            onMenu={(e) => onMenu(a, e)}
            onDrag={(e) => onDrag(a, e)}
          />
        )
      }}
    />
  )
}

function GridLayout({ boardId, ready, assets, cols, currentId, selectMode, selected, anchorId, onCardClick, onMenu, onDrag }: LayoutProps) {
  const { ref, onScroll } = useScrollMemory(boardId, ready)
  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="grid flex-1 content-start gap-4 overflow-y-auto p-4"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {assets.map((a) => (
        <AssetCard
          key={a.id}
          asset={a}
          active={currentId === a.id}
          checked={selected.has(a.id)}
          selectMode={selectMode}
          anchorId={anchorId}
          onClick={(e) => onCardClick(a, e)}
          onMenu={(e) => onMenu(a, e)}
          onDrag={(e) => onDrag(a, e)}
        />
      ))}
    </div>
  )
}

function TreeLayout({ boardId, ready, assets, cols, currentId, selectMode, selected, anchorId, onCardClick, onMenu, onDrag }: LayoutProps) {
  const { ref, onScroll } = useScrollMemory(boardId, ready)
  const groups = useMemo(() => {
    const m = new Map<string, Asset[]>()
    for (const a of assets) {
      const dir = a.rel_dir || "根目录"
      if (!m.has(dir)) m.set(dir, [])
      m.get(dir)!.push(a)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [assets])

  return (
    <div ref={ref} onScroll={onScroll} className="flex-1 space-y-5 overflow-y-auto p-4">
      {groups.map(([dir, items]) => (
        <div key={dir}>
          <div className="mb-2 text-sm font-semibold text-muted-foreground">
            {dir}（{items.length}）
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {items.map((a) => (
              <AssetCard
                key={a.id}
                asset={a}
                active={currentId === a.id}
                checked={selected.has(a.id)}
                selectMode={selectMode}
                anchorId={anchorId}
                onClick={(e) => onCardClick(a, e)}
                onMenu={(e) => onMenu(a, e)}
                onDrag={(e) => onDrag(a, e)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DetailLayout({ boardId, ready, assets, currentId, selectMode, selected, anchorId, onCardClick, onMenu, onDrag, onUpdate }: LayoutProps) {
  const { ref, onScroll } = useScrollMemory(boardId, ready)
  return (
    <div ref={ref} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto p-4">
      {assets.map((a) => (
        <DetailRow
          key={a.id}
          asset={a}
          active={currentId === a.id}
          checked={selected.has(a.id)}
          selectMode={selectMode}
          anchorId={anchorId}
          onClick={(e) => onCardClick(a, e)}
          onMenu={(e) => onMenu(a, e)}
          onDrag={(e) => onDrag(a, e)}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}

function DetailRow({
  asset,
  active,
  checked,
  selectMode,
  anchorId,
  onClick,
  onMenu,
  onDrag,
  onUpdate,
}: {
  asset: Asset
  active: boolean
  checked: boolean
  selectMode: boolean
  anchorId: string | null
  onClick: (e: ReactMouseEvent<HTMLDivElement>) => void
  onMenu: (e: ReactMouseEvent<HTMLDivElement>) => void
  onDrag: (e: ReactDragEvent<HTMLDivElement>) => void
  onUpdate: (id: string, patch: { description?: string }) => Promise<void>
}) {
  const [desc, setDesc] = useState(asset.description)
  useEffect(() => setDesc(asset.description), [asset.id, asset.description])
  const isVideo = VIDEO_EXTS.has(asset.ext)
  const isImage = IMAGE_EXTS.has(asset.ext)
  const version = extractVersion(asset.name)
  const ring = selectMode
    ? checked
      ? anchorId === asset.id
        ? "ring-2 ring-orange-500"
        : "ring-2 ring-ring"
      : ""
    : active
      ? "ring-2 ring-ring"
      : ""

  return (
    <Card
      className={cn("flex cursor-pointer items-center gap-4 p-3", ring)}
      draggable
      onDragStart={onDrag}
      onClick={onClick}
      onContextMenu={onMenu}
    >
      {selectMode && (
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border",
          )}
        >
          {checked && <Check className="h-3 w-3" />}
        </div>
      )}
      <div className="h-14 w-14 shrink-0">
        {isVideo ? (
          <VideoThumbnail path={asset.path} className="h-full w-full rounded object-cover" />
        ) : isImage ? (
          <Thumbnail
            path={asset.preview_paths[0] ?? asset.path}
            alt={asset.name}
            className="h-full w-full rounded object-cover"
          />
        ) : (
          <FileIcon path={asset.path} className="h-full w-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{asset.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {version && <span className="mr-3">v{version}</span>}
          <span>{formatSize(asset.size)}</span>
        </div>
        {asset.link && (
          <button
            className="mt-1 flex max-w-full items-center gap-1 truncate text-xs text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              api.openUrl(asset.link)
            }}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{asset.link}</span>
          </button>
        )}
      </div>
      <div className="w-72 shrink-0">
        <Input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => {
            if (desc !== asset.description) onUpdate(asset.id, { description: desc })
          }}
          placeholder="文件说明"
          className="h-8 text-xs"
        />
      </div>
    </Card>
  )
}

function LayoutRenderer({ layout, ...props }: LayoutProps & { layout: string }): ReactNode {
  switch (layout) {
    case "grid":
      return <GridLayout {...props} />
    case "tree":
      return <TreeLayout {...props} />
    case "detail":
      return <DetailLayout {...props} />
    // drawer / board 后续实现，暂回退到瀑布流
    default:
      return <MasonryLayout {...props} />
  }
}

function AssetDetail({
  asset,
  onUpdate,
  onRename,
}: {
  asset: Asset
  onUpdate: (id: string, patch: { tags?: string[] }) => Promise<void>
  onRename: (asset: Asset) => void
}) {
  const [imgIdx, setImgIdx] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const isVideo = VIDEO_EXTS.has(asset.ext)
  const previews = asset.preview_paths
  const idx = Math.min(imgIdx, Math.max(0, previews.length - 1))
  const currentImg = previews[idx] ?? (IMAGE_EXTS.has(asset.ext) ? asset.path : null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">资产详情</span>
        <Button size="sm" variant="ghost" onClick={() => onRename(asset)}>
          <PenLine className="h-4 w-4" />
          重命名
        </Button>
      </div>
      {isVideo ? (
        <div className="space-y-2">
          {playing && (
            <video
              src={assetUrl(asset.path)}
              controls
              controlsList="nofullscreen"
              className="max-h-80 w-full rounded-lg bg-black"
            />
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setPlaying((p) => !p)}>
              <Play className="h-4 w-4" />
              {playing ? "收起" : "播放"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFullscreen(true)}>
              <Maximize className="h-4 w-4" />
              全屏
            </Button>
            <Button size="sm" variant="ghost" onClick={() => api.openUrl(asset.path)}>
              <ExternalLink className="h-4 w-4" />
              外部播放器
            </Button>
          </div>
        </div>
      ) : currentImg ? (
        <Thumbnail
          path={currentImg}
          alt={asset.name}
          className="max-h-80 w-full cursor-zoom-in rounded-lg object-contain"
          onClick={() => setZoomed(true)}
        />
      ) : (
        <FileIcon path={asset.path} className="h-40 w-full rounded-lg" />
      )}

      {previews.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {previews.map((p, i) => (
            <Thumbnail
              key={p}
              path={p}
              alt={`${asset.name} 预览 ${i + 1}`}
              onClick={() => setImgIdx(i)}
              className={cn(
                "h-12 w-12 shrink-0 cursor-pointer rounded object-cover",
                i === idx ? "ring-2 ring-ring" : "opacity-60 hover:opacity-100",
              )}
            />
          ))}
        </div>
      )}

      <div className="break-all text-base font-semibold">{asset.name}</div>
      <div className="flex items-center gap-2">
        <Badge>{asset.category || "未分类"}</Badge>
        <span className="text-xs text-muted-foreground">{asset.ext}</span>
      </div>
      <Separator />
      <Row label="路径" value={asset.path} />
      <Row label="大小" value={formatSize(asset.size)} />
      <div>
        <div className="mb-1 text-xs text-muted-foreground">标签</div>
        <TagEditor
          tags={asset.tags}
          suggested={[]}
          onChange={(tags) => onUpdate(asset.id, { tags })}
        />
      </div>
      <Button
        size="sm"
        className="w-full"
        onClick={() => api.revealInFolder(asset.path)}
      >
        <FolderOpen className="h-4 w-4" />
        打开文件位置
      </Button>

      {zoomed && currentImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
          onClick={() => setZoomed(false)}
        >
          <FullImage path={currentImg} alt={asset.name} className="max-h-full max-w-full object-contain" />
        </div>
      )}

      {fullscreen && isVideo && (
        <div
          className="fixed inset-0 z-50 bg-black"
          onClick={() => setFullscreen(false)}
        >
          <video
            src={assetUrl(asset.path)}
            controls
            controlsList="nofullscreen"
            className="h-full w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-3 top-3 z-10 text-white"
            onClick={() => setFullscreen(false)}
          >
            <X className="h-4 w-4" />
            退出全屏
          </Button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all text-right text-xs">{value}</span>
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
