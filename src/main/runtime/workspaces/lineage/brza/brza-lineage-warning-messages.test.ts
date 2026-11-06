import { describe, expect, it } from 'vitest'
import { LINEAGE_WARNING_MESSAGES } from './brza-lineage-warning-messages'

describe('LINEAGE_WARNING_MESSAGES', () => {
  it('keeps upstream wording under the BrzA Studio name', () => {
    expect(Object.values(LINEAGE_WARNING_MESSAGES)).toEqual([
      'Worktree created, but BrzA Studio could not validate the environment parent context.',
      'Worktree created, but BrzA Studio could not validate the caller terminal as a parent context.',
      'Worktree created, but BrzA Studio could not validate the current directory as a parent context.',
      'Worktree created, but BrzA Studio could not prove which parent context caused it.'
    ])
  })
})
