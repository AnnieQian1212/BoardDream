# Notices: the one-minute film

What the film (`video/promo`) is made of, who made each part, and under what terms. Everything on screen is BoardDream itself: screen recordings and stills of the app running on a local server, and art the app painted with Muse Image. No footage, art or brand of any other product appears in the film.

## Code from video-shotcraft (Apache License 2.0)

Parts of this film's code are adapted from [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) by Vincent Wei (commit `1266a3e`), licensed under the Apache License, Version 2.0. A copy of the license is in [licenses/video-shotcraft-Apache-2.0.txt](licenses/video-shotcraft-Apache-2.0.txt).

The files below were changed from the originals: timed in seconds on a 60 fps clock and laid on the music's bars, recoloured and retyped in BoardDream's own tokens, and rebuilt around stills of BoardDream. Each file names its source in its first lines.

| File | Adapted from (video-shotcraft) |
| --- | --- |
| `src/lib/PageCam.tsx` | `assets/lib/PageCam.tsx` |
| `src/shots/built/fx.tsx`, `src/shots/table/fx.tsx`, `src/shots/outro/SpeedBlur.tsx`, `src/shots/paint/SpeedBlur.tsx` | `demos/_fixtures/Polish.tsx` (SpeedBlur, easing presets) |
| `src/shots/Open.tsx` | `demos/typography/brand-ink-open/BrandInkOpen.tsx` |
| `src/shots/TwoWays.tsx` | `demos/ui-entrance/draw-svg-trace/` |
| `src/shots/Table.tsx` | `demos/camera/overhead-camera-moves/TiltReveal.tsx` |
| `src/shots/Paint.tsx` | `demos/data/before-after-slider-scrub/`, `demos/effects/scanline-annotate-focus/` |
| `src/shots/Quad.tsx` | `demos/rhythm/quad-split-parallel-scenes/` |
| `src/shots/built/Timeline.tsx` | `demos/data/timeline-travel/` |
| `src/shots/built/CodeSpace.tsx` | `demos/camera/terminal-3d/` |
| `src/shots/Outro.tsx` | `demos/outro/outro-group-photo-launch/OutroGroupPhotoLaunch.tsx` |

The other shots (`Sentence`, `Making`, `Ready`, `HouseRule`, `built/Models`) and the shared pieces in `src/lib/ui.tsx` follow shot cards' written recipes (typing, a document writing itself, a crash zoom, a lifted card, words rising out of a blur) and were written for this film.

video-shotcraft records that its shot cards are techniques studied from public product films and open-source sites and re-implemented from scratch, with none of the sources' footage, art or brands (its `references/shots/ATTRIBUTION.md`); the cards used here that it lists with a source are `terminal-3d` (technique from remotion-bits.dev) and `quad-split-parallel-scenes` (technique from a public motion piece on X).

## Music

**Cat Walk** by Arulo, from Mixkit, under the [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree), which video-shotcraft's music notes (`assets/audio/ATTRIBUTION.md`) list as free for commercial use with no attribution required. Source file: https://assets.mixkit.co/music/371/371.mp3.

As a precaution, the track itself is not stored in this repository: it is licensed for use in the film, not for handing out as a file on its own. Download it to `public/audio/bgm/cat-walk.mp3` before rendering; the film's timing was measured on that file (129.995 BPM, first downbeat at 0.7085 s).

## Sound effects

Fifteen sounds from [Freesound](https://freesound.org), all under **CC0 1.0** (public domain dedication). Each one's title, author, page and licence, and the date its licence was checked, are in [public/audio/sfx/FREESOUND-CREDITS.md](public/audio/sfx/FREESOUND-CREDITS.md) and `public/audio/sfx/audio-manifest.json`. The files are Freesound's MP3 previews, unedited; the film trims and mixes them only at render time.

## Fonts

Fraunces, Inter and JetBrains Mono, each under the [SIL Open Font License 1.1](https://openfontlicense.org), through the Fontsource packages `@fontsource-variable/fraunces`, `@fontsource-variable/inter` and `@fontsource/jetbrains-mono`. Fraunces and Inter are the app's own fonts.

## Rendering

[Remotion](https://www.remotion.dev) renders the film. Remotion has its own [license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md): free, even commercially, for "an individual", "a for-profit organization with up to 3 employees" and non-profits, which covers BoardDream; any other organization needs a Company License.

## What is on screen

- The app: BoardDream, built during the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026). Two screen recordings at 60 fps (`video/record/takes.mjs`, takes `film` and `after`, with `--screen`) and stills (`capture/pipeline.mjs`, `capture/statics.mjs`), all from a local server.
- The game made on screen, Clovefire Reach, and its rules and code: made by BoardDream with Muse Spark while it was recorded; its house rule rewritten by Muse Spark; its board painted by Muse Image and checked by SAM 3.1; the opponents at its table played by Muse Spark Open. Ashfall Beacons, in a few stills and the end card, was made the same way an hour earlier.
- The demo games on screen (Tidehearth, Cloudwaft Harbor and the others on the shelf): made by BoardDream during the hackathon and bundled with the app.
- The diagram: BoardDream's own `docs/media/two-ways.svg`, redrawn.
- The code excerpts: BoardDream's own source (`apps/server/src/agent/designer.ts`, `packages/engine/src/fuzz.ts`, `apps/server/src/art/board.ts`).
- People: two local test accounts, "Aichen" and "Mira", with example.com addresses. No real user data, keys or customer content.
