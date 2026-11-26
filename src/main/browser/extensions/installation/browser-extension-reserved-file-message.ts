import { BRAND_APP_NAME } from '../../../../shared/brand-identity'

/** The refusal for an extension whose own file uses a name the app reserves for its worker shim. */
export function reservedFileMessage(path: string): string {
  return `${BRAND_APP_NAME} can't load this extension: its file ${path} uses a name ${BRAND_APP_NAME} reserves`
}
