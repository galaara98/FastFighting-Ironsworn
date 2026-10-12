/**
 * Every playstyle perk in Ironsworn's terms: a friend put in harm's way (a taunter, one who draws attacks, a friend
 * beside one keeping a low profile), a foe's provocation (Face Danger, +heart), Heal, a hazard's Face Danger (+edge), one
 * in a hurry taking End the Fight on sooner, momentum by the resources answer, a low profile in the fray, Secure an
 * Advantage for spoilers and Puzzle-Maniacs.
 */
import { describe, expect, test } from "vitest";
import { ironswornRules } from "../scripts/rules.js";
import { characterMoves, foeNumbers, advantageMoves, healMove } from "../scripts/build.js";
import { deriveIronswornTraits } from "../scripts/traits.js";
import { replay } from "../../FastFighting/scripts/engine/simulator.js";
import { createRng } from "../../FastFighting/scripts/engine/rng.js";
import { STATUS } from "../scripts/core.js";

const traits = t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { base: v, fudge: 0 }]));
const unit = (id, side, spec = {}, extra = {}) => ({ id, side, status: STATUS.STANDING, active: true, effects: [], adjacent: new Set(), resources: { momentum: 5 }, spec: { name: id, ...spec }, ...extra });
const mover = (id, behavior = {}, extra = {}) => unit(id, "friendly", { mover: true, ruleset: "classic", behavior, stats: { edge: 1, heart: 1, iron: 1, shadow: 3, wits: 2 } }, extra);
const runOf = (units, seed = 1) => ({ prep: { options: { positioning: false }, sides: { friendly: { enemies: new Set(["hostile"]) }, hostile: { enemies: new Set(["friendly"]) } } }, units, rng: createRng(seed), byId: new Map(units.map(u => [u.id, u])) });
const strike = { move: "strike" };

describe("Pay the Price: a friend put in harm's way", () => {
  test("a friend whose taunt the foe is under takes it", () => {
    const [me, tank] = [mover("me"), mover("tank")];
    const foe = unit("foe", "hostile", { rank: 2 }, { effects: [{ taunt: 65, sourceId: "tank" }] });
    const cost = ironswornRules.backlash(runOf([me, tank, foe]), me, foe, strike, 1);
    expect(cost.to).toBe(tank);
    expect(cost.damage[0].flat).toBe(2);
    expect(cost.said.text).toBeTruthy();
  });

  test("one who draws attacks steps in, as often as its perk; with no such friend, it pays itself", () => {
    const foe = unit("foe", "hostile", { rank: 2 });
    const me = mover("me");
    expect(ironswornRules.backlash(runOf([me, mover("pal", { drawAggro: 1 }), foe]), me, foe, strike, 1).to?.id).toBe("pal");
    expect(ironswornRules.backlash(runOf([me, mover("pal"), foe]), me, foe, strike, 1).to).toBeUndefined();
  });

  test("keeping a low profile, the foe's eye slides to a friend beside it who doesn't", () => {
    const foe = unit("foe", "hostile", { rank: 2 });
    const me = mover("me", { lowProfile: 1 });
    expect(ironswornRules.backlash(runOf([me, mover("pal"), foe]), me, foe, strike, 1).to?.id).toBe("pal");
    expect(ironswornRules.backlash(runOf([me, mover("pal", { lowProfile: 1 }), foe]), me, foe, strike, 1).to).toBeUndefined();
  });
});

describe("what a character can do", () => {
  test("Heal: +wits, +2 health on a hit, only in control; a weak hit costs momentum, a miss the price", () => {
    const heal = healMove({ id: "me", stats: { wits: 2 } });
    expect(heal).toMatchObject({ kind: "heal", move: "heal", healCheck: { mod: 2, dc: 10 } });
    expect(characterMoves({ id: "me", stats: { iron: 2, edge: 1, wits: 2 } }).some(a => a.move === "heal")).toBe(true);
    const u = mover("me", {}, { control: false });
    expect(ironswornRules.usable(null, u, heal, null)).toBe(false);
    u.control = true;
    expect(ironswornRules.usable(null, u, heal, null)).toBe(true);
    expect([0, 1, 2, 3].map(d => ironswornRules.healCheckMultiplier(d))).toEqual([0, 0, 1, 1]);
    ironswornRules.afterRoll(null, u, { degree: 2 }, { kind: "heal" });
    expect(u).toMatchObject({ control: true, resources: { momentum: 4 } });
    ironswornRules.afterRoll(null, u, { degree: 1 }, { kind: "heal" });
    expect(u).toMatchObject({ control: false, resources: { momentum: 3 } });
  });

  test("Secure an Advantage is what a spoiler and a Puzzle-Maniac go for; one in a hurry doesn't stop for it", () => {
    const [self] = advantageMoves({ id: "me", stats: { edge: 2 } });
    expect(self).toMatchObject({ setup: true, leans: ["hinders", "exploitWeakness"] });
  });

  test("with assets, Securing an Advantage is its specialty (an Un-Mundane character leans on it)", () => {
    const own = assets => characterMoves({ id: "me", stats: { edge: 2, iron: 1 }, assets }).find(a => a.move === "advantage" && a.targets === "self").special;
    expect(own(true)).toBe(true);
    expect(own(false)).toBe(false);
  });

  test("in a hurry, End the Fight two boxes sooner", () => {
    const finish = { move: "finish" };
    const foe = unit("foe", "hostile", { rank: 2 }, { hp: 28, maxHp: 40 });
    const u = mover("me", {}, { control: true });
    // (Three boxes marked: 12 of 40 ticks.)
    expect(ironswornRules.usable(null, u, finish, foe)).toBe(false);
    u.hurried = true;
    expect(ironswornRules.usable(null, u, finish, foe)).toBe(true);
  });

  test("the resources answer says when momentum is burned: conserving, never for a weak hit; all out, readily", () => {
    const burn = resourceUse => {
      const u = mover("me", {}, { tac: { resourceUse } });
      u.resources.momentum = 5;
      return ironswornRules.adjustRoll(null, u, { degree: 2, total: 4, challenge: [3, 4] }, { stakes: 0.3 }).degree;
    };
    expect(burn("conserve")).toBe(2);
    expect(burn("balanced")).toBe(2);
    expect(burn("nova")).toBe(3);
  });

  test("keeping a low profile, it moves into position unseen: Enter the Fray +shadow", () => {
    const statOf = behavior => {
      const run = runOf([mover("me", behavior)]);
      return [ironswornRules.startTurn(run, run.units[0])].flat().find(s => s?.data?.move === "fray").data.stat;
    };
    expect(statOf({})).toBe("heart");
    expect(statOf({ lowProfile: 0.3 })).toBe("shadow");
  });
});

describe("hazards", () => {
  test("a hazard catches a character, and it Faces Danger (+edge): any hit gets clear", () => {
    const trap = unit("trap", "hostile", { hazard: { once: false } }, { prep: { offense: [{ id: "t", kind: "strike", bonus: 4, damage: [] }] } });
    const me = mover("me");
    expect(ironswornRules.canTarget(null, trap, me)).toBe(true);
    expect(ironswornRules.canTarget(null, unit("foe", "hostile", { rank: 2 }), me)).toBe(false);
    ironswornRules.initRun({ units: [trap, me] });
    expect(trap.prep.offense[0]).toMatchObject({ kind: "save", save: { type: "edge", faceDanger: true } });
    expect([1, 2, 3].map(d => ironswornRules.saveMultiplier(d, { faceDanger: true }))).toEqual([1, 0, 0]);
    ironswornRules.afterRoll(null, me, { degree: 2 }, { kind: "save", type: "edge" });
    expect(me.resources.momentum).toBe(4);
  });
});

describe("a foe that taunts", () => {
  const hero = (id, behavior = {}) => ({
    id, name: id, side: "friendly", kind: "pc", level: 1, mover: true, ruleset: "classic", stats: { edge: 1, heart: 1, iron: 2, shadow: 1, wits: 1 }, behavior,
    hp: { value: 5, max: 5, temp: 0 }, defenses: { ac: 10, fortitude: 2, reflex: 1, will: 1 }, initiative: { mod: 0 }, speeds: { walk: 30 },
    resources: { momentum: 2 }, momentumReset: 2, momentumMax: 10, iwr: { immune: [], weak: {}, resist: {} }, actions: characterMoves({ id, stats: { edge: 1, heart: 1, iron: 2, shadow: 1, wits: 1 } }),
    traits: traits(deriveIronswornTraits({ pc: true, stats: { iron: 2 } }).traits), flags: {}, diesAtZero: false, social: { pitches: {}, resist: {}, languages: ["common"] }
  });
  const bully = id => ({
    id, name: id, side: "hostile", kind: "npc", ...foeNumbers({ id, rank: 4 }), defenses: { ac: 10 }, initiative: { mod: 0 }, speeds: { walk: 30 }, resources: {}, behavior: { taunt: 1 },
    traits: traits(deriveIronswornTraits({ pc: false, rank: 4 }).traits), flags: { fearless: true }, diesAtZero: true, social: { pitches: {}, resist: {}, languages: ["common"] }
  });
  const fights = behavior => {
    let provoked = 0;
    let taunted = 0;
    for ( let seed = 1; seed <= 20; seed++ ) {
      const spec = { combatants: [hero("kara", behavior), bully("brute"), bully("thug")], sides: { friendly: { label: "I", enemies: ["hostile"] }, hostile: { label: "F", enemies: ["friendly"] } },
        options: { positioning: false, maxRounds: 4, talking: true, tauntLuck: 100 } };
      const log = replay(spec, ironswornRules, seed).log.filter(e => e.type === "startTurn" && e.move === "faceDanger");
      provoked += log.length;
      taunted += log.filter(e => e.taunted).length;
    }
    return { provoked, taunted };
  };

  test("doesn't roll: it provokes, the character Faces Danger (+heart); a miss, it rises to it, unless it shrugs taunts off", () => {
    const plain = fights({});
    expect(plain.provoked).toBeGreaterThan(0);
    expect(plain.taunted).toBeGreaterThan(0);
    expect(fights({ tauntProof: 0.9 }).taunted).toBeLessThan(plain.taunted);
  });
});
