import { describe, expect, it } from 'vitest'
import { getGeneralCliSearchEntries } from './general-search'

describe('the CLI settings row', () => {
  it('stays findable by the command name, which keeps its Orca spelling', () => {
    const [cli] = getGeneralCliSearchEntries()
    expect(cli.title).toBe('orca in other terminals')
    expect(cli.keywords).toContain('BrzA Studio CLI')
    expect(cli.cmdJKeywords).toContain('orca')
  })
})
