import { z } from 'zod'
import { Identifier } from './structured-agent-session-identifiers'

/** Identity only: derive transcript/account paths host-side so clients cannot choose imported files or credential directories. */
export const ResumeSource = z
  .object({
    providerSessionId: Identifier('Invalid provider session id'),
    cliSource: z
      .object({
        workspaceId: Identifier('Invalid workspace id'),
        paneKey: Identifier('Invalid pane key')
      })
      .strict()
      .optional(),
    accountSwitch: z
      .object({ accountId: Identifier('Invalid account id').nullable() })
      .strict()
      .optional()
  })
  .strict()
