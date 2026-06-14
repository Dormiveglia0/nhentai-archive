# Discover Popular Sunset Fan Design

## Decision

Use **方案 A revised: title-side sunset fan** as the discover-page popular layout baseline.

The core correction is that "今日热门" belongs to the right side of the `发现 / 导入` title area. It is not a middle-page module, not a floating window, and not a fade-in/fade-out overlay. It is a scroll-progress-driven cover fan:

1. First visible enough for the user to understand that today's popular works exist.
2. Image-first, because a comic site should lead with covers.
3. As the user scrolls down, covers follow a rightward semicircle arc and disappear through the right/bottom clipped edge like a sunset.
4. As the user scrolls back up, the same animation reverses and the fan rises again.

## Page Structure

The discover page has two stable structural areas:

- Title area: `发现 / 导入`, short description, and right-side `今日热门` sunset fan.
- Discovery area: filters, result grid/list, pagination.

Today's popular is part of the title area, not a third section between title and filters.

## Popular Fan Behavior

At top of page:

- Show a five-cover fan to the right of the title copy.
- The fan has a compact `今日热门 · 5` label above/right of the covers.
- Covers are arranged as a shallow paper fan:
  - center card slightly raised;
  - side cards slightly rotated;
  - no list rows;
  - no fake count beyond the known 5-item remote response.

Scroll behavior:

- Animation is driven by `window.scrollY`, not a one-shot state transition.
- Down-scroll progressively moves covers along a semicircle path toward the right edge and clips them out.
- Up-scroll reverses the same arc so covers rise back into the fan.
- Do not use fade-only animation as the main motion.
- Do not substitute linear translate/scale interpolation for the semicircle path.
- Do not use close buttons for popular.

Compact state:

- Compact state remains in the title area.
- It is the end-state of the scroll transform, not a separate popover.
- Covers are hidden by the right/bottom clipping region; the label remains readable.

Close behavior:

- No close behavior. The user controls visibility by scrolling.

## Visual Rules

- Do not use a horizontal mini-list for popular works.
- Do not make popular a permanent title-level section.
- Do not put popular under filters, because that implies the feed below belongs to popular.
- Do not reserve right-side layout width for popular.
- Do not use adult sample or fake cover images in development assets.
- Popular covers use the same privacy blur pipeline as normal cards.
- The fan must feel like part of the paper surface: thin horizontal rules, open spacing, cover-led composition.
- Do not wrap the fan in a bordered/shadowed/colored window container.
- Do not place title blocks or large action buttons over the covers. Import may be a small hover action; primary inspection happens through the detail modal.
- Collapse/expand must be scroll-progress motion along a semicircle: translate/rotate cover cards and clip them out, not PPT-style fade and not cheap scale-only motion.

## Data And API Rules

- `GET /api/discover/popular` still returns the real 5-item remote response.
- Frontend must reuse the existing discover-session cache and in-flight request reuse.
- Backend must keep using `NhentaiClient` TTL cache and 429 cooldown.
- The fan must not poll.
- Visual QA must not repeatedly reload the real remote-backed discover page. Use cached data, local fixtures, or wait for cooldown before screenshot loops.

## Component Plan

Frontend:

- `PopularStrip` has been replaced by `PopularFan`.
- `PopularFan` owns scroll progress and writes cover transforms.
- `DiscoverPage` keeps one stable feed; it passes popular items and actions to `PopularFan`.
- Detail opening remains through `GalleryPreviewModal`.

Backend:

- No new endpoint required.
- Keep `/api/discover/popular`.

Docs:

- `PROJECT_MAP.md`, `PROJECT_STATUS.md`, and `NEXT_STAGE_PROMPT.md` must describe popular as a title-side sunset fan, not a permanent third section, framed panel, or popover.

## Acceptance Criteria

- First viewport communicates that today's popular exists without requiring a manual click.
- User can start searching/filtering without popular occupying a middle-page block.
- Down-scroll folds the fan smoothly; up-scroll raises it smoothly.
- Popular remains visually integrated with the title area instead of looking like a separate window.
- No horizontal page overflow on desktop or mobile.
- No repeated remote calls during repeated render/screenshot loops.
- `npm run build` passes.
- Backend tests pass.
