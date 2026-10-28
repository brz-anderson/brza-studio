import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EXTERNAL_SUBCOMMAND_CHAIN_ENV,
  externalSubcommandEnv,
  findExternalSubcommand,
  runExternalSubcommand
} from './external-subcommand'
import { main } from './index'

const HEADS = new Set(['terminal', 'worktree'])

describe.skipIf(process.platform === 'win32')('external brza-<name> subcommands', () => {
  let bin: string

  function script(name: string, body: string): string {
    const file = path.join(bin, name)
    writeFileSync(file, `#!/bin/sh\n${body}\n`)
    chmodSync(file, 0o755)
    return file
  }

  async function mainStderr(argv: string[]): Promise<string> {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await main(argv, bin)
      return error.mock.calls.map((args) => args.map(String).join(' ')).join('\n')
    } finally {
      error.mockRestore()
    }
  }

  beforeEach(() => {
    bin = mkdtempSync(path.join(tmpdir(), 'brza-external-'))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.exitCode = undefined
    rmSync(bin, { recursive: true, force: true })
  })

  it('finds brza-<name> on PATH with the remaining arguments', async () => {
    const executable = script('brza-sessions', 'exit 0')
    await expect(
      findExternalSubcommand(['sessions', '--help', 'x'], HEADS, { PATH: bin })
    ).resolves.toEqual({ name: 'sessions', executable, args: ['--help', 'x'] })
  })

  it('returns null when no brza-<name> exists', async () => {
    await expect(findExternalSubcommand(['sessions'], HEADS, { PATH: bin })).resolves.toBeNull()
  })

  it('never shadows a built-in command head', async () => {
    script('brza-terminal', 'exit 0')
    await expect(
      findExternalSubcommand(['terminal', 'foo'], HEADS, { PATH: bin })
    ).resolves.toBeNull()
  })

  it('ignores flags and names that are not plain words', async () => {
    script('brza-x', 'exit 0')
    for (const head of ['--json', '-x', '../x', 'a/b', '']) {
      await expect(findExternalSubcommand([head], HEADS, { PATH: bin })).resolves.toBeNull()
    }
  })

  it('does not re-enter a subcommand already running in the chain', async () => {
    script('brza-sessions', 'exit 0')
    await expect(
      findExternalSubcommand(['sessions'], HEADS, {
        PATH: bin,
        [EXTERNAL_SUBCOMMAND_CHAIN_ENV]: 'run:sessions'
      })
    ).resolves.toBeNull()
  })

  it('restores the launcher-moved Node options and drops Electron node mode', () => {
    const env = externalSubcommandEnv('run', {
      ELECTRON_RUN_AS_NODE: '1',
      ORCA_NODE_OPTIONS: '--max-old-space-size=64',
      [EXTERNAL_SUBCOMMAND_CHAIN_ENV]: 'sessions'
    })
    expect(env).not.toHaveProperty('ELECTRON_RUN_AS_NODE')
    expect(env).not.toHaveProperty('ORCA_NODE_OPTIONS')
    expect(env.NODE_OPTIONS).toBe('--max-old-space-size=64')
    expect(env[EXTERNAL_SUBCOMMAND_CHAIN_ENV]).toBe('sessions:run')
  })

  it('passes arguments and returns the exit code', async () => {
    const out = path.join(bin, 'out')
    const executable = script('brza-run', `printf '%s|' "$@" > '${out}'; exit 7`)
    const code = await runExternalSubcommand(
      { name: 'run', executable, args: ['a b', '--c'] },
      { PATH: bin }
    )
    expect(code).toBe(7)
    expect(readFileSync(out, 'utf8')).toBe('a b|--c|')
  })

  it('reports 128 + signal when the subcommand is killed', async () => {
    const executable = script('brza-die', 'kill -TERM $$')
    await expect(
      runExternalSubcommand({ name: 'die', executable, args: [] }, { PATH: bin })
    ).resolves.toBe(143)
  })

  it('main() runs brza-<name> for an unknown first term', async () => {
    const out = path.join(bin, 'out')
    script(
      'brza-sessions',
      `printf '%s|%s' "$1" "$${EXTERNAL_SUBCOMMAND_CHAIN_ENV}" > '${out}'; exit 3`
    )
    vi.stubEnv('PATH', `${bin}:${process.env.PATH ?? ''}`)
    await main(['sessions', '--help'], bin)
    expect(process.exitCode).toBe(3)
    expect(readFileSync(out, 'utf8')).toBe('--help|sessions')
  })

  it('main() keeps the Unknown command error when nothing matches', async () => {
    vi.stubEnv('PATH', bin)
    const stderr = await mainStderr(['brza-external-missing'])
    expect(process.exitCode).toBe(1)
    expect(stderr).toContain('Unknown command: brza-external-missing')
  })

  it('main() keeps built-in commands off the external path', async () => {
    script('brza-terminal', `touch '${path.join(bin, 'ran')}'`)
    vi.stubEnv('PATH', bin)
    const stderr = await mainStderr(['terminal', 'foo'])
    expect(process.exitCode).toBe(1)
    expect(() => readFileSync(path.join(bin, 'ran'))).toThrow()
    expect(stderr).toContain('Unknown command: terminal foo')
  })
})
