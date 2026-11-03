# BoardDream demo video

The demo video's edit, in [Remotion](https://www.remotion.dev): Part 1 (`src/Reel.tsx`), a fast reel of the app, and Part 2 (`src/Primer.tsx`), the builder's primer over one continuous take; the plan is in [docs/VIDEO.md](../../docs/VIDEO.md). The mochi that guides the eye is the steamer game's (`src/MochiArt.tsx`, copied from the app).

```sh
npm i
node ../record/takes.mjs primer      # and friends, table, cards, rivals, painted: the footage, in public/footage
npm run dev                          # Remotion Studio, to preview
npx remotion render DemoVideo out/boarddream.mp4
node stills.mjs 150 2400             # single frames, to check a layout
```
