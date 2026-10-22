/**
 * What the core gained since API 19, as this helper takes it up: every move a character makes is a table roll a live
 * battle shows as the move it is (the action die and its score, then each challenge die), whether the core rolls it
 * (rules.roll's `shown`) or the rules do (Endure Harm, Face Death, Endure Stress, Face Desolation, Face Danger, Enter
 * the Fray), with the harm and stress tables' d100s and persistent harm's end; the same dice as before. And what a
 * character is like on the core's hidden scale (aptitudes, API 23).
 */
import { describe, expect, test } from "vitest";
import { ironswornRules, endureStress } from "../scripts/rules.js";
import { characterMoves, foeNumbers } from "../scripts/build.js";
import { aptitudesOf, deriveIronswornTraits } from "../scripts/traits.js";
import { APTITUDES } from "../scripts/core.js";
import { beginRun, beginRound, prepareBattle } from "../../FastFighting/scripts/engine/simulator.js";
import { rollCheck } from "../../FastFighting/scripts/engine/probability.js";
import { createRng } from "../../FastFighting/scripts/engine/rng.js";
import { recordingRng } from "../../FastFighting/scripts/engine/table-rolls.js";
import { text } from "./foundry-i18n.js";

const move = key => text(`FFIRONSWORN.Move.${key}`);
const traits = t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { base: v, fudge: 0 }]));
function hero({ id = "kara", stats = { edge: 2, heart: 2, iron: 3, shadow: 1, wits: 1 }, ruleset = "classic", ...over } = {}) {
  return {
    id, name: id, side: "friendly", kind: "pc", level: 1, mover: true, ruleset, stats,
    hp: { value: 5, max: 5, temp: 0 }, defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 }, initiative: { mod: 0 }, speeds: { walk: 30 },
    resources: { momentum: 2 }, momentumReset: 2, momentumMax: 10, spirit: { value: 5, max: 5 }, iwr: { immune: [], weak: {}, resist: {} },
    actions: characterMoves({ id, stats, ruleset }), traits: traits(deriveIronswornTraits({ pc: true, stats }).traits), flags: {}, diesAtZero: false,
    social: { pitches: {}, resist: {}, languages: ["common"] }, ...over
  };
}
function foe({ id = "raider", rank = 2, ...over } = {}) {
  return {
    id, name: id, side: "hostile", kind: "npc", ...foeNumbers({ id, rank }), defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 }, initiative: { mod: 0 },
    speeds: { walk: 30 }, resources: {}, traits: traits(deriveIronswornTraits({ pc: false, rank, nature: "people" }).traits), flags: { fearless: true },
    diesAtZero: true, social: { pitches: {}, resist: {}, languages: ["common"] }, ...over
  };
}
const fight = list => ({ combatants: list, sides: { friendly: { label: "Ironsworn", enemies: ["hostile"] }, hostile: { label: "Foes", enemies: ["friendly"] } }, options: { positioning: false, maxRounds: 12, talking: false } });
/** A fight a round in, its dice coming up as given (the d6, then the two challenge dice ...), recorded as a live battle's. */
function begun(list, ...values) {
  const run = beginRun(prepareBattle(fight(list), ironswornRules), 1, { log: true });
  beginRound(run, 1);
  run.rng = recordingRng({ ...createRng(1), die: () => values.shift() });
  return run;
}
/** A roll's dice as [faces, results, which of its rolls]. */
const diceOf = roll => roll.groups.map(g => [g.faces, g.results, g.roll]);

describe("an action roll, shown as the move it is", () => {
  test("rolled by the core: the action die and its score (at most 10), then each challenge die on its own", () => {
    const rng = recordingRng({ ...createRng(1), die: (vals => () => vals.shift())([6, 3, 9]) });
    const roll = rollCheck(ironswornRules, rng, 5, 10, { by: "kara", kind: "attack", label: move("Strike") });
    expect(roll).toMatchObject({ natural: 6, total: 10, challenge: [3, 9], degree: 3 });
    const [shown] = rng.tray.rolls;
    expect(diceOf(shown)).toEqual([[6, [6], 0], [10, [3], 1], [10, [9], 2]]);
    expect(shown.rolls).toEqual([{ mod: 5, total: 10 }, { mod: 0, total: 3 }, { mod: 0, total: 9 }]);
  });

  test("a progress roll: its challenge dice alone (the score is no roll)", () => {
    const rng = recordingRng({ ...createRng(1), die: (vals => () => vals.shift())([4, 8]) });
    const roll = rollCheck(ironswornRules, rng, 6, 10, { by: "kara", kind: "attack", label: move("EndtheFight"), progress: true });
    expect(roll).toMatchObject({ total: 6, challenge: [4, 8], degree: 2 });
    const [shown] = rng.tray.rolls;
    expect(diceOf(shown)).toEqual([[10, [4], 0], [10, [8], 1]]);
    expect(shown.rolls).toEqual([{ mod: 0, total: 4 }, { mod: 0, total: 8 }]);
  });

  test("the same draws as before: a plain rng rolls just as it did, and records nothing", () => {
    const a = ironswornRules.roll(createRng(9), 2, 10);
    const b = ironswornRules.roll(recordingRng(createRng(9)), 2, 10);
    expect(b).toEqual(a);
  });
});

describe("the moves the rules roll themselves, shown", () => {
  test("Endure Harm, then (wounded, at 0 health) the harm table and Face Death", () => {
    const run = begun([hero({ wounded: true }), foe()], 1, 10, 10, 3, 6, 2, 4);
    const kara = run.byId.get("kara");
    kara.wounded = true;
    kara.hp = 0;
    const said = ironswornRules.afterHarm(run, kara, 2, run.rng);
    expect(said.data).toMatchObject({ result: "mortal", d100: 3, faceDeath: 3 });
    const [endure, table, face] = run.rng.tray.rolls;
    expect(endure).toMatchObject({ by: "kara", kind: "other", label: move("EndureHarm"), total: 4, degree: 0 });
    expect(diceOf(endure)).toEqual([[6, [1], 0], [10, [10], 1], [10, [10], 2]]);
    expect(table).toMatchObject({ by: "kara", kind: "other", label: text("FFIRONSWORN.Rolls.HarmTable"), total: 3 });
    expect(diceOf(table)).toEqual([[100, [3], 0]]);
    expect(face).toMatchObject({ by: "kara", label: move("FaceDeath"), total: 8, degree: 3 });
  });

  test("Endure Stress, then (shaken, at 0 spirit) the stress table and Face Desolation", () => {
    const run = begun([hero(), foe()], 1, 10, 10, 1, 1, 9, 9);
    const kara = run.byId.get("kara");
    Object.assign(kara, { spirit: 0, shaken: true });
    const said = endureStress(run, kara, 1, run.rng);
    expect(said.data).toMatchObject({ result: "desolation", d100: 1, gaveUp: true });
    expect(run.rng.tray.rolls.map(r => [r.label, r.total])).toEqual([
      [move("EndureStress"), 3], [text("FFIRONSWORN.Rolls.StressTable"), 1], [move("FaceDesolation"), 3]
    ]);
  });

  test("Face Danger to break free, or at a locked door: its stat and adds as the mod", () => {
    const run = begun([hero({ stats: { edge: 3, heart: 1, iron: 1, shadow: 1, wits: 1 } }), foe()], 4, 2, 5, 2, 2, 6);
    const kara = Object.assign(run.byId.get("kara"), { control: true });
    expect(ironswornRules.breakFree(run, kara, { key: "bound", others: "untie" }).degree).toBe(3);
    expect(ironswornRules.tryDoor(run, kara, { id: "d1" }, { method: "force", mod: 3, dc: 13 }).degree).toBe(2);
    expect(run.rng.tray.rolls.map(r => [r.by, r.label, r.mod, r.total])).toEqual([["kara", move("FaceDanger"), 3, 7], ["kara", move("FaceDanger"), 2, 4]]);
  });

  test("Enter the Fray, a character's first move: shown", () => {
    const run = begun([hero(), foe()], 5, 1, 2);
    const kara = run.byId.get("kara");
    delete kara.control;
    ironswornRules.startTurn?.(run, kara);
    const fray = run.rng.tray.rolls.find(r => r.label === move("EntertheFray"));
    expect(fray).toMatchObject({ by: "kara", kind: "other", natural: 5, degree: 3 });
    expect(kara.control).toBe(true);
  });

  test("persistent harm's end: a d10, 6 or more, shown as a flat check", () => {
    const rng = recordingRng({ ...createRng(1), die: () => 6 });
    expect(ironswornRules.persistentFlatCheck(rng, { unit: "kara" })).toBe(true);
    expect(rng.tray.rolls[0]).toMatchObject({ by: "kara", kind: "flat", what: "persistentEnd", dc: 6, total: 6, degree: 2 });
    expect(ironswornRules.persistentFlatCheck(createRng(1))).toEqual(expect.any(Boolean));
  });
});

describe("aptitudes", () => {
  test("a character's stats, as they stand on the scale: wits smart and wise, iron strong, edge fast, heart charismatic", () => {
    const apt = aptitudesOf({ edge: 1, heart: 3, iron: 2, shadow: 2, wits: 4 });
    expect(apt).toEqual({ smart: 4, strong: 2, fast: 1, wise: 4, charismatic: 3 });
    expect(Object.keys(apt).sort()).toEqual([...APTITUDES].sort());
    expect(aptitudesOf({ edge: 6, iron: -1 })).toMatchObject({ fast: 4, strong: 0, smart: 0 });
  });
});
