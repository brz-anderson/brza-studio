import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMMAND_SPECS } from '../specs'
import { formatCommandHelp, printHelp } from '../help'
import { withBrzaCommandName } from './cli-display-name'

// Also catches a line that is just `orca` (the root header), which `(^|\s)orca\s` misses line by line.
const STARTS_WITH_ORCA = /(^|\s)orca(\s|$)/

function capturePrintedHelp(commandPath: string[] = []): string {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  printHelp(COMMAND_SPECS, commandPath)
  const printed = log.mock.calls.map((call) => call.join(' ')).join('\n')
  log.mockRestore()
  return printed
}

describe('brza CLI display name', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints the root help without a line that names the command orca', () => {
    const printed = capturePrintedHelp()

    expect(printed.split('\n').filter((line) => STARTS_WITH_ORCA.test(line))).toEqual([])
    expect(printed).toContain('Usage: brza <command> [options]')
    expect(printed).toContain('BrzA CLI')
  })

  it('keeps the orca-named protocol and environment tokens in the root help', () => {
    const printed = capturePrintedHelp()

    expect(printed).toContain('orca://pair')
    expect(printed).toContain('ORCA_PAIRING_CODE')
    expect(printed).toContain('ORCA_ENVIRONMENT')
  })

  it('prints group and command help as brza while the formatters keep returning orca', () => {
    const groupPrinted = capturePrintedHelp(['terminal'])
    expect(groupPrinted.split('\n').filter((line) => STARTS_WITH_ORCA.test(line))).toEqual([])
    expect(groupPrinted).toContain('Usage: brza terminal <command> [options]')

    const spec = COMMAND_SPECS.find((candidate) => candidate.path.join(' ') === 'status')
    expect(spec).toBeDefined()
    const commandPrinted = capturePrintedHelp(['status'])
    expect(commandPrinted.split('\n')[0]).toBe('brza status')
    expect(formatCommandHelp(spec!).split('\n')[0]).toBe('orca status')
  })

  it('renames only the command word, not the orca:// scheme, env vars or orca.yaml', () => {
    expect(withBrzaCommandName('orca status')).toBe('brza status')
    expect(withBrzaCommandName('Run `orca terminal list` first')).toBe(
      'Run `brza terminal list` first'
    )
    expect(withBrzaCommandName('  $ orca status --json')).toBe('  $ brza status --json')
    expect(withBrzaCommandName('orca://pair?x=1 ORCA_PAIRING_CODE orca.yaml')).toBe(
      'orca://pair?x=1 ORCA_PAIRING_CODE orca.yaml'
    )
  })
})
