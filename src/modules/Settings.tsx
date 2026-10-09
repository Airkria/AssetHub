import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"
import {
  Save,
  FolderSearch,
  FolderPlus,
  FolderOpen,
  Trash2,
  Pause,
  Play,
  Square,
  Plus,
  X,
  Filter,
  FileImage,
  type LucideIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useLibrary } from "@/store/LibraryContext"
import { api, askConfirm, pickFile, pickFolder } from "@/api"
import { cn } from "@/lib/utils"
import type { BoardConfig, MatchRules } from "@/types"

const textareaClass =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

function deriveName(path: string) {
  const seg = path
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop()
  return seg || "板块"
}

// 全局匹配规则表单（分类 / 预览格式 / 预览后缀，不随库变）
interface RulesForm {
  suffixes: string
  categoryRules: { name: string; extensions: string }[]
  formatFamilies: { key: string; label: string; extensions: string }[]
  tagVocabulary: string
}

function formToMatchRules(form: RulesForm): MatchRules {
  return {
    preview_suffixes: form.suffixes.split(",").map((s) => s.trim()).filter(Boolean),
    category_rules: form.categoryRules.map((r) => ({
      name: r.name.trim(),
      extensions: r.extensions.split(",").map((s) => s.trim()).filter(Boolean),
    })),
    format_families: form.formatFamilies.map((f) => ({
      key: f.key,
      label: f.label,
      extensions: f.extensions.split(",").map((s) => s.trim()).filter(Boolean),
    })),
    tag_vocabulary: form.tagVocabulary.split(",").map((s) => s.trim()).filter(Boolean),
  }
}

function matchRulesToForm(rules: MatchRules): RulesForm {
  return {
    suffixes: rules.preview_suffixes.join(","),
    categoryRules: rules.category_rules.map((r) => ({
      name: r.name,
      extensions: r.extensions.join(","),
    })),
    formatFamilies: rules.format_families.map((f) => ({
      key: f.key,
      label: f.label,
      extensions: f.extensions.join(","),
    })),
    tagVocabulary: rules.tag_vocabulary.join(","),
  }
}

type SectionKey = "lib" | "rules" | "preview" | "index"
const KEYS: SectionKey[] = ["lib", "rules", "preview", "index"]

const NAV: { key: SectionKey; label: string; icon: LucideIcon }[] = [
  { key: "lib", label: "板块", icon: FolderPlus },
  { key: "rules", label: "规则设置", icon: Filter },
  { key: "preview", label: "预览设置", icon: FileImage },
  { key: "index", label: "扫描索引", icon: FolderSearch },
]

// 放大尺寸档位（最长边像素）
const ZOOM_PRESETS = [
  { label: "1K", value: 1024 },
  { label: "2K", value: 2048 },
  { label: "3K", value: 3072 },
  { label: "4K", value: 4096 },
]

// 板块显示方案
const LAYOUTS = [
  { key: "masonry", label: "瀑布流" },
  { key: "grid", label: "卡片网格" },
  { key: "drawer", label: "抽屉" },
  { key: "tree", label: "树状" },
  { key: "board", label: "随机板" },
]

// Pro 切割点：开通 Pro 后改为 false，锁定名称/显示方案自定义（当前默认解锁）
const BOARD_CUSTOMIZABLE = true

export function Settings({ onClose }: { onClose: () => void }) {
  const { config, setConfig } = useLibrary()
  const [form, setForm] = useState<RulesForm>(() => matchRulesToForm(config.match_rules))
  const [active, setActive] = useState<SectionKey>("lib")
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const libRef = useRef<HTMLElement | null>(null)
  const rulesRef = useRef<HTMLElement | null>(null)
  const previewRef = useRef<HTMLElement | null>(null)
  const indexRef = useRef<HTMLElement | null>(null)
  const refs: Record<SectionKey, RefObject<HTMLElement | null>> = {
    lib: libRef,
    rules: rulesRef,
    preview: previewRef,
    index: indexRef,
  }

  // 配置从外部变化（选库加载配置等）时，重新同步表单
  useEffect(() => {
    if (JSON.stringify(formToMatchRules(form)) !== JSON.stringify(config.match_rules)) {
      setForm(matchRulesToForm(config.match_rules))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.match_rules])

  const onScroll = () => {
    const c = scrollRef.current
    if (!c) return
    // 滚到底部时强制高亮最后一个板块
    if (c.scrollTop + c.clientHeight >= c.scrollHeight - 8) {
      setActive("index")
      return
    }
    const cTop = c.getBoundingClientRect().top
    let cur: SectionKey = "lib"
    for (const k of KEYS) {
      const el = refs[k].current
      if (el && el.getBoundingClientRect().top - cTop <= 80) cur = k
    }
    setActive(cur)
  }

  const scrollTo = (k: SectionKey) => {
    refs[k].current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-base font-semibold">设置</div>
          <div className="text-xs text-muted-foreground">配置板块、匹配规则与预览</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-44 shrink-0 border-r p-2">
          <nav className="flex flex-col gap-1">
            {NAV.map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant={active === key ? "secondary" : "ghost"}
                className={cn(
                  "justify-start",
                  active === key && "bg-accent text-accent-foreground",
                )}
                onClick={() => scrollTo(key)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </nav>
        </aside>
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <section ref={libRef} className="scroll-mt-6">
              <BoardSection />
            </section>
            <section ref={rulesRef} className="scroll-mt-6">
              <RulesSection form={form} setForm={setForm} />
            </section>
            <section ref={previewRef} className="scroll-mt-6">
              <PreviewSection form={form} setForm={setForm} />
            </section>
            <section ref={indexRef} className="scroll-mt-6">
              <IndexSection />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

// 设置 Modal：从设置按钮为原点 scale 释放 / 收回，背景变暗
export function SettingsModal({
  open,
  onClose,
  origin,
}: {
  open: boolean
  onClose: () => void
  origin: { x: number; y: number } | null
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const originStyle = origin
    ? `${origin.x - window.innerWidth * 0.03}px ${origin.y - window.innerHeight * 0.03}px`
    : "center"

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-overlay"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="flex h-[94%] w-[94%] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
            style={{ transformOrigin: originStyle }}
            initial={{ scaleX: 0.3, scaleY: 0.03, opacity: 0 }}
            animate={{ scaleX: 1, scaleY: 1, opacity: 1 }}
            exit={{ scaleX: 0.3, scaleY: 0.03, opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <Settings onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// —— 板块 1：板块 ——
function BoardSection() {
  const { config, addBoard } = useLibrary()

  const addViaPicker = async () => {
    const path = await pickFolder()
    if (!path) return
    await addBoard(deriveName(path), path)
  }

  return (
    <div className="space-y-4">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>板块</CardTitle>
          <CardDescription>每个板块 = 名称 + 文件夹 + 显示方案 + 可选过滤，自由组合成资产管理方案</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.boards.length === 0 && (
            <p className="text-sm text-muted-foreground">
              还没有板块，点击下方「添加板块」选择一个文件夹
            </p>
          )}
          {config.boards.map((b) => (
            <BoardEditor key={b.id} board={b} />
          ))}
          <Button variant="outline" onClick={addViaPicker}>
            <FolderPlus className="h-4 w-4" />
            添加板块
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function BoardEditor({ board }: { board: BoardConfig }) {
  const { config, setConfig, removeBoard } = useLibrary()
  const [filterOn, setFilterOn] = useState(
    board.include_dirs.length > 0 || board.exclude_dirs.length > 0,
  )
  const [include, setInclude] = useState(board.include_dirs.join("\n"))
  const [exclude, setExclude] = useState(board.exclude_dirs.join("\n"))

  const update = (patch: Partial<BoardConfig>) =>
    setConfig({
      ...config,
      boards: config.boards.map((b) => (b.id === board.id ? { ...b, ...patch } : b)),
    })

  const pick = async () => {
    const p = await pickFolder()
    if (p) update({ folder: p })
  }

  const saveFilter = () =>
    update({
      include_dirs: include.split("\n").map((s) => s.trim()).filter(Boolean),
      exclude_dirs: exclude.split("\n").map((s) => s.trim()).filter(Boolean),
    })

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={board.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="板块名"
          disabled={!BOARD_CUSTOMIZABLE}
          className="w-32"
        />
        <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {board.folder || "未设置路径"}
        </div>
        <Button size="sm" variant="outline" onClick={pick}>
          选择
        </Button>
        {board.folder && (
          <Button size="sm" variant="ghost" onClick={() => update({ folder: "" })}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <select
          value={board.layout}
          onChange={(e) => update({ layout: e.target.value })}
          disabled={!BOARD_CUSTOMIZABLE}
          className="h-8 w-28 shrink-0 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {LAYOUTS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <Button size="sm" variant="ghost" onClick={() => removeBoard(board.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={filterOn}
          onChange={(e) => setFilterOn(e.target.checked)}
        />
        启用过滤（只扫指定子目录，相对板块文件夹，一行一个）
      </label>

      {filterOn && (
        <div className="space-y-2">
          <textarea
            className={textareaClass}
            rows={2}
            value={include}
            onChange={(e) => setInclude(e.target.value)}
            placeholder={"只扫的子目录，如 01_Textures\\A"}
          />
          <textarea
            className={textareaClass}
            rows={2}
            value={exclude}
            onChange={(e) => setExclude(e.target.value)}
            placeholder={"排除的子目录，如 99_归档"}
          />
          <Button size="sm" onClick={saveFilter}>
            <Save className="h-4 w-4" />
            保存过滤
          </Button>
        </div>
      )}
    </div>
  )
}

function FolderRow({
  label,
  value,
  onPick,
  onClear,
}: {
  label: string
  value: string
  onPick: (p: string) => void
  onClear: () => void
}) {
  const pick = async () => {
    const p = await pickFolder()
    if (p) onPick(p)
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-sm">{label}</span>
      <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {value || "未设置"}
      </div>
      <Button size="sm" variant="outline" onClick={pick}>
        选择
      </Button>
      {value && (
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

// —— 板块 2：规则设置 ——
function RulesSection({
  form,
  setForm,
}: {
  form: RulesForm
  setForm: Dispatch<SetStateAction<RulesForm>>
}) {
  const setRule = (i: number, patch: Partial<{ name: string; extensions: string }>) =>
    setForm((f) => ({
      ...f,
      categoryRules: f.categoryRules.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }))

  return (
    <div className="space-y-4">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>分类规则</CardTitle>
          <CardDescription>按扩展名归类资产（命中不到规则归「未分类」，全局共享）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {form.categoryRules.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={r.name}
                onChange={(e) => setRule(i, { name: e.target.value })}
                placeholder="分类名"
                className="w-36"
              />
              <Input
                value={r.extensions}
                onChange={(e) => setRule(i, { extensions: e.target.value })}
                placeholder="扩展名，逗号分隔（如 fbx,obj）"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    categoryRules: f.categoryRules.filter((_, j) => j !== i),
                  }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setForm((f) => ({
                ...f,
                categoryRules: [...f.categoryRules, { name: "", extensions: "" }],
              }))
            }
          >
            <Plus className="h-4 w-4" />
            添加分类规则
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>预览图后缀</CardTitle>
          <CardDescription>用于包体 ↔ 预览图匹配（全局共享）</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={form.suffixes}
            onChange={(e) => setForm((f) => ({ ...f, suffixes: e.target.value }))}
            placeholder="_preview,_thumb"
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>共识标签</CardTitle>
          <CardDescription>团队共享的标签词表（逗号分隔），打标签时自动建议，随配置文件同步</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={form.tagVocabulary}
            onChange={(e) => setForm((f) => ({ ...f, tagVocabulary: e.target.value }))}
            placeholder="科幻, 场景, 角色, 贴图"
          />
        </CardContent>
      </Card>

      <ConfigFileSection form={form} setForm={setForm} />
    </div>
  )
}

// —— 板块 3：预览设置 ——
function PreviewSection({
  form,
  setForm,
}: {
  form: RulesForm
  setForm: Dispatch<SetStateAction<RulesForm>>
}) {
  const { config, setConfig } = useLibrary()

  const clearCache = async () => {
    const ok = await askConfirm("确定要清除所有缩略图缓存吗？下次预览会重新生成。", "清除缓存")
    if (!ok) return
    await api.clearCache()
  }

  return (
    <div className="space-y-4">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>格式白名单</CardTitle>
          <CardDescription>按格式家族管理可索引/预览的扩展名白名单（全局共享）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.formatFamilies.map((f, i) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-sm font-medium">{f.label}</span>
              <Input
                value={f.extensions}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    formatFamilies: prev.formatFamilies.map((x, j) =>
                      j === i ? { ...x, extensions: e.target.value } : x,
                    ),
                  }))
                }
                placeholder="扩展名，逗号分隔"
                className="flex-1"
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            白名单决定哪些文件被索引与预览；预览渲染能力按家族逐步接入（3D 预览 v1.1）
          </p>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>放大尺寸上限</CardTitle>
          <CardDescription>点击图片放大时，最长边解码到此尺寸（原图更大时按比例缩小）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={config.zoom_max_px}
            onChange={(e) => setConfig({ ...config, zoom_max_px: Number(e.target.value) })}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {ZOOM_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}（{p.value}px）
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            tga / exr / hdr / dds / psd 等 webview 无法解码的格式，由后端按此档位解码放大图
          </p>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>缓存</CardTitle>
          <CardDescription>缩略图缓存位置（建议放 SSD，默认在 C 盘应用数据目录）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FolderRow
            label="缓存位置"
            value={config.cache_dir}
            onPick={(p) => setConfig({ ...config, cache_dir: p })}
            onClear={() => setConfig({ ...config, cache_dir: "" })}
          />
          <p className="text-xs text-muted-foreground">
            留空用默认位置；缓存超 5GB 自动清理最旧的缩略图
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="destructive" size="sm" onClick={clearCache}>
            <Trash2 className="h-4 w-4" />
            清除缓存
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function ConfigFileSection({
  form,
  setForm,
}: {
  form: RulesForm
  setForm: Dispatch<SetStateAction<RulesForm>>
}) {
  const { config, setConfig } = useLibrary()
  const [kind, setKind] = useState<"public" | "personal">("public")
  const [rulesName, setRulesName] = useState("")
  const [currentConfig, setCurrentConfig] = useState("")
  const [baseForm, setBaseForm] = useState<RulesForm | null>(null)

  const dirty = baseForm !== null && JSON.stringify(form) !== JSON.stringify(baseForm)

  const saveConfigFile = async () => {
    const name = rulesName.trim()
    if (!name) return
    const folder = await pickFolder()
    if (!folder) return
    const rules = formToMatchRules(form)
    const fullPath = `${folder.replace(/[\\/]+$/, "")}\\${kind}_${name}.json`
    await api.saveRulesFile(fullPath, rules)
    await setConfig({ ...config, match_rules: rules })
    setCurrentConfig(fullPath)
    setBaseForm(form)
  }

  const overwriteConfigFile = async () => {
    if (!currentConfig) return
    const rules = formToMatchRules(form)
    await api.saveRulesFile(currentConfig, rules)
    await setConfig({ ...config, match_rules: rules })
    setBaseForm(form)
  }

  const loadConfigFile = async () => {
    const path = await pickFile(["json"])
    if (!path) return
    const loaded = await api.loadRulesFile(path)
    const loadedForm = matchRulesToForm(loaded)
    setForm(loadedForm)
    await setConfig({ ...config, match_rules: loaded })
    setCurrentConfig(path)
    setBaseForm(loadedForm)
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>配置文件</CardTitle>
        <CardDescription>
          全局匹配规则（分类 / 预览格式 / 预览后缀）保存为可分享的配置文件
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border p-2">
          <span className="shrink-0 text-sm text-muted-foreground">当前配置</span>
          <span className="min-w-0 flex-1 truncate text-xs">
            {currentConfig || "未加载配置文件"}
          </span>
        </div>
        <Separator />
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">保存全局规则到文件</label>
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "public" | "personal")}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="public">全局 public_</option>
              <option value="personal">个人 personal_</option>
            </select>
            <Input
              value={rulesName}
              onChange={(e) => setRulesName(e.target.value)}
              placeholder="名称（如 team_rules）"
              className="h-8 flex-1 text-sm"
            />
            {currentConfig && dirty ? (
              <>
                <Button size="sm" onClick={overwriteConfigFile}>
                  <Save className="h-4 w-4" />
                  覆盖配置
                </Button>
                <Button size="sm" variant="outline" onClick={saveConfigFile}>
                  另存为
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={saveConfigFile}>
                <Save className="h-4 w-4" />
                保存配置文件
              </Button>
            )}
          </div>
        </div>
        <Separator />
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">从文件加载全局规则</label>
          <Button size="sm" variant="outline" onClick={loadConfigFile}>
            <FolderOpen className="h-4 w-4" />
            加载配置文件
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// —— 板块 4：扫描索引 ——
function IndexSection() {
  const { scanning, paused, progress, error, assets, startScan, cancelScan, pauseScan, resumeScan } =
    useLibrary()

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>扫描索引</CardTitle>
        <CardDescription>配置完成后，再扫描建立索引</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {scanning ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={paused ? "text-muted-foreground" : ""}>
                {paused ? "已暂停" : "扫描中..."}
              </span>
              <span className="text-muted-foreground">已扫描 {progress.scanned} 个文件</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
            </div>
            <div className="truncate text-xs text-muted-foreground">{progress.currentDir}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={paused ? resumeScan : pauseScan}>
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {paused ? "继续" : "暂停"}
              </Button>
              <Button size="sm" variant="destructive" onClick={cancelScan}>
                <Square className="h-4 w-4" />
                停止
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={startScan}>
            <FolderSearch className="h-4 w-4" />
            扫描当前板块
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">当前库已索引 {assets.length} 个文件</p>
      </CardContent>
    </Card>
  )
}
