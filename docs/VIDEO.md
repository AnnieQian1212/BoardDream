# The 3-minute demo video

The submission needs a demo video of at most three minutes that shows what was built during the hackathon (all of BoardDream). Judges score Impact (30%), Use of Meta AI tooling (25%), Technical depth (20%) and Demo (25%: "is the demo video genuinely cool to watch?"), and the finalists' videos are watched live.

The video has two parts:

| Part | Time | Reference | What it is |
| --- | --- | --- | --- |
| 1. BoardDream in motion | 0:00–0:50 | Figma, [Introducing Figma Motion](https://www.youtube.com/watch?v=l3HuAYXyOTo) | A fast product reel: music, no voice, close-ups of the real app |
| 2. A primer with the builder | 0:50–2:56 | Linear, [Introducing Linear Initiatives](https://www.youtube.com/watch?v=FlDVDvzCmn0) | The builder on camera, explaining it over one continuous screen recording |

One message to land: **a sentence becomes a board game that has been played a thousand times, and you can play it tonight, against Meta's models or with friends.**

## What the references do

**Figma Motion (68 s).** Music only, no narration; about 20 hard cuts, one every 3 seconds. A 3-second abstract brand open, then the product in context (a design zooms out to the editor), then a title card ("Figma Motion") over a collage of examples. Then seven features of 5–10 seconds each, every one shown as a close-up of the real interface (a timeline, a keyframe, an easing curve) on a solid color background, with an oversized cursor doing one action and its result playing. Text appears only in the title and the closing line ("Set your ideas in motion"), then the logo.

**Linear Initiatives (4:14).** A 3-second black title card, "Introducing Linear Initiatives: a primer with Nan Yu, Head of Product". Then one continuous screen recording with the presenter in a round webcam bubble in the bottom-right corner the whole time; no hard cuts, only slow zooms into the part being discussed. The talk: who I am and the feature in one sentence, "let me show you" (0:00–0:29); a concrete example, an imaginary company, walked through as the presenter uses it (0:29–1:58); a second use, planning, done live (1:58–3:23); why we built it, the pain of scattered tools, and an invitation to try it (3:23–4:09); the logo.

## Part 1: BoardDream in motion (0:00–0:50)

Music only. Every shot is a close-up of the real app, cropped and framed on a solid color from the storybook palette (parchment, teal, warm orange), with the oversized cursor from the recording scripts. One short label per Meta model, set in the board's serif, names the model at work.

| Time | Shot | On screen | Label |
| --- | --- | --- | --- |
| 0:00–0:03 | Brand open | The BoardDream mark assembles on parchment | |
| 0:03–0:07 | The question | "What do you want to play tonight?"; the cursor picks **Cafes on one busy street** and presses **Dream it up** | |
| 0:07–0:10 | Title | **BoardDream**, "Describe a board game. Play it tonight.", over the four demo games' covers sliding past | |
| 0:10–0:16 | Designing | The making screen, sped up: steps tagged Muse Spark, mechanic cards dealt from the library, the rules streaming in | Muse Spark designs and writes the rules |
| 0:16–0:21 | Playtesting | The playtest squares filling; a fault, and its fix | 1,000 games before you play |
| 0:21–0:29 | The table | Tidehearth up close: a village set down, the water rippling under the cursor, a card flashing gold | |
| 0:29–0:35 | Rivals that talk | Muse Spark Open players' speech bubbles, an accusation, a vote | Muse Spark Open plays and talks |
| 0:35–0:40 | Painted | The board's tiles taking their paintings; the wall of covers | Muse Image paints · SAM 3.1 checks |
| 0:40–0:45 | Make it yours | A balance slider dragged, the seats' win rates moving; a rule changed in words, "Version 2" | |
| 0:45–0:48 | Friends | Two windows side by side: a friend joins, both make a move | |
| 0:48–0:50 | Close | "Dream it up. Play it tonight." and the mark | |

## Part 2: a primer with the builder (0:50–2:56)

**Layout.** A 3-second title card, "How BoardDream works: a primer with [your name]". Then one continuous screen recording of the full app, with the builder in a round webcam bubble in the bottom-right corner and English captions along the bottom; slow zooms into whatever is being talked about, no hard cuts. The mark closes it.

The narration is about 290 words, which fills two minutes at an easy pace. Lines in [brackets] are the first to cut if it runs long.

### Who I am, what it is (0:53–1:08)

**Screen:** the home page.

> Hi, I'm [your name], and I built BoardDream during this hackathon. It turns one sentence into a board game you can really play: rules written as code, tested a thousand times, on a 3D table in your browser. Let me show you.

### A game made for tonight (1:08–1:58)

**Screen:** pick **Cafes on one busy street**, open **Advanced settings**, set 3–4 players and an hour, press **Dream it up**.

> Say my friends want a cafe game tonight. I pick an idea, set three to four players and an hour, and press Dream it up.

**Screen:** the making screen, sped up, with "sped up" and the real time in the corner.

> Muse Spark designs the game: the street, the cards, how you win. It picks tested mechanics from our library and writes the rules as real code; you can watch it stream in.

**Screen:** the playtest squares, a fault and its repair.

> Then bots play a thousand games. Anything that crashes or gets stuck goes back to Muse Spark to fix, [and a planning bot checks that thinking ahead actually wins.]

**Screen:** the new game's table: a move, a rival's speech bubble.

> A few minutes later I'm dealt in. My rivals are Muse Spark Open, Meta's open-weight model on Baseten, and they talk at the table.

### Make it yours (1:58–2:24)

**Screen:** **Designer**, **Rules**, **Change the rules**; type a change; "Version 2".

> Don't like a rule? Ask in plain words. It's rewritten and tested again, as version two.

**Screen:** **Art**: the board painted, and how many tiles SAM 3.1 found in place.

> Muse Image paints the cover, the cards and the board, and SAM 3.1 checks that every painted tile sits on the real one.

**Screen:** **Invite friends**: the table's link.

> [And when it's ready, invite friends with a link; bots fill the empty seats.]

### Why (2:24–2:46)

**Screen:** the Games page, the demo games' covers.

> Why build this? Trying a board game idea takes weeks of paper prototypes, and rules an AI just writes out are rarely tested. BoardDream hands you a game that has already been played a thousand times. Four Meta models, each with a job: Muse Spark designs, Muse Spark Open plays, Muse Image paints, and SAM 3.1 checks.

### Close (2:46–2:53)

**Screen:** the home page, **boarddream.pages.dev** over it.

> Everything you saw was built during this hackathon. Try it at boarddream.pages.dev. Describe a game, and play it tonight.

## How it is made

| Step | Tool | What |
| --- | --- | --- |
| Screen footage | `ui-demo` scripts (Playwright driving the installed Chrome, `channel: "chrome"`) | Every app shot, played by script so each take is the same: the oversized cursor, moves before clicks, visible typing. Part 1's close-ups at twice the pixel density, so their crops stay sharp; Part 2 as one take of the whole screen at 1920 × 1080 |
| Camera | Webcam or phone, 1080p, a teleprompter | Part 2's talking head and voice, recorded a section at a time |
| Assembly | Remotion | Crops and slow zooms, the solid frames and labels, the brand open and title cards, the generation sped up with its badge, the round webcam bubble, captions, music; renders the 1920 × 1080 MP4 and a vertical cut |
| Music | A licensed royalty-free track | The rules disqualify assets used without the rights to them |

The scripts and the Remotion project live in `video/` at the repository root, outside the npm workspaces, so the app's install and deploy never pull them in; raw footage and renders stay out of git.

**Order:** make the hero game in advance (see below) → script and rehearse each shot (`ui-demo`'s discover, rehearse, record) → record the screen → record the camera against the finished screen take → assemble in Remotion → check the length (under 3:00) and the captions → render.

## Before recording

- Run the full server locally with `.env` set, so generation, art, Muse Spark Open opponents and tables with friends all work. Use the light theme.
- Make the hero game from **Cafes on one busy street** two or three times at the default effort and keep the best take; a take where one check fails and the repair fixes it shows the most. Record its making screen while it is made: about 5–8 minutes, shown sped up.
- Check that Muse Spark Open players speak in Fogfall Lanterns before relying on it for "rivals that talk"; Fenlight, the game the opponents benchmark plays, is the fallback. Shots without talking rivals use `&bots`, so they spend no opponent credits.
- Sign in with test accounts, not a personal one, so no personal email or name shows; two accounts for the friends shot.
- 1920 × 1080, browser zoom 100%, nothing else on screen.

## Where each part scores

| Rubric | Where |
| --- | --- |
| Impact (30%) | Part 2's "why" and "a game made for tonight"; friends at one table |
| Use of Meta AI tooling (25%) | Part 1's model labels; Part 2's walk through what each model does, and the four models named in "why" |
| Technical depth (20%) | Rules written as code, a thousand test games, repair, the planning check, the painted tiles checked by SAM 3.1; the README carries the numbers |
| Demo (25%) | All of Part 1; the live table and the talking rivals in Part 2 |

## A 30-second cut for X

For the Most Viral prize, Part 1 cut vertically (1080 × 1920): the brand open, the question, the table, the rivals talking, the painting, then the close with **boarddream.pages.dev**. Captions instead of voice.
