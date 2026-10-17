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

import { numberSetting } from "./core.js";

export const LORE_BOOST = Object.freeze({ min: 1.25, max: 3, step: 0.05, default: 2.35 });

const setting = numberSetting("fast-fighting-ironsworn", "loreBoost", {
  ...LORE_BOOST, name: "FFIRONSWORN.Settings.loreBoost.Name", hint: "FFIRONSWORN.Settings.loreBoost.Hint"
});

/** Register the setting (on init). */
export const registerLoreBoost = setting.register;

/** The world's setting, within its bounds (the default if there's none to read). */
export const loreBoost = setting.read;
