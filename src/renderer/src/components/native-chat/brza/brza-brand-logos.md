# Brand logos in the native chat tool slot

Desktop draws these logos for the `*-logo` ids in
`src/shared/native-chat/tools/brza/brza-tool-categories.ts`; mobile draws the lucide fallback
(`BRZA_BRAND_LOGO_FALLBACK_ICONS`). Every logo renders monochrome in `currentColor`, beside the
tool's name, to identify the tool the row ran — never as BrzA Studio's own mark.

| Id            | Component                         | Source                                                                     | License                                                                                                                                                                           |
| ------------- | --------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git-logo`    | `BrzaGitLogo.tsx`                 | Path from [Simple Icons](https://simpleicons.org) 16.36.0, `icons/git.svg` | Git Logo by Jason Long, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) ([git-scm.com/community/logos](https://git-scm.com/community/logos)); Simple Icons path CC0     |
| `github-logo` | `components/icons/GitHubIcon.tsx` | Upstream Orca's mark (Primer Octicons `mark-github`)                       | Octicons MIT; the mark follows [GitHub's logo guidelines](https://brand.github.com/foundations/logo), which permit it "to inform others that your project integrates with GitHub" |
| `jira-logo`   | `components/icons/JiraIcon.tsx`   | Upstream Orca's monochrome Jira mark                                       | Atlassian trademark; used as upstream uses it, to identify the Jira provider                                                                                                      |

Git's [trademark policy](https://git-scm.com/about/trademark) allows the marks "to identify the Git
software as a distinct component of a software offering".

## Not brought (R29.4, decided by Anderson on 2026-10-28)

- **Figma**: its [trademark guidelines](https://www.figma.com/using-the-figma-brand/) say "Don't modify
  our marks in any way"; a monochrome glyph recolors the multicolor mark. Lucide `pen-tool` instead.
- **Firebase**: its [brand guidelines](https://firebase.google.com/brand-guidelines) bar using the
  lockup in a product and changing its colors. Lucide `flame` instead.

To add a logo later, add its id to `BrzaBrandLogoIconName` and `BRZA_BRAND_LOGO_FALLBACK_ICONS`, its
component to `BRZA_TOOL_GLYPHS`, and a row to this table.
