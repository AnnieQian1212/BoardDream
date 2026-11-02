# The 3-minute demo video

Judges score Impact (30%), Use of Meta AI tooling (25%), Technical depth (20%) and Demo (25%), and the video is one of the main things they judge. The rules also say the demo may only show what was built during the hackathon, which is all of BoardDream.

One message to land: **a sentence becomes a board game that has been playtested a thousand times, and you can play it tonight, against Meta's models or with friends.**

The narration below is about 390 words, which fills three minutes at an easy pace. Times are targets; cut words before cutting shots.

## Before recording

- Screen at 1920 × 1080, the browser full screen (F11), zoom 100%, no bookmarks bar, notifications off. Use a large cursor and move it slowly.
- Run the full server locally with `.env` set, so generation, art, Muse Spark opponents and tables with friends all work.
- Tidy the game list: delete weak or old generated games, so the library and the home row look chosen.
- Make the hero game in advance, two or three times from the same idea, and keep the best take. A take where one check fails and the repair fixes it is the best one to show. Suggested idea: **Cafes on one busy street** (an example on the home page; worker-placement ideas passed 4 of 4 first drafts in the benchmark), with one or two Advanced settings changed on camera.
- Record each scene on its own (OBS or similar) and cut them together. Generation takes about three minutes: show it sped up, with "sped up" on screen and the real time from the steps panel.
- For the friends scene, two windows side by side: a normal one and an incognito one, each signed in with its own test account.
- For the opponents scene, open Fenlight without `&bots` so Muse Spark Open plays and talks.

## Scenes

### 1. Cold open (0:00–0:12)

**On screen:** the home page; type the idea and press **Dream it up**. Hard cut to the finished game on the 3D table, a card flashing gold as its ability fires.

**Say:** "This board game didn't exist three minutes ago. I typed one sentence, and BoardDream designed it, playtested it a thousand times, and dealt me in."

### 2. Who it is for (0:12–0:25)

**On screen:** back on the home page; open **Advanced settings** and change the board and how to win.

**Say:** "Trying out a board game idea usually takes weeks of paper prototypes and friends playing broken rules. BoardDream is for hobby players and designers who want to play the idea tonight. You can steer it: players, length, board, how to win, tone."

### 3. Making the game, sped up (0:25–1:05)

**On screen:** the steps on the left and the game assembling in the middle: the box cover, mechanic cards dealt from the library, the components, the rules; lines of code; the playtest squares; a failed check and its fix; bots playing the first draft on the table. Overlay "sped up · 3 min".

**Say:** "Muse Spark turns the idea into a plan, then finds building blocks in a library of 27 tested mechanics, from worker placement to tile laying. It rewrites the search and reranks the results, which lifts retrieval from 0.81 to 0.97 nDCG on our benchmark. Then it writes the rules as real code on those blocks. Nothing reaches you untested: bots play a thousand random games, and any crash, endless game or dead end goes back to the model to fix. Then a planning bot plays against random ones, to check that thinking ahead wins. On 24 hobby-game ideas, every one passed within one repair, for about 17 cents each."

### 4. Playing it (1:05–1:40)

**On screen:** the new game on the table: the guide pulsing on the clickable spots, a move, cards setting each other off, tokens falling, the pointer rippling water. Then Fenlight: Muse Spark Open players' lines appearing, an accusation, a vote.

**Say:** "Then you play it on a 3D table that runs on a laptop. A guide shows what you can do each turn, and cards that set each other off light up. Your opponents can be Muse Spark Open, Meta's open-weight model, served on Baseten. They don't just pick moves, they talk: in Fenlight, a hidden-role game, they argue from the evidence, accuse each other and vote."

### 5. Changing the rules (1:40–2:00)

**On screen:** **Designer**, then **Balance**: drag a slider and watch the seat win rates move. Then **Rules**, **Change the rules**: type a change and cut to the result, "Version 2" beside the name.

**Say:** "Don't like a rule? Drag a slider and the balance updates from simulated games. Or ask for a change in plain words: Muse Spark rewrites the game, and it goes through the same tests before it's saved as version two."

### 6. Art, paper and friends (2:00–2:25)

**On screen:** the games page, its painted covers; a painted board. **Print and play** for a second. Then **Invite friends**: the lobby, **Copy**, the friend's window joining, **Start the game**, a move in each window.

**Say:** "Muse Image paints every cover, card and board, and SAM 3.1 checks that each painted tile lines up with the real board. You can print a game and play it on paper, or invite friends with a link: they sign in and sit down, the server referees every move, and bots fill the empty seats."

### 7. The numbers (2:25–2:48)

**On screen:** **Behind the scenes**, scrolling slowly: the generation benchmark, retrieval, opponents, the demo games' balance.

**Say:** "Every claim here is measured: the generation benchmark, retrieval quality, the opponents and the balance of every demo game are on this page, and each number links to its eval in the repository."

### 8. Close (2:48–3:00)

**On screen:** the home page, with **boarddream.pages.dev** and the GitHub link over it.

**Say:** "All of this was built during the hackathon. Play the demo at boarddream.pages.dev. Describe a game, and play it tonight."

## Where each part scores

| Rubric | Scenes |
| --- | --- |
| Impact (30%) | 2 (who it is for), 6 (paper and friends), 8 |
| Use of Meta AI tooling (25%) | 3 (Muse Spark designs, searches and writes code), 4 (Muse Spark Open opponents), 5 (revisions), 6 (Muse Image and SAM 3.1) |
| Technical depth (20%) | 3 (retrieval, a thousand test games, repair, the planner check), 7 |
| Demo (25%) | 1, 4 and 6: the live table, the AI players talking, friends at one table |

## A short cut for X

For the Most Viral prize, a 30-second vertical cut: scene 1, five seconds of scene 3, the table and the Fenlight talk from scene 4, and the link. No narration needed; captions instead.
