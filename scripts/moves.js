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

/** How many ticks of a 40-tick track one mark of progress fills at each challenge rank (1 troublesome ... 5 epic). */
export const TICKS = Object.freeze({ 1: 12, 2: 8, 3: 4, 4: 2, 5: 1 });
export const TRACK = 40;
export const MOMENTUM = Object.freeze({ min: -6, max: 10, reset: 2 });

/**
 * The combat moves, per ruleset: progress marked (harm inflicted) on a strong and a weak hit, and what the moves are
 * called. Ironsworn: Strike when you have initiative, Clash when your foe does, End the Fight. Starforged: Strike when
 * in control, Clash when in a bad spot, Take Decisive Action.
 */
export const RULESETS = Object.freeze({
  classic: Object.freeze({
    strike: { strong: 2, weak: 1 }, clash: { strong: 1, weak: 1 },
    names: { strike: "Strike", clash: "Clash", finish: "End the Fight", fray: "Enter the Fray", endure: "Endure Harm", price: "Pay the Price", face: "Face Death" },
    control: { on: "has initiative", off: "loses initiative" }
  }),
  starforged: Object.freeze({
    strike: { strong: 2, weak: 2 }, clash: { strong: 2, weak: 1 },
    names: { strike: "Strike", clash: "Clash", finish: "Take Decisive Action", fray: "Enter the Fight", endure: "Endure Harm", price: "Pay the Price", face: "Face Death" },
    control: { on: "is in control", off: "is in a bad spot" }
  })
});

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
