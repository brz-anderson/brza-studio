import { spawn } from 'node:child_process'
import { constants as osConstants } from 'node:os'
import { resolveCommandOnLocalPath } from '../main/ipc/command-path-resolver'
import { stripElectronRunAsNode } from './runtime/orca-app-executable'

export const EXTERNAL_SUBCOMMAND_PREFIX = 'brza-'
// The chain of external subcommands running above this process; `brza-x` calling `brza x` must not re-enter itself.
export const EXTERNAL_SUBCOMMAND_CHAIN_ENV = 'BRZA_EXTERNAL_SUBCOMMANDS'

const EXTERNAL_SUBCOMMAND_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export type ExternalSubcommand = { name: string; executable: string; args: string[] }

function chainOf(env: NodeJS.ProcessEnv): string[] {
  return (env[EXTERNAL_SUBCOMMAND_CHAIN_ENV] ?? '').split(':').filter((name) => name.length > 0)
}

/** Like `git x` finding `git-x`: the first term no built-in command starts, resolved on PATH. */
export async function findExternalSubcommand(
  argv: readonly string[],
  builtinHeads: ReadonlySet<string>,
  env: NodeJS.ProcessEnv = process.env
): Promise<ExternalSubcommand | null> {
  const name = argv[0]
  if (
    name === undefined ||
    !EXTERNAL_SUBCOMMAND_NAME.test(name) ||
    builtinHeads.has(name) ||
    chainOf(env).includes(name)
  ) {
    return null
  }
  const executable = await resolveCommandOnLocalPath(`${EXTERNAL_SUBCOMMAND_PREFIX}${name}`, {
    env
  })
  return executable ? { name, executable, args: argv.slice(1) } : null
}

/** The environment the user's shell would give the subcommand, plus the chain guard. */
export function externalSubcommandEnv(name: string, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next = stripElectronRunAsNode(env)
  // The launcher moves these aside for Electron's Node mode; the subcommand expects them back.
  delete next.NODE_OPTIONS
  delete next.NODE_REPL_EXTERNAL_MODULE
  if (env.ORCA_NODE_OPTIONS) {
    next.NODE_OPTIONS = env.ORCA_NODE_OPTIONS
  }
  if (env.ORCA_NODE_REPL_EXTERNAL_MODULE) {
    next.NODE_REPL_EXTERNAL_MODULE = env.ORCA_NODE_REPL_EXTERNAL_MODULE
  }
  delete next.ORCA_NODE_OPTIONS
  delete next.ORCA_NODE_REPL_EXTERNAL_MODULE
  next[EXTERNAL_SUBCOMMAND_CHAIN_ENV] = [...chainOf(env), name].join(':')
  return next
}

/** Runs the subcommand on this process's stdio and returns its exit code, 128 + signal when killed. */
export async function runExternalSubcommand(
  command: ExternalSubcommand,
  env: NodeJS.ProcessEnv = process.env
): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      stdio: 'inherit',
      env: externalSubcommandEnv(command.name, env)
    })
    // The terminal already sends SIGINT/SIGQUIT to the whole group; a second copy would double-interrupt the child.
    const ignore = (): void => {}
    const forward = (signal: NodeJS.Signals): void => {
      child.kill(signal)
    }
    const handlers: [NodeJS.Signals, (signal: NodeJS.Signals) => void][] = [
      ['SIGINT', ignore],
      ['SIGQUIT', ignore],
      ['SIGTERM', forward],
      ['SIGHUP', forward]
    ]
    for (const [signal, handler] of handlers) {
      process.on(signal, handler)
    }
    const release = (): void => {
      for (const [signal, handler] of handlers) {
        process.off(signal, handler)
      }
    }
    child.once('error', (error) => {
      release()
      reject(error)
    })
    child.once('exit', (code, signal) => {
      release()
      if (typeof code === 'number') {
        resolve(code)
        return
      }
      resolve(128 + (signal ? (osConstants.signals[signal] ?? 0) : 0))
    })
  })
}
