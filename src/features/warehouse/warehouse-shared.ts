import { useNotify as useRawNotify } from "../../components/ui/Notifications"
import type { IssueResolutionType } from "../../operations/types"

export function useNotify() {
  const raw = useRawNotify()
  return (text: string) => {
    const isErr = /cannot|blocked|error|require|only|select|specify|enter|describe|provide|prepare|not found|assign the/i.test(text)
    raw({ tone: isErr ? "error" : "success", text })
  }
}

export const RESOLUTION_OPTIONS: IssueResolutionType[] = [
  "Recovered",
  "Repair Scheduled",
  "Approved Write-off",
  "Supplier Settled",
  "Charged to Client",
]

