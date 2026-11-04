# BoardDream promo: design spec

A 1:44 demo made with [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) (autonomous free creation) and Remotion, from new screen recordings and stills of the running app. No earlier footage or film is used.

## Brief

- **For:** the Meta Global AI Developer Hackathon judges (Demo, 25%: "Is this a working, impressive demo? Does it hold up live? Is the demo video genuinely cool to watch?").
- **Rule:** the demo must show only what was built during the hackathon, and make that clear. The opening shows the repo's first commit (a two-line README) and says everything shown was built during the event; a tag says so from the first look at the app to the end card; a section shows our code and the four Meta models.
- **Must show:** one sentence to a game (Muse Spark design, rules as code, 1,000 bot games, repair), the 3D table, Muse Spark Open in empty seats, house rules in words (version two), board art by Muse Image checked by SAM 3.1, friends by a link, print and play, the mochi game, Behind the scenes, the README's flow diagram (`docs/media/two-ways.svg`), the code.
- **How each question is answered:** *working* — one real run screen-recorded at 60 fps: the idea typed, the real making screen with Muse Spark writing the code live and its real clock, the made game's table with Muse Spark Open, its house rule and its painting, all on the same game; *holds up live* — real footage at real speed wherever it fits, every sped-up stretch labelled with its real duration, the live URL at the end; *cool to watch* — cut on the beat of a 130 BPM house track, the app as floating windows on the app's own paper, one motion idea per shot.
- **Organizers' guidance (Nov 4):** most of the video real screen footage of the working product with the live Meta model calls visible; simulated or sped-up parts labelled; an opening line on what existed before the event and what was built during it; no slides; 3:00 at most; English.

## Look

From the app's own tokens (`apps/web/src/styles.css`): paper `#eadcc0`, panel `#fbf3e1`, ink `#2d2016`, gold `#d9a233`/`#f2cf7c`, teal `#138f9f`; Fraunces (soft, wonky axes) for display, Inter for UI, JetBrains Mono for code. Panels lift as the app's do: a 1.5px ink edge, a hard ink drop, a warm soft shadow. A faint hex grid on the paper (the board). Motion voice: playful-energetic (entrances `bezier(0.16,1,0.3,1)`, landings overshoot `bezier(0.34,1.56,0.64,1)`), no handheld shake, no glints in bulk.

## Music

Cat Walk (Arulo, Mixkit Stock Music Free License), 129.995 BPM, first downbeat 0.7085 s, grid residual 9 ms. Film bar = music bar up to bar 41; there the music skips its bars 42–46 (five bars of the same breakdown loop, a 3-frame crossfade at the seam), so film bar f ≥ 42 plays music bar f + 5. Music bars 1–8 quiet intro, 9–16 build, **17 drop one (29.54 s)** = Dream it up, 24–25 a dip (ready), 26–31 full, 32 falls, 33–47 a calm breakdown, 48 build, **49 drop two (film 79.4 s)** as the second code window lands, 56–57 a dip, 58–60 full (the end mark), 61 falls, 62–63 the tail. At most three whole-frame hits.

## Storyboard (1:44, 1920 × 1080 laid out, 60 fps; masters at 2560 × 1440)

| # | Time | Shot | Shot card | Key motion |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:07 | **Open.** BoardDream pressed in ink, its promise; then what existed before the event (the repo's first commit: a two-line README) and what was built during it (everything shown) | brand-ink-open | crosshair, mark and wordmark press in, the statement holds |
| 2 | 0:07–0:17 | **Two ways** (README diagram): the old way loops for weeks; BoardDream goes straight through in minutes | draw-svg-trace | the old loop traced, BoardDream's lane drawn on beats, the whole figure held |
| 3 | 0:17–0:30 | **One sentence** (screen recording): the idea typed at real speed, the settings at their highest, Dream it up on drop one | type-and-filter (typing grammar) | push in on the box, pull back to the settings |
| 4 | 0:30–0:42 | **The making** (screen recording, sped up and labelled): Muse Spark plans, writes the rules as code live, bots play 1,130 games | document-typewriter-reveal + lifted cards | the code and the playtest grid lifted out of the recording |
| 5 | 0:42–0:46 | **Ready**: the real clock (8:37), Start playing | crash-zoom-punch | slow push, click on the last beat |
| 6 | 0:46–0:52 | **The table** (real speed): Muse Spark Open thinks and talks | overhead-camera-moves tilt-reveal | the recording rises level, then holds |
| 7 | 0:52–0:57 | **House rules**: a rule in plain words, Muse Spark rewrites it (84 s, sped up), version two | lifted loupe | the before/after in a loupe |
| 8 | 0:57–1:05 | **Painted and checked**: Muse Image paints (34 s, sped up), SAM 3.1's result, before/after | before-after-slider-scrub | slider over two recordings |
| 9 | 1:05–1:16 | **Everything else**: friends by a link, print and play, the mochi game, Behind the scenes | quad-split-parallel-scenes | each panel in turn, then all four |
| 10 | 1:16–1:32 | **Built at the hackathon**: our code in three windows (drop two), the four Meta models and their jobs | terminal-3d | code windows fly in 3D |
| 11 | 1:32–1:44 | **End**: a piece of every feature around the mark, boarddream.pages.dev | outro-group-photo-launch | pieces fly in, mark stamps on bar 58, the address held |

Timings live in `src/timeline.ts`; sounds are pinned to them in `src/sound.tsx`.

## Data

Two local test accounts (Aichen, Mira, example.com addresses), the local server's games, no keys or personal data on screen.

## Making it again

With the app running locally (web on :5173, API on :8787) and the test accounts made (`npx tsx video/record/accounts.ts`):

```sh
export SCREEN_FFMPEG=<an ffmpeg 8+ with gfxcapture> FOOTAGE_DIR=video/promo/footage-raw
node video/record/takes.mjs film --screen                 # one take, 60 fps: the idea typed, a game made for real at the highest settings, its table (stops at the first turn)
node video/record/takes.mjs after --screen --game=<id> "--rule=Every family starts the game with one extra lamp-oil."   # its table, Muse Spark Open, the house rule, the painting, the invite
FFMPEG=<that ffmpeg> python video/promo/capture/cut.py   # the clips the film uses (capture/cuts.json) into public/footage/clips
node video/promo/capture/pipeline.mjs   # one game made for real, then its table, rivals, house rule, painting, Balance, rules, print kit, invite (spends model calls)
node video/promo/capture/statics.mjs    # Behind the scenes, the shelf, the mochi game, two friends at one table, the demo tables (spends nothing)
python video/promo/src/shots/outro/crop.py
curl -L -o video/promo/public/audio/bgm/cat-walk.mp3 https://assets.mixkit.co/music/371/371.mp3   # the music (kept out of git, see NOTICE.md)
cd video/promo
npm run preview                         # 1280 x 720, 60 fps
npm run render                          # 2560 x 1440, 60 fps
npx remotion render src/index.ts Promo out/promo-2k60-nobgm.mp4 --scale=1.3333333333333333 --props=props-nobgm.json   # the same film without the music
```

The recordings (footage-raw, public/footage), the stills (public/cap), the music and the renders (out) stay out of git. Sources and licences of everything in the film: [NOTICE.md](NOTICE.md).

## Sounds

Freesound CC0 previews, listed with their sources in `public/audio/sfx/FREESOUND-CREDITS.md`; the cue table is in `src/sound.tsx`. Music: Cat Walk by Arulo, Mixkit Stock Music Free License (https://assets.mixkit.co/music/371/371.mp3).
