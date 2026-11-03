# The 3-minute demo video

The submission needs a demo video of at most three minutes that shows what was built during the hackathon (all of BoardDream). Judges score Impact (30%), Use of Meta AI tooling (25%), Technical depth (20%) and Demo (25%: "is the demo video genuinely cool to watch?"), and the finalists' videos are watched live.

**The story: game night with friends.** A group that plays every week runs out of games; BoardDream makes a new one from a sentence, tested a thousand times, and the friends play it together that night, at one table by a link, with Muse Spark Open in any empty seat and house rules asked for in words. The friendship is shown, not claimed: friends joining by a link, two windows dealt in, rivals talking. The models and the testing stay the spine, since they carry 45% of the score.

The video has two parts:

| Part | Time | Reference | What it is |
| --- | --- | --- | --- |
| 1. BoardDream in motion | 0:00–0:50 | Figma, [Introducing Figma Motion](https://www.youtube.com/watch?v=l3HuAYXyOTo) | A fast reel of the real app in close-ups: music, no voice |
| 2. A primer with the builder | 0:50–2:56 | Linear, [Introducing Linear Initiatives](https://www.youtube.com/watch?v=FlDVDvzCmn0) | Aichen Qian on camera over one continuous take of the app |

**The look.** Every shot of the app fills the frame, the camera moving slowly over it; nothing is framed in a box or laid over the page but a small label in the lower left naming what is at work (a Meta model, a feature) and, in Part 2, the subtitles. Between the shots, cards in warm near-black with gold type (the app's Fraunces and Inter), words rising into place. Every cut has a handover, varied but in one family: a blur-zoom, a soft slanted wipe, a push, an iris, a fade, and a gold light leak over a hard cut. Close-ups are recorded at twice the pixels, so they stay sharp enlarged.

## What the references do

**Figma Motion (68 s).** Music only, no narration; about 20 hard cuts, one every 3 seconds. A 3-second abstract brand open, the product in context, a title card over a collage of examples, then seven features of 5–10 seconds, each a close-up of the real interface on a solid color with an oversized cursor doing one thing; a closing line and the logo.

**Linear Initiatives (4:14).** A 3-second black title card, "a primer with Nan Yu, Head of Product", then one continuous screen recording with the presenter in a round webcam bubble in the corner, no hard cuts, slow zooms. Who I am and the feature in one sentence; a concrete example walked through as they use it; a second use, done live; why we built it; an invitation to try it; the logo.

## Part 1: BoardDream in motion (0:00–0:52)

| Time | Shot | Label (lower left) |
| --- | --- | --- |
| 0:00 | The mark and the name, a sheen across it | |
| 0:03 | "What do you want to play tonight?", an example idea picked | |
| 0:07 | "A new game for your table, every night." | |
| 0:10 | The game being made, 24× | Muse Spark: designs the game and writes its rules as code |
| 0:15 | "1,000" counting up: games played by bots on every new game | |
| 0:18 | The rules written, tested, a fault fixed | Tested, then fixed |
| 0:21 | Split screen: Aichen's screen and Mira's, Mira joining by the link, both dealt in | Game night: invite friends with one link |
| 0:27 | Tidehearth up close, bots building, the water under the cursor | |
| 0:32 | Cloudwaft Harbor's hand, a card's ability firing | Engine building |
| 0:36 | Fogfall Lanterns with Muse Spark Open in every seat, talking | Muse Spark Open: takes the empty seat, and talks |
| 0:40 | A house rule typed | House rules |
| 0:44 | A board taking its painting | Muse Image · SAM 3.1 |
| 0:47 | A tilted wall of the games' covers: "Every game, a world of its own." | |
| 0:50 | "Dream it up. Play it tonight." | |

## Part 2: a primer with the builder (0:52–2:57)

A title card, "How BoardDream works, a primer with Aichen Qian". Then Aichen on camera, full frame, cut between the shots of the app rather than laid over them: the opening, "why", and the close. Until those takes are recorded the line is set in large type in their place. The app's shots are the take that made **Copper Grind** for real (its making, sped up with a badge giving the real time) and a take that plays it on with no first-game guide over the table: Muse Spark Open in the other seats, a house rule made version two, the board painted, the invite link. A tilted wall of covers and a card of the four models close the argument. The narration (about 280 words) runs as subtitles along the bottom.

| Time | On screen | Narration |
| --- | --- | --- |
| 0:55 | Aichen on camera | Hi, I'm Aichen Qian. Every week my friends and I have a game night, and we'd played everything on the shelf. So I built BoardDream: describe a game in one sentence, and play it together tonight. |
| 1:08 | The idea picked, three to four players, **Dream it up** | Tonight we want a cafe game. I pick an idea, set three to four players, and press Dream it up. |
| 1:17 | The game being made, 14× (5 min 44 s) | Muse Spark, Meta's model, designs the game: the street, the cards, how you win. It picks tested mechanics from our library and writes the rules as real code. Before anyone plays, bots run a thousand games, and anything that breaks goes back to Muse Spark to fix. |
| 1:41 | Ready; the table | About six minutes later, the game is ready. |
| 1:47 | Muse Spark Open playing the other seats | If a friend can't make it, Muse Spark Open, Meta's open-weight model, takes the empty seat. |
| 1:55 | A house rule typed and applied; version two, 18× (1 min 13 s) | Every group has house rules. We ask for a change in plain words, and it's rewritten and tested again, as version two. |
| 2:09 | The board painted, 15× (58 s) | Muse Image paints the board, and SAM 3.1 checks every painted tile sits on the real one. |
| 2:17 | The table's invite link | Then I send my friends a link, and we play at one table. |
| 2:25 | Aichen on camera; the wall of covers; the four models | Why build this? Game night is how we stay close, and a new game keeps it fresh. But testing your own idea takes weeks of paper prototypes. BoardDream gives your table a game that has already been played a thousand times. Four Meta models, each with a job: Muse Spark designs, Muse Spark Open plays, Muse Image paints, SAM 3.1 checks. |
| 2:47 | Aichen on camera; the end card | Everything you saw was built during this hackathon. Try it at boarddream.pages.dev, and play something new with your friends tonight. |

## How it is made

| Step | Where | What |
| --- | --- | --- |
| Footage | `video/record` (the `ui-demo` skill: discover, rehearse, record) | `takes.mjs` drives the installed Chrome with Playwright at 1920 × 1080: an oversized ink cursor that glides before every click, visible typing, a rehearsal that checks every selector first. Frames come from Chrome's screencast and are encoded at 30 fps; a take slows its frame rate while a game is made, and marks the moments the edit cuts on. Takes: `primer` (makes a game for real), `after` (plays it on: rivals, a house rule, the painting, the link), `friends` (two accounts in two windows), `rivals`, and close-ups at twice the pixels with `--2x`: `home`, `rule`, `table`, `cards`, `painted`. Every game counts as seen, so no first-game guide covers a table, and a rehearsal stops before anything that spends model calls. The test accounts, Aichen and Mira, are made in the local database by `accounts.ts`, so no sign-up mail is sent |
| Edit | `video/remotion` (the Remotion skill) | Part 1 (`Reel.tsx`) and Part 2 (`Primer.tsx`) as scenes with a handover at each cut (`timeline.tsx`); the footage, type, labels, cards and transitions in `fx.tsx`; `npx remotion render DemoVideo` |
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
