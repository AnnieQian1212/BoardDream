# BoardDream demo video

The demo video's edit, in [Remotion](https://www.remotion.dev): Part 1 (`src/Reel.tsx`), a fast reel of the app, and Part 2 (`src/Primer.tsx`), the builder's primer, each a list of scenes with a handover at every cut (`src/timeline.tsx`; the pieces in `src/fx.tsx`). The plan is in [docs/VIDEO.md](../../docs/VIDEO.md).

```sh
npm i
# with the app running (web on :5173, API on :8787), record the footage into public/footage:
node ../record/takes.mjs make            # then after --game=<the made game's id>, friends, rivals, table, cards, painted
npm run dev                              # Remotion Studio, to preview
npx remotion render DemoVideo out/boarddream.mp4   # 2560 x 1440 at 60 fps (remotion.config.ts)
node stills.mjs 150 2400                 # single frames, to check a layout
```
