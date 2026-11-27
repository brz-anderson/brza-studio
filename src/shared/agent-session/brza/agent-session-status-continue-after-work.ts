/** O Continuar em outra conta que espera a tarefa em segundo plano (PLN-026, D4). */
export type BrzaContinueAfterWorkStatus = {
  /** The usage-limit cut the person continued from. */
  turnItemId: string
  /** The account the chat continues on, as the person chose it. */
  account: string
  since: number
  /** The wait ran out (30 min) and the continue was dropped; the row offers the switch again. */
  expired?: true
}

/** Campo do BrzA no resumo de status; fica fora do `agent-session-wire.ts` pelo limite de linhas. */
export type AgentSessionStatusContinueAfterWork = {
  /** Absent with nothing waiting, and from older hosts. */
  brzaContinueAfterWork?: BrzaContinueAfterWorkStatus
}

export function brzaContinueAfterWorkEqual(
  a: AgentSessionStatusContinueAfterWork,
  b: AgentSessionStatusContinueAfterWork
): boolean {
  const [x, y] = [a.brzaContinueAfterWork, b.brzaContinueAfterWork]
  return (
    x?.turnItemId === y?.turnItemId &&
    x?.account === y?.account &&
    x?.since === y?.since &&
    x?.expired === y?.expired
  )
}
