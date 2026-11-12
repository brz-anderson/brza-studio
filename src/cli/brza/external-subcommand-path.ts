import { delimiter, isAbsolute, join } from 'node:path'
import { isRunnableCommand } from '../../shared/cli-fs-reads'
import { getExecutableNames } from '../../shared/node-cli-command-resolution'

function pathEnvOf(env: NodeJS.ProcessEnv): string {
  const key = Object.keys(env).find((name) => name.toUpperCase() === 'PATH')
  return key ? (env[key] ?? '') : ''
}

/**
 * Primeiro executável com esse nome no PATH, como o `git x` acha o `git-x`.
 * Fica na CLI, sem o resolver do main: desde a 1.4.256 ele puxa um worker que o asar não leva.
 */
export function findCommandOnPath(
  command: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform
): string | null {
  const names = getExecutableNames(platform, command)
  for (const dir of pathEnvOf(env).split(delimiter)) {
    if (!dir || !isAbsolute(dir)) {
      continue
    }
    for (const name of names) {
      const candidate = join(dir, name)
      if (isRunnableCommand(platform, candidate)) {
        return candidate
      }
    }
  }
  return null
}
