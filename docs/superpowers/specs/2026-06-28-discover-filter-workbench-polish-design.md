# Discover Filter Workbench Polish Design

## Goal

Fix the discover/import page as a working search surface, not a mode switcher.

## Problems

- The top `mode-tabs` row duplicates navigation and leaves dead upload/scan modes on this page.
- Random is separated from the search action even though it is another discovery action.
- The random action should be an icon-only tool placed immediately left of the submit/query button in `.view-actions`.
- Tag search misses common Chinese input cases and can show the same remote tag more than once.
- Selected tags wrap into multiple rows and push the filter toolbar taller.
- Selected tags must not live in normal page flow; they should never change toolbar height.
- Language filtering must produce a real remote tag query, not an inert-looking control.
- Empty searches must not fabricate `pages:>0`; it leaks implementation details and can bias results.
- Card language labels must use dictionary display names and skip generic `translated` when a concrete language tag exists.
- Fixed page size can leave a visually broken short last row on normal full pages.

## Design

- Keep the existing warm paper / hairline / terracotta NH Archive language.
- Remove the mode-tabs row from discover. The page stays on the feed surface.
- Put the icon-only random button in `.view-actions`, immediately left of the submit/query button.
- Keep selected tags inside the absolute-positioned tag popover and summarize selection in the trigger as `first +N`.
- Let one Chinese character trigger tag autocomplete; ASCII still uses the existing two-character threshold.
- De-duplicate tag picker results by real remote tag id.
- Build language filters as remote language terms (`language:japanese`, `language:english`, `language:chinese`); do not send languages as generic `tag:"..."` terms.
- Use latest feed for empty-query browsing even if sort is not `date`; do not use the old `pages:>0` search fallback.
- Display card language from dictionary `display`; ignore `translated` unless a future real source provides no concrete language at all.
- Use responsive page sizes based on visible columns: four full rows per page.

## Non-Goals

- No new upload/scan implementation.
- No new design system.
- No fake tag data, fake works, or local sample assets.
