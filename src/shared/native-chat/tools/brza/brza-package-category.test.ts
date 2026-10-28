import { describe, expect, it } from 'vitest'
import { nativeChatToolIconName, nativeChatToolRunIconName } from '../native-chat-tool-icon'
import { nativeChatToolLineLabel } from '../native-chat-tool-line-label'

function icon(command: string): string {
  return nativeChatToolIconName('Bash', undefined, { command })
}

describe('a shell call that installs packages or builds', () => {
  it.each(['pnpm install --offline', 'npm i', 'npm ci', 'pnpm add -D zod', 'flutter pub get'])(
    'draws the package for %s',
    (command) => {
      expect(icon(command)).toBe('package')
    }
  )

  it.each(['pnpm build', 'npm run build', 'pnpm run build:mac', 'flutter build apk'])(
    'draws the hammer for %s',
    (command) => {
      expect(icon(command)).toBe('hammer')
    }
  )

  it('sits below git and tests, above the CLI flame, and leaves other scripts alone', () => {
    expect(icon('pnpm install && git status')).toBe('git-logo')
    expect(icon('pnpm build && pnpm test')).toBe('flask-conical')
    expect(icon('brza worktree list && pnpm install')).toBe('package')
    expect(icon('pnpm lint')).toBe('square-terminal')
  })

  it('keeps the command as the title, and the package glyph over a mixed run', () => {
    const call = { type: 'tool-call' as const, name: 'Bash', input: { command: 'pnpm build' } }
    expect(nativeChatToolLineLabel(call).target).toBe('pnpm build')
    const bash = (command: string) => ({ name: 'Bash', input: { command } })
    expect(nativeChatToolRunIconName([bash('pnpm install'), bash('pnpm build')])).toBe('package')
  })
})
