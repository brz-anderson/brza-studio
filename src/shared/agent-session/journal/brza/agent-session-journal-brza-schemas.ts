import * as z from 'zod'

// Tool-result images keep `type` open, so a newer image kind adds no closed set (journal-closed-sets.test.ts).
export const ToolResultImage = z.object({
  type: z.string(),
  path: z.string().optional(),
  url: z.string().optional(),
  alt: z.string().optional()
})

/** The account a chat moved to; the notice row keeps the id and the name it had then. */
export const AccountSwitch = z.object({
  accountId: z.string().min(1).max(512).nullable(),
  account: z.string().min(1).max(1024)
})
