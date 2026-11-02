import { expect, it } from 'vitest'
import { nativeChatNoticeLook } from '../native-chat-notice'

// BrzA P36: the divider a per-chat account switch writes, carried over from the fork's
// native-chat-notice test that the upstream moved and rewrote.
it.each([
  [
    {
      presentation: 'account-switched',
      accountSwitch: { accountId: 'adm', account: 'adm@example.com' }
    },
    { kind: 'divider', label: 'accountSwitched', account: 'adm@example.com' }
  ],
  // A row that lost its account still says its own sentence.
  [{ presentation: 'account-switched' }, { kind: 'line', tone: null }]
] as const)('reads an account switch as a divider or a plain line (%j)', (block, look) => {
  expect(nativeChatNoticeLook({ type: 'text', text: 'Switched', ...block })).toEqual(look)
})
