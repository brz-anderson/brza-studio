import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { z } from 'zod'
import { computeAgentSessionPayloadFingerprint } from '../../../shared/agent-session/lifecycle/agent-session-mutation-envelope'
import { closeProviderTimelineRigs } from '../../native-chat/agent-session-timeline/provider-timeline-assembler-test-support'
import { CALLER } from '../../native-chat/agent-session-wire/host/testing/structured-agent-session-host-test-harness'
import {
  HOST_TEST_SESSION,
  hostTestAttachParams,
  hostTestOperationId
} from '../../native-chat/agent-session-wire/host/testing/structured-agent-session-host-test-data'
import { acpLaunchSpecFor } from '../launch/acp-launch-registry'
import type { AcpScriptedAgent } from '../process/testing/acp-scripted-agent.test-support'
import { PROVIDER_SESSION, waitFor } from './testing/acp-structured-adapter.test-support'
import { framesOf, launch, openHostRig, send } from './testing/acp-structured-host.test-support'

const ANTIGRAVITY = acpLaunchSpecFor('antigravity')!
const RESUMES = { agentCapabilities: { loadSession: true, sessionCapabilities: { resume: {} } } }
afterEach(closeProviderTimelineRigs)

// A resumed chat whose server reports its mode option under the mode category.
async function openModeRig(script: (agent: AcpScriptedAgent) => void) {
  let resumed = false
  const { rig, host, fence, ready } = await openHostRig({
    spec: ANTIGRAVITY,
    initialize: RESUMES,
    script: (agent) => {
      agent.on('session/resume', (frame) => agent.reply(frame, {}))
      agent.on('session/set_config_option', (frame) => {
        const { configId: id, value } = z
          .object({ configId: z.string(), value: z.string() })
          .parse(frame.params)
        const mode = { id, name: id, category: 'mode', type: 'select', currentValue: value }
        agent.reply(frame, { configOptions: [{ ...mode, options: [] }] })
      })
      script(agent)
    },
    deps: {
      resolveLaunch: async () => ({
        ...(await launch(() => resumed, ANTIGRAVITY)()),
        env: { GEMINI_HOME: join(tmpdir(), 'antigravity-chat') }
      })
    }
  })
  const attach = hostTestAttachParams(null, {
    provider: 'antigravity',
    agent: 'antigravity',
    accountHome: { variable: 'GEMINI_HOME', path: '/data/antigravity-chat' },
    providerHandle: undefined
  })
  expect(await host.attach(CALLER, attach)).toMatchObject({ ok: true })
  await ready()
  resumed = true
  const pick = (value: string) => {
    const fields = { key: 'permissionMode', value }
    const fingerprint = { method: 'agentSession.setOption', sessionId: HOST_TEST_SESSION, fields }
    const envelope = {
      sessionId: HOST_TEST_SESSION,
      clientOperationId: hostTestOperationId(),
      expectedRuntimeFence: fence(),
      payloadFingerprint: computeAgentSessionPayloadFingerprint(fingerprint)
    }
    return host.setOption(CALLER, { envelope, ...fields })
  }
  const modes = () =>
    framesOf(rig.child(), 'session/set_config_option').map((frame) => frame.params)
  return { rig, host, pick, modes }
}

it('switches the live server to the chat permission mode picked mid-chat, without a restart', async () => {
  const { rig, host, pick, modes } = await openModeRig((agent) =>
    agent.on('session/prompt', (frame) => agent.reply(frame, { stopReason: 'end_turn' }))
  )
  const child = rig.child()
  for (const [index, value] of ['accept-edits', 'full-access'].entries()) {
    expect(await pick(value)).toMatchObject({ ok: true })
    await send(host, value)
    await waitFor(() => expect(framesOf(child, 'session/prompt')).toHaveLength(index + 1))
  }
  expect(rig.child()).toBe(child)
  expect(modes()).toEqual([
    expect.objectContaining({ configId: 'mode', value: 'default' }),
    expect.objectContaining({ configId: 'mode', value: 'auto_edit' }),
    expect.objectContaining({ configId: 'mode', value: 'yolo' })
  ])
})

it('switches the live server to Full access while its turn waits on an approval', async () => {
  const { rig, host, pick, modes } = await openModeRig(() => {})
  const child = rig.child()
  await send(host, 'run it')
  const prompt = await rig.frame('session/prompt')
  const approval = child.agent.request(9, 'session/request_permission', {
    sessionId: PROVIDER_SESSION,
    toolCall: { toolCallId: 'call-1', title: 'ls' },
    options: [{ optionId: 'allow-once', name: 'Allow', kind: 'allow_once' }]
  })
  await waitFor(async () => {
    const page = await host.history({ sessionId: HOST_TEST_SESSION, direction: 'tail' })
    expect(page.page.items.some((row) => row.body.kind === 'approval')).toBe(true)
  })
  expect(await pick('full-access')).toMatchObject({ ok: true })
  expect(modes().at(-1)).toMatchObject({ configId: 'mode', value: 'yolo' })
  // The open request stays with the person; the server stops asking from here on.
  expect(child.agent.frames.some((frame) => frame.id === 9 && !frame.method)).toBe(false)
  expect(framesOf(child, 'session/cancel')).toHaveLength(0)
  child.agent.reply(prompt, { stopReason: 'end_turn' })
  await rig.settle()
  expect(rig.child()).toBe(child)
  void approval
})
