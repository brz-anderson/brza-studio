import { runCheckoutProcess } from './release-checkout-process.ts'

const PREPARATION_TIMEOUT_MS = 60_000

export async function prepareReleaseSnapshotSource(
  repoRoot: string,
  commit: string,
  { timeoutMs = PREPARATION_TIMEOUT_MS } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  const git = (args: string[], input?: string): Promise<string> =>
    runCheckoutProcess(repoRoot, 'git', args, deadline, {
      input,
      maxOutputBytes: 16 * 1024 * 1024,
      timeoutMs
    })
  // Starting at the tree visits this snapshot, not the commit's ancestry.
  const missingObjects = async (): Promise<string[]> =>
    (
      await git([
        'rev-list',
        '--objects',
        '--no-object-names',
        '--missing=print',
        `${commit}^{tree}`
      ])
    )
      .split('\n')
      .filter((line) => line.startsWith('?'))
      .map((line) => line.slice(1))
  try {
    let missing = await missingObjects()
    if (missing.length !== 0) {
      const remotes = await git(['config', '--get-regexp', '^remote[.].*[.]promisor$'])
      const names = [...remotes.matchAll(/^remote\.(.+)\.promisor (?:true|1)$/gm)]
        .map((match) => match[1])
        .filter((name): name is string => name !== undefined)
      if (names.length === 0) {
        throw new Error('Missing snapshot objects without a promisor remote')
      }
      // Origin is this fork. Release snapshots live on the upstream promisor when the tag is not here.
      let lastError: unknown
      for (const remote of names) {
        if (missing.length === 0) {
          break
        }
        try {
          await git(
            [
              '-c',
              'fetch.negotiationAlgorithm=noop',
              '-c',
              'maintenance.auto=false',
              '-c',
              'gc.auto=0',
              'fetch',
              '--quiet',
              '--no-tags',
              '--no-write-fetch-head',
              '--recurse-submodules=no',
              '--filter=blob:none',
              remote,
              '--stdin'
            ],
            `${missing.join('\n')}\n`
          )
        } catch (error) {
          lastError = error
        }
        missing = await missingObjects()
      }
      if (missing.length !== 0) {
        throw lastError instanceof Error
          ? lastError
          : new Error('Requested snapshot objects remain unavailable')
      }
    }
  } catch (error) {
    throw new Error(`Historical source preparation: ${String(error)}`)
  }
}
