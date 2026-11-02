// The fork ships the same CLI as `brza`; the upstream help text keeps `orca`.
const COMMAND_NAME = /(^|[\s`$(])orca(?=\s|`|$)/gm

export function withBrzaCommandName(text: string): string {
  return text.replace(COMMAND_NAME, '$1brza')
}
