import {
  getState,
  isRole,
  normalizeEmail,
  recordAudit,
  update,
  type ActorRole,
  type AuditAction,
  type AuditActor,
  type AuditChange,
  type AuditEvent,
} from './store'

export type WorkflowAuditActorInput = {
  email?: string | null
  name?: string | null
  role?: string | null
}

/**
 * Records a cross-role workflow audit event in the shared store after an operation succeeds.
 * Resolves the actor from the prototype account store when present, or preserves the supplied
 * actor name/email/role so non-admin workflows appear cleanly in System Admin -> Audit Logs.
 */
export function recordWorkflowAudit(input: {
  actor?: WorkflowAuditActorInput | null
  fallbackRole?: ActorRole
  action: AuditAction
  target: AuditEvent['target']
  description: string
  changes?: AuditChange[]
  operationId?: string
}) {
  const email = input.actor?.email ? normalizeEmail(input.actor.email) : ''
  const store = getState()
  let matched = email ? store.accounts.find((a) => a.email === email) ?? null : null
  if (!matched && input.fallbackRole) {
    const activeSess = [...store.sessions].reverse().find((s) => s.status === 'active' && s.role === input.fallbackRole)
    if (activeSess) {
      matched = store.accounts.find((a) => a.id === activeSess.accountId) ?? null
    }
  }
  const role: ActorRole = matched
    ? matched.role
    : input.actor?.role && isRole(input.actor.role)
      ? input.actor.role
      : (input.fallbackRole ?? 'System')
  const actorObj: AuditActor & { name?: string; email?: string | null } = {
    account: matched,
    role,
    name: input.actor?.name?.trim() || undefined,
    email: email || null,
  }
  update((draft) => {
    recordAudit(draft, {
      actor: actorObj,
      action: input.action,
      target: input.target,
      description: input.description,
      changes: input.changes,
      operationId: input.operationId,
    })
  })
}
