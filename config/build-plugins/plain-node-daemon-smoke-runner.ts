import { spawn } from 'node:child_process'

export type SmokeTimings = {
  timeoutMs: number
  // daemon-entry traps SIGTERM and awaits a native shutdown, so the deadline
  // needs an uncatchable follow-up to stay a deadline.
  killGraceMs: number
}

// Bound the wait for stderr to flush after exit; a grandchild inheriting stdio
// can hold the pipes open long after the child is gone.
const SMOKE_STDERR_DRAIN_MS = 250

export type SmokeResult = {
  status: number | null
  signal: NodeJS.Signals | null
  stderr: string
  error?: Error
  timedOut: boolean
}

// spawnSync timeout waits after SIGTERM; trapped signals can hang builds, so escalate asynchronously to SIGKILL.
export function runDaemonEntry(entryPath: string, timings: SmokeTimings): Promise<SmokeResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entryPath], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    let timedOut = false
    let settled = false
    let forceKillTimer: NodeJS.Timeout | undefined
    let drainTimer: NodeJS.Timeout | undefined

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })

    const deadlineTimer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), timings.killGraceMs)
    }, timings.timeoutMs)

    const finish = (status: number | null, signal: NodeJS.Signals | null, error?: Error): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(deadlineTimer)
      clearTimeout(forceKillTimer)
      clearTimeout(drainTimer)
      resolve({ status, signal, stderr, error, timedOut })
    }

    child.on('error', (error: Error) => finish(null, null, error))
    // 'close' gives the full stderr; 'exit' is the fallback so a held-open pipe
    // cannot outlast the process itself.
    child.on('close', (status, signal) => finish(status, signal))
    child.on('exit', (status, signal) => {
      drainTimer = setTimeout(() => finish(status, signal), SMOKE_STDERR_DRAIN_MS)
    })
  })
}
