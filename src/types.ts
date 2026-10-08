export type ModuleKey =
  | "art-direction"
  | "asset-search"
  | "tools"
  | "tutorial"
  | "output"
  | "settings"

export interface MatchRules {
  include_dirs: string[]
  exclude_dirs: string[]
  preview_suffixes: string[]
  category_rules: CategoryRule[]
  format_families: FormatFamily[]
}

export interface CategoryRule {
  name: string
  extensions: string[]
}

export interface FormatFamily {
  key: string
  label: string
  extensions: string[]
}

export interface Library {
  id: string
  name: string
  path: string
}

export interface Config {
  libraries: Library[]
  active_library_id: string | null
  match_rules: MatchRules
  art_folder: string
  tools_folder: string
}

export interface Asset {
  id: string
  path: string
  name: string
  stem: string
  ext: string
  category: string
  rel_dir: string
  size: number
  mtime: number
  is_preview: boolean
  preview_paths: string[]
  tags: string[]
  edited: boolean
  description: string
  link: string
}
