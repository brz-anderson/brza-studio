import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { botsRootFolder } from './bot-home'

const appData = join('home', 'me', 'Library', 'Application Support')
const home = join('home', 'me')

describe('botsRootFolder for BrzA Studio profiles', () => {
  it.each(['brza-studio', 'brza-dev'])('keeps %s bots in ~/.brza/bots', (profile) => {
    expect(botsRootFolder({ userData: join(appData, profile), appData, home })).toBe(
      join(home, '.brza', 'bots')
    )
  })

  it('keeps an isolated data folder on the upstream <userData>/bots branch', () => {
    const userData = join('tmp', 'review617', 'profile')
    expect(botsRootFolder({ userData, appData, home })).toBe(join(userData, 'bots'))
  })

  it('keeps a per-worktree dev profile isolated', () => {
    const userData = join(appData, 'brza-dev-wt', 'feature')
    expect(botsRootFolder({ userData, appData, home })).toBe(join(userData, 'bots'))
  })
})
