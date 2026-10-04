<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# U& — Couples Companion PWA Agent Guidelines

Before implementing any interactive, layout, or animated component in this repository, check these rules and guidelines.

## Required Motion & Gesture Techniques
- **Framer Motion**: Use for layout animations, drag gestures, and `AnimatePresence` page/tab transitions.
- **@use-gesture/react**: Use for any swipe gesture (specifically the Pick card deck), paired with `react-spring` or Framer Motion's spring physics. NEVER use fixed-duration easing for anything the user's finger is actively controlling.
- **Raw Pointer Events**: Use raw pointer events (pointerdown, pointermove, pointerup) for any custom gesture not covered by the libraries above. Avoid separate mouse/touch handlers.
- **Hardware Acceleration**: Always use `transform: translate3d()` (or Framer/Spring transform props) for anything moving during a gesture — never alter `top`, `left`, `margin`, etc.
- **View Transitions API**: Use `document.startViewTransition` when available for smooth tab/page navigation, optimized for Chrome-on-Android first as the primary target device.
- **Workbox / PWA Service Worker**: Instant reopen, offline state support, and elimination of blank-screen flash on initial load.
- **IndexedDB (via `idb`)**: Local-first state management — writes must reflect on-screen instantly. Supabase sync happens asynchronously in the background via queued mutations.
- **Haptic Feedback**: Feature-detect `navigator.vibrate()`. Trigger haptics only on key moments:
  - Spark mutual answer reveal celebrate (light double pulse: `[40, 60, 40]`)
  - Someday time capsule unlock (pop vibration: `[70]`)
  - Pick mutual match (celebration pattern: `[50, 50, 100]`)
  - Nudge send/receive (soft tap: `[30]`)
- **Reskinned Component System**: Base on shadcn/ui but fully customized to U& brand design tokens — never ship default styles.
- **CSS Containment & Virtualization**: Use `content-visibility: auto` and CSS containment on long lists (such as the Trail feed).

## Brand & Design Tokens
- **App Name**: U&
- **Logotype**: Space Grotesk Bold "U&" where "U" is Ivory (`#F6EFE9`) and "&" is Coral (`#FF8966`).
- **Color Palette**:
  - Deep Aubergine Background: `#1F1324` (`--bg-aubergine`)
  - Warm Coral Accent: `#FF8966` (`--accent-coral`)
  - Ivory Text / Highlights: `#F6EFE9` (`--text-ivory`)
  - Soft Plum Surface / Cards: `#372A3E` (`--surface-plum`)
  - Soft Border / Muted Plum: `#4F3C59` (`--border-plum`)
- **Typography**: Space Grotesk font family throughout.

## Non-Negotiable Feel & Architecture
- Interactions must feel fluid like **Excalidraw** or **Tinder**, not like a traditional static web form.
- **Optimistic UI Writes**: Every user action (answering Spark, swiping Pick, dropping a Trail moment, sealing a Someday capsule, sending a Nudge) renders immediately on-screen and commits to `idb`. Background synchronization pushes queued mutations to Supabase.
- **Zero Spinners on Primary Flows**: Use initial skeleton renderers or instant IndexedDB cached reads on launch.
- **Standalone PWA Layout**: `display: standalone`, custom theme `#1F1324`, `safe-area-inset` padding for modern mobile cutouts, bottom tab bar navigation fixed at the viewport bottom.

## Activity Tab Architecture (Order & Routing)
1. **Trail** (`/trail` or Tab 1): Shared scrapbook & timeline, "On this day" resurfacing, countdowns, photo/moment entries.
2. **Spark** (`/spark` or Tab 2): Daily prompt. Answers kept private until both partners submit, then dual reveal with animation & haptics.
3. **Someday** (`/someday` or Tab 3): Sealed time capsules unlocked at a future date. Partners and invited event friends contribute.
4. **Pick** (`/pick` or Tab 4): Tinder-style card swipe deck for choices (food, movies, plans). Mutual right swipes trigger a match overlay.
5. **Nudge** (`/nudge` or Tab 5): Instant single-tap "thinking of you" action.

Default landing tab on launch: **Trail**.

