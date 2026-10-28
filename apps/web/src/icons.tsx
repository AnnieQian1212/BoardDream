import type { ResourceSpec } from "@boarddream/engine";
import {
  Anchor,
  Bean,
  BrickWall,
  Circle,
  Cloud,
  Coins,
  Crown,
  Droplet,
  Egg,
  Feather,
  Fish,
  Flame,
  Flower2,
  Gem,
  Hammer,
  Heart,
  Hexagon,
  Leaf,
  LeafyGreen,
  Mountain,
  Nut,
  Pickaxe,
  Shapes,
  Shell,
  Shield,
  Shovel,
  Sparkles,
  Sprout,
  Star,
  Sun,
  TreeDeciduous,
  TreePine,
  Trees,
  Umbrella,
  Waves,
  Wheat,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Icons a game may name for its resources (ResourceSpec.icon). */
export const RESOURCE_ICONS: Record<string, LucideIcon> = {
  anchor: Anchor,
  brick: BrickWall,
  cloud: Cloud,
  coins: Coins,
  crown: Crown,
  droplet: Droplet,
  egg: Egg,
  feather: Feather,
  fish: Fish,
  flame: Flame,
  flower: Flower2,
  gem: Gem,
  hammer: Hammer,
  heart: Heart,
  leaf: Leaf,
  mountain: Mountain,
  pickaxe: Pickaxe,
  shield: Shield,
  shovel: Shovel,
  sprout: Sprout,
  star: Star,
  sun: Sun,
  tree: TreePine,
  trees: Trees,
  wheat: Wheat,
  zap: Zap,
};

export const iconFor = (name: string | undefined): LucideIcon => (name && RESOURCE_ICONS[name]) || Circle;

const TAG_STYLES: Record<string, { color: string; icon: LucideIcon }> = {
  herb: { color: "#5f9e4f", icon: LeafyGreen },
  flower: { color: "#d4648c", icon: Flower2 },
  tree: { color: "#3d7a4f", icon: TreeDeciduous },
  succulent: { color: "#3f9c93", icon: Sprout },
  aquatic: { color: "#3a86c8", icon: Waves },
  fungus: { color: "#9a7350", icon: Umbrella },
  fern: { color: "#4f8f4b", icon: Leaf },
  exotic: { color: "#8b5fc4", icon: Sparkles },
  // Map terrains.
  forest: { color: "#4f8a4a", icon: TreePine },
  quarry: { color: "#7d808a", icon: Mountain },
  fields: { color: "#c4932a", icon: Wheat },
  reef: { color: "#3f8fc8", icon: Fish },
  lagoon: { color: "#2f9c93", icon: Waves },
};

const FALLBACK_COLORS = ["#c9774a", "#4f8fb8", "#8b6fc0", "#4c9a7a", "#c45d6a", "#b08d3c", "#5c7ccc", "#7a9a3f"];
const FALLBACK_ICONS = [Shapes, Hexagon, Gem, Star, Feather, Shell, Bean, Nut];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Accent color and art icon for a card's first tag; unknown tags get a stable pick. */
export function tagStyle(tag: string | undefined): { color: string; icon: LucideIcon } {
  if (!tag) return { color: "#8a8172", icon: Shapes };
  const known = TAG_STYLES[tag.toLowerCase()];
  if (known) return known;
  const h = hash(tag);
  return { color: FALLBACK_COLORS[h % FALLBACK_COLORS.length], icon: FALLBACK_ICONS[h % FALLBACK_ICONS.length] };
}

export const resourceById = (resources: ResourceSpec[] | undefined) => new Map((resources ?? []).map((r) => [r.id, r]));
