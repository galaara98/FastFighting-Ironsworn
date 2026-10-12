/** A character's personality from its whole sheet, and a foe's from what it is: as Ironsworn and Starforged read them. */
import { describe, test, expect } from "vitest";
import { deriveIronswornTraits, pcParts, natureOf, foeId, assetLeanKey } from "../scripts/traits.js";
import { characterBiography, foeBiography } from "../scripts/auto.js";
import { PC_BASELINE, TRAITS } from "../../FastFighting/scripts/constants.js";
import { text } from "./foundry-i18n.js";

/** The usual hero's stats: 3, 2, 2, 1 and 1, 1.8 each on average. */
const AVERAGE = { edge: 1.8, heart: 1.8, iron: 1.8, shadow: 1.8, wits: 1.8 };
/** Every way to give the five stats 3, 2, 2, 1 and 1. */
function allocations() {
  const out = new Set();
  const order = ["edge", "heart", "iron", "shadow", "wits"];
  const permute = (left, picked) => {
    if ( !left.length ) return out.add(JSON.stringify(Object.fromEntries(order.map((k, i) => [k, picked[i]]))));
    left.forEach((v, i) => permute([...left.slice(0, i), ...left.slice(i + 1)], [...picked, v]));
  };
  permute([3, 2, 2, 1, 1], []);
  return [...out].map(s => JSON.parse(s));
}

/** An asset as the adapter reads it: its id, its kind, its name, how many abilities marked. */
const asset = (dsid, enabled = 1, name = assetLeanKey(dsid)) => ({ key: dsid, category: dsid.replace(/^asset:/, "").split("/")[1], name, enabled });
/** A character: the usual hero's numbers unless told otherwise (three assets that say nothing, a bond, its two vows). */
const pc = extra => deriveIronswornTraits({
  pc: true, ruleset: "classic", stats: AVERAGE,
  assets: [asset("asset:classic/path/wayfinder"), asset("asset:classic/path/rider"), asset("asset:classic/companion/horse")].map(a => ({ ...a, category: "path" })),
  debilities: [], bonds: 1, connections: [], vows: [{ rank: 5 }, { rank: 2 }], legacies: {},
  ...extra
});
const delta = (a, b = PC_BASELINE) => Object.fromEntries(TRAITS.map(k => [k, a[k] - b[k]]));

describe("an Ironsworn character's traits, from its sheet", () => {
  test("the usual hero's numbers make the usual hero", () => {
    expect(pc().traits).toEqual(PC_BASELINE);
    // Its stats are centered: over every way to assign 3, 2, 2, 1 and 1, a hero is the usual hero on average.
    const heroes = allocations().map(stats => pc({ stats }).traits);
    expect(heroes).toHaveLength(30);
    for ( const k of TRAITS ) {
      const mean = heroes.reduce((s, h) => s + h[k], 0) / heroes.length;
      expect(Math.abs(mean - PC_BASELINE[k])).toBeLessThan(0.5);
    }
  });

  test("no two alike: a shield-bearer stands by its friends, a cutthroat looks out for itself, a scholar thinks ahead, a berserker charges in", () => {
    const shield = pc({ stats: { iron: 3, heart: 2, edge: 2, wits: 1, shadow: 1 }, bonds: 3,
      assets: [asset("asset:classic/combat_talent/shield_bearer"), asset("asset:classic/path/banner_sworn"), asset("asset:classic/combat_talent/ironclad")] }).traits;
    const rogue = pc({ stats: { shadow: 3, edge: 2, wits: 2, heart: 1, iron: 1 },
      assets: [asset("asset:classic/combat_talent/cutthroat"), asset("asset:classic/path/infiltrator"), asset("asset:classic/path/outcast")] }).traits;
    const scholar = pc({ stats: { wits: 3, heart: 2, shadow: 2, edge: 1, iron: 1 },
      assets: [asset("asset:classic/path/lorekeeper"), asset("asset:classic/path/alchemist"), asset("asset:classic/path/herbalist")] }).traits;
    const berserker = pc({ stats: { iron: 3, edge: 2, heart: 2, wits: 1, shadow: 1 },
      assets: [asset("asset:classic/combat_talent/berserker"), asset("asset:classic/combat_talent/brawler"), asset("asset:classic/path/slayer")] }).traits;
    expect(shield.loyal).toBeGreaterThan(PC_BASELINE.loyal + 10);
    expect(shield.selfish).toBeLessThan(PC_BASELINE.selfish);
    expect(rogue.selfish).toBeGreaterThan(PC_BASELINE.selfish + 10);
    expect(rogue.loyal).toBeLessThan(PC_BASELINE.loyal - 10);
    expect(scholar.tactical).toBeGreaterThan(Math.max(shield.tactical, rogue.tactical, berserker.tactical));
    expect(berserker.brave).toBeGreaterThan(Math.max(shield.brave, rogue.brave, scholar.brave));
    expect(berserker.tactical).toBeLessThan(PC_BASELINE.tactical - 10);
    expect(new Set([shield, rogue, scholar, berserker].map(x => JSON.stringify(x))).size).toBe(4);
  });

  test("assets by their id's last part, each ruleset's alike, more as they're upgraded", () => {
    const mercenary = pc({ assets: [asset("asset:starforged/path/mercenary")] });
    expect(delta(mercenary.traits)).toMatchObject({ selfish: 6, loyal: -3 });
    expect(mercenary.reasons.selfish).toContain("mercenary");
    // An older id (Dataforged's), or none at all but its name, reads the same.
    expect(pc({ assets: [{ key: "Ironsworn/Assets/Combat_Talent/Shield-Bearer", category: "combat_talent", name: "Shield-Bearer", enabled: 1 }] }).traits)
      .toEqual(pc({ assets: [asset("asset:classic/combat_talent/shield_bearer")] }).traits);
    // Its other two abilities marked: half as much again.
    expect(delta(pc({ assets: [asset("asset:classic/path/honorbound", 3)] }).traits)).toMatchObject({ selfish: -6 });
    // A companion at its side.
    expect(delta(pc({ assets: [asset("asset:starforged/companion/protocol_bot")] }).traits).loyal).toBe(2);
  });

  test("how far it has come: assets beyond its first three (not its ship), and upgrades", () => {
    const fresh = [asset("asset:starforged/command_vehicle/starship"), asset("asset:starforged/path/explorer"), asset("asset:starforged/path/navigator"), asset("asset:starforged/companion/utility_bot")];
    const base = pc({ assets: fresh }).traits.tactical;
    const seasoned = pc({ assets: [...fresh, asset("asset:starforged/path/naturalist", 2), asset("asset:starforged/module/medbay", 3)] });
    expect(seasoned.traits.tactical - base).toBe(5);
    expect(seasoned.reasons.tactical).toContain("5");
  });

  test("a shaken or corrupted hero is a different one, for now", () => {
    const names = { debilities: { shaken: "Shaken!", corrupted: "Corrupted!" } };
    const shaken = pc({ debilities: ["shaken"], names });
    expect(delta(shaken.traits)).toMatchObject({ brave: -6, tactical: -2 });
    expect(shaken.reasons.brave).toContain("Shaken!");
    expect(delta(pc({ debilities: ["corrupted"] }).traits)).toMatchObject({ selfish: 6, loyal: -4 });
    expect(delta(pc({ ruleset: "starforged", debilities: ["traumatized", "indebted"] }).traits)).toMatchObject({ brave: -4, selfish: 3 });
    // Cursed is a bane in Ironsworn (death's quest); in Starforged, its ship's.
    expect(pc({ debilities: ["cursed"] }).traits.brave).toBe(PC_BASELINE.brave + 2);
    expect(pc({ ruleset: "starforged", debilities: ["cursed", "battered"] }).traits).toEqual(PC_BASELINE);
  });

  test("its friends and its word: bonds, connections, vows and legacies", () => {
    expect(pc({ bonds: 4 }).traits.loyal).toBe(PC_BASELINE.loyal + 6);
    expect(pc({ bonds: 0 }).traits).toEqual(PC_BASELINE);
    expect(pc({ bonds: 0, connections: [{ bonded: true }, {}] }).traits.loyal).toBe(PC_BASELINE.loyal + 3);
    // Sworn to more than the usual two, and to epic ones; or only to a troublesome one.
    expect(delta(pc({ vows: [{ rank: 5 }, { rank: 5 }, { rank: 5 }, { rank: 5 }] }).traits)).toMatchObject({ loyal: 2, selfish: -2, brave: 3 });
    expect(delta(pc({ vows: [{ rank: 1 }] }).traits)).toMatchObject({ brave: -5, loyal: 0 });
    expect(pc({ vows: [{ rank: 5 }, { rank: 2 }, { rank: 3, completed: true }, { rank: 2, completed: true }] }).traits.loyal).toBe(PC_BASELINE.loyal + 2);
    const legend = delta(pc({ legacies: { quests: 20, bonds: 16, discoveries: 44 } }).traits);
    expect(legend.brave).toBe(4);
    expect(legend.loyal).toBe(3);
    expect(legend.tactical).toBe(6);
  });

  test("each trait's reason says where it started and every part that moved it", () => {
    const { reasons } = pc({ stats: { heart: 3, wits: 2, iron: 2, edge: 1, shadow: 1 }, assets: [asset("asset:classic/path/loyalist", 1, "Loyalist")], bonds: 3, names: { bonds: "Bondz" } });
    expect(reasons.loyal).toContain(String(PC_BASELINE.loyal));
    expect(reasons.loyal).toContain(text("FFIRONSWORN.Stat.heart"));
    expect(reasons.loyal).toContain("Loyalist");
    expect(reasons.loyal).toContain("Bondz");
    expect(pcParts({ stats: AVERAGE }).every(p => Math.abs(p.n) < 1e-9)).toBe(true);
  });
});

describe("a foe's traits", () => {
  test("what it is, by its id: Ironsworn's collections, Starforged's foes as the book has them", () => {
    expect(foeId("npc.variant:starforged/sample_npcs/chiton.chiton_queen")).toEqual({ collection: "sample_npcs", key: "chiton", variant: "chiton_queen" });
    expect(natureOf({ dsid: "npc:classic/animals/bear" })).toBe("animal");
    expect(natureOf({ dsid: "npc:delve/anomalies/gloom" })).toBe("horror");
    expect(natureOf({ dsid: "npc:classic/firstborn/elf" })).toBe("firstborn");
    expect(natureOf({ dsid: "npc:starforged/sample_npcs/howlcat" })).toBe("animal");
    expect(natureOf({ dsid: "npc:starforged/sample_npcs/warden" })).toBe("people");
    expect(natureOf({ dsid: "npc.variant:starforged/sample_npcs/servitor.enforcer" })).toBe("machine");
    // (Without one: its folder, then its words.)
    expect(natureOf({ dsid: "", folder: "Horrors" })).toBe("horror");
  });

  test("still read by nature and rank, then what its kind is like", () => {
    expect(deriveIronswornTraits({ pc: false, rank: 2, nature: "people" }).traits).toEqual({ tactical: 50, brave: 50, selfish: 50, loyal: 55 });
    const raider = deriveIronswornTraits({ pc: false, rank: 2, nature: "people", dsid: "npc:classic/ironlanders/raider", name: "Raider" });
    const folk = deriveIronswornTraits({ pc: false, rank: 1, nature: "people", dsid: "npc:classic/ironlanders/common_folk", name: "Common folk" });
    expect(raider.traits.selfish).toBeGreaterThan(folk.traits.selfish);
    expect(raider.traits.brave).toBeGreaterThan(folk.traits.brave + 15);
    expect(raider.reasons.selfish).toContain("Raider");
    expect(raider.reasons.brave).toContain(text("FFIRONSWORN.Nature.people"));
  });

  test("a pack stands together", () => {
    const one = deriveIronswornTraits({ pc: false, rank: 2, nature: "animal", dsid: "npc:starforged/sample_npcs/howlcat" }).traits;
    const pack = deriveIronswornTraits({ pc: false, rank: 2, nature: "animal", dsid: "npc.variant:starforged/sample_npcs/howlcat.howlcat_pack" });
    expect(delta(pack.traits, one)).toMatchObject({ loyal: 5, brave: 5 });
    expect(pack.reasons.loyal).toContain(text("FFIRONSWORN.Reason.Group"));
  });
});

describe("a biography, for the keywords", () => {
  test("a Starforged sheet's characteristics are said of the character; its notes and vows are its story", () => {
    const sf = characterBiography({ biography: "Grim, <b>loyal</b> to a fault", notes: "<p>Her brother fled.</p>", vows: [{ name: "Find my brother", description: "<p>Wherever he went</p>" }] });
    expect(sf).toEqual({ about: "Grim, loyal to a fault", story: "Her brother fled.. Find my brother. Wherever he went", against: "" });
    // An Ironsworn sheet keeps its notes as its biography: a story.
    expect(characterBiography({ classic: true, biography: "<p>Raised by wolves.</p>" })).toEqual({ about: "", story: "Raised by wolves.", against: "" });
  });

  test("a foe's description is about it; its quest starter is a story", () => {
    const bio = foeBiography("<h4>Drives</h4><p>Find food</p><blockquote>Quest Starter: <p>The hunters fled.</p></blockquote>");
    expect(bio.about).toBe("Drives Find food");
    expect(bio.story).toBe("Quest Starter: The hunters fled.");
  });
});
