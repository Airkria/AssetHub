import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { listen } from "@tauri-apps/api/event"
import { api, isTauri } from "@/api"
import type { Asset, BoardConfig, Config } from "@/types"

const defaultConfig: Config = {
  boards: [],
  match_rules: {
    preview_suffixes: ["", "_preview", "_thumb", "_预览"],
    category_rules: [],
    format_families: [],
    tag_vocabulary: [],
  },
  cache_dir: "",
  zoom_max_px: 2048,
}

interface ScanProgress {
  scanned: number
  currentDir: string
}

export interface AssetPatch {
  tags?: string[]
  description?: string
  link?: string
}

interface LibraryState {
  config: Config
  boards: BoardConfig[]
  activeBoardId: string | null
  activeBoard: BoardConfig | null
  assets: Asset[]
  scanning: boolean
  paused: boolean
  progress: ScanProgress
  error: string | null
  configLoaded: boolean
  setConfig: (cfg: Config) => Promise<void>
  addBoard: (name: string, folder: string) => Promise<BoardConfig>
  removeBoard: (id: string) => Promise<void>
  setActiveBoard: (id: string) => void
  updateBoard: (id: string, patch: Partial<BoardConfig>) => Promise<void>
  startScan: () => Promise<void>
  cancelScan: () => Promise<void>
  pauseScan: () => Promise<void>
  resumeScan: () => Promise<void>
  updateMetadata: (id: string, patch: AssetPatch) => Promise<void>
  renameAsset: (id: string, newStem: string) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
}

const LibraryContext = createContext<LibraryState | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<Config>(defaultConfig)
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [scanning, setScanning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState<ScanProgress>({
    scanned: 0,
    currentDir: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  const activeBoard = useMemo(
    () => config.boards.find((b) => b.id === activeBoardId) ?? null,
    [config, activeBoardId],
  )
  const activeBoardIdRef = useRef<string | null>(null)
  useEffect(() => {
    activeBoardIdRef.current = activeBoardId
  }, [activeBoardId])

  // 加载配置，默认选中第一个板块
  useEffect(() => {
    if (!isTauri) return
    api
      .getConfig()
      .then((c) => {
        setConfigState(c)
        setActiveBoardId((prev) => prev ?? c.boards[0]?.id ?? null)
        setConfigLoaded(true)
      })
      .catch(() => setConfigLoaded(true))
  }, [])

  // 板块切换时加载资产
  useEffect(() => {
    if (!isTauri || !activeBoardId) {
      setAssets([])
      return
    }
    api
      .listAssets(activeBoardId)
      .then(setAssets)
      .catch(() => setAssets([]))
  }, [activeBoardId])

  // 扫描事件监听（一次注册，通过 ref 取当前板块 id）
  useEffect(() => {
    if (!isTauri) return
    const unlisteners: Array<() => void> = []
    let disposed = false
    const track = (p: Promise<() => void>) =>
      p.then((un) => {
        if (disposed) un()
        else unlisteners.push(un)
      })

    track(
      listen<{ scanned: number; current_dir: string }>(
        "scan://progress",
        (e) =>
          setProgress({
            scanned: e.payload.scanned,
            currentDir: e.payload.current_dir,
          }),
      ),
    )
    track(
      listen("scan://done", async () => {
        setScanning(false)
        setPaused(false)
        setProgress({ scanned: 0, currentDir: "" })
        const bid = activeBoardIdRef.current
        if (bid) {
          try {
            setAssets(await api.listAssets(bid))
          } catch {
            /* ignore */
          }
        }
      }),
    )
    track(
      listen("scan://cancelled", () => {
        setScanning(false)
        setPaused(false)
        setProgress({ scanned: 0, currentDir: "" })
      }),
    )
    track(
      listen<{ message: string }>("scan://error", (e) => {
        setError(e.payload.message)
        setScanning(false)
        setPaused(false)
      }),
    )

    return () => {
      disposed = true
      unlisteners.forEach((u) => u())
    }
  }, [])

  const setConfig = async (cfg: Config) => {
    setConfigState(cfg)
    if (isTauri) await api.setConfig(cfg)
  }

  const addBoard = async (name: string, folder: string) => {
    const board = await api.addBoard(name, folder)
    setConfigState(await api.getConfig())
    setActiveBoardId((prev) => prev ?? board.id)
    return board
  }

  const removeBoard = async (id: string) => {
    await api.removeBoard(id)
    const cfg = await api.getConfig()
    setConfigState(cfg)
    if (activeBoardId === id) setActiveBoardId(cfg.boards[0]?.id ?? null)
  }

  const setActiveBoard = (id: string) => setActiveBoardId(id)

  const updateBoard = async (id: string, patch: Partial<BoardConfig>) => {
    const boards = config.boards.map((b) => (b.id === id ? { ...b, ...patch } : b))
    await setConfig({ ...config, boards })
  }

  const startScan = async () => {
    if (!isTauri || !activeBoardId) return
    setError(null)
    setScanning(true)
    setPaused(false)
    setProgress({ scanned: 0, currentDir: "" })
    try {
      await api.startScan(activeBoardId)
    } catch (e) {
      setError(String(e))
      setScanning(false)
    }
  }

  const cancelScan = async () => {
    if (isTauri) await api.cancelScan()
  }

  const pauseScan = async () => {
    setPaused(true)
    if (isTauri) await api.pauseScan()
  }

  const resumeScan = async () => {
    setPaused(false)
    if (isTauri) await api.resumeScan()
  }

  const updateMetadata = async (id: string, patch: AssetPatch) => {
    if (!activeBoardId) return
    const cur = assets.find((a) => a.id === id)
    if (!cur) return
    const updated: Asset = { ...cur, ...patch, edited: true }
    setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)))
    if (isTauri) {
      await api.updateAsset(
        activeBoardId,
        id,
        updated.tags,
        updated.description,
        updated.link,
      )
    }
  }

  const renameAsset = async (id: string, newStem: string) => {
    if (!activeBoardId) return
    const updated = await api.renameAsset(activeBoardId, id, newStem)
    setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)))
  }

  const deleteAsset = async (id: string) => {
    if (!activeBoardId) return
    await api.deleteAsset(activeBoardId, id)
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <LibraryContext.Provider
      value={{
        config,
        boards: config.boards,
        activeBoardId,
        activeBoard,
        assets,
        scanning,
        paused,
        progress,
        error,
        configLoaded,
        setConfig,
        addBoard,
        removeBoard,
        setActiveBoard,
        updateBoard,
        startScan,
        cancelScan,
        pauseScan,
        resumeScan,
        updateMetadata,
        renameAsset,
        deleteAsset,
      }}
    >
      {children}
    </LibraryContext.Provider>
  )
}

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider")
  return ctx
}
