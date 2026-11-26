import { describe, expect, it } from 'vitest'
import { getReleaseNotesUrlForVersion } from './release-channel'

describe('release channel', () => {
  // Dev tags exist only in their dedicated repos; main-repo links 404.
  it('builds release-notes links against the repo that published the version', () => {
    expect(getReleaseNotesUrlForVersion('1.4.160-hourly.202607281400')).toBe(
      'https://github.com/brz-anderson/brza-studio-hourly/releases/tag/v1.4.160-hourly.202607281400'
    )
    expect(getReleaseNotesUrlForVersion('1.4.160-daily.202607281300')).toBe(
      'https://github.com/brz-anderson/brza-studio-daily/releases/tag/v1.4.160-daily.202607281300'
    )
    expect(getReleaseNotesUrlForVersion('1.4.160')).toBe(
      'https://github.com/brz-anderson/brza-studio/releases/tag/v1.4.160'
    )
    expect(getReleaseNotesUrlForVersion('v1.4.160-rc.3')).toBe(
      'https://github.com/brz-anderson/brza-studio/releases/tag/v1.4.160-rc.3'
    )
    expect(getReleaseNotesUrlForVersion('1.4.160-adhoc.20260728140533')).toBe(
      'https://github.com/brz-anderson/brza-studio-adhoc/releases/tag/v1.4.160-adhoc.20260728140533'
    )
    expect(getReleaseNotesUrlForVersion(null)).toBe(
      'https://github.com/brz-anderson/brza-studio/releases'
    )
  })
})
