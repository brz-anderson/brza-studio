import { afterEach, beforeEach, expect, it } from 'vitest'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import { structuredQueueHold } from '../structured-agent-session-queued-gate'
import {
  createQueuedMessageTestRig,
  type QueuedMessageTestRig
} from '../../host/testing/structured-agent-session-queued-message-rig.test-fixture'
import { HOST_TEST_SESSION as SESSION } from '../../host/testing/structured-agent-session-host-test-data'
import { StructuredAgentSessionCurrentWork } from '../../observations/structured-agent-session-current-work'

let rig: QueuedMessageTestRig

beforeEach(async () => {
  rig = await createQueuedMessageTestRig()
})

afterEach(() => rig.dispose())

// BrzA Studio: the folded question strip (P69) keeps a queued send waiting behind a pending question.
it('a queue-if-active send behind a pending question waits as a card and leaves the question pending', async () => {
  const { host, store } = rig
  await rig.workingSend()
  const journal = host.collaboratorsForTests().sessions.get(SESSION)!.journal
  await journal.appendItem(
    { provider: 'orca', clientMessageId: 'question-1' },
    {
      kind: 'question',
      question: 'Pick a library',
      options: [{ id: 'q1:react', label: 'React' }],
      resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
    },
    { fence: 1, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  )
  const queued = await rig.send('while the question waits', 'queue-if-active').result
  expect(queued).toMatchObject({ ok: true, value: { queued: { state: 'waiting' } } })
  expect(
    structuredQueueHold({
      record: store.getRecord(SESSION),
      work: new StructuredAgentSessionCurrentWork(journal, 1)
    })
  ).toBe('prompt')
  const question = journal.snapshot().items.find((item) => item.body.kind === 'question')
  expect(question?.body).toMatchObject({ resolution: { state: 'pending' } })
})
