import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LibraryProvider } from "@/store/LibraryContext"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LibraryProvider>
      <TooltipProvider delayDuration={200}>
        <App />
      </TooltipProvider>
    </LibraryProvider>
  </React.StrictMode>,
)
