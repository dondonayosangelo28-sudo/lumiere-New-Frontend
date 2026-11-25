import { useEffect, useState } from 'react'

const BUILD_ID = '2026-11-25-dark-root-diag'

type Snapshot = {
  htmlClass: string
  themeColor: string
  htmlBg: string
  htmlScheme: string
  bodyBg: string
  bodyScheme: string
  rootBg: string
  shellBg: string
  innerHeight: number
  vvHeight: number | null
  vvOffsetTop: number | null
  scrollEl: string
  scrollHeight: number
  scrollY: number
  standalone: boolean
}

function readSnapshot(): Snapshot {
  const html = document.documentElement
  const body = document.body
  const root = document.getElementById('root')
  const shell = root?.firstElementChild as HTMLElement | null
  const htmlStyle = getComputedStyle(html)
  const bodyStyle = getComputedStyle(body)
  const rootStyle = root ? getComputedStyle(root) : null
  const shellStyle = shell ? getComputedStyle(shell) : null
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const vv = window.visualViewport
  return {
    htmlClass: html.className || '(none)',
    themeColor: meta?.content ?? '(removed)',
    htmlBg: htmlStyle.backgroundColor,
    htmlScheme: htmlStyle.colorScheme,
    bodyBg: bodyStyle.backgroundColor,
    bodyScheme: bodyStyle.colorScheme,
    rootBg: rootStyle?.backgroundColor ?? '(none)',
    shellBg: shellStyle?.backgroundColor ?? '(none)',
    innerHeight: window.innerHeight,
    vvHeight: vv ? Math.round(vv.height) : null,
    vvOffsetTop: vv ? Math.round(vv.offsetTop) : null,
    scrollEl: document.scrollingElement?.tagName ?? '(none)',
    scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
    scrollY: Math.round(window.scrollY),
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  }
}

export default function IosThemeDiagnostic({
  dark,
  setDark,
}: {
  dark: boolean
  setDark: (v: boolean) => void
}) {
  const enabled =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('ios-diag') === '1'
  const [open, setOpen] = useState(true)
  const [hideBgLayers, setHideBgLayers] = useState(false)
  const [stripThemeMeta, setStripThemeMeta] = useState(false)
  const [snap, setSnap] = useState<Snapshot | null>(null)

  useEffect(() => {
    if (!enabled) return
    const update = () => setSnap(readSnapshot())
    update()
    const vv = window.visualViewport
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
    }
  }, [enabled, dark, hideBgLayers, stripThemeMeta])

  useEffect(() => {
    if (!enabled) return
    const layers = Array.from(
      document.querySelectorAll<HTMLElement>('#root > div > div.pointer-events-none.fixed.inset-0'),
    )
    layers.forEach((el) => {
      el.style.display = hideBgLayers ? 'none' : ''
    })
    return () => {
      layers.forEach((el) => {
        el.style.display = ''
      })
    }
  }, [enabled, hideBgLayers])

  useEffect(() => {
    if (!enabled) return
    const head = document.head
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (stripThemeMeta) {
      meta?.remove()
      return () => {
        if (!document.querySelector('meta[name="theme-color"]')) {
          const restored = document.createElement('meta')
          restored.name = 'theme-color'
          restored.content = dark ? '#0b0b0b' : '#f9fafb'
          head.appendChild(restored)
        }
      }
    }
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      head.appendChild(meta)
    }
    meta.content = dark ? '#0b0b0b' : '#f9fafb'
  }, [enabled, stripThemeMeta, dark])

  if (!enabled) return null

  return (
    <aside
      aria-label="iOS theme diagnostic"
      className="fixed bottom-3 left-3 z-[200] max-w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-card/95 p-3 text-[11px] leading-4 text-foreground shadow-xl backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2 font-semibold">
        <span>iOS Diag · {BUILD_ID}</span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded border border-line px-1.5 py-0.5 text-[10px]"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && snap && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDark(!dark)}
              className="rounded border border-line px-2 py-1 text-[10px]"
            >
              Theme: {dark ? 'Dark' : 'Light'}
            </button>
            <button
              type="button"
              onClick={() => setHideBgLayers(!hideBgLayers)}
              className="rounded border border-line px-2 py-1 text-[10px]"
            >
              Fixed BG: {hideBgLayers ? 'Off' : 'On'}
            </button>
            <button
              type="button"
              onClick={() => setStripThemeMeta(!stripThemeMeta)}
              className="rounded border border-line px-2 py-1 text-[10px]"
            >
              theme-color: {stripThemeMeta ? 'Removed' : 'Active'}
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-3.5 text-muted-foreground">
            {[
              `mode: ${snap.standalone ? 'PWA' : 'Safari'} | html: ${snap.htmlClass}`,
              `theme-color: ${snap.themeColor}`,
              `html: ${snap.htmlBg} (${snap.htmlScheme})`,
              `body: ${snap.bodyBg} (${snap.bodyScheme})`,
              `#root: ${snap.rootBg} | shell: ${snap.shellBg}`,
              `innerH: ${snap.innerHeight} | vvH: ${snap.vvHeight ?? 'n/a'} (top ${snap.vvOffsetTop ?? 0})`,
              `scroll: ${snap.scrollEl} h=${snap.scrollHeight} y=${snap.scrollY}`,
            ].join('\n')}
          </pre>
        </div>
      )}
    </aside>
  )
}
