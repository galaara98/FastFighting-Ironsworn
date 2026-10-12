/** Setting a character up by itself, as Ironsworn reads it: a character's assets by the system's ids, a foe's nature. */
import { describe, expect, test } from "vitest";
import { ironswornHints, ironswornTactics, assetKey } from "../scripts/auto.js";

describe("the playstyles Ironsworn says fit", () => {
  test("an asset by the last part of its id (each ruleset's of the same name alike); rituals make a mystic", () => {
    expect(assetKey("asset:classic/combat_talent/shield_bearer")).toBe("shield_bearer");
    expect(ironswornHints({ assets: ["shield_bearer"] })).toEqual({ tank: 0.6 });
    expect(ironswornHints({ assets: ["oathbreaker"] }).redeemSeeker).toBe(0.6);
    expect(ironswornHints({ assets: ["ritualist", "ward", "scry"], rituals: 2 }).unmundane).toBeCloseTo(0.9);
    expect(ironswornHints({ assets: ["horse"] })).toEqual({});
  });

  test("a foe's nature: horrors and machines Relentless, beasts Brawlers; people as they are", () => {
    expect(ironswornHints({ nature: "machine" })).toEqual({ relentless: 0.6 });
    expect(ironswornHints({ nature: "beast" })).toMatchObject({ brawler: 0.4 });
    expect(ironswornHints({ nature: "people" })).toEqual({});
  });
});

describe("Ironsworn's answers to the tactics questions", () => {
  test("an archer shoots; a shield-bearer guards; horrors never break; beasts stay", () => {
    expect(ironswornTactics({ assets: ["archer"] }).style).toBe("ranged");
    expect(ironswornTactics({ assets: ["shield_bearer"] })).toMatchObject({ style: "protector", target: "protect" });
    expect(ironswornTactics({ nature: "horror" }).retreat).toBe("never");
    expect(ironswornTactics({ nature: "beast" }).beyond).toBe("stay");
  });
});
