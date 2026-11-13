import { useNotify } from '../../components/ui/Notifications'
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  CircleAlert,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import Modal from "../../components/overlay/Modal"
import { NavigationContext } from "../../components/layout/NavigationContext"
import { parseDate } from "../../components/ui/calendarDates"
import CalendarView from "./calendar/CalendarView"
import { ActivityCreatePopover } from "./calendar/ActivityForm"
import {
  getNextValidActivitySchedule,
  manilaTodayKey,
  readCalendarActivities,
  writeCalendarActivities,
  type CalendarActivity,
  type SelectedBlockInfo,
} from "./calendar/calendar-helpers"
import {
  newBrief,
  themePins,
  themes,
  type Brief,
  type Project,
} from "./model"
import { previewStudio } from "./preview-data"
import {
  clearPitchIntent,
  peekPitchIntent,
} from "./intent"
import {
  eventManagerLabel,
  eventManagerRoutes,
  type EventManagerRoute,
  type EventManagerView,
} from "./routes"
import Editor, { type Working } from "./pitch-editor/Editor"
import ThemeBoardEditor from "./mood-board/ThemeBoardEditor"
import { deleteThemeBoard, listThemeBoards, themePitchBrief, type ThemeBoard } from "./mood-board/theme-boards"
import {
  datePart,
  fmtRange,
  type StudioUser,
} from "./shared"
import PageHead, { StateCard } from "./PageHead"
import StudioDashboard from "./StudioDashboard"
import PitchesView, { type OpenPitch } from "./PitchesView"
import ConceptsView from "./ConceptsView"
import AssetsView from "./AssetsView"

export { StudioDashboard }

type Theme = (typeof themes)[number]
type EditorState = {
  key: number
  project: Project | null
  brief: Brief
  step: number
  restored?: boolean
}

const pageCopy: Record<EventManagerView, { title: string; copy: string }> = {
  studio: {
    title: "Event Pitches",
    copy: "Every occasion starts with a conversation.",
  },
  concepts: {
    title: "Ideas worth pinning.",
    copy: "Visual references, textures, and themes for your next occasion.",
  },
  creation: {
    title: "Save the date.",
    copy: "Every approved occasion, by the day it comes to life.",
  },
  assets: {
    title: "Asset library",
    copy: "Find the pieces that belong in your next story.",
  },
}

const workingKey = (user: StudioUser) =>
  `lumiere-event-manager-working:${user.email.trim().toLowerCase()}`
const copyBrief = (b: Brief): Brief => ({
  ...b,
  pins: b.pins.map((p) => ({ ...p, id: crypto.randomUUID() })),
  rentals: b.rentals.map((r) => ({ ...r, id: crypto.randomUUID() })),
  requirements: b.requirements.map((r) => ({ ...r })),
})
const byUpdated = (list: Project[]) =>
  [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

export default function EventManager({
  user,
  route = "module-client-pitching",
}: {
  user: StudioUser
  route?: EventManagerRoute
}) {
  const navigation = useContext(NavigationContext)
  const config = eventManagerRoutes[route]
  const label = eventManagerLabel(route)
  const view = config.view
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const setFlash = useNotify()
  // A Dashboard shortcut may ask Event Pitches to open a pitch, a theme or a blank brief.
  const [intent] = useState(() =>
    route === "module-client-pitching" ? peekPitchIntent(user.email) : null,
  )
  const intentHandled = useRef(false)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [themeBoards, setThemeBoards] = useState<ThemeBoard[]>([])
  const [themeEditor, setThemeEditor] = useState<{ key: number; board: ThemeBoard | null } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [recovered, setRecovered] = useState<Working | null>(null)
  const [deleteTheme, setDeleteTheme] = useState<ThemeBoard | null>(null)
  const [del, setDel] = useState<Project | null>(null)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  const todayKey = manilaTodayKey()
  const [calDay, setCalDay] = useState(todayKey)
  const [calMonth, setCalMonth] = useState(() => parseDate(todayKey))
  const [calPopoverKey, setCalPopoverKey] = useState<string | null>(null)
  const [calSelectedBlock, setCalSelectedBlock] = useState<SelectedBlockInfo | null>(null)
  const [activities, setActivities] = useState<CalendarActivity[]>(() =>
    readCalendarActivities(user),
  )

  useEffect(() => {
    setActivities(readCalendarActivities(user))
  }, [user])

  const createActivity = useCallback(
    (data: {
      title: string
      date: string
      startTime: string
      endTime: string
      meetingLink?: string
      tags: string[]
    }) => {
      const now = new Date().toISOString()
      const created: CalendarActivity = {
        id: `act-${crypto.randomUUID()}`,
        ...data,
        createdAt: now,
        updatedAt: now,
      }
      const next = [...activities, created].sort((a, b) =>
        `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`),
      )
      writeCalendarActivities(user, next)
      setActivities(next)
      setCalDay(data.date)
      setCalMonth(parseDate(data.date))
      setCalSelectedBlock(null)
      setFlash({ tone: "success", text: `Added “${created.title}” to calendar.` })
    },
    [user, setFlash, activities],
  )

  const updateActivity = useCallback(
    (
      id: string,
      patch: {
        title: string
        date: string
        startTime: string
        endTime: string
        meetingLink?: string
        tags: string[]
      },
    ) => {
      const now = new Date().toISOString()
      const next = activities
        .map((item) => (item.id === id ? { ...item, ...patch, updatedAt: now } : item))
        .sort((a, b) =>
          `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`),
        )
      writeCalendarActivities(user, next)
      setActivities(next)
      setFlash({ tone: "success", text: `Updated “${patch.title}”.` })
    },
    [user, setFlash, activities],
  )

  const updateActivityNote = useCallback(
    (id: string, note: string | undefined) => {
      const target = activities.find((item) => item.id === id)
      if (!target) return
      const now = new Date().toISOString()
      const next = activities.map((item) =>
        item.id === id ? { ...item, note, updatedAt: now } : item,
      )
      writeCalendarActivities(user, next)
      setActivities(next)
      setFlash({
        tone: "success",
        text: note
          ? `Saved note for “${target.title}”.`
          : `Removed note from “${target.title}”.`,
      })
    },
    [user, setFlash, activities],
  )

  const deleteActivity = useCallback(
    (id: string) => {
      const target = activities.find((item) => item.id === id)
      if (!target) return
      const next = activities.filter((item) => item.id !== id)
      writeCalendarActivities(user, next)
      setActivities(next)
      setCalSelectedBlock((prev) => (prev?.id === id ? null : prev))
      setFlash({ tone: "success", text: `Removed “${target.title}”.` })
    },
    [user, setFlash, activities],
  )

  const load = useCallback(async () => {
    try {
      const list = await previewStudio(user)
      setProjects(byUpdated(list))
      setThemeBoards(listThemeBoards(user))
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email])

  useEffect(() => {
    load()
  }, [load])

  // Recover an unsaved working copy left by host navigation or a reload.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(workingKey(user))
      if (raw) setRecovered(JSON.parse(raw) as Working)
    } catch {
      /* ignore unreadable working copy */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email])

  const onWorking = useCallback(
    (w: Working | null) => {
      try {
        if (w) sessionStorage.setItem(workingKey(user), JSON.stringify(w))
        else sessionStorage.removeItem(workingKey(user))
      } catch {
        /* storage unavailable */
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [user.email],
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const guard = (action: () => void) =>
    dirty ? setPending(() => action) : action()
  const open = (
    project: Project | null,
    brief?: Brief,
    step = 0,
    restored = false,
  ) =>
    guard(() => {
      setRecovered(null)
      setDirty(false)
      setEditor({
        key: ++seq.current,
        project,
        brief: brief ?? project?.brief ?? newBrief(),
        step,
        restored,
      })
    })
  const openTheme = (board: ThemeBoard | null) =>
    guard(() => {
      setDirty(false)
      setThemeEditor({ key: ++seq.current, board })
    })
  const closeTheme = () =>
    guard(() => {
      setThemeEditor(null)
      setDirty(false)
      setThemeBoards(listThemeBoards(user))
    })
  const onThemeSaved = useCallback(
    () => setThemeBoards(listThemeBoards(user)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.email],
  )
  const close = () =>
    guard(() => {
      setEditor(null)
      setDirty(false)
      onWorking(null)
    })
  const startTheme = (themeId: string, step = 0) => {
    const t = themes.find((x) => x.id === themeId)
    if (t) open(null, { ...newBrief(t.name), pins: themePins(t) }, step)
  }

  const resume = () => {
    if (!recovered) return
    const project = recovered.id
      ? (projects.find((p) => p.id === recovered.id) ?? null)
      : null
    if (recovered.id && !project) {
      setFlash({
        tone: "error",
        text: "The pitch for those unsaved changes no longer exists. They were discarded.",
      })
      discardRecovered()
      return
    }
    setEditor({
      key: ++seq.current,
      project,
      brief: recovered.brief,
      step: recovered.step,
      restored: true,
    })
    setRecovered(null)
  }
  const discardRecovered = () => {
    setRecovered(null)
    onWorking(null)
  }

  const onSaved = useCallback(
    (p: Project | null) => {
      setEditor((current) => (p && current ? { ...current, project: p } : null))
      load()
    },
    [load],
  )

  // Duplicating saves an independent draft copy straight away.
  const duplicate = async (p: Project) => {
    try {
      const copy = await previewStudio(user, {
        action: "save",
        brief: {
          ...copyBrief(p.brief),
          title: `${p.brief.title} (copy)`.slice(0, 120),
        },
        revision: 0,
        status: "draft",
      })
      setFlash({
        tone: "success",
        text: `Duplicated as “${copy.brief.title}”. The copy is a draft.`,
      })
      load()
    } catch (e) {
      setFlash({
        tone: "error",
        text:
          e instanceof Error ? e.message : "The pitch could not be duplicated.",
      })
    }
  }

  const confirmDelete = async () => {
    if (!del || busy) return
    setBusy(true)
    try {
      await previewStudio(user, {
        action: "delete",
        id: del.id,
        revision: del.revision,
      })
      setFlash({ tone: "success", text: `Deleted “${del.brief.title}”.` })
      if (editor?.project?.id === del.id) setEditor(null)
      setDel(null)
      load()
    } catch (e) {
      setFlash({
        tone: "error",
        text: e instanceof Error ? e.message : "The pitch could not be deleted.",
      })
      setDel(null)
      load()
    } finally {
      setBusy(false)
    }
  }

  const viewPitches = () =>
    guard(() => navigation?.go("module-client-pitching"))

  useEffect(() => {
    if (intent) clearPitchIntent(user.email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!intent || intentHandled.current) return
    if (intent.kind === "new") {
      intentHandled.current = true
      open(null, undefined, intent.step ?? 0)
      return
    }
    if (intent.kind === "theme") {
      intentHandled.current = true
      startTheme(intent.themeId, intent.step ?? 0)
      return
    }
    if (loading) return
    intentHandled.current = true
    if (intent.kind === "registered-theme") {
      const board = themeBoards.find((b) => b.id === intent.id)
      if (board) open(null, themePitchBrief(board), 1)
      else setFlash({ tone: "error", text: "That mood board is no longer saved in this browser." })
      return
    }
    const p = projects.find((x) => x.id === intent.id)
    if (p) open(p, undefined, config.openStep)
    else
      setFlash({
        tone: "error",
        text: "That pitch is no longer saved in this browser.",
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, loading, projects, themeBoards])

  const copy = pageCopy[view]
  const headAction =
    view === "studio" ? (
      <button
        type="button"
        className="em-btn em-btn--primary"
        onClick={() => open(null, undefined, 0)}
      >
        <Plus size={15} strokeWidth={1.75} aria-hidden /> New event pitch
      </button>
    ) : view === "concepts" ? (
      <button
        type="button"
        className="em-btn em-btn--primary"
        onClick={() => openTheme(null)}
      >
        <Plus size={15} strokeWidth={1.75} aria-hidden /> New mood board
      </button>
    ) : undefined

  const nextValidSchedule = useMemo(
    () => getNextValidActivitySchedule(calDay),
    [calDay, calPopoverKey],
  )

  const headSubAction =
    view === "creation" ? (
      <ActivityCreatePopover
        openState={calPopoverKey === "header-add-activity"}
        onOpenChange={(next) =>
          setCalPopoverKey(next ? "header-add-activity" : null)
        }
        defaultDate={nextValidSchedule.date}
        defaultStartTime={nextValidSchedule.startTime}
        defaultEndTime={nextValidSchedule.endTime}
        onCreate={createActivity}
        side="bottom"
        align="end"
        triggerClassName="inline-flex h-9 items-center justify-center rounded-full bg-invert px-4 text-[12.5px] font-semibold text-invert-fg transition-opacity hover:opacity-90"
      >
        Add activity
      </ActivityCreatePopover>
    ) : undefined

  return (
    <div className="em-page">
      {!editor && !themeEditor && (
        <PageHead
          crumb={label}
          eyebrow={view === "assets" ? undefined : label}
          title={copy.title}
          copy={copy.copy}
          action={headAction}
          subAction={headSubAction}
        />
      )}
      {recovered && !editor && !themeEditor && view === "studio" && (
        <div role="status" className="em-notice mb-6">
          <FileText size={16} strokeWidth={1.5} aria-hidden />
          <span className="min-w-0 flex-1">
            You have unsaved changes to “
            {recovered.brief.title.trim() || "Untitled pitch"}” from earlier in
            this session.
          </span>
          <button
            type="button"
            className="em-btn em-btn--quiet em-btn--sm"
            onClick={discardRecovered}
          >
            Discard
          </button>
          <button
            type="button"
            className="em-btn em-btn--primary em-btn--sm"
            onClick={view === "studio" || recovered.id ? resume : viewPitches}
          >
            {view === "studio" || recovered.id
              ? "Resume editing"
              : "View event pitches"}
          </button>
        </div>
      )}

      <div id="em-panel" role="region" aria-label={label}>
        {themeEditor ? (
          <ThemeBoardEditor
            key={themeEditor.key}
            user={user}
            board={themeEditor.board}
            onClose={closeTheme}
            onSaved={onThemeSaved}
            onDirty={setDirty}
          />
        ) : editor ? (
          <Editor
            key={editor.key}
            user={user}
            project={editor.project}
            initialBrief={editor.brief}
            initialStep={editor.step}
            onSaved={onSaved}
            onClose={close}
            onDirty={setDirty}
            onWorking={onWorking}
            restored={editor.restored}
            backLabel={label}
          />
        ) : loading ? (
          <LoadingState view={view} />
        ) : loadError ? (
          <StateCard
            icon={CircleAlert}
            title="We couldn't open your pitches."
            copy="Saved pitches in this browser could not be read. Try again, or clear site data for this preview to start fresh."
            action={
              <button
                type="button"
                className="em-btn em-btn--outline"
                onClick={() => {
                  setLoading(true)
                  load()
                }}
              >
                <RefreshCw size={15} strokeWidth={1.5} aria-hidden /> Try again
              </button>
            }
          />
        ) : view === "studio" ? (
          <PitchesView
            projects={projects}
            open={open}
            duplicate={duplicate}
            remove={setDel}
            startNew={() => open(null, undefined, 0)}
          />
        ) : view === "concepts" ? (
          <ConceptsView
            projects={projects}
            themeBoards={themeBoards}
            startRegisteredTheme={(board) => open(null, themePitchBrief(board), 1)}
            editTheme={openTheme}
            removeTheme={setDeleteTheme}
            open={open}
            startNew={() => open(null, undefined, 1)}
          />
        ) : view === "creation" ? (
          <CalendarView
            projects={projects}
            open={open}
            viewPitches={viewPitches}
            today={todayKey}
            day={calDay}
            setDay={setCalDay}
            month={calMonth}
            setMonth={setCalMonth}
            activePopoverKey={calPopoverKey}
            setActivePopoverKey={setCalPopoverKey}
            selectedBlock={calSelectedBlock}
            setSelectedBlock={setCalSelectedBlock}
            activities={activities}
            onCreateActivity={createActivity}
            onUpdateActivity={updateActivity}
            onUpdateActivityNote={updateActivityNote}
            onDeleteActivity={deleteActivity}
          />
        ) : (
          <AssetsView projects={projects} />
        )}
      </div>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Discard changes?"
        panelClassName="em-discard-dialog"
        compact
      >
        <p className="em-copy">
          Unsaved changes will be lost.
        </p>
        <div className="em-modal-actions">
          <button
            type="button"
            className="em-btn em-btn--outline"
            onClick={() => setPending(null)}
          >
            Keep working
          </button>
          <button
            type="button"
            className="em-btn em-btn--danger"
            onClick={() => {
              const next = pending
              setPending(null)
              setDirty(false)
              onWorking(null)
              next?.()
            }}
          >
            Discard changes
          </button>
        </div>
      </Modal>

      <Modal
        open={!!deleteTheme}
        onClose={() => setDeleteTheme(null)}
        title="Delete this mood board?"
        compact
        lowered
      >
        <p className="em-copy pr-6">
          Delete “{deleteTheme?.details.name}” permanently? Existing pitches won’t change.
        </p>
        <div className="em-modal-actions">
          <button type="button" className="em-btn em-btn--outline" onClick={() => setDeleteTheme(null)}>Keep mood board</button>
          <button type="button" className="em-btn em-btn--danger" onClick={() => {
            if (!deleteTheme) return
            try {
              deleteThemeBoard(user, deleteTheme.id)
              setThemeBoards(listThemeBoards(user))
              setFlash({ tone: "success", text: "Mood board deleted." })
              setDeleteTheme(null)
            } catch {
              setFlash({ tone: "error", text: "The mood board could not be deleted. Please try again." })
              setDeleteTheme(null)
            }
          }}><Trash2 size={15} aria-hidden /> Delete mood board</button>
        </div>
      </Modal>

      <Modal
        open={!!del}
        onClose={() => !busy && setDel(null)}
        title="Delete this pitch?"
        compact
        lowered
      >
        <p className="em-copy pr-6">
          “{del?.brief.title}”{del?.brief.client ? ` for ${del.brief.client}` : ""}{" "}
          will be removed from this browser, including its mood board, asset
          plan and history. This can't be undone.
        </p>
        <div className="em-modal-actions">
          <button
            type="button"
            className="em-btn em-btn--outline"
            onClick={() => setDel(null)}
            disabled={busy}
          >
            Keep pitch
          </button>
          <button
            type="button"
            className="em-btn em-btn--danger"
            onClick={confirmDelete}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            ) : (
              <Trash2 size={15} strokeWidth={1.5} aria-hidden />
            )}
            {busy ? "Deleting…" : "Delete pitch"}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function LoadingState({ view }: { view: EventManagerView }) {
  return (
    <div role="status" aria-label="Loading">
      <span className="sr-only">Loading your studio…</span>
      {view === "creation" ? (
        <div className="em-skeleton h-[420px]" aria-hidden />
      ) : (
        <ul className="em-card-grid" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="em-skeleton-card">
              <span className="em-skeleton h-[180px] rounded-none" />
              <span className="em-skeleton mx-5 mt-5 h-5 w-2/3" />
              <span className="em-skeleton mx-5 mb-6 mt-3 h-3.5 w-1/3" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
