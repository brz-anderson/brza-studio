import { useState } from 'react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { NativeChatAppearanceSettings } from '../../../../shared/native-chat-appearance-settings'
import { getChatContrastEntriesByKey } from './chat-appearance-search'
import { translate } from '@/i18n/i18n'
import { Slider } from '../ui/slider'
import { ChatThemePairPicker } from './ChatThemePairPicker'
import { SearchableSetting } from './SearchableSetting'
import { SettingsRow } from './SettingsFormControls'

type ChatContrastControlsProps = {
  appearance: Required<NativeChatAppearanceSettings>
  settings: Pick<GlobalSettings, 'theme' | 'terminalCustomThemes'>
  onChange: (updates: NativeChatAppearanceSettings) => void
  forceVisiblePrimary?: boolean
}

export function AppearanceChatContrastControls({
  appearance,
  settings,
  onChange,
  forceVisiblePrimary
}: ChatContrastControlsProps): React.JSX.Element {
  const entries = getChatContrastEntriesByKey()
  const { contrast } = appearance
  return (
    <>
      <SearchableSetting
        id={entries.theme.targetSectionId}
        {...entries.theme}
        forceVisible={forceVisiblePrimary}
      >
        <ChatThemePairPicker
          title={entries.theme.title}
          description={entries.theme.description}
          pair={appearance}
          settings={settings}
          onChange={onChange}
        />
      </SearchableSetting>
      <SearchableSetting
        id={entries.contrast.targetSectionId}
        {...entries.contrast}
        forceVisible={forceVisiblePrimary}
      >
        <SettingsRow
          label={entries.contrast.title}
          description={entries.contrast.description}
          control={<ChatContrastSlider contrast={contrast} onChange={onChange} />}
        />
      </SearchableSetting>
    </>
  )
}

function ChatContrastSlider({
  contrast,
  onChange
}: Pick<ChatContrastControlsProps, 'onChange'> & {
  contrast: number
}): React.JSX.Element {
  const [draft, setDraft] = useState({ savedContrast: contrast, value: contrast })
  // Keep the thumb mounted so committed keyboard changes retain focus.
  if (draft.savedContrast !== contrast) {
    setDraft({ savedContrast: contrast, value: contrast })
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {translate('settings.appearance.chat.softer', 'Softer')}
      </span>
      <div className="w-40">
        <Slider
          min={50}
          max={150}
          step={1}
          value={[draft.value]}
          thumbLabels={[translate('settings.appearance.chat.contrast', 'Contrast')]}
          onValueChange={([value]) => setDraft({ savedContrast: contrast, value })}
          onValueCommit={([value]) => onChange({ contrast: value })}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {translate('settings.appearance.chat.sharper', 'Sharper')}
      </span>
      <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">
        {draft.value}
      </span>
    </div>
  )
}
