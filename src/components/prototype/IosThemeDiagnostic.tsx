import { useEffect, useState } from 'react'

const BUILD_ID = '2026-11-25-drawer-no-transform'

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
  fixedBackdrops: number
  sidebarDimmer: string
  sidebarDisplay: string
  overflowLocks: string
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
  const sidebar = document.querySelector<HTMLElement>('aside.app-sidebar')
  const dimmerEl = document.querySelector<HTMLElement>('[data-sidebar-dimmer]')
  const fixedBackdrops = Array.from(document.querySelectorAll<HTMLElement>('div.fixed.inset-0')).filter(
    (el) => el.className.includes('bg-black/'),
  ).length
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
    fixedBackdrops,
    sidebarDimmer: dimmerEl ? `${dimmerEl.dataset.sidebarDimmer} (${getComputedStyle(dimmerEl).position})` : 'unmounted',
    sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : '(none)',
    overflowLocks: `${html.style.overflow || 'auto'}/${body.style.overflow || 'auto'}`,
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
  const [backdropMode, setBackdropMode] = useState<'document' | 'fixed' | 'off'>('document')
  const [drawerAnim, setDrawerAnim] = useState<'fade' | 'transform'>('fade')
  const [drawerPos, setDrawerPos] = useState<'fixed' | 'absolute'>('fixed')
  const [forceMainAnim, setForceMainAnim] = useState(false)
  const [snap, setSnap] = useState<Snapshot | null>(null)

  useEffect(() => {
    if (!enabled) return
    document.documentElement.dataset.drawerAnim = drawerAnim
    document.documentElement.dataset.drawerPos = drawerPos
    window.dispatchEvent(new CustomEvent('ios-diag:drawer', { detail: { anim: drawerAnim, pos: drawerPos } }))
  }, [enabled, drawerAnim, drawerPos])

  useEffect(() => {
    if (!enabled) return
    const main = document.querySelector<HTMLElement>('main.shell-main-enter')
    if (main) {
      main.classList.toggle('animate-fade-up', forceMainAnim)
    }
    return () => {
      main?.classList.remove('animate-fade-up')
    }
  }, [enabled, forceMainAnim])

  useEffect(() => {
    if (!enabled) return
    document.documentElement.dataset.sidebarBackdrop = backdropMode
    window.dispatchEvent(new CustomEvent('ios-diag:backdrop', { detail: backdropMode }))
  }, [enabled, backdropMode])

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
  }, [enabled, dark, hideBgLayers, stripThemeMeta, backdropMode, drawerAnim, drawerPos, forceMainAnim])

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
      className="relative z-10 mx-auto my-3 w-full max-w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-line bg-card/95 p-3 text-[11px] leading-4 text-foreground shadow-sm"
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
            <button
              type="button"
              onClick={() =>
                setBackdropMode((m) => (m === 'document' ? 'fixed' : m === 'fixed' ? 'off' : 'document'))
              }
              className="rounded border border-line px-2 py-1 text-[10px]"
            >
              Dimmer: {backdropMode}
            </button>
            <button
              type="button"
              onClick={() => setDrawerAnim((a) => (a === 'fade' ? 'transform' : 'fade'))}
              className="rounded border border-line px-2 py-1 text-[10px]"
            >
              Drawer Anim: {drawerAnim}
            </button>
            <button
              type="button"
              onClick={() => setDrawerPos((p) => (p === 'fixed' ? 'absolute' : 'fixed'))}
              className="rounded border border-line px-2 py-1 text-[10px]"
            >
              Drawer Pos: {drawerPos}
            </button>
            <button
              type="button"
              onClick={() => setForceMainAnim((v) => !v)}
              className="rounded border border-line px-2 py-1 text-[10px]"
            >
              Main Anim: {forceMainAnim ? 'Forced On' : 'Desktop Only'}
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
              `dimmer: ${snap.sidebarDimmer} | fixedBGs: ${snap.fixedBackdrops} | sidebar: ${snap.sidebarDisplay} | overflow: ${snap.overflowLocks}`,
            ].join('\n')}
          </pre>
        </div>
      )}
    </aside>
  )
}
