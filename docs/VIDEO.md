# The 3-minute demo video

The submission needs a demo video of at most three minutes that shows what was built during the hackathon (all of BoardDream). Judges score Impact (30%), Use of Meta AI tooling (25%), Technical depth (20%) and Demo (25%: "is the demo video genuinely cool to watch?"), and the finalists' videos are watched live.

**The story: game night with friends.** A group that plays every week runs out of games; BoardDream makes a new one from a sentence, tested a thousand times, and the friends play it together that night, at one table by a link, with Muse Spark Open in any empty seat and house rules asked for in words. The friendship is shown, not claimed: friends joining by a link, two windows dealt in, rivals talking. The models and the testing stay the spine, since they carry 45% of the score.

The video has two parts:

| Part | Time | Reference | What it is |
| --- | --- | --- | --- |
| 1. BoardDream in motion | 0:00–0:50 | Figma, [Introducing Figma Motion](https://www.youtube.com/watch?v=l3HuAYXyOTo) | A fast reel of the real app in close-ups: music, no voice |
| 2. A primer with the builder | 0:50–2:56 | Linear, [Introducing Linear Initiatives](https://www.youtube.com/watch?v=FlDVDvzCmn0) | Aichen Qian on camera over one continuous take of the app |

**The guide.** A sakura mochi from the steamer game (the game to play while one is made) lives in the frame and leads the eye, the way an animated mascot does: it hops to whatever matters, lands with a squash, looks on, cheers when something works, and in Part 1 names the Meta model at work in a sticker bubble.

## What the references do

**Figma Motion (68 s).** Music only, no narration; about 20 hard cuts, one every 3 seconds. A 3-second abstract brand open, the product in context, a title card over a collage of examples, then seven features of 5–10 seconds, each a close-up of the real interface on a solid color with an oversized cursor doing one thing; a closing line and the logo.

**Linear Initiatives (4:14).** A 3-second black title card, "a primer with Nan Yu, Head of Product", then one continuous screen recording with the presenter in a round webcam bubble in the corner, no hard cuts, slow zooms. Who I am and the feature in one sentence; a concrete example walked through as they use it; a second use, done live; why we built it; an invitation to try it; the logo.

## Part 1: BoardDream in motion (0:00–0:50)

| Time | Shot | The mochi says |
| --- | --- | --- |
| 0:00–0:03 | The mark and the name assemble on paper; the mochi hops in | |
| 0:03–0:07 | "What do you want to play tonight?"; the cursor picks **Cafes on one busy street** | |
| 0:07–0:10 | "A new game for your table, every night." over the four demo games' covers | |
| 0:10–0:16 | The game being made, sped up: the plan, mechanic cards dealt, the rules streaming | Muse Spark designs the game and writes its rules as code |
| 0:16–0:21 | Bots playing the first draft while it is tested | Bots play 1,000 games before you do |
| 0:21–0:29 | Two windows: Aichen's table, Mira joining by the link, both dealt in | Invite your friends with one link |
| 0:29–0:35 | Tidehearth up close: bots building, the water rippling under the cursor | |
| 0:35–0:41 | Fogfall Lanterns with Muse Spark Open in every seat, speaking | A friend can't make it? Muse Spark Open takes the seat, and talks |
| 0:41–0:45 | A house rule typed into **Change the rules** | Your house rules, in plain words |
| 0:45–0:48 | A painted board | Muse Image paints. SAM 3.1 checks. |
| 0:48–0:50 | "Dream it up. Play it tonight." and the mark | |

## Part 2: a primer with the builder (0:50–2:56)

A 3-second title card, "How BoardDream works: a primer with Aichen Qian, who built it". Then the take that made **Copper Grind** for real, in a window on the paper; Aichen's camera in a round frame in the corner; the narration as captions below; long waits played fast with a "sped up" badge and the real time. The mark closes it. The narration is about 280 words.

| Time | On screen | Narration |
| --- | --- | --- |
| 0:53 | The home page | Hi, I'm Aichen Qian. Every week my friends and I have a game night, and we'd played everything on the shelf. So I built BoardDream: describe a game in one sentence, and play it together tonight. |
| 1:08 | The idea picked, three to four players, **Dream it up** | Tonight we want a cafe game. I pick an idea, set three to four players, and press Dream it up. |
| 1:17 | The game being made, 14× (5 min 44 s) | Muse Spark, Meta's model, designs the game: the street, the cards, how you win. It picks tested mechanics from our library and writes the rules as real code. Before anyone plays, bots run a thousand games, and anything that breaks goes back to Muse Spark to fix. |
| 1:41 | Ready; the table | About six minutes later, the game is ready. |
| 1:47 | Muse Spark Open playing the other seats | If a friend can't make it, Muse Spark Open, Meta's open-weight model, takes the empty seat. |
| 1:55 | A house rule typed and applied; version two, 18× (1 min 13 s) | Every group has house rules. We ask for a change in plain words, and it's rewritten and tested again, as version two. |
| 2:09 | The board painted, 15× (58 s) | Muse Image paints the board, and SAM 3.1 checks every painted tile sits on the real one. |
| 2:17 | The table's invite link | Then I send my friends a link, and we play at one table. |
| 2:23 | The games, scrolling | Why build this? Game night is how we stay close, and a new game keeps it fresh. But testing your own idea takes weeks of paper prototypes. BoardDream gives your table a game that has already been played a thousand times. Four Meta models, each with a job: Muse Spark designs, Muse Spark Open plays, Muse Image paints, SAM 3.1 checks. |
| 2:45 | Home | Everything you saw was built during this hackathon. Try it at boarddream.pages.dev, and play something new with your friends tonight. |

## How it is made

| Step | Where | What |
| --- | --- | --- |
| Footage | `video/record` (the `ui-demo` skill: discover, rehearse, record) | `takes.mjs` drives the installed Chrome with Playwright at 1920 × 1080: an oversized ink cursor that glides before every click, visible typing, a rehearsal that checks every selector first. Frames come from Chrome's screencast and are encoded at 30 fps; a take slows its frame rate while a game is made, and marks the moments the edit cuts on. Takes: `primer` (makes a game for real, then plays, changes, paints and shares it), `friends` (two accounts in two windows), `table`, `cards`, `rivals`, `painted`. The test accounts, Aichen and Mira, are made in the local database by `accounts.ts`, so no sign-up mail is sent |
| Edit | `video/remotion` (the Remotion skill) | Part 1 (`Reel.tsx`) and Part 2 (`Primer.tsx`), the mochi (`Mochi.tsx`), the captions, the camera frame, the badges; `npx remotion render DemoVideo` |
| Camera and voice | Aichen | Part 2's talking head and narration, recorded against the finished cut |
| Music | Aichen | A licensed royalty-free track; the rules disqualify assets used without the rights to them |

The footage and renders stay out of git; any machine with the servers running makes them again.

## Still to do

- Record the narration and the camera, and put the camera in the round frame in place of the placeholder.
- Music for Part 1, and quietly under Part 2.
- Record the primer again with its first-game note dismissed after the rule change, so the table is clear while the rules change and the board is painted.

## Where each part scores

| Rubric | Where |
| --- | --- |
| Impact (30%) | The game-night story: friends at one table by a link, an empty seat filled, house rules |
| Use of Meta AI tooling (25%) | The mochi naming each model in Part 1; Part 2's walk through what each model does, and the four named in "why" |
| Technical depth (20%) | Rules written as code, a thousand test games, repair, the painted tiles checked by SAM 3.1; the README carries the numbers |
| Demo (25%) | All of Part 1; the real game made, played and shared in Part 2 |

## A 30-second cut for X

For the Most Viral prize, Part 1 cut vertically (1080 × 1920): the open, the question, friends joining, the table, the rivals talking, the close with **boarddream.pages.dev**. Captions instead of voice.
