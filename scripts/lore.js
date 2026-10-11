/**
 * The Lore-Collector's payoff for sizing a foe up in Ironsworn: how much likelier its next rolls are to succeed, a
 * world setting from 1.25× to 3×.
 *
 * The default is what a turn spent sizing up is worth, worked out from Ironsworn's dice: the Lore-Collector gives up a
 * move to Secure an Advantage (+wits; a Lore-Collector's best, 3, hits 77% of the time), and a miss pays the price (a
 * point of momentum, worth a fifth of a move). For the one roll it pays off to make up for the move it cost, that roll
 * must be 1 + (1 + 0.23 × 0.2) / 0.77 ≈ 2.36 times as likely to succeed: 2.35×. Ironsworn's dice cap a roll near 95%, so
 * a Strike gets all it can by about 1.5× (+2 iron) or 1.75× (+1); the rest is for Compelling a hardier foe, where the
 * odds start low.
 */

export const LORE_BOOST = Object.freeze({ min: 1.25, max: 3, step: 0.05, default: 2.35 });
const MODULE_ID = "fast-fighting-ironsworn";

/** Register the setting (on init). */
export function registerLoreBoost() {
  game.settings.register(MODULE_ID, "loreBoost", {
    name: "FFIRONSWORN.Settings.loreBoost.Name",
    hint: "FFIRONSWORN.Settings.loreBoost.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: LORE_BOOST.min, max: LORE_BOOST.max, step: LORE_BOOST.step },
    default: LORE_BOOST.default
  });
}

/** The world's setting, within its bounds (the default if there's none to read). */
export function loreBoost() {
  let v = LORE_BOOST.default;
  try {
    v = Number(game.settings.get(MODULE_ID, "loreBoost"));
  } catch ( err ) {
    return LORE_BOOST.default;
  }
  return Number.isFinite(v) && v > 0 ? Math.min(LORE_BOOST.max, Math.max(LORE_BOOST.min, v)) : LORE_BOOST.default;
}
