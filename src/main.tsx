import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LibraryProvider } from "@/store/LibraryContext"

// 禁用 WebView2 原生右键菜单（预览卡片上有自定义菜单）
document.addEventListener("contextmenu", (e) => e.preventDefault())

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LibraryProvider>
      <TooltipProvider delayDuration={200}>
        <App />
      </TooltipProvider>
    </LibraryProvider>
  </React.StrictMode>,
)
