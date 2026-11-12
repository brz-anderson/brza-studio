import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  resolveMarkdownThemeSettings,
  type MarkdownThemeSettings
} from '../../../../shared/markdown-theme-settings'
import { translate } from '@/i18n/i18n'
import { ChatThemePairPicker } from './ChatThemePairPicker'
import { SearchableSetting } from './section-layout/SearchableSetting'
import { SettingsSwitchRow } from './form-controls/SettingsFormControls'
import { markdownThemeSearchEntry } from './editor/general-editor-search'
import { GENERAL_SETTING_ANCHORS } from './general/general-setting-anchors'

type MarkdownThemeSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

/** "Follow the chat" for the Markdown viewer, and the own theme pair it uses while off. */
export function MarkdownThemeSetting({
  settings,
  updateSettings
}: MarkdownThemeSettingProps): React.JSX.Element {
  const markdownTheme = resolveMarkdownThemeSettings(settings.markdownTheme)
  const entry = markdownThemeSearchEntry()
  const update = (updates: MarkdownThemeSettings): void =>
    updateSettings({ markdownTheme: { ...settings.markdownTheme, ...updates } })

  return (
    <SearchableSetting id={GENERAL_SETTING_ANCHORS.markdownTheme} {...entry}>
      <SettingsSwitchRow
        label={entry.title}
        description={entry.description}
        checked={markdownTheme.followChat}
        onChange={() => update({ followChat: !markdownTheme.followChat })}
      />
      <ChatThemePairPicker
        title={translate('settings.editor.markdownTheme.ownTheme', 'Markdown theme')}
        description={translate(
          'settings.editor.markdownTheme.ownThemeDescription',
          'Colors of the Markdown viewer while it does not follow the chat.'
        )}
        pair={markdownTheme}
        settings={settings}
        onChange={update}
        disabled={markdownTheme.followChat}
      />
    </SearchableSetting>
  )
}
