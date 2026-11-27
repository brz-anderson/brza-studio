import * as z from 'zod'

/** O Continuar em outra conta que espera a tarefa em segundo plano (PLN-026, D3). */
export const BrzaContinueAfterWorkParams = z
  .object({
    sessionId: z.string().min(1),
    /** The usage-limit cut the person continued from. */
    turnItemId: z.string().min(1),
    /** The chosen account's label, which the row shows while it waits. */
    account: z.string().min(1).max(200)
  })
  .strict()

export const BrzaCancelContinueAfterWorkParams = z.object({ sessionId: z.string().min(1) }).strict()

// Why: new methods; a client defers the continue only on a host that has them, since an older or
// remote host answers `method_not_found`.
export const BRZA_CONTINUE_AFTER_WORK_RUNTIME_CAPABILITY =
  'agent-session.structured.brza-continue-after-work.v1' as const
