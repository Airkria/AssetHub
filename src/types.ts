export interface BoardConfig {
  id: string
  name: string
  folder: string
  include_dirs: string[]
  exclude_dirs: string[]
  layout: string
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

export interface MatchRules {
  preview_suffixes: string[]
  category_rules: CategoryRule[]
  format_families: FormatFamily[]
  tag_vocabulary: string[]
}

export interface Config {
  boards: BoardConfig[]
  match_rules: MatchRules
  cache_dir: string
  zoom_max_px: number
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

export type FilterMode = "folder" | "tag"
