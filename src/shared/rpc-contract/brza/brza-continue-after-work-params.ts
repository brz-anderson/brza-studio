import * as z from 'zod'
import { Identifier } from '../structured-agent-session/structured-agent-session-identifiers'

/** `selection`: the chat follows the selected account, already switched (D1–D4). `pin`: a chat
 *  pinned to an account (P36), whose switch the host makes when the work is done (D5, P5). */
export const BRZA_CONTINUE_AFTER_WORK_TARGETS = ['selection', 'pin'] as const

/** O Continuar em outra conta que espera a tarefa em segundo plano (PLN-026, D3 e D5). */
export const BrzaContinueAfterWorkParams = z
  .object({
    sessionId: z.string().min(1),
    /** The usage-limit cut the person continued from. */
    turnItemId: z.string().min(1),
    /** Absent means `selection`. */
    target: z.enum(BRZA_CONTINUE_AFTER_WORK_TARGETS).optional(),
    /** With `pin`, the account to switch the chat to; null is System default. */
    accountId: Identifier('Invalid account id').nullable().optional(),
    /** The chosen account's label, which the row shows while it waits. */
    account: z.string().min(1).max(200).optional()
  })
  .strict()

export type BrzaContinueAfterWorkRequest = z.infer<typeof BrzaContinueAfterWorkParams>

export const BrzaCancelContinueAfterWorkParams = z.object({ sessionId: z.string().min(1) }).strict()

// Why: new methods; a client defers the continue only on a host that has them, since an older or
// remote host answers `method_not_found`.
export const BRZA_CONTINUE_AFTER_WORK_RUNTIME_CAPABILITY =
  'agent-session.structured.brza-continue-after-work.v1' as const
