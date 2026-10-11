/**
 * Ironsworn and Starforged personality defaults. A character is an Ironsworn hero: steady, sworn to its companions.
 * A foe is read from what it is (the folder its compendium files it under: Ironlanders, Firstborn, Animals, Beasts,
 * Horrors, Anomalies; or its words), and its rank: the higher, the bolder. Pure, unit-tested.
 */
import { t, statName } from "./words.js";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** What kind of foe this is, from its compendium folder or its name and words. */
export function natureOf({ folder = "", name = "", text = "" } = {}) {
  const f = String(folder).toLowerCase();
  if ( /ironlander|human|firstborn|people|npc/.test(f) ) return f.includes("firstborn") ? "firstborn" : "people";
  if ( /animal/.test(f) ) return "animal";
  if ( /beast|creature/.test(f) ) return "beast";
  if ( /horror|undead|anomal/.test(f) ) return "horror";
  const words = `${name} ${text}`.toLowerCase();
  if ( /\b(?:bonewalker|haunt|hollow|sodden|revenant|ghost|wraith|wight|thrall|horde|abomination|husk)\b/.test(words) ) return "horror";
  if ( /\b(?:wolf|wolves|bear|boar|rat|gaunt|lion|spider|crab|newt|beast|wyvern|wyrm|mammoth|leviathan|basilisk|kraken|swarm|stampede|brood|mites|youngling)\b/.test(words) ) return "beast";
  if ( /\b(?:machine|drone|automaton|bot|dropship|colossus|sentinel)\b/.test(words) ) return "machine";
  return "people";
}

/** Who can be talked to: people and the Firstborn (and anyone, if the GM ignores languages). */
export const speaks = nature => nature === "people" || nature === "firstborn";

/**
 * @param {object} d
 * @param {boolean} d.pc
 * @param {number} [d.rank]    1 troublesome ... 5 epic
 * @param {string} [d.nature]  people | firstborn | animal | beast | horror | machine
 * @param {object} [d.stats]   a character's edge, heart, iron, shadow, wits
 * @returns {{traits, flags, reasons}}
 */
export function deriveIronswornTraits({ pc, rank = 2, nature = "people", stats = {} }) {
  const reasons = {};
  const flags = {};
  if ( pc ) {
    // Wits makes a tactician; heart, a steady and loyal one; iron, a bold one; shadow, a little more self-serving.
    const tactical = clamp(50 + 6 * (stats.wits ?? 1), 40, 80);
    const brave = clamp(55 + 5 * (stats.iron ?? 1) + 3 * (stats.heart ?? 1), 45, 90);
    const selfish = clamp(25 + 4 * (stats.shadow ?? 1) - 3 * (stats.heart ?? 1), 5, 60);
    const loyal = clamp(60 + 5 * (stats.heart ?? 1), 50, 95);
    reasons.tactical = `${statName("wits")} ${stats.wits ?? 1}`;
    reasons.brave = `${statName("iron")} ${stats.iron ?? 1}, ${statName("heart")} ${stats.heart ?? 1}`;
    reasons.selfish = `${statName("shadow")} ${stats.shadow ?? 1}`;
    reasons.loyal = t("Reason.Sworn", { heart: statName("heart"), n: stats.heart ?? 1 });
    return { traits: { tactical, brave, selfish, loyal }, flags, reasons };
  }
  const r = clamp(Number(rank) || 2, 1, 5);
  const base = {
    people: { tactical: 50, brave: 50, selfish: 50, loyal: 55 },
    firstborn: { tactical: 60, brave: 60, selfish: 45, loyal: 60 },
    animal: { tactical: 20, brave: 45, selfish: 65, loyal: 50 },
    beast: { tactical: 25, brave: 65, selfish: 60, loyal: 40 },
    horror: { tactical: 30, brave: 90, selfish: 70, loyal: 30 },
    machine: { tactical: 45, brave: 90, selfish: 40, loyal: 80 }
  }[nature] ?? { tactical: 50, brave: 50, selfish: 50, loyal: 50 };
  const traits = { ...base, brave: clamp(base.brave + 5 * (r - 2), 5, 100) };
  const kind = t(`Nature.${nature}`, nature);
  reasons.tactical = kind;
  reasons.brave = t("Reason.Rank", { nature: kind, r });
  reasons.selfish = kind;
  reasons.loyal = kind;
  if ( nature === "horror" || nature === "machine" ) flags.fearless = true;
  if ( nature === "animal" || nature === "beast" ) flags.beast = true;
  return { traits, flags, reasons };
}
