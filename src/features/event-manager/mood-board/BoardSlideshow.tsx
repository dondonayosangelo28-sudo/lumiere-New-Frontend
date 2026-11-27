import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Minimize2 } from "lucide-react"
import OverlayLayer from "../../../components/overlay/OverlayLayer"
import { cx } from "../../../components/ui/ui"
import Board from "./Board"
import type { Brief } from "../model"

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export default function BoardSlideshow({ brief, pages, initialPage, onClose }: {
  brief: Brief
  pages: { title: string; background: string }[]
  initialPage: number
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [slide, setSlide] = useState(initialPage)
  const [controlsVisible, setControlsVisible] = useState(true)
  const controlsFocusedRef = useRef(false)
  const controlsHoveredRef = useRef(false)
  const hideTimerRef = useRef<number | null>(null)
  const wasFullscreen = useRef(Boolean(getFullscreenElement()))
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    if (!controlsFocusedRef.current && !controlsHoveredRef.current) {
      hideTimerRef.current = window.setTimeout(() => {
        if (!controlsFocusedRef.current && !controlsHoveredRef.current) {
          setControlsVisible(false)
        }
      }, 2500)
    }
  }, [clearHideTimer])

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    revealControls()
    return clearHideTimer
  }, [revealControls, clearHideTimer])

  useEffect(() => {
    const onFullscreenChange = () => {
      if (getFullscreenElement()) {
        wasFullscreen.current = true
      } else if (wasFullscreen.current) {
        wasFullscreen.current = false
        onCloseRef.current()
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    document.addEventListener("webkitfullscreenchange", onFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange)
    }
  }, [])

  const move = (delta: number) => setSlide((i) => Math.max(0, Math.min(pages.length - 1, i + delta)))
  const close = () => {
    wasFullscreen.current = false
    const doc = document as FullscreenDocument
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => { })
    } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === "function") {
      try {
        void doc.webkitExitFullscreen()
      } catch {
        // Ignore browser fullscreen exit errors; overlay closes regardless.
      }
    }
    onClose()
  }
  return (
    <OverlayLayer panelRef={panel} onClose={close} className="fixed inset-0 bg-black">
      <div
        ref={panel}
        className="mb-slideshow"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Board presentation"
        onPointerMove={revealControls}
        onPointerDown={revealControls}
        onKeyDown={(e) => {
          if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); move(1) }
          if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); move(-1) }
          if (e.key === "Home") setSlide(0)
          if (e.key === "End") setSlide(pages.length - 1)
        }}
      >
        <div className="mb-slide-canvas">
          <Board compact pins={brief.pins} page={slide} theme={brief.theme} background={pages[slide].background} label={pages[slide].title} />
        </div>
        <footer
          className={cx("mb-slide-controls", !controlsVisible && "is-hidden")}
          onPointerEnter={() => {
            controlsHoveredRef.current = true
            clearHideTimer()
            setControlsVisible(true)
          }}
          onPointerLeave={() => {
            controlsHoveredRef.current = false
            scheduleHide()
          }}
          onFocusCapture={() => {
            controlsFocusedRef.current = true
            clearHideTimer()
            setControlsVisible(true)
          }}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              controlsFocusedRef.current = false
              scheduleHide()
            }
          }}
        >
          <span className="mb-slide-progress" style={{ width: `${((slide + 1) / pages.length) * 100}%` }} />
          <button type="button" aria-label="Previous slide" disabled={slide === 0} onClick={() => move(-1)}><ChevronLeft size={18} strokeWidth={2} /></button>
          <span className="mb-slide-count" aria-live="polite">{slide + 1} / {pages.length}</span>
          <button type="button" aria-label="Next slide" disabled={slide === pages.length - 1} onClick={() => move(1)}><ChevronRight size={18} strokeWidth={2} /></button>
          <span className="mb-slide-title">{pages[slide].title}</span>
          <div className="mb-slide-window-controls">
            <button type="button" title="Exit Present" aria-label="Exit Present" onClick={close}>
              <Minimize2 size={20} strokeWidth={1.85} />
            </button>
          </div>
        </footer>
      </div>
    </OverlayLayer>
  )
}
