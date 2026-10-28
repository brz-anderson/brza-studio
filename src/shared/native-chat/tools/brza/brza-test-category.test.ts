import { describe, expect, it } from 'vitest'
import { nativeChatToolIconName } from '../native-chat-tool-icon'
import { nativeChatToolLineLabel } from '../native-chat-tool-line-label'
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'

function bash(
  command: string,
  extra: Partial<NativeChatToolCallBlock> = {}
): NativeChatToolCallBlock {
  return { type: 'tool-call', name: 'Bash', input: { command }, state: 'completed', ...extra }
}

function output(text: string, isError = false): NativeChatToolResultBlock {
  return { type: 'tool-result', output: text, isError }
}

function target(call: NativeChatToolCallBlock, result?: NativeChatToolResultBlock): string {
  return nativeChatToolLineLabel(call, result).target
}

const VITEST_FAILED = `
 ❯ src/a.test.ts (3 tests | 1 failed) 12ms
   × adds 3ms

 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 12 passed | 2 skipped (15)
   Start at  01:21:11
   Duration  1.20s
`

const PYTEST_FAILED = `============================= test session starts ==============================
collected 13 items

tests/test_app.py ..F..........                                          [100%]

=================================== FAILURES ===================================
=========================== short test summary info ============================
FAILED tests/test_app.py::test_add - assert 1 == 2
========================= 1 failed, 12 passed in 0.52s =========================
`

const FLUTTER_PASSED = `00:01 +0: loading /app/test/widget_test.dart
00:02 +1: Counter increments smoke test
00:03 +2: All tests passed!
`

describe('a shell call that runs tests', () => {
  it.each([
    'vitest run src/a.test.ts',
    'node config/scripts/run-vitest.mjs run --config config/vitest.config.ts src/a.test.ts',
    'flutter test test/widget_test.dart',
    'pytest -q tests',
    'python -m pytest tests',
    'pnpm test',
    'npm test -- --watch=false',
    'pnpm vitest run',
    'npx vitest run',
    'pnpm run test:changed',
    'cd app && git status && pnpm test'
  ])('draws the flask for %s', (command) => {
    expect(nativeChatToolIconName('Bash', undefined, { command })).toBe('flask-conical')
  })

  it('leaves package scripts that do not test to the other categories', () => {
    expect(nativeChatToolIconName('Bash', undefined, { command: 'pnpm lint' })).not.toBe(
      'flask-conical'
    )
    expect(nativeChatToolIconName('Bash', undefined, { command: 'echo pytest' })).toBe(
      'square-terminal'
    )
  })

  it('counts the vitest footer, in Portuguese', () => {
    expect(target(bash('pnpm vitest run'), output(VITEST_FAILED, true))).toBe(
      'vitest — 12 passaram, 1 falhou'
    )
    const call = bash('node config/scripts/run-vitest.mjs run src/a.test.ts')
    expect(target(call, output(' Test Files  1 passed (1)\n      Tests  1 passed (1)\n'))).toBe(
      'vitest — 1 passou'
    )
  })

  it('counts the pytest footer', () => {
    expect(target(bash('pytest tests'), output(PYTEST_FAILED, true))).toBe(
      'pytest — 12 passaram, 1 falhou'
    )
    expect(target(bash('pytest -q'), output('...\n3 failed in 0.20s\n', true))).toBe(
      'pytest — 3 falharam'
    )
  })

  it('counts the flutter test footer', () => {
    expect(target(bash('flutter test'), output(FLUTTER_PASSED))).toBe('flutter test — 2 passaram')
    expect(target(bash('flutter test'), output('00:04 +5 -2: Some tests failed.\n', true))).toBe(
      'flutter test — 5 passaram, 2 falharam'
    )
  })

  it('names the runner a package script turned out to be', () => {
    expect(target(bash('pnpm test'), output(VITEST_FAILED, true))).toBe(
      'vitest — 12 passaram, 1 falhou'
    )
    expect(target(bash('npm test'), output('> app@1.0.0 test\n> node t.js\nok\n'))).toBe(
      'npm test — passou'
    )
  })

  it('says only passed or failed when the footer did not arrive', () => {
    const head = output(' ✓ src/a.test.ts (3 tests) 4ms\n'.repeat(3), true)
    expect(target(bash('vitest run'), head)).toBe('vitest — falhou')
    expect(target(bash('vitest run', { exitCode: 0 }))).toBe('vitest — passou')
    expect(target(bash('vitest run', { exitCode: 1 }))).toBe('vitest — falhou')
    expect(target(bash('vitest run', { state: 'running' }))).toBe('vitest run')
  })
})
