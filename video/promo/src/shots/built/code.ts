// Three excerpts of BoardDream's own source, written during the hackathon. Lines are copied from the
// files as they stand; long calls are wrapped the way Prettier would, and skipped lines are marked
// with "// …".
export type CodeWin = { step: string; path: string; label: string; lines: string[]; hot: number };

export const WINDOWS: CodeWin[] = [
  {
    step: "01",
    path: "apps/server/src/agent/designer.ts",
    label: "Plan, mechanics, rules as code, fuzz, repair",
    hot: 0,
    lines: [
      "/** Prompt + dials -> spec -> retrieved mechanics -> rules code -> fuzz/repair loop. */",
      "// …",
      "  for (let attempt = 0; ; attempt++) {",
      "    const check = await checker(source, {",
      "      runs: fuzzRuns, signal,",
      '      onProgress: (done, total) => onEvent({ type: "checking", attempt, done, total }),',
      "    });",
      "    if (check.ok) passing = source;",
      "    // …",
      "    onProgress(`repairing: ${summarize(check)}`);",
      "    source = extractCode(",
      "      await write(repairMessages(brief, source, formatFailures(check)), deps),",
      "    );",
    ],
  },
  {
    step: "02",
    path: "packages/engine/src/fuzz.ts",
    label: "1,000 strict games catch every broken rule",
    hot: 2,
    lines: [
      "/** Plays many random games in strict mode and groups every broken invariant it finds. */",
      "export function fuzz(game: GameModule, opts: FuzzOptions = {}): FuzzReport {",
      "  const { runs = 1000, seed = 1, maxTurns = 2000,",
      "    defaultParamShare = 0.25, determinismChecks = 20 } = opts;",
      "  for (let run = 0; run < runs; run++) {",
      "    const runSeed = rng.int(2 ** 31);",
      "    const matchOpts = { numPlayers, params, seed: runSeed, maxTurns, strict: true };",
      "    try {",
      "      const result = playMatch(game, matchOpts);",
      "      // …",
      "    } catch (err) {",
      "      // …",
      "      // Group failures that differ only in numbers (seat ids, turn counts, coordinates).",
      '      const key = `${v.kind}:${v.message.replace(/\\d+/g, "#")}`;',
    ],
  },
  {
    step: "03",
    path: "apps/server/src/art/board.ts",
    label: "Muse Image paints, SAM 3.1 checks every tile",
    hot: 6,
    lines: [
      '  step("painting the board");',
      "  const raw = await edit(client, models.image, prompt, [guide], size, signal);",
      "  // Lined up with the geometry before SAM checks it and before tiles are cut from it.",
      "  let { png: painted, registration } = lineUp(raw, geometry);",
      "",
      '  step("checking every tile with SAM 3.1");',
      "  let scores = await checkAlignment(client, models.sam, geometry, painted, signal);",
      "  const first = summarize(scores);",
      "  if (first.alignedShare < 0.5) {",
      '    step("painting the board again");',
      "    // …",
    ],
  },
];
