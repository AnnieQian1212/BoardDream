import { memo, type ReactNode } from "react";

/** The friends of the mochi steamer, drawn round and soft: a body, a face, and what makes each one. */

const LINE = "var(--m-line, #5b3f37)";
const CHEEK = "#ff8fab";
const W = 3.2;

export type Mood = "idle" | "happy";

/** Body outlines, each sitting on the bottom of a 100 × 100 box. */
const DROP = "M50 26C56 38 78 55 78 72C78 86 66 93 50 93C34 93 22 86 22 72C22 55 44 38 50 26Z";
const BLOB = "M50 34C75 34 91 50 91 69C91 85 74 92 50 92C26 92 9 85 9 69C9 50 25 34 50 34Z";
const ROUND = "M50 27C76 27 91 45 91 66C91 84 74 92 50 92C26 92 9 84 9 66C9 45 24 27 50 27Z";

function Body({ d, fill }: { d: string; fill: string }) {
  return <path d={d} fill={fill} stroke={LINE} strokeWidth={W} strokeLinejoin="round" />;
}

/** A soft gleam on the upper left. */
function Shine({ x, y }: { x: number; y: number }) {
  return (
    <>
      <ellipse cx={x} cy={y} rx={8} ry={4.4} transform={`rotate(-32 ${x} ${y})`} fill="#fff" opacity={0.75} />
      <circle cx={x + 10} cy={y - 5} r={2} fill="#fff" opacity={0.75} />
    </>
  );
}

function Eye({ x, y, mood, sleepy, color = LINE }: { x: number; y: number; mood: Mood; sleepy?: boolean; color?: string }) {
  if (mood === "happy") return <path d={`M${x - 4.2} ${y + 1.5}Q${x} ${y - 4.5} ${x + 4.2} ${y + 1.5}`} fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" />;
  if (sleepy) return <path d={`M${x - 4} ${y - 0.5}Q${x} ${y + 3.5} ${x + 4} ${y - 0.5}`} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />;
  return (
    <>
      <ellipse cx={x} cy={y} rx={3.6} ry={4.4} fill={color} />
      <circle cx={x + 1.3} cy={y - 1.6} r={1.4} fill="#fff" />
    </>
  );
}

type Mouth = "smile" | "cat" | "beak" | "none";

/** Eyes, cheeks and a mouth, centered under `y` with the eyes `spread` from the middle. */
function Face({ y, spread = 12, mood, mouth = "smile", sleepy, cheeks = true }: { y: number; spread?: number; mood: Mood; mouth?: Mouth; sleepy?: boolean; cheeks?: boolean }) {
  const l = 50 - spread;
  const r = 50 + spread;
  let m: ReactNode = null;
  if (mood === "happy" && (mouth === "smile" || mouth === "cat")) m = <path d={`M45.5 ${y + 5.5}Q50 ${y + 12.5} 54.5 ${y + 5.5}Z`} fill="#e86a86" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />;
  else if (mouth === "smile") m = <path d={`M46.5 ${y + 6}Q50 ${y + 9.5} 53.5 ${y + 6}`} fill="none" stroke={LINE} strokeWidth={2.4} strokeLinecap="round" />;
  else if (mouth === "cat") m = <path d={`M44.5 ${y + 6}Q47.2 ${y + 9} 50 ${y + 6}Q52.8 ${y + 9} 55.5 ${y + 6}`} fill="none" stroke={LINE} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />;
  else if (mouth === "beak") m = <path d={`M45.5 ${y + 5}L50 ${y + 2}L54.5 ${y + 5}L50 ${y + 8.5}Z`} fill="#ff9b3d" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />;
  return (
    <>
      {cheeks && (
        <>
          <ellipse cx={l - 8} cy={y + 6.5} rx={5.6} ry={3.3} fill={CHEEK} opacity={0.55} />
          <ellipse cx={r + 8} cy={y + 6.5} rx={5.6} ry={3.3} fill={CHEEK} opacity={0.55} />
        </>
      )}
      <Eye x={l} y={y} mood={mood} sleepy={sleepy} />
      <Eye x={r} y={y} mood={mood} sleepy={sleepy} />
      {m}
    </>
  );
}

/** A four-pointed twinkle. */
function Twinkle({ x, y, r }: { x: number; y: number; r: number }) {
  return <path d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`} fill="#fff1a6" stroke={LINE} strokeWidth={1.5} strokeLinejoin="round" />;
}

const DRAW: ((mood: Mood) => ReactNode)[] = [
  // Dewdrop: a sleepy drop of steam.
  (mood) => (
    <>
      <Body d={DROP} fill="#cdeeff" />
      <Shine x={36} y={58} />
      <Face y={73} spread={9} mood={mood} sleepy />
    </>
  ),
  // Mochi.
  (mood) => (
    <>
      <Body d={BLOB} fill="#fff8ec" />
      <Shine x={28} y={52} />
      <Face y={66} mood={mood} />
    </>
  ),
  // Sakura mochi: pink, a blossom and a leaf on top.
  (mood) => (
    <>
      <Body d={BLOB} fill="#ffd3df" />
      <path d="M55 34C47 25 37 26 34 31C40 37 48 37 55 34Z" fill="#9ed27f" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={61 + 5 * Math.sin((a * Math.PI) / 180)} cy={31 - 5 * Math.cos((a * Math.PI) / 180)} r={4.4} fill="#ff9fbd" stroke={LINE} strokeWidth={1.8} />
      ))}
      <circle cx={61} cy={31} r={3} fill="#ffd66b" stroke={LINE} strokeWidth={1.6} />
      <Shine x={28} y={52} />
      <Face y={66} mood={mood} />
    </>
  ),
  // Matcha mochi: green, with a sprout.
  (mood) => (
    <>
      <path d="M50 36C50 31 50 27 51 22" fill="none" stroke={LINE} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M50.5 25C46 16 37 16 35 21C39 27 46 28 50.5 25Z" fill="#86c25c" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M51 23C55 13 66 12 68 17C64 24 57 25 51 23Z" fill="#86c25c" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />
      <Body d={BLOB} fill="#d3eaa9" />
      <Shine x={28} y={52} />
      <Face y={66} mood={mood} />
    </>
  ),
  // Chick: a tuft, little wings and a beak.
  (mood) => (
    <>
      <Body d={ROUND} fill="#ffe17d" />
      <path d="M50 29C46 21 48 14 55 13C52 17 53 22 50 29Z" fill="#ffcf45" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M50 29C48 23 43 19 38 21C43 22 47 25 50 29Z" fill="#ffcf45" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" />
      <ellipse cx={12} cy={69} rx={6} ry={9.5} transform="rotate(28 12 69)" fill="#ffcf45" stroke={LINE} strokeWidth={2.6} />
      <ellipse cx={88} cy={69} rx={6} ry={9.5} transform="rotate(-28 88 69)" fill="#ffcf45" stroke={LINE} strokeWidth={2.6} />
      <Shine x={28} y={46} />
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
          <ellipse cx={x} cy={21} rx={7.6} ry={18} fill="#efe6ff" stroke={LINE} strokeWidth={W} />
          <ellipse cx={x} cy={23} rx={3.6} ry={12} fill="#ffc0d2" />
        </g>
      ))}
      <Body d={ROUND} fill="#efe6ff" />
      <Shine x={28} y={46} />
      <ellipse cx={50} cy={66.5} rx={2.6} ry={1.9} fill="#ff8fab" />
      <Face y={62} mood={mood} mouth="cat" />
    </>
  ),
  // Kitty: pointed ears, stripes and whiskers.
  (mood) => (
    <>
      <path d="M16 52L19 16L46 30Z" fill="#ffcf9f" stroke={LINE} strokeWidth={W} strokeLinejoin="round" />
      <path d="M84 52L81 16L54 30Z" fill="#ffcf9f" stroke={LINE} strokeWidth={W} strokeLinejoin="round" />
      <Body d={ROUND} fill="#ffcf9f" />
      <path d="M22 41L23 24L35 31Z" fill="#ffadb9" />
      <path d="M78 41L77 24L65 31Z" fill="#ffadb9" />
      <path d="M50 30V37M42 32L43.5 37M58 32L56.5 37" stroke="#e48a50" strokeWidth={3} strokeLinecap="round" />
      <path d="M20 70L8 68M20 74L8 77M80 70L92 68M80 74L92 77" stroke={LINE} strokeWidth={1.8} strokeLinecap="round" />
      <Shine x={28} y={46} />
      <ellipse cx={50} cy={66.5} rx={2.4} ry={1.8} fill="#e86a86" />
      <Face y={62} mood={mood} mouth="cat" />
    </>
  ),
  // Bear: round ears and a muzzle.
  (mood) => (
    <>
      {[24, 76].map((x) => (
        <g key={x}>
          <circle cx={x} cy={35} r={11} fill="#d9a676" stroke={LINE} strokeWidth={W} />
          <circle cx={x} cy={35} r={5.5} fill="#f2cfa6" />
        </g>
      ))}
      <Body d={ROUND} fill="#d9a676" />
      <ellipse cx={50} cy={71} rx={12.5} ry={8.8} fill="#f6e2c6" stroke={LINE} strokeWidth={2.4} />
      <ellipse cx={50} cy={67.5} rx={3.8} ry={2.7} fill={LINE} />
      {mood === "happy" ? (
        <path d="M45.5 72Q50 79 54.5 72Z" fill="#e86a86" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
      ) : (
        <path d="M46.5 72.5Q50 76 53.5 72.5" fill="none" stroke={LINE} strokeWidth={2.2} strokeLinecap="round" />
      )}
      <Shine x={28} y={46} />
      <Face y={60} spread={14} mood={mood} mouth="none" />
    </>
  ),
  // Panda: black ears and patches.
  (mood) => (
    <>
      {[24, 76].map((x) => (
        <circle key={x} cx={x} cy={35} r={10.5} fill="#3d3434" stroke={LINE} strokeWidth={W} />
      ))}
      <Body d={ROUND} fill="#ffffff" />
      <ellipse cx={37} cy={63} rx={7.6} ry={9.6} transform="rotate(32 37 63)" fill="#3d3434" />
      <ellipse cx={63} cy={63} rx={7.6} ry={9.6} transform="rotate(-32 63 63)" fill="#3d3434" />
      <ellipse cx={24} cy={71} rx={5} ry={3} fill={CHEEK} opacity={0.55} />
      <ellipse cx={76} cy={71} rx={5} ry={3} fill={CHEEK} opacity={0.55} />
      <Eye x={38} y={62} mood={mood} color="#fff" />
      <Eye x={62} y={62} mood={mood} color="#fff" />
      <ellipse cx={50} cy={70} rx={3.2} ry={2.3} fill="#3d3434" />
      {mood === "happy" ? (
        <path d="M46 73.5Q50 80 54 73.5Z" fill="#e86a86" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
      ) : (
        <path d="M45.5 73.5Q47.8 76 50 73.5Q52.2 76 54.5 73.5" fill="none" stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      )}
      <Shine x={28} y={46} />
    </>
  ),
  // Moon: golden, crowned and twinkling.
  (mood) => (
    <>
      <Body d={ROUND} fill="#ffe48f" />
      <path d="M32 34L34 15L43 25L50 10L57 25L66 15L68 34Z" fill="#ffc53d" stroke={LINE} strokeWidth={2.6} strokeLinejoin="round" />
      <circle cx={34} cy={15} r={2.8} fill="#ff8fb1" stroke={LINE} strokeWidth={1.6} />
      <circle cx={50} cy={10} r={3.2} fill="#8fd8ff" stroke={LINE} strokeWidth={1.6} />
      <circle cx={66} cy={15} r={2.8} fill="#ff8fb1" stroke={LINE} strokeWidth={1.6} />
      <Twinkle x={11} y={33} r={6.5} />
      <Twinkle x={90} y={42} r={5} />
      <Shine x={28} y={48} />
      <Face y={63} mood={mood} />
    </>
  ),
];

/** One of the friends, drawn to fill its box. */
export const MochiArt = memo(function MochiArt({ friend, mood = "idle", className }: { friend: number; mood?: Mood; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      {DRAW[friend]?.(mood)}
    </svg>
  );
});

/** The bamboo steamer's basket, with a face. */
export function SteamerBase() {
  return (
    <svg viewBox="0 0 100 56" aria-hidden>
      <rect x={7} y={4} width={86} height={48} rx={14} fill="#eac38b" stroke={LINE} strokeWidth={W} />
      <path d="M8.5 19H91.5M8.5 37H91.5" stroke="#c8955a" strokeWidth={2.4} />
      <path d="M20 5V18M35 5V18M50 5V18M65 5V18M80 5V18M20 38V51M35 38V51M50 38V51M65 38V51M80 38V51" stroke="#d6a76c" strokeWidth={1.8} />
      <ellipse cx={30} cy={31} rx={5} ry={3} fill={CHEEK} opacity={0.55} />
      <ellipse cx={70} cy={31} rx={5} ry={3} fill={CHEEK} opacity={0.55} />
      <ellipse cx={40} cy={27} rx={2.6} ry={3.2} fill={LINE} />
      <ellipse cx={60} cy={27} rx={2.6} ry={3.2} fill={LINE} />
      <path d="M46.5 31Q50 34.5 53.5 31" fill="none" stroke={LINE} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

/** The steamer's lid, which hops when a batch comes out. */
export function SteamerLid() {
  return (
    <svg viewBox="0 0 100 40" aria-hidden>
      <rect x={42} y={3} width={16} height={10} rx={4.5} fill="#d9a666" stroke={LINE} strokeWidth={2.6} />
      <path d="M6 35C10 12 90 12 94 35Z" fill="#f2d39d" stroke={LINE} strokeWidth={W} strokeLinejoin="round" />
      <path d="M24 33C27 22 38 18 50 18M76 33C73 22 62 18 50 18" fill="none" stroke="#d6a76c" strokeWidth={1.8} />
      <rect x={3} y={31} width={94} height={8} rx={4} fill="#e6bd80" stroke={LINE} strokeWidth={2.6} />
    </svg>
  );
}
