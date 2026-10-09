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
import type { Asset, Config, Library } from "@/types"

const defaultConfig: Config = {
  libraries: [],
  active_library_id: null,
  match_rules: {
    preview_suffixes: ["", "_preview", "_thumb", "_预览"],
    category_rules: [],
    format_families: [],
  },
  cache_dir: "",
  zoom_max_px: 2048,
}

export type ConnStatus = "none" | "connected" | "error"

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
  libraries: Library[]
  activeLibrary: Library | null
  assets: Asset[]
  scanning: boolean
  paused: boolean
  progress: ScanProgress
  error: string | null
  status: ConnStatus
  configLoaded: boolean
  setConfig: (cfg: Config) => Promise<void>
  addLibrary: (name: string, path: string) => Promise<Library>
  removeLibrary: (id: string) => Promise<void>
  setActiveLibrary: (id: string) => Promise<void>
  updateActiveLibrary: (patch: Partial<Library>) => Promise<void>
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
  const [assets, setAssets] = useState<Asset[]>([])
  const [scanning, setScanning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState<ScanProgress>({
    scanned: 0,
    currentDir: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnStatus>("none")
  const [configLoaded, setConfigLoaded] = useState(false)

  const activeLibrary = useMemo(
    () => config.libraries.find((l) => l.id === config.active_library_id) ?? null,
    [config],
  )
  const activeLibIdRef = useRef<string | null>(null)
  useEffect(() => {
    activeLibIdRef.current = activeLibrary?.id ?? null
  }, [activeLibrary])

  useEffect(() => {
    if (!isTauri) return
    api
      .getConfig()
      .then((c) => {
        setConfigState(c)
        setConfigLoaded(true)
      })
      .catch(() => setConfigLoaded(true))
  }, [])

  useEffect(() => {
    if (!isTauri) return
    if (!activeLibrary) {
      setAssets([])
      setStatus("none")
      return
    }
    setStatus("connected")
    api
      .listAssets(activeLibrary.id)
      .then(setAssets)
      .catch(() => setAssets([]))
    api
      .checkPath(activeLibrary.path)
      .then((ok) => setStatus(ok ? "connected" : "error"))
      .catch(() => setStatus("error"))
  }, [activeLibrary])

  // 扫描事件监听（一次注册，通过 ref 取当前库 id）
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
        const libId = activeLibIdRef.current
        if (libId) {
          try {
            setAssets(await api.listAssets(libId))
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

  const addLibrary = async (name: string, path: string) => {
    const lib = await api.addLibrary(name, path)
    setConfigState(await api.getConfig())
    return lib
  }

  const removeLibrary = async (id: string) => {
    await api.removeLibrary(id)
    setConfigState(await api.getConfig())
  }

  const setActiveLibrary = async (id: string) => {
    await api.setActiveLibrary(id)
    setConfigState(await api.getConfig())
  }

  const updateActiveLibrary = async (patch: Partial<Library>) => {
    if (!activeLibrary) return
    const libraries = config.libraries.map((l) =>
      l.id === activeLibrary.id ? { ...l, ...patch } : l,
    )
    await setConfig({ ...config, libraries })
  }

  const startScan = async () => {
    if (!isTauri || !activeLibrary) return
    setError(null)
    setScanning(true)
    setPaused(false)
    setProgress({ scanned: 0, currentDir: "" })
    try {
      await api.startScan(activeLibrary.id)
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
    if (!activeLibrary) return
    const cur = assets.find((a) => a.id === id)
    if (!cur) return
    const updated: Asset = { ...cur, ...patch, edited: true }
    setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)))
    if (isTauri) {
      await api.updateAsset(
        activeLibrary.id,
        id,
        updated.tags,
        updated.description,
        updated.link,
      )
    }
  }

  const renameAsset = async (id: string, newStem: string) => {
    if (!activeLibrary) return
    const updated = await api.renameAsset(activeLibrary.id, id, newStem)
    setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)))
  }

  const deleteAsset = async (id: string) => {
    if (!activeLibrary) return
    await api.deleteAsset(activeLibrary.id, id)
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <LibraryContext.Provider
      value={{
        config,
        libraries: config.libraries,
        activeLibrary,
        assets,
        scanning,
        paused,
        progress,
        error,
        status,
        configLoaded,
        setConfig,
        addLibrary,
        removeLibrary,
        setActiveLibrary,
        updateActiveLibrary,
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
