import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { describeDshProfilesMissingHookPackages } from './dsh-hook-packages'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('describeDshProfilesMissingHookPackages', () => {
  it('names BrzA Studio in the status detail for a profile without the hook packages', () => {
    const home = mkdtempSync(join(tmpdir(), 'brza-dsh-'))
    roots.push(home)
    const profile = join(home, 'profiles', 'default')
    mkdirSync(profile, { recursive: true })
    writeFileSync(join(profile, 'package.json'), '{}')

    const detail = describeDshProfilesMissingHookPackages(home)

    expect(detail).toContain(
      "cannot load BrzA Studio's hooks, so their sessions send no events to BrzA Studio:"
    )
    expect(detail).toContain(`${profile} (missing`)
    expect(detail).not.toContain('Orca')
  })

  it('returns null without a profiles directory', () => {
    const home = mkdtempSync(join(tmpdir(), 'brza-dsh-'))
    roots.push(home)
    expect(describeDshProfilesMissingHookPackages(home)).toBeNull()
  })
})
