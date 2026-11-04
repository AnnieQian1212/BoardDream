# The demo video

The submission needs a demo video of at most three minutes that shows what was built during the hackathon (all of BoardDream), and judges must be able to tell what that is. Judges score Impact (30%), Use of Meta AI tooling (25%), Technical depth (20%) and Demo (25%: "is the demo video genuinely cool to watch?"), and the finalists' videos are watched live.

## The film (`video/promo`, the one submitted, 1:44)

Made from scratch on Nov 4 with [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) and Remotion; no earlier footage or cut is used. Following the organizers' guidance (most of the video real screen footage of the working product with the live Meta model calls visible, simulated or sped-up parts labelled, 3:00 at most, in English, an opening line on what existed before the event), the product is shown in two new screen recordings at 60 fps: one game, Clovefire Reach, made for real at the highest settings (High effort, complexity and play time at their top, a map on hexes; 8 min 37 s to ready), then played against Muse Spark Open, given a house rule, painted by Muse Image and checked by SAM 3.1. Every sped-up stretch carries its real duration. It is cut on one music track (five bars of its calm middle left out): the click on Dream it up lands on its first drop, our code on its second. The design spec, storyboard and how to make it again are in [video/promo/SPEC.md](../video/promo/SPEC.md); sources and licences in [video/promo/NOTICE.md](../video/promo/NOTICE.md).

| Time | Shot |
| --- | --- |
| 0:00 | BoardDream pressed in ink; what existed before Oct 26 (the repo's first commit, a two-line README) and what was built during the hackathon (everything shown) |
| 0:07 | The README's diagram drawn: the old way loops for weeks, BoardDream goes straight through in minutes |
| 0:17 | Screen recording: one sentence typed, the settings at their highest, Dream it up |
| 0:30 | Screen recording, sped up and labelled: Muse Spark plans the game, picks tested mechanics, writes the rules as code live, 1,130 bot games |
| 0:42 | Ready to play, the real clock (8:37); Start playing |
| 0:46 | Screen recording at real speed: the 3D table; Muse Spark Open plays the empty seats and talks |
| 0:52 | A house rule in plain words; Muse Spark rewrites and re-tests it; version two |
| 0:57 | Muse Image paints the board, SAM 3.1 checks the tiles (39 of 39 aligned) |
| 1:05 | Friends join by a link, print and play, the mochi game, Behind the scenes |
| 1:16 | Built at the hackathon: our code in three windows, the four Meta models and their jobs |
| 1:32 | A piece of every feature around the mark, boarddream.pages.dev |

A tag in the corner says from 0:17 to the end card that everything shown was built at the hackathon, Oct 26 – Nov 4.

## The 1:05 film, an earlier cut (`Short` in `video/remotion/src/Short.tsx`)

No voice: words on screen, music, and sounds made for it (`public/sfx`, synthesized with ffmpeg). The pace follows a short AI product promo: the app as an object that floats and drifts rather than a camera pushing into it, parts of it lifted out as larger cards, words sweeping in, and an object (the BoardDream hex) carrying each hand-over.

| Time | Part | What it is |
| --- | --- | --- |
| 0:00–0:30 | A concept film | The games' boxes on a ring, painted boards, cards, the mochi game, a table in play, two friends' screens: results, not process |
| 0:30–0:35 | Aichen, five seconds | Cut fast against word cards, after Apple's 2018 keynote opener: a shrug at the shelf, "Game night?", a box held up, "Played it.", another, "Played that.", a look at the camera, "So I built this." The words keep the beat alone if the face is left out |
| 0:35–0:59 | The app in one take | Recorded in the film's order and played without a cut, fast through the waits: one sentence, Muse Spark designing it, a turn, Muse Spark Open in the empty seat, a house rule with its progress bar and version two, Balance, the board painted and checked, the print-and-play kit in Chrome's print preview, the invite. A tag says throughout that it was built during the hackathon |
| 0:59–1:05 | Built at the hackathon | Commits a day from the first to the last, what we built, what it is powered by (the four Meta models and open-source libraries), and boarddream.pages.dev |

The three-minute version below (`DemoVideo`) is the earlier cut, kept for its parts.

## What the references do

**Figma Motion (68 s).** Music only, no narration; about 20 hard cuts, one every 3 seconds. A 3-second abstract brand open, the product in context, a title card over a collage of examples, then seven features of 5–10 seconds, each a close-up of the real interface on a solid color with an oversized cursor doing one thing; a closing line and the logo.

**Linear Initiatives (4:14).** A 3-second black title card, "a primer with Nan Yu, Head of Product", then one continuous screen recording with the presenter in a round webcam bubble in the corner, no hard cuts, slow zooms. Who I am and the feature in one sentence; a concrete example walked through as they use it; a second use, done live; why we built it; an invitation to try it; the logo.

## Part 1: BoardDream, a concept film (0:00–0:30)

| Time | Shot |
| --- | --- |
| 0:00 | "What do you want to play tonight?", each word out of depth and focus, gold streaks of light |
| 0:03 | One sentence written in light, breaking into the games' covers |
| 0:06 | The games as boxes (cover on the lid, name on the coloured sides) on a ring turning level: "Every game, a world of its own." |
| 0:10 | Three painted boards rising in depth under a passing light: "Boards painted for every game" |
| 0:13 | A hand of the games' cards fanning out and turning face up, each with its game's name |
| 0:15 | "While your game is made": the mochi strip cut into boards (its band over the steamer and blanket, the orders and friends met below); the steamer clicked, then two mochi put together into a new friend, in one take |
| 0:20 | "Tonight. Your move.": Tidehearth in play, the pointer over the water as the pieces land |
| 0:25 | Two friends' screens drifting together: "Game night, every night." |
| 0:28 | The mark and "Dream it up. Play it tonight." |

## Part 2: a primer with the builder (0:30–2:59)

A title card, "How BoardDream works, a primer with Aichen Qian". Aichen is on camera three times (the opening, "why", the close): head and shoulders in a gold ring on the left, over the app out of focus, with a few words of what is said arriving on the right; until those takes are recorded a stand-in holds the ring. The game made is **Basalt Kin**, made for real at high effort with complexity at its highest. Its making is one shot from **Dream it up** to the table: fast through the design, gliding down to a round of the mochi game, fast through the rules and the playtest, at its own pace as the table comes in. The walk through it is one take of Chrome's window at 60 fps. The narration (about 330 words, plain and spoken) runs as subtitles along the bottom.

| Time | On screen | Narration |
| --- | --- | --- |
| 0:33 | Aichen on camera | Hi, I'm Aichen. My friends and I have a game night every week, and we've played every game on our shelf. So I built BoardDream: describe a game in one sentence, and play it with friends tonight. |
| 0:48 | The idea typed, high effort, complexity and play time at their highest, a map on hexes, **Dream it up** | Tonight we want something big: rival families settling volcanic islands. I turn the complexity all the way up and hit Dream it up. |
| 0:57 | The making, one shot (8× and 32×, the mochi near its own pace) | Muse Spark, Meta's AI model, designs the whole game: the islands, the cards, how you win. While you wait, there's a little mochi game to play. It builds on game parts we've already tested, and writes the rules as real code. Then bots play it a thousand times, and anything that breaks gets fixed. About six and a half minutes later, it's ready to play. Islands, harbors, lighthouses, and cards that combo. |
| 1:26 | Muse Spark Open playing the other seats | Missing a friend? Muse Spark Open, Meta's open model, takes the empty seat, and even chats. |
| 1:33 | A house rule typed and applied; version two, 21×, its before and after | Every group has house rules. Just type the change in plain words, and the game is rewritten and tested again, as version two. |
| 1:46 | A turn: only the legal moves glow | On your turn, only the moves you're allowed to make light up. |
| 1:52 | The rulebook | Every game comes with a short rulebook. |
| 1:57 | The print-and-play kit: rules, board, cards | Prefer cardboard? Print the rules, board and cards, and play at a real table. |
| 2:02 | The Balance tab, its games played fast | The Balance tab shows how it plays: how complex, how lucky, how much you clash. |
| 2:08 | The board painted and checked, 16× | Muse Image paints the board, and SAM 3.1 checks every tile lines up. |
| 2:16 | The table's invite link | Then I send my friends a link, and we all sit at one table. |
| 2:21 | Aichen on camera; the two flows | Why did I build this? Game night keeps us close, and a new game keeps it fun. Testing a game idea by hand takes weeks of paper prototypes. With BoardDream, it's been played a thousand times before you sit down. |
| 2:36 | Behind the scenes; the four models | Behind the scenes, we measure every step: drafts, fixes, and how well the bots play. Four Meta models, four jobs: Muse Spark designs, Muse Spark Open plays, Muse Image paints, SAM 3.1 checks. |
| 2:49 | Aichen on camera; the end card | Everything you saw was built during this hackathon. Try it at boarddream.pages.dev, and play something new with your friends tonight. |

## How it is made

| Step | Where | What |
| --- | --- | --- |
| Footage | `video/record` (the `ui-demo` skill: discover, rehearse, record) | `takes.mjs` drives the installed Chrome with Playwright: an oversized ink cursor that glides before every click, visible typing, a rehearsal that checks every selector first and spends nothing. With `--screen` it records Chrome's own window, full screen on the 2560 × 1440 display, at 60 fps with Windows graphics capture (ffmpeg's `gfxcapture`); without it, Chrome's screencast, which tops out near 20 frames a second at these sizes and shows as judder at 60 fps. Takes: `make` (a game made for real; the one used is saved as `making`), `after --game=<id>` (its house rule made version two and its board painted), `walk --game=<id> --revised=<id> --screen` (Part 2's walk through it), `merge --screen` and `play --screen` (Part 1's mochi and table), `friends`. Every game counts as seen, so no first-game guide covers a table. The test accounts, Aichen and Mira, are made in the local database by `accounts.ts`, so no sign-up mail is sent |
| Edit | `video/remotion` (the Remotion skill) | Part 1 (`Reel.tsx`) and Part 2 (`Primer.tsx`) as scenes with a handover at each cut (`timeline.tsx`); the footage, camera, type, labels, cards and transitions in `fx.tsx`; `npx remotion render DemoVideo` (2560 × 1440, 60 fps, `remotion.config.ts`) |
| The two flows | `video/remotion` (the DashMotion skill) | One geometry (`flowLayout.ts`) drawn twice: `flows-html.mts` writes it as a stand-alone DashMotion page that DashMotion's checker passes, and `Flows.tsx` draws it in the film, everything moving on the film's clock |
| Camera and voice | Aichen | Part 2's three camera takes (opening, why, close) and the narration over the app, recorded against the cut; the takes go in `public/camera` and their names in `CAMERA` in `Primer.tsx` |
| Music | Aichen | A licensed royalty-free track; the rules disqualify assets used without the rights to them |

The footage and renders stay out of git; any machine with the servers running makes them again.

## Still to do

- Record the three camera takes and the narration.
- Music for Part 1, and quietly under Part 2.

## Where each part scores

| Rubric | Where |
| --- | --- |
| Impact (30%) | The game-night story: friends at one table by a link, an empty seat filled, house rules |
| Use of Meta AI tooling (25%) | The labels naming each model in Part 1; Part 2's walk through what each model does, and the four named in "why" |
| Technical depth (20%) | Rules written as code, a thousand test games, repair, the painted tiles checked by SAM 3.1; the README carries the numbers |
| Demo (25%) | All of Part 1; the real game made, played and shared in Part 2 |

## A 30-second cut for X

For the Most Viral prize, Part 1 cut vertically (1080 × 1920): the open, the question, friends joining, the table, the rivals talking, the close with **boarddream.pages.dev**. Captions instead of voice.
