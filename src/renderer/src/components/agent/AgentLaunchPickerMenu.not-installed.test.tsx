// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AgentLaunchPickerMenu } from './AgentLaunchPickerMenu'
import type { AgentPickerEntry } from '../../../../shared/agent-launch/picker/agent-launch-picker'

vi.mock('@/hooks/useShortcutLabel', () => ({ useOptionalShortcutLabel: () => null }))
afterEach(cleanup)

const entry = (
  agent: AgentPickerEntry['agent'],
  label: string,
  rows: AgentPickerEntry['rows'],
  surfaces: AgentPickerEntry['surfaces']
): AgentPickerEntry => ({
  agent,
  label,
  rows,
  surfaces,
  defaultSurface: surfaces[0] ?? 'terminal',
  terminal: {},
  structured: {},
  catalog: { origin: 'probe', fetchedAt: 1, models: [] }
})

it('hides agents that are not installed and keeps other unavailable ones', () => {
  const entries = [
    entry('codex', 'Codex', [{ agent: 'codex', kind: 'cli' }], ['terminal']),
    entry(
      'grok',
      'Grok',
      [{ agent: 'grok', kind: 'chat-unavailable', reason: 'not-installed' }],
      []
    ),
    entry(
      'opencode',
      'OpenCode',
      [{ agent: 'opencode', kind: 'chat-unavailable', reason: 'ssh' }],
      ['terminal']
    )
  ]
  render(
    <TooltipProvider>
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <AgentLaunchPickerMenu entries={entries} runLaunch={vi.fn()} hideSearch />
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
  const text = [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent)
  expect(text.some((t) => t?.includes('Codex'))).toBe(true)
  expect(text.some((t) => t?.includes('OpenCode'))).toBe(true)
  expect(text.some((t) => t?.includes('Grok'))).toBe(false)
  expect(text.some((t) => t?.includes('Not installed'))).toBe(false)
})
