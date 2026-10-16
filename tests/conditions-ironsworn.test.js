/**
 * The core's own conditions in Ironsworn and Starforged: its debilities and impacts that share a name with one of the
 * core's (cursed, doomed, encumbered) mean what the rules make of them, and the story tells them in the master list's
 * words, or not at all; what harms each turn (a fire, radiation) is a point of harm; a fall, a point for each 10 feet.
 */
import { describe, expect, test } from "vitest";
import { ironswornRules, DEBILITY_KEYS } from "../scripts/rules.js";
import { conditionSetup, CORE_CONDITIONS } from "../../FastFighting/scripts/engine/conditions.js";
import { conditionOf } from "../../FastFighting/scripts/story/master.js";

describe("the core's conditions, in Ironsworn's terms", () => {
  test("its own debilities and impacts aren't given the core's meaning; the core's other ones are", () => {
    const { owned } = conditionSetup(ironswornRules);
    const shared = CORE_CONDITIONS.map(c => c.key).filter(k => DEBILITY_KEYS.includes(k));
    expect(shared.sort()).toEqual(["cursed", "doomed", "encumbered"]);
    for ( const key of shared ) expect(owned).toContain(key);
    expect(owned).not.toContain("irradiated");
  });

  test("in the story: wounded is bloodied, permanently harmed maimed; the burdens nobody would see are told not at all", () => {
    const told = key => conditionOf(key, ironswornRules.storyCondition.bind(ironswornRules));
    expect(["wounded", "shaken", "maimed", "permanentlyharmed"].map(told)).toEqual(["bloodied", "shaken", "maimed", "maimed"]);
    const burdens = DEBILITY_KEYS.filter(k => !["wounded", "shaken", "maimed", "permanentlyharmed"].includes(k));
    expect(burdens.sort()).toEqual(["battered", "corrupted", "cursed", "doomed", "encumbered", "indebted", "tormented", "traumatized", "unprepared"]);
    for ( const key of burdens ) expect(ironswornRules.storyCondition(key)).toBe(false);
    // (Every other condition as the master list has it.)
    expect(["prone", "grappled", "constructor"].map(k => ironswornRules.storyCondition(k))).toEqual([null, null, null]);
    expect(told("grappled")).toBe("grabbed");
  });

  test("a condition's harm each turn: a point; a fall: a point for each 10 feet, at most 3, and no lying prone", () => {
    expect(ironswornRules.conditionHarm("burning", 3)).toEqual([expect.objectContaining({ flat: 1, type: "harm" })]);
    expect(ironswornRules.fallDamage(5)).toEqual([]);
    expect(ironswornRules.fallDamage(25)).toEqual([expect.objectContaining({ flat: 2, type: "harm" })]);
    expect(ironswornRules.fallDamage(100)).toEqual([expect.objectContaining({ flat: 3 })]);
    expect(ironswornRules.fallProne).toBe(false);
  });
});
