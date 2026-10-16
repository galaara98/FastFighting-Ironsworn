/** Setting a character up by itself, as Ironsworn reads it: a character's assets by the system's ids, a foe's nature. */
import { describe, expect, test } from "vitest";
import { createHash } from "crypto";
import { ironswornHints, ironswornTactics, abilityMoves, assetKey, rangedAsset, healerAsset, MOVE_LINKS } from "../scripts/auto.js";
import { IronswornAdapter } from "../scripts/adapter.js";
import { TACTIC_CHOICES, TACTIC_KEYS } from "../../FastFighting/scripts/engine/tactics.js";
import { withHints } from "../../FastFighting/scripts/foundry/auto-config.js";
import { text } from "./foundry-i18n.js";

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

/* Ironsworn's answers to the tactics questions ------------------------------------------------------------------------ */

/** A move's link in an ability's text, as the system writes it (the move's id: the end of the SHA-256 of its Datasworn id). */
const MOVES = {
  advantage: "@Compendium[foundry-ironsworn.ironswornmoves.4dd8468e095810a4]{x}",
  gainGround: "@Compendium[foundry-ironsworn.starforgedmoves.3f5a834fa3fea5d1]{x}",
  compel: "@Compendium[foundry-ironsworn.ironswornmoves.be95ca063ded2b19]{x}",
  heal: "@Compendium[foundry-ironsworn.ironswornmoves.3d315ee54e9ce845]{x}",
  aid: "@Compendium[foundry-ironsworn.starforgedmoves.f4dec946415d8e57]{x}",
  strike: "@Compendium[foundry-ironsworn.ironswornmoves.5288e935906f6d28]{x}"
};
/**
 * An asset as the adapter reads it: its id, its kind, its name, and its abilities (each marked or not, the moves its text
 * links to): `abilities` as [[marked, ...moves]].
 */
const asset = (dsid, name, abilities = [[true]]) => ({
  key: dsid, category: dsid.replace(/^asset:/, "").split("/")[1], name,
  abilities: abilities.map(([marked, ...moves]) => ({ marked, moves: abilityMoves(moves.map(m => MOVES[m]).join(" ")) }))
});
const pc = (assets = [], extra = {}) => ironswornTactics({ pc: true, stats: { edge: 2, heart: 2, iron: 2, shadow: 1, wits: 1 }, supply: 3, assets, ...extra });
const foe = (dsid, nature, name, rank = 2) => ironswornTactics({ pc: false, nature, key: dsid.split("/").pop(), name, rank });
const values = out => Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.value]));

describe("the moves an asset's ability makes", () => {
  test("by the system's id for each move: the SHA-256 of its Datasworn id, as the system makes it", () => {
    const DFIDS = {
      "Ironsworn/Moves/Adventure/Secure_an_Advantage": "advantage", "Starforged/Moves/Adventure/Secure_an_Advantage": "advantage",
      "Starforged/Moves/Combat/Gain_Ground": "advantage", "Ironsworn/Moves/Relationship/Compel": "compel", "Starforged/Moves/Adventure/Compel": "compel",
      "Ironsworn/Moves/Adventure/Heal": "heal", "Starforged/Moves/Recover/Heal": "heal",
      "Ironsworn/Moves/Relationship/Aid_Your_Ally": "aid", "Starforged/Moves/Adventure/Aid_Your_Ally": "aid"
    };
    const hashed = Object.fromEntries(Object.entries(DFIDS).map(([dfid, move]) => [createHash("sha256").update(dfid).digest("hex").slice(48), move]));
    expect(MOVE_LINKS).toEqual(hashed);
  });

  test("each linked move once, either way of linking; other moves and text count for nothing", () => {
    const html = `<p>When you ${MOVES.advantage} or @UUID[Compendium.foundry-ironsworn.starforgedmoves.Item.9f538fabf8998c5b]{Compel}, `
      + `then ${MOVES.advantage} again, or ${MOVES.strike}...</p>`;
    expect(abilityMoves(html)).toEqual(["advantage", "compel"]);
    expect(abilityMoves(null)).toEqual([]);
    expect(abilityMoves("<p>Add +1.</p>")).toEqual([]);
  });
});

describe("a character's answers, from its sheet", () => {
  test("its weapons: a bow at range, a shield guarding, a blade up close, a dagger from the shadows; each with the asset's name", () => {
    expect(pc([asset("asset:classic/combat_talent/archer", "Archer")]).style).toEqual({ value: "ranged", why: "Archer" });
    expect(values(pc([asset("asset:classic/combat_talent/shield_bearer", "Shield-Bearer")]))).toMatchObject({ style: "protector", target: "protect" });
    expect(pc([asset("asset:starforged/path/blademaster", "Blademaster")]).style.value).toBe("frontline");
    expect(pc([asset("asset:classic/combat_talent/cutthroat", "Cutthroat")]).style.value).toBe("skirmisher");
    // (Classic's Long-Arm is a staff: up close.)
    expect(pc([asset("asset:classic/combat_talent/long_arm", "Long-Arm")]).style.value).toBe("frontline");
    // Most say: two blades over one bow.
    const both = pc([asset("asset:classic/combat_talent/archer", "Archer"), asset("asset:classic/combat_talent/swordmaster", "Swordmaster"),
      asset("asset:classic/combat_talent/sunderer", "Sunderer")]);
    expect(both.style.value).toBe("frontline");
    expect(both.style.why).toContain("Swordmaster");
    expect(both.style.why).toContain("Sunderer");
  });

  test("a bow and a shield: it could go either way, so its own reading stands (not even its stats say)", () => {
    expect(pc([asset("asset:classic/combat_talent/archer", "Archer"), asset("asset:classic/combat_talent/shield_bearer", "Shield-Bearer")]).style).toBeUndefined();
  });

  test("no weapon among its assets: the stat it fights with, iron up close, edge at range; even, nothing", () => {
    const iron = pc([], { stats: { iron: 3, edge: 1, heart: 2, wits: 2, shadow: 1 } });
    expect(iron.style).toEqual({ value: "frontline", why: text("FFIRONSWORN.Reason.Stat", { name: text("FFIRONSWORN.Stat.iron"), n: 3 }) });
    expect(pc([], { stats: { edge: 3, iron: 2 } }).style.value).toBe("ranged");
    expect(pc([], { stats: { edge: 2, iron: 2 } })).toEqual({});
  });

  test("who it is: a berserker charges the nearest and never breaks; a revenant gets back up; a slayer hunts the monster", () => {
    expect(values(pc([asset("asset:classic/combat_talent/berserker", "Berserker")])))
      .toMatchObject({ style: "frontline", target: "nearest", retreat: "never", selfRevived: "rejoin" });
    expect(values(pc([asset("asset:starforged/deed/revenant", "Revenant")]))).toMatchObject({ retreat: "never", selfRevived: "rejoin" });
    expect(values(pc([asset("asset:classic/path/slayer", "Slayer")]))).toMatchObject({ target: "dangerous", beyond: "hunt" });
    expect(values(pc([asset("asset:classic/path/commander", "Commander")]))).toMatchObject({ beyond: "seekHelp" });
    expect(pc([asset("asset:starforged/path/fugitive", "Fugitive")]).retreat).toEqual({ value: "hurt", why: "Fugitive" });
  });

  test("a healer heals readily and saves a friend (unless it would go further already); a Rider's Heal is its horse's", () => {
    const herbalist = pc([asset("asset:classic/path/herbalist", "Herbalist", [[true, "heal"], [false, "heal"]])]);
    expect(values(herbalist)).toMatchObject({ healAggro: "aggressive", allyDying: "rescue", selfRevived: "healSelf" });
    expect(herbalist.healAggro.why).toBe("Herbalist");
    // (A path of someone's own that Heals.)
    expect(values(pc([asset("asset:classic/path/medic", "Medic", [[true, "heal"]])]))).toMatchObject({ healAggro: "aggressive", allyDying: "rescue" });
    expect(ironswornTactics({ pc: true, assets: [asset("asset:starforged/path/healer", "Healer")] }, { healAggro: "allCosts" }).healAggro).toBeUndefined();
    expect(pc([asset("asset:classic/path/rider", "Rider", [[true, "heal"]])]).healAggro).toBeUndefined();
  });

  test("its assets brought to bear (securing an advantage): a little more often with two, much more with four", () => {
    // One ability for it: nothing to say.
    expect(pc([asset("asset:classic/combat_talent/archer", "Archer", [[true, "advantage"], [false, "strike"]])]).specialty).toBeUndefined();
    const two = pc([asset("asset:classic/combat_talent/archer", "Archer", [[true, "advantage"]]), asset("asset:classic/companion/hawk", "Hawk", [[true], [true, "advantage"]])]);
    expect(two.specialty.value).toBe("some");
    expect(two.specialty.why).toContain("Hawk");
    // A ritualist and its rituals: each ritual, and the ritualist's powers, count.
    const mystic = pc([asset("asset:classic/path/ritualist", "Ritualist", [[true, "advantage"]]), asset("asset:classic/ritual/ward", "Ward"), asset("asset:classic/ritual/scry", "Scry")]);
    expect(mystic.specialty.value).toBe("strong");
    // (Never less than the character's own reading already says.)
    const rituals = [asset("asset:classic/ritual/ward", "Ward"), asset("asset:classic/ritual/scry", "Scry")];
    expect(ironswornTactics({ pc: true, assets: rituals }).specialty.value).toBe("some");
    expect(ironswornTactics({ pc: true, assets: rituals }, { specialty: "strong" }).specialty).toBeUndefined();
    // A ship's modules are the ship's.
    expect(pc([asset("asset:starforged/module/overseer", "Overseer", [[true, "advantage", "gainGround"]]), asset("asset:starforged/module/sensor_array", "Sensor Array", [[true], [true, "advantage"]])]).specialty).toBeUndefined();
  });

  test("abilities marked: burning momentum pays off for a Swordmaster; a Kinetic's greatest feats need it at its max", () => {
    expect(pc([asset("asset:classic/combat_talent/swordmaster", "Swordmaster", [[true], [false], [false]])]).resourceUse).toEqual({ value: "nova", why: "Swordmaster" });
    expect(pc([asset("asset:starforged/path/kinetic", "Kinetic", [[false], [false], [true]])]).resourceUse.value).toBe("conserve");
    // Nothing marked: it has the first ability, which isn't the one.
    expect(pc([asset("asset:starforged/path/kinetic", "Kinetic", [[false], [false], [false]])]).resourceUse).toBeUndefined();
    expect(pc([asset("asset:classic/path/banner_sworn", "Banner-Sworn", [[true], [false], [false]])]).resourceUse).toBeUndefined();
  });

  test("talking: a diplomat first, a liar when it could work, abilities that Compel; a ship's guns don't talk", () => {
    expect(values(pc([asset("asset:starforged/path/diplomat", "Diplomat")]))).toMatchObject({ talk: "first", offer: { kind: "noHarm" } });
    expect(pc([asset("asset:starforged/path/scoundrel", "Scoundrel")]).talk.value).toBe("opportune");
    expect(pc([asset("asset:classic/combat_talent/cutthroat", "Cutthroat", [[true], [true, "compel"]])]).talk).toEqual({ value: "opportune", why: "Cutthroat" });
    const words = pc([asset("asset:classic/path/storyteller", "Storyteller", [[true, "compel"], [true, "compel"]]), asset("asset:classic/path/envoy", "Envoy", [[true, "compel"]])]);
    expect(words.talk.value).toBe("first");
    expect(pc([asset("asset:starforged/module/heavy_cannons", "Heavy Cannons", [[true], [true], [true, "compel"]])]).talk).toBeUndefined();
  });

  test("standing by a friend: a loyalist, or an ability that aids an ally", () => {
    expect(pc([asset("asset:classic/path/loyalist", "Loyalist")]).allyDying).toEqual({ value: "rescue", why: "Loyalist" });
    expect(values(pc([asset("asset:starforged/path/leader", "Leader", [[true, "aid"]])]))).toMatchObject({ allyDying: "rescue", talk: "opportune" });
  });

  test("what it offers and expects: Supply if it has any, or a promise", () => {
    expect(pc([asset("asset:starforged/path/trader", "Trader")]).offer).toEqual({ value: { kind: "money", amount: 1, coin: 1 }, why: "Trader" });
    expect(pc([asset("asset:starforged/path/trader", "Trader")], { supply: 0 }).offer).toBeUndefined();
    expect(pc([asset("asset:starforged/path/mercenary", "Mercenary")]).expect.value).toEqual({ kind: "money", amount: 1, coin: 1 });
    expect(pc([asset("asset:starforged/path/courier", "Courier")]).expect.value).toEqual({ kind: "passage" });
    expect(pc([asset("asset:starforged/path/fugitive", "Fugitive")]).offer.value).toEqual({ kind: "leave" });
  });

  test("one who makes elixirs or explosives uses them freely", () => {
    expect(pc([asset("asset:classic/path/alchemist", "Alchemist")]).consumables).toEqual({ value: "freely", why: "Alchemist" });
  });

  test("an asset by its id, its older id or its name", () => {
    expect(pc(["asset:classic/combat_talent/archer"]).style.value).toBe("ranged");
    expect(pc(["Ironsworn/Assets/Path/Herbalist"]).healAggro.value).toBe("aggressive");
    expect(pc(["Shield-Bearer"]).target.value).toBe("protect");
  });

  test("assets that say nothing of a fight leave every question to the character's own reading", () => {
    expect(pc([asset("asset:classic/companion/horse", "Horse"), asset("asset:classic/path/wayfinder", "Wayfinder")], { stats: { iron: 2, edge: 2 } })).toEqual({});
  });
});

describe("what its assets make of its moves, by their ids", () => {
  /** Which of these ids it says yes to. */
  const yes = (is, ids) => ids.filter(id => is(id));

  test("fighting at range: a bow, a sling, a rifle, pistols, in every ruleset (or by its older id); not a staff, a spear or arrows made", () => {
    const ranged = ["asset:classic/combat_talent/archer", "asset:classic/combat_talent/slinger", "asset:starforged/path/archer", "asset:starforged/path/sniper",
      "asset:starforged/path/gunner", "asset:starforged/path/gunslinger", "asset:sundered_isles/path/musketeer", "asset:sundered_isles/path/pistoleer",
      "Ironsworn/Assets/Combat_Talent/Archer"];
    expect(yes(rangedAsset, ranged)).toEqual(ranged);
    expect(yes(rangedAsset, ["asset:classic/combat_talent/long_arm", "asset:classic/combat_talent/skirmisher", "asset:classic/combat_talent/fletcher",
      "asset:classic/combat_talent/swordmaster", "asset:sundered_isles/path/harpooner", "asset:starforged/module/heavy_cannons", "", null])).toEqual([]);
  });

  test("healing its thing: Ironsworn's Herbalist, Starforged's Healer; not a Rider (its horse's), nor a ship's medbay", () => {
    const healers = ["asset:classic/path/herbalist", "asset:starforged/path/healer", "Ironsworn/Assets/Path/Herbalist"];
    expect(yes(healerAsset, healers)).toEqual(healers);
    expect(yes(healerAsset, ["asset:classic/path/rider", "asset:starforged/module/medbay", "asset:sundered_isles/module/improved_sick_bay",
      "asset:classic/path/loyalist", "", null])).toEqual([]);
  });
});

describe("a foe's answers, from what it is", () => {
  test("a raider intimidates first, takes Supply (as much as its rank says), never breaks and burns it all down", () => {
    const raider = foe("npc:classic/ironlanders/raider", "people", "Raider");
    expect(values(raider)).toEqual({ talk: "first", retreat: "never", beyond: "hunt", expect: { kind: "money", amount: 1, coin: 1 } });
    expect(raider.retreat.why).toBe("Raider");
    expect(foe("npc:classic/ironlanders/raider", "people", "Raider", 4).expect.value.amount).toBe(2);
  });

  test("a wolf pack runs down the weakest and hunts on; it doesn't talk", () => {
    const wolf = foe("npc:classic/animals/wolf", "animal", "Wolf");
    expect(values(wolf)).toEqual({ beyond: "hunt", talk: "never", target: "weakest" });
    expect(wolf.talk.why).toBe(text("FFIRONSWORN.Nature.animal"));
    expect(wolf.beyond.why).toBe("Wolf");
  });

  test("its nature where its kind says nothing: horrors and machines never break, beasts stay, neither talks", () => {
    expect(foe("npc:classic/horrors/sodden", "horror", "Sodden")).toEqual({
      retreat: { value: "never", why: text("FFIRONSWORN.Nature.horror") }, talk: { value: "never", why: text("FFIRONSWORN.Nature.horror") }
    });
    expect(values(foe("npc:classic/beasts/basilisk", "beast", "Basilisk"))).toEqual({ beyond: "stay", talk: "never" });
    // A servitor weighs its odds.
    expect(values(foe("npc:starforged/sample_npcs/servitor", "machine", "Servitor"))).toMatchObject({ retreat: "losing", target: "protect" });
  });

  test("a giant would rather talk: it spares lives, offers peace and wants you gone", () => {
    expect(values(foe("npc:classic/firstborn/giant", "firstborn", "Giant", 4)))
      .toEqual({ talk: "first", fallen: "spare", offer: { kind: "noHarm" }, expect: { kind: "leave" } });
  });

  test("people its system says nothing about: everything left to its own reading; no words, nothing to bargain", () => {
    expect(foe("npc:classic/ironlanders/nobody", "people", "Somebody")).toEqual({});
    expect(foe("", "people", "Somebody")).toEqual({});
    expect(foe("npc:classic/ironlanders/raider", "beast", "Raider").expect).toBeUndefined();
  });
});

describe("read from the sheets, as the adapter does", () => {
  /** A document's flags, as the system sets them. */
  const flags = dsid => ({ "foundry-ironsworn": { dsid } });
  const items = list => Object.assign(list, { find: Array.prototype.find, filter: Array.prototype.filter });
  /** As the test world's: Brand on an Ironsworn sheet, a raider, a wolf (and their progress tracks). */
  const brand = {
    type: "character", name: "Brand",
    system: { edge: 1, heart: 1, iron: 3, shadow: 2, wits: 2, supply: { value: 4, max: 5 } },
    items: items([
      { type: "asset", name: "Herbalist", flags: flags("asset:classic/path/herbalist"), system: { abilities: [
        { enabled: true, description: `<p>When you attempt to ${MOVES.heal} ...</p>` }, { enabled: false, description: `<p>${MOVES.heal}</p>` }, { enabled: false, description: "" }] } },
      { type: "asset", name: "Swordmaster", flags: flags("asset:classic/combat_talent/swordmaster"), system: { abilities: [
        { enabled: true, description: `<p>${MOVES.strike}</p>` }, { enabled: false, description: "" }, { enabled: false, description: "" }] } },
      { type: "asset", name: "Hound", flags: flags("asset:classic/companion/hound"), system: { abilities: [
        { enabled: true, description: "" }, { enabled: true, description: `<p>${MOVES.strike}</p>` }, { enabled: true, description: `<p>${MOVES.advantage}</p>` }] } },
      { type: "bondset", name: "bonds", system: { bonds: [] } }
    ])
  };
  const foeActor = (dsid, name, rank) => ({ type: "foe", name, flags: flags(dsid), items: items([{ type: "progress", name, flags: flags(dsid), system: { rank, current: 0, description: "" } }]) });
  const adapter = new IronswornAdapter();

  test("a character: its assets by id, the abilities marked on them and what they do; its stats and supply", () => {
    // (Its supply, read as Foundry reads a document's property.)
    globalThis.foundry = { utils: { getProperty: (o, path) => path.split(".").reduce((v, k) => v?.[k], o) } };
    let out;
    try {
      out = adapter.tacticHints(brand, {}, {});
    } finally {
      delete globalThis.foundry;
    }
    expect(values(out)).toEqual({ style: "frontline", resourceUse: "nova", healAggro: "aggressive", allyDying: "rescue", selfRevived: "healSelf" });
    expect(out.resourceUse.why).toBe("Swordmaster");
    // (Each with its reason.)
    expect(Object.entries(out).filter(([, { why }]) => !(typeof why === "string" && why))).toEqual([]);
    // (The Hound's one ability that secures an advantage isn't enough to lean on.)
    expect(out.specialty).toBeUndefined();
  });

  test("a foe: its nature (as its spec has it) and its kind, by its id", () => {
    expect(values(adapter.tacticHints(foeActor("npc:classic/ironlanders/raider", "Raider", 2), { nature: "people" }, {})))
      .toMatchObject({ talk: "first", expect: { kind: "money", amount: 1, coin: 1 } });
    expect(values(adapter.tacticHints(foeActor("npc:classic/animals/wolf", "Wolf", 2), { nature: "animal" }, {})))
      .toEqual({ beyond: "hunt", talk: "never", target: "weakest" });
  });

  /** A character's spec, as the adapter builds it for a token of it. */
  const specOf = async actor => {
    globalThis.foundry = { utils: { getProperty: (o, path) => path.split(".").reduce((v, k) => v?.[k], o) } };
    try {
      return await adapter.toCombatantSpec({ id: "token", name: actor.name, actor });
    } finally {
      delete globalThis.foundry;
    }
  };
  /** Brand with other assets: [id, name] each. */
  const carrying = (...assets) => ({ ...brand, items: items(assets.map(([dsid, name]) => ({ type: "asset", name, flags: flags(dsid), system: { abilities: [] } }))) });

  test("its moves: Heal, anyone's to make, is a Herbalist's specialty; a bow fights at range, whatever it's called, a staff doesn't", async () => {
    const heal = spec => spec.actions.find(a => a.move === "heal").special;
    expect(heal(await specOf(brand))).toBe(true);
    expect(heal(await specOf(carrying(["asset:classic/path/rider", "Rider"])))).toBe(false);
    // (Brand's edge is less than its iron: only an asset puts it at range.)
    const atRange = async (...assets) => (await specOf(carrying(...assets))).actions.filter(a => a.melee === false).map(a => a.move);
    expect(await atRange(["asset:classic/combat_talent/archer", "Bogenschütze"])).toEqual(["strike", "clash"]);
    expect(await atRange(["asset:classic/combat_talent/long_arm", "Long-Arm"])).toEqual([]);
    expect(await atRange()).toEqual([]);
  });

  test("its words: the system's for health and Supply, in the reader's language; no armor class", () => {
    const system = { "IRONSWORN.Health": "Leben", "IRONSWORN.Supply": "Vorrat" };
    const own = game.i18n;
    game.i18n = { ...own, has: k => k in system || own.has(k), localize: k => system[k] ?? own.localize(k) };
    expect([adapter.term("hp"), adapter.term("money"), adapter.term("ac"), adapter.term("level"), adapter.term("sp")]).toEqual(["Leben", "Vorrat", false, false, null]);
    // (A system without the word: FastFighting's own.)
    game.i18n = own;
    expect(adapter.term("hp")).toBeNull();
  });
});

describe("every answer is one of its question's choices", () => {
  const characters = [
    ["archer", "shield_bearer", "berserker", "herbalist", "revenant", "slayer", "diplomat", "trader", "fugitive", "alchemist"]
      .map(k => asset(`asset:classic/path/${k}`, k, [[true, "advantage", "compel", "heal", "aid"], [true, "advantage"], [true, "compel"]])),
    ["swordmaster", "kinetic", "mercenary", "courier", "cutthroat", "commander", "scoundrel", "loyalist", "demolitionist", "veteran"]
      .map(k => asset(`asset:starforged/path/${k}`, k, [[true], [true], [true]]))
  ].flatMap(list => list.map(a => pc([a])).concat([pc(list)]))
    // (No assets: its stats alone.)
    .concat([pc([], { stats: { edge: 1, iron: 3 } }), pc([], { stats: { edge: 3, iron: 1 } })]);
  const foes = [
    ["npc:classic/ironlanders/raider", "people"], ["npc:classic/ironlanders/common_folk", "people"], ["npc:classic/firstborn/giant", "firstborn"],
    ["npc:classic/firstborn/troll", "firstborn"], ["npc:classic/animals/wolf", "animal"], ["npc:classic/beasts/mammoth", "beast"],
    ["npc:classic/horrors/iron_revenant", "horror"], ["npc:starforged/sample_npcs/scrap_bandit", "people"], ["npc:starforged/sample_npcs/colossus", "machine"]
  ].map(([dsid, nature]) => foe(dsid, nature, dsid.split("/").pop(), 3))
    // (Nothing known of its kind, nor a name: its nature alone.)
    .concat(["horror", "machine", "beast"].map(nature => ironswornTactics({ pc: false, nature })));

  test("each answer a choice (offer and expect as the survey stores them), with a reason; the core takes them all", () => {
    for ( const out of [...characters, ...foes] ) {
      for ( const [k, { value, why }] of Object.entries(out) ) {
        expect(typeof why === "string" && why.length > 0).toBe(true);
        if ( k === "offer" || k === "expect" ) expect(["money", "noHarm", "passage", "leave"]).toContain(value.kind);
        else {
          expect(TACTIC_KEYS).toContain(k);
          expect(TACTIC_CHOICES[k]).toContain(value);
        }
      }
      // (As the core's auto setup takes them: every one, with its reason.)
      const spec = { actions: [], valuables: { money: 3, denominations: [{ label: "supply", value: 1 }] } };
      const taken = withHints({}, out, spec);
      expect(Object.keys(taken.why).sort()).toEqual(Object.keys(out).sort());
    }
  });

  test("Ironsworn has no potions and no shields to raise, and marks no signature attack: those it never answers", () => {
    for ( const out of [...characters, ...foes] ) for ( const k of ["potionThreshold", "shield", "preferredAction"] ) expect(out[k]).toBeUndefined();
  });
});
