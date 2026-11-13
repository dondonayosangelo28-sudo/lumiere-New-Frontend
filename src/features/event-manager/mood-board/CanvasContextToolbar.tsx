import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Copy,
  Droplet,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  Italic,
  LayoutGrid,
  Lock,
  LockOpen,
  Minus,
  PanelsTopLeft,
  Plus,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { Badge, Button, IconButton, cx } from "../../../components/ui/ui"
import Dropdown from "../../../components/ui/Dropdown"
import ColourPicker from "../../../components/ui/ColourPicker"
import { fieldCls, ghostBtn } from "../../../components/admin/AdminKit"
import { safePaint, validHex } from "../../../components/ui/colourValues"
import type { Pin } from "../model"
import { clamp, FONTS, LEGACY_PAPER, type Tab } from "./canvas-constants"

export function CanvasContextToolbar({
  pin,
  readOnly,
  tool,
  setTool,
  patchPin,
  palette,
  docColors,
  tab,
  setTab,
  duplicate,
  remove,
  page,
  pageBackground,
  changePageBackground,
  showPages,
  setShowPages,
  pageGrid,
  setPageGrid,
}: {
  pin: Pin | undefined
  readOnly: boolean
  tool: "select" | "pan" | "draw"
  setTool: (tool: "select" | "pan" | "draw") => void
  patchPin: (changes: Partial<Pin>) => void
  palette: readonly string[]
  docColors: string[]
  tab: Tab | null
  setTab: (tab: Tab | null | ((t: Tab | null) => Tab | null)) => void
  duplicate: (p: Pin) => void
  remove: () => void
  page: number
  pageBackground: string
  changePageBackground: (color: string) => void
  showPages: boolean
  setShowPages: (show: boolean | ((s: boolean) => boolean)) => void
  pageGrid: boolean
  setPageGrid: (grid: boolean | ((g: boolean) => boolean)) => void
}) {
  const iconButton = (
    Icon: LucideIcon,
    label: string,
    action: () => void,
    {
      disabled = false,
      active = false,
      text,
    }: { disabled?: boolean; active?: boolean; text?: string } = {},
  ) =>
    text ? (
      <button
        type="button"
        className={cx(ghostBtn, active && "bg-fg/[0.18]")}
        title={label}
        disabled={disabled}
        aria-pressed={active || undefined}
        onClick={action}
      >
        <Icon size={15} strokeWidth={1.75} aria-hidden />
        {text}
      </button>
    ) : (
      <IconButton
        type="button"
        icon={Icon}
        label={label}
        disabled={disabled}
        aria-pressed={active || undefined}
        onClick={action}
        className={cx(
          "shrink-0 disabled:pointer-events-none disabled:opacity-40",
          active && "bg-fg/[0.18] text-foreground",
        )}
      />
    )

  const dropdown = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: readonly (readonly [string, string])[],
    className?: string,
  ) => (
    <div className={cx("relative", className)}>
      <Dropdown
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(fieldCls, "appearance-none pr-9 text-left")}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Dropdown>
      <ChevronDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )

  const swatch = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    text?: string,
    gradient = false,
  ) => (
    <ColourPicker
      label={label}
      value={value}
      onChange={onChange}
      text={text}
      gradient={gradient}
      palette={palette}
    />
  )

  const divider = <span className="mb-divider" aria-hidden />

  const textPin =
    pin &&
    !pin.image &&
    (!pin.kind || pin.kind === "text" || pin.kind === "sticky")
  const alignIcon =
    pin?.align === "center"
      ? AlignCenter
      : pin?.align === "right"
        ? AlignRight
        : AlignLeft
  const nextAlign: Record<string, Pin["align"]> = {
    left: "center",
    center: "right",
    right: "left",
  }

  const selectionTools = pin ? (
    pin.locked ? (
      <>
        <Badge tone="neutral">Locked</Badge>
        {iconButton(LockOpen, "Unlock", () => patchPin({ locked: false }), {
          text: "Unlock",
        })}
      </>
    ) : (
      <>
        {textPin && (
          <>
            {dropdown(
              "Font",
              pin.fontFamily ?? "Arial, sans-serif",
              (fontFamily) => patchPin({ fontFamily }),
              FONTS,
              "mb-compact w-[132px]",
            )}
            <span className="mb-stepper">
              <button
                type="button"
                aria-label="Decrease font size"
                onClick={() =>
                  patchPin({
                    fontSize: clamp((pin.fontSize ?? 22) - 2, 8, 144),
                  })
                }
              >
                <Minus size={14} aria-hidden />
              </button>
              <input
                type="number"
                aria-label="Font size"
                min={8}
                max={144}
                value={pin.fontSize ?? 22}
                onChange={(e) => {
                  if (Number.isFinite(e.target.valueAsNumber))
                    patchPin({
                      fontSize: clamp(e.target.valueAsNumber, 8, 144),
                    })
                }}
              />
              <button
                type="button"
                aria-label="Increase font size"
                onClick={() =>
                  patchPin({
                    fontSize: clamp((pin.fontSize ?? 22) + 2, 8, 144),
                  })
                }
              >
                <Plus size={14} aria-hidden />
              </button>
            </span>
            {swatch("Text color", pin.color ?? "#292524", (color) =>
              patchPin({ color }),
            )}
            {iconButton(Bold, "Bold", () => patchPin({ bold: !pin.bold }), {
              active: pin.bold,
            })}
            {iconButton(
              Italic,
              "Italic",
              () => patchPin({ italic: !pin.italic }),
              { active: pin.italic },
            )}
            {iconButton(alignIcon, `Alignment: ${pin.align ?? "left"}`, () =>
              patchPin({ align: nextAlign[pin.align ?? "left"] }),
            )}
            {pin.kind !== "text" &&
              swatch("Note color", pin.fill ?? "#fff1b8", (fill) =>
                patchPin({ fill }), undefined, true,
              )}
          </>
        )}
        {["rect", "circle", "triangle", "diamond", "star", "arrow", "frame"].includes(pin.kind ?? "") &&
          swatch(
            "Fill color",
            pin.fill ?? "#d6c7b3",
            (fill) => patchPin({ fill }),
            "Color",
            ["rect", "circle", "frame"].includes(pin.kind ?? ""),
          )}
        {(pin.kind === "line" || pin.kind === "draw") &&
          swatch(
            "Stroke color",
            pin.color ?? "#44403c",
            (color) => patchPin({ color }),
            "Color",
          )}
        {pin.image && (
          <>
            {iconButton(
              FlipHorizontal2,
              "Flip horizontal",
              () => patchPin({ flipX: !pin.flipX }),
              { active: pin.flipX },
            )}
            {iconButton(
              FlipVertical2,
              "Flip vertical",
              () => patchPin({ flipY: !pin.flipY }),
              { active: pin.flipY },
            )}
          </>
        )}
        {divider}
        <label className="mb-opacity" title="Transparency">
          <Droplet size={15} strokeWidth={1.75} aria-hidden />
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            aria-label="Transparency"
            value={Math.round((pin.opacity ?? 1) * 100)}
            onChange={(e) =>
              patchPin({ opacity: Number(e.target.value) / 100 })
            }
          />
        </label>
        {iconButton(SlidersHorizontal, "Edit, align and effects", () => setTab("layers"), {
          text: "Edit",
          active: tab === "layers",
        })}
        {divider}
        {iconButton(Lock, "Lock", () => patchPin({ locked: true }))}
        {iconButton(Copy, "Duplicate", () => duplicate(pin))}
        {iconButton(Trash2, "Delete", remove)}
      </>
    )
  ) : null

  const pageTools =
    tool === "draw" ? (
      <>
        <Badge tone="neutral">Drawing on page {page + 1}</Badge>
        {iconButton(Hand, "Stop drawing", () => setTool("select"), {
          text: "Done",
        })}
      </>
    ) : (
      <>
        {swatch(
          `Page ${page + 1} background`,
          pageBackground ?? LEGACY_PAPER,
          changePageBackground,
          "Background",
          true,
        )}
      </>
    )

  return (
    <div
      className="mb-context"
      role="toolbar"
      aria-label="Edit selection"
    >
      {selectionTools ?? pageTools}
      <div className="mb-context-right">
        <Button
          type="button"
          variant="ghost"
          icon={PanelsTopLeft}
          aria-pressed={showPages && !pageGrid}
          onClick={() => {
            setPageGrid(false)
            setShowPages((s) => !s)
          }}
        >
          Pages
        </Button>
        <Button
          type="button"
          variant="ghost"
          icon={LayoutGrid}
          aria-pressed={pageGrid}
          onClick={() => setPageGrid((g) => !g)}
        >
          Grid
        </Button>
      </div>
    </div>
  )
}

export default CanvasContextToolbar

