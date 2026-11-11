// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentChildWorkView } from '../../../../../../shared/agent-status/child-work/agent-status-child-work-view'

import { NativeChatBackgroundTasksStatus } from './NativeChatBackgroundTasksStatus'

afterEach(cleanup)

it("shows an agent by the provider's id, beside its own Stop, and leaves command rows inert", () => {
  const running = (id: string, kind: 'agent' | 'command') => ({
    id: `host-${id}`,
    providerId: `provider-${id}`,
    kind,
    description: `child ${id}`,
    state: 'working' as const,
    membership: 'live' as const,
    firstObservedAt: 1_000,
    observedAt: 2_000,
    stoppable: true,
    invocation: { invocationId: `spawn-${id}`, generation: 1 }
  })
  const onShowAgent = vi.fn()
  const onStop = vi.fn()
  render(
    <NativeChatBackgroundTasksStatus
      expanded
      onExpandedChange={() => {}}
      isVisible
      tasks={[]}
      settledTasks={[]}
      childViews={[running('a', 'agent'), running('s', 'command')]}
      indicatorActive
      supportsTaskStop
      offersStopAll={false}
      stoppingTaskIds={new Set()}
      stoppingAll={false}
      onStop={onStop}
      onShowAgent={onShowAgent}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Show child a in the conversation' }))
  expect(onShowAgent).toHaveBeenCalledWith('provider-a')
  expect(onStop).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Show child s/ })).toBeNull()
})

describe('the agent type on a running agent row', () => {
  const NOW = 1_000_000
  const child = (overrides: Partial<AgentChildWorkView>): AgentChildWorkView => ({
    id: 'child',
    providerId: 'task-child',
    kind: 'agent',
    description: 'Revisar features do fork pós-sync',
    state: 'working',
    membership: 'live',
    firstObservedAt: NOW - 60_000,
    observedAt: NOW - 1_000,
    stoppable: true,
    invocation: { invocationId: 'spawn-child', generation: 1 },
    ...overrides
  })
  const bash = { toolName: 'Bash', basis: 'open', observedAt: NOW } as const

  function rowText(view: AgentChildWorkView): string {
    render(
      <NativeChatBackgroundTasksStatus
        expanded
        onExpandedChange={() => {}}
        isVisible
        tasks={[]}
        settledTasks={[]}
        childViews={[view]}
        indicatorActive
        supportsTaskStop
        offersStopAll={false}
        stoppingTaskIds={new Set()}
        stoppingAll={false}
        onStop={() => {}}
      />
    )
    return screen.getAllByRole('listitem')[0].querySelector('span.truncate')?.textContent ?? ''
  }

  it('reads description, type and tool, in that order', () => {
    expect(rowText(child({ agentType: 'reviewer', operation: bash }))).toBe(
      'Revisar features do fork pós-sync · reviewer · Bash'
    )
  })

  it('keeps the tool input after the tool name', () => {
    expect(
      rowText(child({ agentType: 'reviewer', operation: { ...bash, input: 'pnpm test' } }))
    ).toBe('Revisar features do fork pós-sync · reviewer · Bash: pnpm test')
  })

  it('leaves the row as it was without an agent type', () => {
    expect(rowText(child({ operation: bash }))).toBe('Revisar features do fork pós-sync · Bash')
  })

  it.each(['default', 'unknown', '  '])('does not name the type %j', (agentType) => {
    expect(rowText(child({ agentType, operation: bash }))).toBe(
      'Revisar features do fork pós-sync · Bash'
    )
  })

  it('does not repeat a type that already names the row', () => {
    // The row is named by its role, so the upstream id tail keeps same-role siblings apart.
    expect(rowText(child({ description: undefined, agentType: 'reviewer', operation: bash }))).toBe(
      'reviewer (child) · Bash'
    )
  })

  it('says the type once when the detail is the role, not a tool', () => {
    expect(rowText(child({ agentType: 'reviewer' }))).toBe(
      'Revisar features do fork pós-sync · reviewer'
    )
  })

  it('does not change the Stop label', () => {
    rowText(child({ agentType: 'reviewer', operation: bash }))
    expect(screen.getByLabelText('Stop Revisar features do fork pós-sync')).toBeInTheDocument()
  })
})
