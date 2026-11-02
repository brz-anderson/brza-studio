import { describe, expect, it } from 'vitest'
import { wsFallbackPortLadder } from '../ws-fallback-port-store'

// Coexistence with upstream Orca: its 6768-6799 ladder belongs to Orca, so ours starts at 6868.
describe('ws-fallback-port-store ladder of BrzA Studio', () => {
  it('builds a deterministic ladder above the preferred port, clear of upstream Orca', () => {
    // 6869 stays free for a `pnpm dev` instance pinned beside packaged BrzA Studio.
    expect(wsFallbackPortLadder(6868)).toEqual(Array.from({ length: 30 }, (_, i) => 6870 + i))
    expect(wsFallbackPortLadder(6869)).toEqual(Array.from({ length: 31 }, (_, i) => 6870 + i))
    expect(wsFallbackPortLadder(65530)).toEqual([65531, 65532, 65533, 65534, 65535])
    expect(wsFallbackPortLadder(0)).toEqual([])
  })
})
