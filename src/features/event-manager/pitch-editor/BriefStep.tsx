import { ShieldCheck } from "lucide-react"
import { Field, Input } from "../../../components/ui/ui"
import DatePicker from "../../../components/ui/DatePicker"
import TimePicker from "../../../components/ui/TimePicker"
import {
  displayDate,
  type Brief,
  type Project,
} from "../model"
import {
  FieldError,
  addOneHour,
  combine,
  coverAlt,
  datePart,
  pitchCover,
  textareaCls,
  timePart,
  type Errors,
  type StudioUser,
} from "../shared"
import { parseBudget } from "./budget"
import StepHead from "./StepHead"

function DateTime({
  label,
  value,
  onChange,
  error,
  errKey,
  min,
  disabled,
}: {
  label: string
  value: string
  onChange: (d: string, t: string) => void
  error?: string
  errKey: string
  min?: string
  disabled: boolean
}) {
  const id = `em-${errKey}`
  return (
    <div>
      <span id={`${id}-label`} className="mb-2 block text-[14px] font-semibold">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[160px] flex-1">
          <DatePicker
            aria-labelledby={`${id}-label`}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `em-err-${errKey}` : undefined}
            value={datePart(value)}
            min={min}
            disabled={disabled}
            onChange={(d) => onChange(d, timePart(value))}
          />
        </div>
        <div className="w-[120px] shrink-0">
          <TimePicker
            aria-label={`${label} time`}
            value={timePart(value)}
            disabled={disabled || !value}
            onChange={(time) => onChange(datePart(value), time)}
          />
        </div>
      </div>
      <FieldError id={`em-err-${errKey}`} text={error} />
    </div>
  )
}

export function BriefStep({
  brief,
  update,
  errors,
  onEmailBlur,
  budgetInput,
  onBudgetChange,
  onBudgetBlur,
  readOnly,
  saved,
  user,
}: {
  brief: Brief
  update: (p: Partial<Brief>) => void
  errors: Errors
  onEmailBlur?: () => void
  budgetInput: string
  onBudgetChange: (text: string) => void
  onBudgetBlur: () => void
  readOnly: boolean
  saved: Project | null
  user: StudioUser
}) {
  const err = (k: keyof Errors) => ({
    "aria-invalid": !!errors[k] || undefined,
    "aria-describedby": errors[k] ? `em-err-${k}` : undefined,
  })
  const setStart = (d: string, t: string) => {
    const start = combine(d, t)
    if (!d) {
      update({ start })
      return
    }
    const prevEnd = brief.end
    const prevDefault = addOneHour(datePart(brief.start), timePart(brief.start))
    const isDefaultEnd =
      !prevEnd ||
      prevEnd === prevDefault ||
      prevEnd === datePart(brief.start) ||
      prevEnd === d
    if (isDefaultEnd) {
      update({ start, end: addOneHour(d, t) })
      return
    }
    if (!timePart(prevEnd) && t) {
      const [, endTime = ""] = addOneHour(datePart(prevEnd), t).split("T")
      update({ start, end: combine(datePart(prevEnd), endTime) })
      return
    }
    update({ start })
  }
  return (
    <div className="em-step-grid">
      <section className="em-panel em-step-panel">
        <StepHead
          eyebrow="01 / The client brief"
          title="Who is this moment for?"
          description="Capture who the event is for and when it happens. A title and client are enough to save a draft."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Field label="Client">
              <Input
                value={brief.client}
                onChange={(e) => update({ client: e.target.value })}
                placeholder="Client or organization"
                autoComplete="organization"
                maxLength={120}
                {...err("client")}
              />
            </Field>
            <FieldError id="em-err-client" text={errors.client} />
          </div>
          <div className="relative">
            <Field label="Client email">
              <Input
                type="email"
                inputMode="email"
                value={brief.clientEmail ?? ""}
                onChange={(e) => update({ clientEmail: e.target.value })}
                onBlur={onEmailBlur}
                placeholder="name@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                {...err("clientEmail")}
              />
            </Field>
            <div className="absolute inset-x-0 top-full [&_.em-error]:mt-1 [&_.em-error]:leading-3">
              <FieldError id="em-err-clientEmail" text={errors.clientEmail} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Field label="Event title">
              <Input
                value={brief.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="e.g. Santos–Reyes garden wedding"
                maxLength={140}
                {...err("title")}
              />
            </Field>
            <FieldError id="em-err-title" text={errors.title} />
          </div>
          <DateTime
            label="Starts"
            value={brief.start}
            onChange={setStart}
            error={errors.start}
            errKey="start"
            disabled={readOnly}
          />
          <DateTime
            label="Ends"
            value={brief.end}
            onChange={(d, t) => update({ end: combine(d, t) })}
            error={errors.end}
            errKey="end"
            min={datePart(brief.start) || undefined}
            disabled={readOnly}
          />
          <div>
            <Field label="Venue">
              <Input
                value={brief.venue}
                onChange={(e) => update({ venue: e.target.value })}
                placeholder="Venue name and city"
                maxLength={160}
                {...err("venue")}
              />
            </Field>
            <FieldError id="em-err-venue" text={errors.venue} />
          </div>
          <div>
            <Field label="Guest count">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={5000}
                step={1}
                value={Number.isFinite(brief.pax) ? brief.pax : ""}
                onChange={(e) =>
                  update({
                    pax:
                      e.target.value === ""
                        ? 0
                        : Math.round(Number(e.target.value)),
                  })
                }
                {...err("pax")}
              />
            </Field>
            <FieldError id="em-err-pax" text={errors.pax} />
          </div>
          <div>
            <Field label="Theme">
              <Input
                value={brief.theme}
                onChange={(e) => update({ theme: e.target.value })}
                placeholder="Enter event theme"
                maxLength={120}
                {...err("theme")}
              />
            </Field>
            <FieldError id="em-err-theme" text={errors.theme} />
          </div>
          <div>
            <Field label="Estimated budget">
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[14px] text-muted-foreground">₱</span>
                <Input
                  aria-label="Estimated budget in Philippine pesos (PHP)"
                  inputMode="decimal"
                  value={budgetInput}
                  onFocus={() => {
                    const result = parseBudget(budgetInput)
                    if (!result.error && result.value != null) onBudgetChange(String(result.value))
                  }}
                  onChange={(e) => onBudgetChange(e.target.value)}
                  onBlur={onBudgetBlur}
                  placeholder="150,000"
                  className="pl-8 tabular-nums"
                  {...err("estimatedBudget")}
                />
              </div>
            </Field>
            <FieldError id="em-err-estimatedBudget" text={errors.estimatedBudget} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                value={brief.notes}
                onChange={(e) => update({ notes: e.target.value })}
                placeholder="Preferences, must-haves, budget cues or access constraints"
                maxLength={2000}
                className={textareaCls}
              />
            </Field>
            <p className="mt-1 text-right text-[12px] text-muted-foreground tabular-nums">
              {brief.notes.length}/2000
            </p>
          </div>
        </div>
      </section>

      <aside className="em-step-aside">
        <figure className="em-feeling">
          <img src={pitchCover(brief)} alt={coverAlt(brief)} />
          <figcaption>
            <span className="em-feeling-eyebrow">
              The beginning of something beautiful
            </span>
            <span className="em-feeling-title">First, imagine the feeling.</span>
          </figcaption>
        </figure>
        <div className="em-aside-card">
          <ShieldCheck size={18} strokeWidth={1.5} aria-hidden />
          <p className="em-aside-card-title">A record of every beginning.</p>
          <p className="em-aside-card-meta">
            {saved
              ? `Processed by ${saved.processedBy} on ${displayDate(saved.createdAt)}.`
              : `Processed by ${user.name} when this pitch is first saved.`}
          </p>
        </div>
      </aside>
    </div>
  )
}

export default BriefStep

