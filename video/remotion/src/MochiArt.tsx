// Copied from apps/web/src/components/MochiArt.tsx (the mochi steamer's friends) for the demo video,
// where the sakura mochi guides the eye. Keep the drawings in step with the app's.
import { memo, type ReactNode } from "react";

/**
 * The friends of the mochi steamer, drawn like the pieces on the game table: round bodies in dark
 * brown ink, flat color in the table's ochre, rust, moss and slate, a shaded band along the lower
 * right with a few hatch strokes in it, and a painted gleam on the upper left.
 */

const INK = "var(--m-line, #33241a)";
const W = 4.2;
const CHEEK = "#d9785a";
const LIGHT = "#fff6e2";

export type Mood = "idle" | "happy";

/** Body outlines, each sitting on the bottom of a 100 × 100 box, and the shade along each. */
const DROP = "M50 26C56 38 78 55 78 72C78 86 66 93 50 93C34 93 22 86 22 72C22 55 44 38 50 26Z";
const DROP_SHADE = "M32 89C40 93 45 93 50 93C66 93 78 86 78 72C78 65 75 58 70 51C72 70 62 84 32 89Z";
const BLOB = "M50 34C75 34 91 50 91 69C91 85 74 92 50 92C26 92 9 85 9 69C9 50 25 34 50 34Z";
const BLOB_SHADE = "M24 89C34 92 42 92 50 92C74 92 91 85 91 69C91 62 89 57 86 52C86 72 70 85 24 89Z";
const ROUND = "M50 27C76 27 91 45 91 66C91 84 74 92 50 92C26 92 9 84 9 66C9 45 24 27 50 27Z";
const ROUND_SHADE = "M24 89C34 92 42 92 50 92C74 92 91 84 91 66C91 58 89 51 85 45C86 68 72 83 24 89Z";

/** A flat body with its shade, hatching and gleam, and whatever is painted on it, inked round. */
function Body({ d, shade, fill, dark, hatch, gleam, children }: { d: string; shade: string; fill: string; dark: string; hatch: string; gleam: string; children?: ReactNode }) {
  return (
    <>
      <path d={d} fill={fill} />
      <path d={shade} fill={dark} />
      <path d={hatch} stroke={INK} strokeWidth={1.7} strokeLinecap="round" opacity={0.45} />
      <path d={gleam} fill="none" stroke={LIGHT} strokeWidth={3.4} strokeLinecap="round" opacity={0.9} />
      {children}
      <path d={d} fill="none" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
    </>
  );
}

const blob = (fill: string, dark: string, children?: ReactNode) => (
  <Body d={BLOB} shade={BLOB_SHADE} fill={fill} dark={dark} hatch="M66 85l6-4M73 81l6-5M79 75l5-5" gleam="M19 63C21 55 27 48 35 45">
    {children}
  </Body>
);
const round = (fill: string, dark: string, children?: ReactNode) => (
  <Body d={ROUND} shade={ROUND_SHADE} fill={fill} dark={dark} hatch="M66 85l6-4M73 80l6-5M79 73l5-5" gleam="M19 58C21 47 28 39 37 35">
    {children}
  </Body>
);

function Eye({ x, y, mood, sleepy, light }: { x: number; y: number; mood: Mood; sleepy?: boolean; light?: boolean }) {
  const color = light ? LIGHT : INK;
  if (mood === "happy") return <path d={`M${x - 4.4} ${y + 1.5}Q${x} ${y - 4.8} ${x + 4.4} ${y + 1.5}`} fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" />;
  if (sleepy) return <path d={`M${x - 4.2} ${y - 0.5}Q${x} ${y + 3.8} ${x + 4.2} ${y - 0.5}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />;
  return (
    <>
      <ellipse cx={x} cy={y} rx={3.9} ry={4.9} fill={color} />
      <circle cx={x + 1.3} cy={y - 1.7} r={1.4} fill={light ? INK : LIGHT} />
    </>
  );
}

type Mouth = "smile" | "cat" | "beak" | "none";

/** Eyes, cheeks and a mouth, centered under `y` with the eyes `spread` from the middle. */
function Face({ y, spread = 12, mood, mouth = "smile", sleepy }: { y: number; spread?: number; mood: Mood; mouth?: Mouth; sleepy?: boolean }) {
  const l = 50 - spread;
  const r = 50 + spread;
  let m: ReactNode = null;
  if (mood === "happy" && (mouth === "smile" || mouth === "cat")) m = <path d={`M45.5 ${y + 5.5}Q50 ${y + 12.5} 54.5 ${y + 5.5}Z`} fill="#c8613f" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />;
  else if (mouth === "smile") m = <path d={`M46.5 ${y + 6}Q50 ${y + 9.5} 53.5 ${y + 6}`} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />;
  else if (mouth === "cat") m = <path d={`M44.5 ${y + 6}Q47.2 ${y + 9} 50 ${y + 6}Q52.8 ${y + 9} 55.5 ${y + 6}`} fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />;
  else if (mouth === "beak") m = <path d={`M45.5 ${y + 5}L50 ${y + 2}L54.5 ${y + 5}L50 ${y + 8.5}Z`} fill="#c8613f" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />;
  return (
    <>
      <ellipse cx={l - 8} cy={y + 6.5} rx={5.4} ry={3.2} fill={CHEEK} opacity={0.5} />
      <ellipse cx={r + 8} cy={y + 6.5} rx={5.4} ry={3.2} fill={CHEEK} opacity={0.5} />
      <Eye x={l} y={y} mood={mood} sleepy={sleepy} />
      <Eye x={r} y={y} mood={mood} sleepy={sleepy} />
      {m}
    </>
  );
}

/** A four-pointed twinkle. */
function Twinkle({ x, y, r }: { x: number; y: number; r: number }) {
  return <path d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`} fill="#f3d27a" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />;
}

const leaf = (d: string) => <path d={d} fill="#7f9a48" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />;

const DRAW: ((mood: Mood) => ReactNode)[] = [
  // Dewdrop: a sleepy drop of steam.
  (mood) => (
    <>
      <Body d={DROP} shade={DROP_SHADE} fill="#a9ccd6" dark="#86abba" hatch="M62 85l5-4M68 80l5-4" gleam="M31 66C32 58 37 50 43 44" />
      <Face y={73} spread={9} mood={mood} sleepy />
    </>
  ),
  // Mochi.
  (mood) => (
    <>
      {blob("#f4e6c8", "#ddc79c")}
      <Face y={66} mood={mood} />
    </>
  ),
  // Sakura mochi: a blossom and a leaf on top.
  (mood) => (
    <>
      {blob("#e8ad9c", "#d18c79")}
      {leaf("M55 35C47 25 37 26 34 31C40 37 48 37 55 35Z")}
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={61 + 5 * Math.sin((a * Math.PI) / 180)} cy={31 - 5 * Math.cos((a * Math.PI) / 180)} r={4.4} fill="#e9a08e" stroke={INK} strokeWidth={2} />
      ))}
      <circle cx={61} cy={31} r={3} fill="#e8b84a" stroke={INK} strokeWidth={1.8} />
      <Face y={66} mood={mood} />
    </>
  ),
  // Matcha mochi: a sprout on top.
  (mood) => (
    <>
      <path d="M50 36C50 31 50 27 51 22" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      {leaf("M50.5 25C46 16 37 16 35 21C39 27 46 28 50.5 25Z")}
      {leaf("M51 23C55 13 66 12 68 17C64 24 57 25 51 23Z")}
      {blob("#b7c47c", "#97a85c")}
      <Face y={66} mood={mood} />
    </>
  ),
  // Chick: a tuft, little wings and a beak.
  (mood) => (
    <>
      {round("#eec35c", "#d6a53c")}
      <path d="M50 29C46 21 48 14 55 13C52 17 53 22 50 29Z" fill="#d6a53c" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M50 29C48 23 43 19 38 21C43 22 47 25 50 29Z" fill="#d6a53c" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <ellipse cx={12} cy={69} rx={6} ry={9.5} transform="rotate(28 12 69)" fill="#e2b04a" stroke={INK} strokeWidth={3} />
      <ellipse cx={88} cy={69} rx={6} ry={9.5} transform="rotate(-28 88 69)" fill="#d6a53c" stroke={INK} strokeWidth={3} />
      <Face y={62} mood={mood} mouth="beak" />
    </>
  ),
  // Bunny: long ears.
  (mood) => (
    <>
      {[
        [37, -10],
        [63, 10],
      ].map(([x, a]) => (
        <g key={x} transform={`rotate(${a} ${x} 34)`}>
          <ellipse cx={x} cy={21} rx={7.6} ry={18} fill="#e9dfcd" stroke={INK} strokeWidth={W} />
          <ellipse cx={x} cy={23} rx={3.4} ry={11.5} fill="#e2a493" />
        </g>
      ))}
      {round("#e9dfcd", "#d0c0a5")}
      <ellipse cx={50} cy={66.5} rx={2.6} ry={1.9} fill="#c8613f" />
      <Face y={62} mood={mood} mouth="cat" />
    </>
  ),
  // Kitty: pointed ears, stripes and whiskers.
  (mood) => (
    <>
      <path d="M16 52L19 16L46 30Z" fill="#df9a62" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M84 52L81 16L54 30Z" fill="#df9a62" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      {round(
        "#df9a62",
        "#c67b45",
        <>
          <path d="M23 40L24 25L35 31Z" fill="#ebb3a0" />
          <path d="M77 40L76 25L65 31Z" fill="#ebb3a0" />
          <path d="M50 30V38M42 32L43.5 37.5M58 32L56.5 37.5" stroke="#9e5530" strokeWidth={3.2} strokeLinecap="round" />
        </>,
      )}
      <path d="M21 70L8 68M21 74L8 77M79 70L92 68M79 74L92 77" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <ellipse cx={50} cy={66.5} rx={2.4} ry={1.8} fill="#9e4a32" />
      <Face y={62} mood={mood} mouth="cat" />
    </>
  ),
  // Bear: round ears and a muzzle.
  (mood) => (
    <>
      {[24, 76].map((x) => (
        <g key={x}>
          <circle cx={x} cy={35} r={11} fill="#b07d50" stroke={INK} strokeWidth={W} />
          <circle cx={x} cy={35} r={5.5} fill="#d9b48a" />
        </g>
      ))}
      {round("#b07d50", "#93643c")}
      <ellipse cx={50} cy={71} rx={12.5} ry={8.8} fill="#efdbb6" stroke={INK} strokeWidth={2.8} />
      <ellipse cx={50} cy={67.5} rx={3.8} ry={2.7} fill={INK} />
      {mood === "happy" ? (
        <path d="M45.5 72Q50 79 54.5 72Z" fill="#c8613f" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      ) : (
        <path d="M46.5 72.5Q50 76 53.5 72.5" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      )}
      <Face y={60} spread={14} mood={mood} mouth="none" />
    </>
  ),
  // Panda: dark ears and patches.
  (mood) => (
    <>
      {[24, 76].map((x) => (
        <circle key={x} cx={x} cy={35} r={10.5} fill="#3a2c22" stroke={INK} strokeWidth={W} />
      ))}
      {round(
        "#f6eedd",
        "#dccfb3",
        <>
          <ellipse cx={37} cy={63} rx={7.6} ry={9.6} transform="rotate(32 37 63)" fill="#3a2c22" />
          <ellipse cx={63} cy={63} rx={7.6} ry={9.6} transform="rotate(-32 63 63)" fill="#3a2c22" />
        </>,
      )}
      <ellipse cx={24} cy={71} rx={5} ry={3} fill={CHEEK} opacity={0.5} />
      <ellipse cx={76} cy={71} rx={5} ry={3} fill={CHEEK} opacity={0.5} />
      <Eye x={38} y={62} mood={mood} light />
      <Eye x={62} y={62} mood={mood} light />
      <ellipse cx={50} cy={70} rx={3.2} ry={2.3} fill="#3a2c22" />
      {mood === "happy" ? (
        <path d="M46 73.5Q50 80 54 73.5Z" fill="#c8613f" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      ) : (
        <path d="M45.5 73.5Q47.8 76 50 73.5Q52.2 76 54.5 73.5" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      )}
    </>
  ),
  // Moon: golden, crowned and twinkling.
  (mood) => (
    <>
      {round("#ebc15a", "#d1a03a")}
      <path d="M32 34L34 15L43 25L50 10L57 25L66 15L68 34Z" fill="#d99a2b" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M34 30H66" stroke="#b5791c" strokeWidth={2.4} />
      <circle cx={34} cy={15} r={2.9} fill="#c8613f" stroke={INK} strokeWidth={1.8} />
      <circle cx={50} cy={10} r={3.3} fill="#4fa3a5" stroke={INK} strokeWidth={1.8} />
      <circle cx={66} cy={15} r={2.9} fill="#c8613f" stroke={INK} strokeWidth={1.8} />
      <Twinkle x={11} y={33} r={6.5} />
      <Twinkle x={90} y={42} r={5} />
      <Face y={63} mood={mood} />
    </>
  ),
];

/** One of the friends, drawn to fill its box. */
export const MochiArt = memo(function MochiArt({ friend, mood = "idle", className }: { friend: number; mood?: Mood; className?: string }) {
  return (
    <svg className={className} width="100%" height="100%" viewBox="0 0 100 100" overflow="visible" aria-hidden>
      {DRAW[friend]?.(mood)}
    </svg>
  );
});

/** The bamboo steamer's basket, with a face. */
export function SteamerBase() {
  return (
    <svg viewBox="0 0 100 56" aria-hidden>
      <rect x={7} y={4} width={86} height={48} rx={14} fill="#d9a866" />
      <path d="M93 18V38C93 46 87 52 79 52H40C70 48 86 36 93 18Z" fill="#bf8c4c" />
      <path d="M8.5 19H91.5M8.5 37H91.5" stroke="#8d5e30" strokeWidth={2.6} />
      <path d="M20 5V18M35 5V18M50 5V18M65 5V18M80 5V18M20 38V51M35 38V51M50 38V51M65 38V51M80 38V51" stroke={INK} strokeWidth={1.6} opacity={0.45} />
      <rect x={7} y={4} width={86} height={48} rx={14} fill="none" stroke={INK} strokeWidth={W} />
      <ellipse cx={30} cy={31} rx={5} ry={3} fill={CHEEK} opacity={0.5} />
      <ellipse cx={70} cy={31} rx={5} ry={3} fill={CHEEK} opacity={0.5} />
      <ellipse cx={40} cy={27} rx={2.8} ry={3.4} fill={INK} />
      <ellipse cx={60} cy={27} rx={2.8} ry={3.4} fill={INK} />
      <path d="M46.5 31Q50 34.5 53.5 31" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}

/** The steamer's lid, which hops when a batch comes out. */
export function SteamerLid() {
  return (
    <svg viewBox="0 0 100 40" aria-hidden>
      <rect x={42} y={3} width={16} height={10} rx={4.5} fill="#b9814a" stroke={INK} strokeWidth={3} />
      <path d="M6 35C10 12 90 12 94 35Z" fill="#e2b878" />
      <path d="M60 18C76 20 90 26 93 34L66 34C66 28 64 22 60 18Z" fill="#c99a5c" />
      <path d="M24 33C27 22 38 18 50 18M76 33C73 22 62 18 50 18" fill="none" stroke={INK} strokeWidth={1.6} opacity={0.5} />
      <path d="M6 35C10 12 90 12 94 35" fill="none" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <rect x={3} y={31} width={94} height={8} rx={4} fill="#c99a5c" stroke={INK} strokeWidth={3} />
    </svg>
  );
}
