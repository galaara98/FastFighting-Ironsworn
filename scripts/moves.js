/**
 * Ironsworn and Starforged dice and combat moves, as numbers. Pure, unit-tested.
 *
 * An action roll is a d6 plus a stat and any adds (an action score of at most 10) against two challenge dice (d10s):
 * beat both for a strong hit, one for a weak hit, neither for a miss. Matching challenge dice on a miss make it dire.
 * A progress roll uses the progress score (0-10) instead, and momentum can't change it. Burning momentum sets the
 * action score to the momentum, after the dice are seen.
 *
 * In the engine's terms: a strong hit is a critical success (3), a weak hit a success (2), a miss a failure (1), and
 * a miss on matching dice a critical failure (0).
 */
import { t, moveName } from "./words.js";
import { part } from "./core.js";

/** How many ticks of a 40-tick track one mark of progress fills at each challenge rank (1 troublesome ... 5 epic). */
export const TICKS = Object.freeze({ 1: 12, 2: 8, 3: 4, 4: 2, 5: 1 });
export const TRACK = 40;
export const MOMENTUM = Object.freeze({ min: -6, max: 10, reset: 2 });
/** So much harm, as the engine's damage: no dice, only the number (a foe's rank, a strike's 1 or 2). */
export const harm = n => part([], n, "harm");

/**
 * The combat moves of each ruleset the system plays, by what they do here (the moves' names are the system's own):
 *  - strike, clash: harm inflicted (Ironsworn) or progress marked (Starforged) on a strong and a weak hit; `harm` says
 *    the weapon's harm counts (a deadly weapon's).
 *  - fray: Enter the Fray: the stats it may roll (besides +shadow to spring an ambush and +wits ambushed), and what a
 *    miss costs (Ironsworn: Pay the Price; Starforged: only a bad spot).
 *  - endure: Endure Harm: what shaking it off costs, whether a weak hit can trade momentum for health, what a miss
 *    costs.
 *  - finish, price, face: End the Fight / Take Decisive Action, Pay the Price, Face Death (they play alike here).
 *  - stress, desolation: Endure Stress (played as Endure Harm is, on spirit) and Face Desolation.
 *  - advantage: Secure an Advantage (Starforged's fight: Gain Ground), in control: what a strong and a weak hit give
 *    (`next`: +1 on the next move; `momentum`); a miss pays the price. aid: Aid Your Ally, the same for a friend
 *    (a strong hit in a fight puts both in control).
 * Ironsworn: Strike when you have the initiative, Clash when your foe does. Starforged: Strike in control, Clash in a
 * bad spot. Sundered Isles plays Starforged's moves, with its own Enter the Fray (which plays the same way).
 */
const CLASSIC = Object.freeze({
  strike: { key: "Strike", strong: 2, weak: 1, harm: true },
  // (A strong Clash: "find an opening", +1 harm.)
  clash: { key: "Clash", strong: 2, weak: 1, harm: true },
  finish: { key: "EndtheFight" },
  // (A strong hit: "take control", +1 on the next move here; a weak hit: +1 momentum.)
  advantage: { key: "SecureanAdvantage", strong: { next: 1, momentum: 0 }, weak: { next: 0, momentum: 1 } },
  aid: { key: "AidYourAlly" },
  fray: { key: "EntertheFray", stats: ["heart"], missMomentum: -1 },
  endure: { key: "EndureHarm", shakeCost: 1, weakTrade: false, miss: "momentum" },
  price: { key: "PaythePrice" },
  face: { key: "FaceDeath" },
  stress: { key: "EndureStress" },
  desolation: { key: "FaceDesolation" },
  control: { on: "hasinitiative", off: "losesinitiative" }
});
const STARFORGED = Object.freeze({
  strike: { key: "Strike", strong: 2, weak: 2 },
  clash: { key: "Clash", strong: 2, weak: 1 },
  finish: { key: "TakeDecisiveAction" },
  // (A strong hit: two of +2 momentum, +1 on the next move, progress; a weak hit: one, +1 on the next move here.)
  advantage: { key: "GainGround", strong: { next: 1, momentum: 2 }, weak: { next: 1, momentum: 0 } },
  aid: { key: "AidYourAlly" },
  fray: { key: "EntertheFray", stats: ["edge", "heart", "iron"], missMomentum: 0 },
  endure: { key: "EndureHarm", shakeCost: 0, weakTrade: true, miss: "worse" },
  price: { key: "PaythePrice" },
  face: { key: "FaceDeath" },
  stress: { key: "EndureStress" },
  desolation: { key: "FaceDesolation" },
  control: { on: "isincontrol", off: "isinabadspot" }
});
const SUNDERED_ISLES = Object.freeze({ ...STARFORGED, fray: { ...STARFORGED.fray } });

export const RULESETS = Object.freeze({ classic: CLASSIC, starforged: STARFORGED, sundered_isles: SUNDERED_ISLES });
/** The moves each ruleset has of its own (Sundered Isles has only a few: of the combat moves, Enter the Fray). */
const OWN_MOVES = Object.freeze({ classic: Object.keys(CLASSIC), starforged: Object.keys(STARFORGED), sundered_isles: ["fray"] });

/**
 * The moves a character makes in a fight. Following the character sheets (no preference): its own sheet's, always.
 * Preferring a ruleset the world has on: where that ruleset has a move of the same name, it's played as that ruleset
 * plays it. Moves called differently (End the Fight, Take Decisive Action) stay the character's own; so do the words for
 * who's in control.
 * @param {string} own                the character's ruleset (its sheet's): classic | starforged | sundered_isles
 * @param {string|null} [preference]  the world's "Rules preference": "sheet" (or none), or the ruleset to prefer
 * @param {string[]|null} [enabled]   the rulesets on in the world (null: take the preferred one as on)
 */
export function movesFor(own, preference = null, enabled = null) {
  const base = RULESETS[own] ?? CLASSIC;
  const moves = { ...base, ruleset: RULESETS[own] ? own : "classic" };
  const preferred = RULESETS[preference];
  if ( !preferred || preference === moves.ruleset || (enabled && !enabled.includes(preference)) ) return named(moves);
  for ( const key of OWN_MOVES[preference] ) {
    const move = preferred[key];
    if ( move?.key && moves[key]?.key === move.key ) moves[key] = move;
  }
  return named(moves);
}

/** The moves named in the reader's language (worked out after they're matched by their keys). */
function named(moves) {
  const out = { ...moves };
  for ( const [key, move] of Object.entries(moves) ) if ( move?.key ) out[key] = { ...move, name: moveName(move.key) };
  if ( moves.control ) out.control = { on: t(`Control.${moves.control.on}`), off: t(`Control.${moves.control.off}`) };
  return out;
}

/** A roll's degree from its score and the challenge dice: 3 strong hit, 2 weak hit, 1 miss, 0 a miss on a match. */
export function grade(score, challenge) {
  const beats = challenge.filter(c => score > c).length;
  if ( beats === 2 ) return 3;
  if ( beats === 1 ) return 2;
  return challenge[0] === challenge[1] ? 0 : 1;
}

/** Chances of [dire miss, miss, weak hit, strong hit] for one action score (capped at 10) against the challenge dice. */
export function scoreChances(score) {
  const s = Math.max(0, Math.min(10, Math.floor(score)));
  const p = Math.max(0, s - 1) / 10; // a challenge die it beats: anything under the score
  const strong = p * p;
  const weak = 2 * p * (1 - p);
  // Both dice at or over the score, and the same: (11 - s) of the 100 pairs (or all ten doubles, for 0).
  const dire = (10 - Math.max(0, s - 1)) / 100;
  const miss = (1 - p) * (1 - p) - dire;
  return [dire, miss, weak, strong];
}

/**
 * Chances of each degree for an action roll (a d6 + mod + adds) or a progress roll (the score itself).
 * @param {number} mod
 * @param {object} [options]
 * @param {number} [options.adds=0]
 * @param {boolean} [options.progress=false]
 * @returns {number[]}
 */
export function chances(mod, { adds = 0, progress = false } = {}) {
  if ( progress ) return scoreChances(mod);
  const out = [0, 0, 0, 0];
  for ( let die = 1; die <= 6; die++ ) {
    const c = scoreChances(die + mod + adds);
    for ( let i = 0; i < 4; i++ ) out[i] += c[i] / 6;
  }
  return out;
}

/** The degree a burned momentum gives against the same challenge dice (null when momentum can't help). */
export function burnGrade(momentum, challenge) {
  if ( !(momentum > 0) ) return null;
  return grade(momentum, challenge);
}

/**
 * At 0 spirit and missing an Endure Stress, a character already shaken rolls d100: 1-10 it's overwhelmed (Face
 * Desolation), 11-50 it falters, 51-100 it perseveres. (The books' tables say more; this is what matters in a fight.)
 * @returns {"desolation"|"falters"|"perseveres"}
 */
export function stressTable(d100) {
  if ( d100 <= 10 ) return "desolation";
  if ( d100 <= 50 ) return "falters";
  return "perseveres";
}

/**
 * At 0 health and missing an Endure Harm, a character already wounded rolls d100: 1-10 the harm is mortal (Face
 * Death), 11-20 dying, 21-35 out cold, 36-50 reeling, 51-100 still standing.
 * @returns {"mortal"|"dying"|"out"|"reeling"|"standing"}
 */
export function harmTable(d100) {
  if ( d100 <= 10 ) return "mortal";
  if ( d100 <= 20 ) return "dying";
  if ( d100 <= 35 ) return "out";
  if ( d100 <= 50 ) return "reeling";
  return "standing";
}
