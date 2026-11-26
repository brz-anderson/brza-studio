import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/i18n', () => ({
  translate: (key: string, _fallback: string, vars?: Record<string, string>) =>
    vars?.path ? `${key}:${vars.path}` : key
}))

import { formatCliUserFacingDetail } from './cli-user-facing-detail'

describe('formatCliUserFacingDetail', () => {
  it.each([
    ['/usr/local/bin/orca exists but is not an Orca symlink.'],
    ['/usr/local/bin/orca exists but is not a BrzA Studio symlink.']
  ])('maps the symlink detail in either brand spelling: %s', (raw) => {
    expect(formatCliUserFacingDetail(raw)).toBe(
      'auto.lib.cli.detail.notOrcaSymlink:/usr/local/bin/orca'
    )
  })

  it('maps the older-launcher detail with the BrzA Studio spelling', () => {
    expect(formatCliUserFacingDetail('/bin/x contains an older BrzA Studio launcher.')).toBe(
      'auto.lib.cli.detail.olderLauncher:/bin/x'
    )
  })

  it('maps exact string details with the BrzA Studio spelling', () => {
    expect(
      formatCliUserFacingDetail('The bundled CLI launcher is missing from this BrzA Studio build.')
    ).toBe('auto.lib.cli.detail.launcherMissing')
  })

  it('maps the register hint with the BrzA Studio spelling', () => {
    expect(formatCliUserFacingDetail('Register /bin/x to use BrzA Studio from the terminal.')).toBe(
      'auto.lib.cli.detail.registerForTerminal:/bin/x'
    )
  })

  it('returns unknown details unchanged', () => {
    expect(formatCliUserFacingDetail('Something about BrzA Studio.')).toBe(
      'Something about BrzA Studio.'
    )
  })
})
