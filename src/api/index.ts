import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { open, ask } from "@tauri-apps/plugin-dialog"
import type { Asset, Config, Library, MatchRules } from "@/types"

// 是否运行在 Tauri 桌面壳内（浏览器预览模式为 false）
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args)
}

export const api = {
  isTauri,
  getConfig: () => call<Config>("get_config"),
  setConfig: (cfg: Config) => call<void>("set_config", { cfg }),
  addLibrary: (name: string, path: string) =>
    call<Library>("add_library", { name, path }),
  removeLibrary: (id: string) => call<void>("remove_library", { id }),
  setActiveLibrary: (id: string) => call<void>("set_active_library", { id }),
  startScan: (libId: string) => call<void>("start_scan", { libId }),
  cancelScan: () => call<void>("cancel_scan"),
  pauseScan: () => call<void>("pause_scan"),
  resumeScan: () => call<void>("resume_scan"),
  listAssets: (libId: string) => call<Asset[]>("list_assets", { libId }),
  updateAsset: (
    libId: string,
    id: string,
    tags: string[],
    description: string,
    link: string,
  ) => call<void>("update_asset", { libId, id, tags, description, link }),
  renameAsset: (libId: string, id: string, newStem: string) =>
    call<Asset>("rename_asset", { libId, id, newStem }),
  deleteAsset: (libId: string, id: string) => call<void>("delete_asset", { libId, id }),
  openUrl: (url: string) => call<void>("open_url", { url }),
  revealInFolder: (path: string) => call<void>("reveal_in_folder", { path }),
  checkPath: (path: string) => call<boolean>("check_path", { path }),
  saveRulesFile: (path: string, rules: MatchRules) =>
    call<void>("save_rules_file", { path, rules }),
  loadRulesFile: (path: string) => call<MatchRules>("load_rules_file", { path }),
  listRulesFiles: (dir: string) => call<string[]>("list_rules_files", { dir }),
}

// 选择文件夹（原生对话框）
export async function pickFolder(): Promise<string | null> {
  if (!isTauri) return null
  const selected = await open({ directory: true, multiple: false })
  return typeof selected === "string" ? selected : null
}

// 选择文件（原生对话框，可过滤扩展名）
export async function pickFile(extensions: string[]): Promise<string | null> {
  if (!isTauri) return null
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "配置文件", extensions }],
  })
  return typeof selected === "string" ? selected : null
}

// 确认对话框
export async function askConfirm(message: string, title: string): Promise<boolean> {
  if (!isTauri) return false
  return await ask(message, { title })
}

// 本地文件路径 → webview 可加载的 URL（Tauri asset protocol）
export function assetUrl(path: string): string {
  return convertFileSrc(path)
}
