import {
  NativeChatDisclosureContext,
  type NativeChatDisclosureStore
} from './native-chat-disclosure-store'

/** What the transcript's rows and its rail read: open disclosures. */
export function NativeChatTranscriptContexts({
  disclosures,
  children
}: {
  disclosures: NativeChatDisclosureStore
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <NativeChatDisclosureContext.Provider value={disclosures}>
      {children}
    </NativeChatDisclosureContext.Provider>
  )
}
