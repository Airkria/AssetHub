import { useRef, useState, type Dispatch, type SetStateAction } from "react"
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
import { ModuleHeader } from "@/components/layout/module-header"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useLibrary } from "@/store/LibraryContext"
import { api, askConfirm, pickFile, pickFolder } from "@/api"
import { cn } from "@/lib/utils"
import type { MatchRules } from "@/types"

const textareaClass =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

function deriveName(path: string) {
  const seg = path
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .pop()
  return seg || "资源库"
}

// 匹配规则表单（字符串形式，避免输入时解析导致光标跳动）
interface RulesForm {
  include: string
  exclude: string
  suffixes: string
  categoryRules: { name: string; extensions: string }[]
  formatFamilies: { key: string; label: string; extensions: string }[]
}

function formToMatchRules(form: RulesForm): MatchRules {
  return {
    include_dirs: form.include.split("\n").map((s) => s.trim()).filter(Boolean),
    exclude_dirs: form.exclude.split("\n").map((s) => s.trim()).filter(Boolean),
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
  }
}

function matchRulesToForm(rules: MatchRules): RulesForm {
  return {
    include: rules.include_dirs.join("\n"),
    exclude: rules.exclude_dirs.join("\n"),
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
  }
}

type SectionKey = "paths" | "rules" | "formats" | "config"

const NAV: { key: SectionKey; label: string; icon: LucideIcon }[] = [
  { key: "paths", label: "路径设置", icon: FolderPlus },
  { key: "rules", label: "匹配规则", icon: Filter },
  { key: "formats", label: "预览文件格式", icon: FileImage },
  { key: "config", label: "配置文件", icon: Save },
]

export function Settings() {
  const { config, setConfig } = useLibrary()
  const [form, setForm] = useState<RulesForm>(() => matchRulesToForm(config.match_rules))
  const [active, setActive] = useState<SectionKey>("paths")
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pathsRef = useRef<HTMLElement | null>(null)
  const rulesRef = useRef<HTMLElement | null>(null)
  const formatsRef = useRef<HTMLElement | null>(null)
  const configRef = useRef<HTMLElement | null>(null)
  const refs = {
    paths: pathsRef,
    rules: rulesRef,
    formats: formatsRef,
    config: configRef,
  }

  const onScroll = () => {
    const c = scrollRef.current
    if (!c) return
    const cTop = c.getBoundingClientRect().top
    let cur: SectionKey = "paths"
    for (const k of ["paths", "rules", "formats", "config"] as SectionKey[]) {
      const el = refs[k].current
      if (el && el.getBoundingClientRect().top - cTop <= 80) cur = k
    }
    setActive(cur)
  }

  const scrollTo = (k: SectionKey) => {
    refs[k].current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ModuleHeader title="设置" description="配置资源库、匹配规则与预览格式" />
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
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto p-6"
        >
          <div className="space-y-6">
            <section ref={pathsRef} className="scroll-mt-6">
              <PathsSection />
            </section>
            <section ref={rulesRef} className="scroll-mt-6">
              <RulesSection form={form} setForm={setForm} />
            </section>
            <section ref={formatsRef} className="scroll-mt-6">
              <FormatsSection form={form} setForm={setForm} />
            </section>
            <section ref={configRef} className="scroll-mt-6">
              <ConfigFileSection
                form={form}
                setForm={setForm}
                config={config}
                setConfig={setConfig}
              />
            </section>
            <section>
              <IndexSection />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function PathsSection() {
  const { libraries, addLibrary, removeLibrary, config, setConfig } = useLibrary()

  const addViaPicker = async () => {
    const path = await pickFolder()
    if (!path) return
    const files = await api.listRulesFiles(path)
    if (files.length > 0) {
      const use = await askConfirm(
        `检测到 ${files.length} 个配置文件（${files[0]} 等），是否使用现有配置？`,
        "发现配置文件",
      )
      if (use) {
        const loaded = await api.loadRulesFile(
          `${path.replace(/[\\/]+$/, "")}\\${files[0]}`,
        )
        await setConfig({ ...config, match_rules: loaded })
      }
    }
    await addLibrary(deriveName(path), path)
  }

  return (
    <div className="space-y-4">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>资源库路径</CardTitle>
          <CardDescription>
            可添加多个 NAS 路径，每个作为独立资源库切换查看
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {libraries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              还没有资源库，点击下方「添加资源库」选择 NAS 文件夹
            </p>
          )}
          {libraries.map((lib) => (
            <div
              key={lib.id}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{lib.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {lib.path}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeLibrary(lib.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addViaPicker}>
            <FolderPlus className="h-4 w-4" />
            添加资源库
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>板块划分</CardTitle>
          <CardDescription>美术设定与工具板块对应的工作文件夹</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FolderRow
            label="美术设定文件夹"
            value={config.art_folder}
            onPick={(p) => setConfig({ ...config, art_folder: p })}
            onClear={() => setConfig({ ...config, art_folder: "" })}
          />
          <FolderRow
            label="工具文件夹"
            value={config.tools_folder}
            onPick={(p) => setConfig({ ...config, tools_folder: p })}
            onClear={() => setConfig({ ...config, tools_folder: "" })}
          />
        </CardContent>
      </Card>
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
          <CardTitle>扫描范围</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              限制搜索的文件夹（相对库根，一行一个，留空 = 扫描全部）
            </label>
            <textarea
              className={textareaClass}
              rows={3}
              value={form.include}
              onChange={(e) => setForm((f) => ({ ...f, include: e.target.value }))}
              placeholder={"02_资产库\\Library\n03_工具库\\Tools"}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              排除的文件夹（相对库根，一行一个）
            </label>
            <textarea
              className={textareaClass}
              rows={2}
              value={form.exclude}
              onChange={(e) => setForm((f) => ({ ...f, exclude: e.target.value }))}
              placeholder={"99_归档"}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              预览图后缀（逗号分隔，用于包体 ↔ 预览图匹配）
            </label>
            <Input
              value={form.suffixes}
              onChange={(e) => setForm((f) => ({ ...f, suffixes: e.target.value }))}
              placeholder="_preview,_thumb"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>分类规则</CardTitle>
          <CardDescription>按扩展名归类资产（优先于目录名分类）</CardDescription>
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
    </div>
  )
}

function FormatsSection({
  form,
  setForm,
}: {
  form: RulesForm
  setForm: Dispatch<SetStateAction<RulesForm>>
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>预览文件格式</CardTitle>
        <CardDescription>按格式家族管理可索引/预览的扩展名白名单</CardDescription>
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
  )
}

function ConfigFileSection({
  form,
  setForm,
  config,
  setConfig,
}: {
  form: RulesForm
  setForm: Dispatch<SetStateAction<RulesForm>>
  config: ReturnType<typeof useLibrary>["config"]
  setConfig: ReturnType<typeof useLibrary>["setConfig"]
}) {
  const [kind, setKind] = useState<"public" | "personal">("public")
  const [rulesName, setRulesName] = useState("")

  const saveConfigFile = async () => {
    const name = rulesName.trim()
    if (!name) return
    const folder = await pickFolder()
    if (!folder) return
    const rules = formToMatchRules(form)
    const fullPath = `${folder.replace(/[\\/]+$/, "")}\\${kind}_${name}.json`
    await api.saveRulesFile(fullPath, rules)
    await setConfig({ ...config, match_rules: rules })
  }

  const loadConfigFile = async () => {
    const path = await pickFile(["json"])
    if (!path) return
    const loaded = await api.loadRulesFile(path)
    setForm(matchRulesToForm(loaded))
    await setConfig({ ...config, match_rules: loaded })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>配置文件</CardTitle>
        <CardDescription>
          匹配规则统一保存在配置文件（public_ 全局 / personal_ 个人），可分享给团队
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            保存当前匹配规则到文件
          </label>
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
            <Button size="sm" onClick={saveConfigFile}>
              <Save className="h-4 w-4" />
              保存配置文件
            </Button>
          </div>
        </div>

        <Separator />

        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            从文件加载匹配规则
          </label>
          <Button size="sm" variant="outline" onClick={loadConfigFile}>
            <FolderOpen className="h-4 w-4" />
            加载配置文件
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

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
              <span className="text-muted-foreground">
                已扫描 {progress.scanned} 个文件
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {progress.currentDir}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={paused ? resumeScan : pauseScan}
              >
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
            扫描当前资源库
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          当前库已索引 {assets.length} 个文件
        </p>
      </CardContent>
    </Card>
  )
}
