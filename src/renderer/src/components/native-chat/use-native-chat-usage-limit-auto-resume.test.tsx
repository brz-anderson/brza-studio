// @vitest-environment happy-dom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_AUTOMATIC_RUNTIME_CAPABILITY,
  AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_RUNTIME_CAPABILITY
} from '../../../../shared/native-chat/native-chat-usage-limit-auto-resume'
import { useNativeChatUsageLimitAutoResume } from './use-native-chat-usage-limit-auto-resume'

const mocks = vi.hoisted(() => {
  const listed: unknown[] = []
  return { supported: new Set<string>(), listed, call: vi.fn() }
})
vi.mock('@/runtime/structured-agent-session-host-capability', () => ({
  useStructuredAgentSessionHostCapabilityState: (_target: unknown, capability: string) =>
    mocks.supported.has(capability) ? 'supported' : 'unsupported'
}))
vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: mocks.call
}))

const RESETS_AT = Date.UTC(2026, 10, 2, 15, 0)
const RESUME_AT = RESETS_AT + 60_000
const TARGET = { kind: 'local' } as const
const CUT = { turnItemId: 'cut-turn', resetsAt: RESETS_AT }

function host(): void {
  mocks.call.mockImplementation(async (_target: unknown, method: string) => {
    if (method === 'agentSession.usageLimitAutoResumeList') {
      return { resumes: mocks.listed }
    }
    if (method === 'agentSession.usageLimitAutoResume') {
      return { resume: { sessionId: 'chat', turnItemId: 'cut-turn', resumeAt: RESUME_AT } }
    }
    return {}
  })
}

afterEach(() => {
  cleanup()
  mocks.supported.clear()
  mocks.listed = []
  mocks.call.mockReset()
})

// BrzA P79 (pedido 41): Resume automatically is on by default, once per cut; the host keeps a
// Cancel, so a remount asks again and the host refuses.
it('schedules Continue by itself once the host lists nothing for the cut', async () => {
  mocks.supported.add(AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_RUNTIME_CAPABILITY)
  mocks.supported.add(AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_AUTOMATIC_RUNTIME_CAPABILITY)
  host()
  const { result, rerender } = renderHook(() =>
    useNativeChatUsageLimitAutoResume(TARGET, 'chat', CUT)
  )
  await waitFor(() => expect(result.current?.resumeAt).toBe(RESUME_AT))
  rerender()
  const schedules = mocks.call.mock.calls.filter(
    ([, method]) => method === 'agentSession.usageLimitAutoResume'
  )
  expect(schedules).toEqual([
    [
      TARGET,
      'agentSession.usageLimitAutoResume',
      { sessionId: 'chat', turnItemId: 'cut-turn', automatic: true }
    ]
  ])
})

it('does not schedule over the schedule the host already lists', async () => {
  mocks.supported.add(AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_RUNTIME_CAPABILITY)
  mocks.supported.add(AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_AUTOMATIC_RUNTIME_CAPABILITY)
  mocks.listed = [{ sessionId: 'chat', turnItemId: 'cut-turn', resumeAt: RESUME_AT }]
  host()
  const { result } = renderHook(() => useNativeChatUsageLimitAutoResume(TARGET, 'chat', CUT))
  await waitFor(() => expect(result.current?.resumeAt).toBe(RESUME_AT))
  expect(mocks.call).toHaveBeenCalledTimes(1)
})

it('leaves a host without the automatic schedule to the button', async () => {
  mocks.supported.add(AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_RUNTIME_CAPABILITY)
  host()
  const { result } = renderHook(() => useNativeChatUsageLimitAutoResume(TARGET, 'chat', CUT))
  await waitFor(() => expect(mocks.call).toHaveBeenCalledTimes(1))
  await Promise.resolve()
  expect(mocks.call.mock.calls[0]?.[1]).toBe('agentSession.usageLimitAutoResumeList')
  expect(result.current?.resumeAt).toBeNull()
})
