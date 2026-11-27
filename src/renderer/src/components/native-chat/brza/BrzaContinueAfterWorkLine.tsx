import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type { BrzaContinueAfterWorkStatus } from '../../../../../shared/agent-session/brza/agent-session-status-continue-after-work'

function continueAfterWorkText(
  t: ReturnType<typeof useTranslate>,
  status: BrzaContinueAfterWorkStatus
): string {
  const values = { account: status.account }
  if (status.reason === 'accountUnavailable') {
    return t(
      'components.native-chat.continueInOtherAccount.accountUnavailable',
      "{{account}} couldn't take this chat, so it didn't continue there",
      values
    )
  }
  if (status.reason === 'turnFailed') {
    return t(
      'components.native-chat.continueInOtherAccount.turnFailed',
      "The chat stopped with an error on the old account, so it didn't continue in {{account}}",
      values
    )
  }
  return status.expired
    ? t(
        'components.native-chat.continueInOtherAccount.expired',
        "The background task didn't finish within 30 minutes, so the chat didn't continue in {{account}}",
        values
      )
    : t(
        'components.native-chat.continueInOtherAccount.waiting',
        'Will continue in {{account}} when the background task finishes',
        values
      )
}

/** Na linha de limite (PLN-026, R5.1, R7.2, R8.2): a espera da tarefa em segundo plano, com Cancelar,
 *  ou o aviso, que se dispensa, de que o prazo de 30 minutos venceu, a conta do fixado recusou ou o
 *  acordar falhou por outro motivo. */
export function BrzaContinueAfterWorkLine({
  status,
  onCancel
}: {
  status: BrzaContinueAfterWorkStatus
  onCancel: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const text = continueAfterWorkText(t, status)
  return (
    <span className="flex min-w-0 items-center gap-1.5" role="status">
      {status.expired ? null : (
        <Clock aria-hidden="true" className="size-3.5 shrink-0 text-chat-foreground-faint" />
      )}
      <span className="min-w-0 max-w-64 text-xs leading-tight text-chat-foreground-faint [overflow-wrap:anywhere]">
        {text}
      </span>
      <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
        {status.expired
          ? t('components.native-chat.continueInOtherAccount.dismissExpired', 'Dismiss')
          : t('components.native-chat.continueInOtherAccount.cancelWaiting', 'Cancel')}
      </Button>
    </span>
  )
}
