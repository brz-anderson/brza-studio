// Split out of structured-agent-session-params.ts, which is at its line limit.

import * as z from 'zod'
import { Identifier } from './structured-agent-session/structured-agent-session-identifiers'
import { MutationEnvelope } from './structured-agent-session/structured-agent-session-mutation-envelope'

/** The account to move the chat to; null is System default. */
export const SwitchAccountParams = z
  .object({
    envelope: MutationEnvelope,
    accountId: Identifier('Invalid account id').nullable()
  })
  .strict()
