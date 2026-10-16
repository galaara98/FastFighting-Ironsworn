/**
 * Live battles in Ironsworn and Starforged: a character's spotlight read from the ironsworn system's move cards, whom
 * FastFighting would spotlight next, and a character's debilities or impacts as the conditions the GM puts on and the
 * sheet keeps.
 */
import { afterEach, describe, expect, test } from "vitest";
import { readIronswornTurn, rollOf, outcomeOf } from "../scripts/read-turn.js";
import { ironswornRules, endureStress, DEBILITIES, DEBILITY_KEYS } from "../scripts/rules.js";
import { characterMoves, foeNumbers } from "../scripts/build.js";
import { IronswornAdapter } from "../scripts/adapter.js";
import { beginLive, liveRound, pcTurnBegin, pcTurnEnd, nextSpotlight, setCondition, syncFromSheets, snapshotRun, restoreRun } from "../../FastFighting/scripts/engine/live.js";
import { captureUnit } from "../../FastFighting/scripts/engine/simulator.js";
import { diffOutcome } from "../../FastFighting/scripts/engine/changes.js";
import { CORE_CONDITIONS } from "../../FastFighting/scripts/engine/conditions.js";
import { text } from "./foundry-i18n.js";

/** A move card as the ironsworn system writes it: the roll as JSON in an attribute, escaped as Handlebars does. */
const card = ({ move = "move:classic/combat/strike", actorId = "actKara", die = 5, stat = 3, adds = 0, challenge = [4, 6], post = {}, progress = null } = {}) => {
  const roll = {
    preRollOptions: { actorId, moveDsId: move, ...(progress === null ? { stat: { source: "iron", value: stat } } : { progress: { source: "Raider", value: progress } }), adds },
    postRollOptions: post, rawActionDieValue: progress === null ? die : undefined, rawChallengeDiceValues: challenge
  };
  const json = JSON.stringify(roll).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  return { speaker: { actor: actorId, token: null }, content: `<div class="ironsworn-roll" data-ironswornroll='${json}'><h3>Strike</h3></div>` };
};
const context = { actorId: "actKara", tokenId: "tokKara" };

describe("a spotlight read from the ironsworn system's move cards", () => {
  test("the roll comes back off the card, and its outcome as the engine counts it", () => {
    expect(rollOf(card()).preRollOptions.moveDsId).toBe("move:classic/combat/strike");
    expect(outcomeOf(rollOf(card())).degree).toBe(3); // 8 beats 4 and 6
    expect(outcomeOf(rollOf(card({ challenge: [4, 9] }))).degree).toBe(2);
    expect(outcomeOf(rollOf(card({ challenge: [9, 10] }))).degree).toBe(1);
    expect(outcomeOf(rollOf(card({ challenge: [9, 9] }))).degree).toBe(0);
    // (Momentum burned: the outcome it bought.)
    expect(outcomeOf(rollOf(card({ challenge: [9, 10], post: { replacedOutcome: { value: 2, source: "Momentum" } } }))).degree).toBe(3);
    // (A progress roll: the progress alone, at most 10.)
    expect(outcomeOf(rollOf(card({ move: "move:classic/combat/end_the_fight", progress: 7, challenge: [3, 8] }))).degree).toBe(2);
  });

  test("Strike, Clash and End the Fight are blows at a foe the cards don't name; Compel is words", () => {
    const events = readIronswornTurn([
      card(),
      card({ move: "move:starforged/combat/clash", challenge: [9, 10] }),
      card({ move: "move:classic/combat/end_the_fight", progress: 8, challenge: [2, 5] }),
      card({ move: "move:starforged/adventure/compel", challenge: [1, 2] }),
      card({ move: "move:classic/suffer/endure_harm" })
    ], context);
    expect(events.map(e => [e.type, e.degree, e.targetId, e.aimless ?? false])).toEqual([
      ["attack", 3, null, true], ["attack", 1, null, true], ["attack", 3, null, true], ["talk", 3, null, false]
    ]);
    expect(events[0].action).toBe(text("FFIRONSWORN.Move.Strike"));
    expect(events[2]).toMatchObject({ finish: true, action: text("FFIRONSWORN.Move.EndtheFight") });
    expect(events.every(e => e.sure === false)).toBe(true);
  });

  test("a card as Foundry stores it (the attribute in double quotes, the JSON spread over lines) reads the same", () => {
    const json = JSON.stringify({ preRollOptions: { actorId: "actKara", moveDsId: "move:starforged/combat/strike", stat: { source: "iron", value: 2 } }, postRollOptions: {}, rawActionDieValue: 6, rawChallengeDiceValues: [1, 4] }, null, 2);
    const stored = { speaker: { actor: "actKara", token: null }, content: `<article class="ironsworn-roll flexcol" data-ironswornroll="${json.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"><h3>Strike</h3></article>` };
    expect(readIronswornTurn([stored], context)).toEqual([expect.objectContaining({ type: "attack", degree: 3, aimless: true })]);
  });

  test("another character's cards, and cards that aren't moves, are left out", () => {
    expect(readIronswornTurn([card({ actorId: "actVex" }), { speaker: { actor: "actKara" }, content: "<p>Hello</p>" }], context)).toEqual([]);
  });
});

describe("whom FastFighting would spotlight next", () => {
  const traits = { tactical: { base: 50, fudge: 0 }, brave: { base: 60, fudge: 0 } };
  const hero = id => ({
    id, name: id, side: "friendly", kind: "pc", level: 1, mover: true, ruleset: "classic", stats: { edge: 2, heart: 2, iron: 3, shadow: 1, wits: 1 },
    hp: { value: 5, max: 5, temp: 0 }, defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 }, initiative: { mod: 0 }, speeds: { walk: 30 },
    resources: { momentum: 2 }, momentumReset: 2, momentumMax: 10, iwr: { immune: [], weak: {}, resist: {} },
    actions: characterMoves({ id, stats: { edge: 2, heart: 2, iron: 3, shadow: 1, wits: 1 }, ruleset: "classic" }), traits, flags: {}, diesAtZero: false
  });
  const foe = id => ({ id, name: id, side: "hostile", kind: "npc", ...foeNumbers({ id, rank: 2, current: 0 }), defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 },
    initiative: { mod: 0 }, speeds: { walk: 30 }, resources: {}, traits, flags: { fearless: true }, diesAtZero: true });

  test("the characters one after another; the foes never take a spotlight of their own", () => {
    const spec = { combatants: [hero("kara"), foe("raider"), hero("vex")], sides: { friendly: { label: "Ironsworn", enemies: ["hostile"] }, hostile: { label: "Foes", enemies: ["friendly"] } },
      options: { positioning: false, maxRounds: 12, talking: false, initiativeOrder: ["kara", "raider", "vex"] } };
    const run = beginLive(spec, ironswornRules, { seed: 2, players: ["kara", "vex"] });
    liveRound(run, 1);
    for ( const u of run.units ) u.active = true;
    expect(nextSpotlight(run).id).toBe("kara");
    pcTurnBegin(run, "kara");
    pcTurnEnd(run, "kara", []);
    expect(nextSpotlight(run).id).toBe("vex");
    pcTurnBegin(run, "vex");
    pcTurnEnd(run, "vex", []);
    expect(nextSpotlight(run).id).toBe("kara");
  });
});

describe("debilities and impacts: conditions the GM puts on, kept on the sheet", () => {
  const adapter = new IronswornAdapter();
  const getProperty = (o, path) => path.split(".").reduce((v, k) => v?.[k], o);
  const setProperty = (o, path, value) => {
    const keys = path.split(".");
    const last = keys.pop();
    keys.reduce((v, k) => (v[k] ??= {}), o)[last] = value;
  };
  afterEach(() => { delete globalThis.foundry; });
  /** A token as foundry-ironsworn keeps it: a character with those debilities marked (the rest not), or a foe. */
  const token = (type = "character", marked = []) => {
    const actor = {
      type, id: `act-${type}`, uuid: `Actor.act-${type}`, name: type, statuses: new Set(), effects: [], items: [], updates: 0,
      system: type !== "character" ? {} : {
        edge: 2, heart: 2, iron: 3, shadow: 1, wits: 1, health: { value: 5, max: 5 }, spirit: { value: 5, max: 5 }, supply: { value: 3, max: 5 },
        momentum: { value: 2, max: 10, resetValue: 2 }, debility: Object.fromEntries(DEBILITY_KEYS.map(k => [k, marked.includes(k)]))
      },
      async update(data) {
        this.updates++;
        for ( const [path, value] of Object.entries(data) ) setProperty(this, path, value);
        return this;
      }
    };
    return { id: `tok-${type}`, uuid: `Scene.s.Token.tok-${type}`, name: type, actor, parent: null };
  };
  /** One turn's change set (engine/changes.js) with only conditions in it, written on a character. */
  const write = (doc, spec, set, cleared = []) => adapter.commitChanges(doc, spec, { conditions: { set, cleared } }, { system: {} }, {});

  test("one put on goes on the sheet by the system's id and is read back as the same key; taken off, it comes off", async () => {
    globalThis.foundry = { utils: { getProperty, setProperty } };
    const doc = token("character", ["wounded"]);
    const spec = await adapter.toCombatantSpec(doc);
    expect(spec.conditions).toEqual({ wounded: 1 });
    const undo = await write(doc, spec, { unprepared: 1, permanentlyharmed: 1 });
    expect(doc.actor.system.debility).toMatchObject({ wounded: true, unprepared: true, permanentlyharmed: true, shaken: false });
    // (Rewound, each as it was.)
    expect(undo.actorUpdate).toEqual({ "system.debility.unprepared": false, "system.debility.permanentlyharmed": false });
    expect((await adapter.readLiveState(doc)).conditions).toEqual({ wounded: 1, unprepared: 1, permanentlyharmed: 1 });
    const off = await write(doc, spec, {}, ["wounded", "unprepared"]);
    expect(off.actorUpdate).toEqual({ "system.debility.wounded": true, "system.debility.unprepared": true });
    expect((await adapter.readLiveState(doc)).conditions).toEqual({ permanentlyharmed: 1 });
    // Written again, nothing more happens; the core's own conditions aren't the sheet's to carry.
    const updates = doc.actor.updates;
    await write(doc, spec, {}, ["wounded"]);
    await write(doc, spec, { frightened: 2, stunned: 1 }, ["prone"]);
    expect(doc.actor.updates).toBe(updates);
  });

  test("its sheet carries every debility and impact, and nothing else; a foe's carries none", async () => {
    globalThis.foundry = { utils: { getProperty, setProperty } };
    const state = await adapter.readLiveState(token("character", DEBILITY_KEYS));
    expect(Object.keys(state.conditions).sort()).toEqual([...DEBILITY_KEYS].sort());
    expect(state.carries).toBeUndefined(); // (the core asks sheetCarries)
    for ( const key of DEBILITY_KEYS ) expect(adapter.sheetCarries(key)).toBe(true);
    for ( const { key } of CORE_CONDITIONS ) expect(adapter.sheetCarries(key)).toBe(false);
    // (What it offers of its own, it carries.)
    expect(adapter.conditionChoices().filter(c => adapter.sheetCarries(c.key)).map(c => c.key).sort()).toEqual([...DEBILITY_KEYS].sort());
    // A foe has no debilities: whatever the GM puts on one, FastFighting keeps.
    const foe = await adapter.readLiveState(token("foe"));
    expect(foe.conditions).toEqual({});
    expect(DEBILITY_KEYS.some(key => foe.carries(key))).toBe(false);
    // (And so the Battle Interface, asking for that creature, says so.)
    expect(DEBILITY_KEYS.some(key => adapter.sheetCarries(key, token("foe").actor))).toBe(false);
    expect(DEBILITY_KEYS.every(key => adapter.sheetCarries(key, token("character").actor))).toBe(true);
  });

  test("the GM's choices: the debilities of the rulesets the world has on, in the system's words, then the core's own", () => {
    const system = { "IRONSWORN.IMPACT.Wounded": "verletzt", "IRONSWORN.DEBILITY.Wounded": "verwundet", "IRONSWORN.DEBILITY.Maimed": "verstümmelt" };
    const own = game.i18n;
    game.i18n = { ...own, has: k => k in system || own.has(k), localize: k => system[k] ?? own.localize(k) };
    // The impact's word first, as the system has it; one only Ironsworn has, its debility's; none, the core's own.
    expect(["wounded", "maimed", "doomed", "frightened"].map(k => adapter.conditionLabel(k))).toEqual(["Verletzt", "Verstümmelt", null, null]);
    // (No ruleset known: every one.)
    const keys = () => adapter.conditionChoices().map(c => c.key);
    expect(keys()).toEqual([...DEBILITY_KEYS, ...CORE_CONDITIONS.map(c => c.key)]);
    // A world that plays Ironsworn alone: its debilities, in their words.
    game.settings = { get: (id, key) => key === "ruleset-classic" };
    expect(keys().filter(k => adapter.sheetCarries(k))).toEqual(DEBILITIES.classic);
    expect(adapter.conditionLabel("wounded")).toBe("Verwundet");
    // Sundered Isles: Starforged's impacts.
    game.settings = { get: (id, key) => key === "ruleset-sundered_isles" };
    expect(keys().filter(k => adapter.sheetCarries(k))).toEqual(DEBILITIES.starforged);
    expect(adapter.conditionLabel("wounded")).toBe("Verletzt");
  });

  const traits = { tactical: { base: 50, fudge: 0 }, brave: { base: 60, fudge: 0 } };
  const stats = { edge: 2, heart: 2, iron: 3, shadow: 1, wits: 1 };
  /** Kara with a wound and unprepared on her sheet (as the adapter reads them), and a raider. */
  const spec = () => ({
    combatants: [
      { id: "kara", name: "kara", side: "friendly", kind: "pc", level: 1, mover: true, ruleset: "classic", stats, hp: { value: 5, max: 5, temp: 0 }, spirit: { value: 5, max: 5 },
        defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 }, initiative: { mod: 0 }, speeds: { walk: 30 }, resources: { momentum: 2 }, momentumReset: 2, momentumMax: 10,
        iwr: { immune: [], weak: {}, resist: {} }, actions: characterMoves({ id: "kara", stats, ruleset: "classic" }), traits, flags: {}, diesAtZero: false,
        wounded: true, conditions: { wounded: 1, unprepared: 1 } },
      { id: "raider", name: "raider", side: "hostile", kind: "npc", ...foeNumbers({ id: "raider", rank: 2, current: 0 }), defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 },
        initiative: { mod: 0 }, speeds: { walk: 30 }, resources: {}, traits, flags: { fearless: true }, diesAtZero: true }
    ],
    sides: { friendly: { label: "Ironsworn", enemies: ["hostile"] }, hostile: { label: "Foes", enemies: ["friendly"] } },
    options: { positioning: false, maxRounds: 12, talking: false, initiativeOrder: ["kara", "raider"] }
  });
  /** Dice that miss (a 1 against two 10s); a d100 of 100 (still standing; perseveres). */
  const miss = { die: faces => ({ 6: 1, 10: 10 })[faces] ?? 100 };

  test("wounded and shaken are its conditions: the GM's word or the sheet's counts for the rules, and what the fight marks goes on the sheet", () => {
    const run = beginLive(spec(), ironswornRules, { seed: 2, players: ["kara"] });
    const kara = run.byId.get("kara");
    expect([kara.wounded, kara.shaken, kara.conds]).toEqual([true, false, { wounded: 1, unprepared: 1 }]);
    // At 0 spirit, a miss on Endure Stress: shaken by the GM's word, the stress table; taken off again, it marks shaken.
    kara.spirit = 0;
    setCondition(run, "kara", { key: "shaken" });
    expect(endureStress(run, kara, 1, miss).data.result).toBe("perseveres");
    setCondition(run, "kara", { key: "shaken", value: 0 });
    expect(kara.shaken).toBe(false);
    const before = captureUnit(kara, ironswornRules);
    expect(endureStress(run, kara, 1, miss).data.shaken).toBe(true);
    // (Marked as the condition, so the turn writes it on the sheet.)
    expect(diffOutcome(before, captureUnit(kara, ironswornRules)).conditions).toEqual({ set: { shaken: 1 }, cleared: [] });
    // At 0 health, a miss on Endure Harm: wounded on the sheet, the harm table; the GM takes the wound off, it marks one.
    kara.hp = 0;
    expect(ironswornRules.afterHarm(run, kara, 1, miss).data.result).toBe("standing");
    setCondition(run, "kara", { key: "wounded", value: 0 });
    expect(ironswornRules.afterHarm(run, kara, 1, miss).data.wounded).toBe(true);
    expect(kara.wounded).toBe(true);
    // The sheet read again: the player cleared both. The rules follow it.
    syncFromSheets(run, { kara: { conditions: { unprepared: 1 }, carries: key => adapter.sheetCarries(key) } });
    expect([kara.wounded, kara.shaken, kara.conds]).toEqual([false, false, { unprepared: 1 }]);
  });

  test("kept with the battle: taken back and played again, wounded and shaken are as they were", () => {
    const run = beginLive(spec(), ironswornRules, { seed: 2, players: ["kara"] });
    // The GM takes the sheet's wound off, and shakes her for two rounds.
    setCondition(run, "kara", { key: "wounded", value: 0 });
    setCondition(run, "kara", { key: "shaken", rounds: 2 });
    const back = restoreRun(spec(), ironswornRules, JSON.parse(JSON.stringify(snapshotRun(run)))).byId.get("kara");
    expect([back.wounded, back.shaken, back.conds]).toEqual([false, true, { unprepared: 1, shaken: 1 }]);
    expect(back.effects.map(e => [e.key, e.rounds])).toEqual([["gm:shaken", 2]]);
  });
});
