import { describe, expect, test } from "vitest";
import { TICKS, TRACK } from "../scripts/moves.js";
import { ironswornRules, endureStress } from "../scripts/rules.js";
import { characterMoves, foeNumbers } from "../scripts/build.js";
import { deriveIronswornTraits } from "../scripts/traits.js";
import { defaultMode, defaultRank, joinEncounter, trackProgress, STEPS, ENCOUNTER, boxes, DOOR_HARM, doorHarmOf, doorsFor } from "../scripts/conflict.js";
import { replay, prepareBattle } from "../../FastFighting/scripts/engine/simulator.js";
import { createRun } from "../../FastFighting/scripts/engine/battle-state.js";
import { createRng } from "../../FastFighting/scripts/engine/rng.js";
import { stepsToConvince } from "../../FastFighting/scripts/engine/behavior/talk.js";
import { turnOn, joinSide } from "../../FastFighting/scripts/engine/behavior/neutral.js";

const traits = t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { base: v, fudge: 0 }]));
const speaking = stats => ({ pitches: { persuade: { skill: "heart", mod: stats.heart }, intimidate: { skill: "iron", mod: stats.iron }, deceive: { skill: "shadow", mod: stats.shadow } }, resist: {}, languages: ["common"] });

function hero({ id = "kara", stats = { edge: 2, heart: 2, iron: 3, shadow: 1, wits: 1 }, ruleset = "starforged", spirit = 5, ...over } = {}) {
  return {
    id, name: id, side: "friendly", kind: "pc", level: 1, mover: true, ruleset, stats,
    hp: { value: 5, max: 5, temp: 0 }, spirit: { value: spirit, max: 5 }, defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 }, initiative: { mod: 0 }, speeds: { walk: 30 },
    resources: { momentum: 2 }, momentumReset: 2, momentumMax: 10, iwr: { immune: [], weak: {}, resist: {} },
    actions: characterMoves({ id, stats, ruleset }), traits: traits(deriveIronswornTraits({ pc: true, stats }).traits), flags: {}, diesAtZero: false,
    social: speaking(stats), ...over
  };
}
function foe({ id = "raider", rank = 2, nature = "people", ...over } = {}) {
  return {
    id, name: id, side: "hostile", kind: "npc", ...foeNumbers({ id, rank }), nature, defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 }, initiative: { mod: 0 }, speeds: { walk: 30 },
    resources: {}, traits: traits(deriveIronswornTraits({ pc: false, rank, nature }).traits), flags: { fearless: true }, diesAtZero: true,
    social: { pitches: {}, resist: {}, languages: ["common"] }, ...over
  };
}
const fight = (combatants, options = {}) => ({ combatants, sides: { friendly: { label: "Ironsworn", enemies: ["hostile"] }, hostile: { label: "Foes", enemies: ["friendly"] } }, options: { positioning: false, maxRounds: 12, talking: false, ...options } });

describe("how an encounter is tracked", () => {
  test("one track for the encounter where anyone plays Starforged's moves; at its most dangerous foe's rank", () => {
    expect(defaultMode(["classic", "starforged"])).toBe("encounter");
    expect(defaultMode(["sundered_isles"])).toBe("encounter");
    expect(defaultMode(["classic"])).toBe("foes");
    expect(defaultRank([1, 3, 2])).toBe(3);
    expect(defaultRank([])).toBe(2);
  });

  test("a foe on the encounter's track: the track's ticks are its hit points, marked at the encounter's rank", () => {
    const f = joinEncounter(foe({ rank: 1 }), { rank: 3, current: 12 });
    expect(f).toMatchObject({ sharedHp: ENCOUNTER, hp: { value: TRACK - 12, max: TRACK }, rank: 1, objectiveRank: 3 });
    expect(f.iwr.ticksPerHarm).toBe(TICKS[3]);
    expect(f.social.steps).toBe(STEPS[3]);
  });

  test("the rank says how many successes it takes to talk a foe round", () => {
    const run = createRun(prepareBattle(fight([hero(), joinEncounter(foe(), { rank: 1 }), joinEncounter(foe({ id: "chief" }), { rank: 5 })]), ironswornRules));
    expect(stepsToConvince(run.byId.get("raider"), run)).toBe(STEPS[1]);
    expect(stepsToConvince(run.byId.get("chief"), run)).toBe(STEPS[5]);
  });
});

describe("a locked door, as the conflict makes it", () => {
  const doors = { d1: { locked: true, x: 20, y: 0 }, d2: { locked: true, x: 40, y: 0, hp: 6 } };

  test("Ironsworn's (each foe's own track): as much harm as the world's setting, 1 to 3; a door's own hit points first", () => {
    expect(doorsFor(doors, { mode: "foes", harm: 2 })).toEqual({ d1: { locked: true, x: 20, y: 0, hp: 2 }, d2: doors.d2 });
    expect(doorsFor(doors, { mode: "foes" }).d1.hp).toBe(DOOR_HARM.default);
    expect([0, 1, 2.4, 3, 9, "2", null, undefined, "", "x"].map(doorHarmOf)).toEqual([1, 1, 2, 3, 3, 2, 3, 3, 3, 3]);
    expect(DOOR_HARM).toMatchObject({ min: 1, max: 3, step: 1, default: 3 });
    expect(doors.d1.hp).toBeUndefined(); // (the scene's own left as it was)
  });

  test("Starforged's (one track for the encounter): a step of progress forward, one hit, whatever the setting says", () => {
    expect(doorsFor(doors, { mode: "encounter", harm: 3 })).toEqual({ d1: { locked: true, x: 20, y: 0, hp: 1 }, d2: doors.d2 });
    // (No doors, or none on the map: nothing to do.)
    expect([doorsFor({}, { mode: "foes" }), doorsFor(null, { mode: "foes" })]).toEqual([{}, null]);
  });
});

describe("one track for the encounter", () => {
  const spec = (rank = 2) => fight([hero(), hero({ id: "ash", stats: { edge: 3, heart: 1, iron: 2, shadow: 2, wits: 1 } }),
    joinEncounter(foe(), { rank }), joinEncounter(foe({ id: "raider2" }), { rank }), joinEncounter(foe({ id: "chief", rank: 3 }), { rank })]);

  test("what one foe takes, all of them take; they fall together, or the objective is lost", () => {
    let won = 0;
    let lost = 0;
    for ( let seed = 1; seed <= 40; seed++ ) {
      const r = replay(spec(), ironswornRules, seed);
      const foes = ["raider", "raider2", "chief"].map(id => r.units[id].final);
      // (One track: every foe ends with the same ticks left on it.)
      expect(new Set(foes.map(f => Math.max(0, f.hp))).size).toBe(1);
      const end = r.log.find(e => e.type === "end");
      if ( end.resolved === "objectiveLost" ) {
        lost++;
        expect(end.winners).toEqual(["hostile"]);
      } else if ( foes.every(f => f.status === "beaten") ) won++;
    }
    expect(won).toBeGreaterThan(0);
    expect(won + lost).toBeGreaterThan(20);
  });

  test("the track's progress, for the planner's summary: the fight's ticks, and a mark for each success in words", () => {
    const plan = { mode: "encounter", rank: 2, before: 8, foeIds: ["a", "b"], friendly: "friendly" };
    const done = { units: { a: { final: { hp: 0 } }, b: { final: { hp: 0 } } }, log: [{ type: "end", winners: ["friendly"] }] };
    expect(trackProgress(plan, done)).toMatchObject({ before: 8, after: 40, achieved: true, lost: false });
    const talked = { units: { a: { final: { hp: 32 } }, b: { final: { hp: 32 } } }, log: [
      { type: "talk", side: "friendly", targetId: "a", degree: 3 }, { type: "talk", side: "friendly", targetId: "b", degree: 2 },
      { type: "talk", side: "friendly", targetId: "a", degree: 1 }, { type: "talk", side: "hostile", targetId: "kara", degree: 3 },
      { type: "end", resolved: "objectiveLost", winners: ["hostile"] }] };
    expect(trackProgress(plan, talked)).toMatchObject({ before: 8, after: 8 + 3 * TICKS[2], talked: 3 * TICKS[2], fought: 0, lost: true, achieved: false });
    expect(boxes(22)).toBe(5);
  });
});

describe("beaten, or killed", () => {
  const spec = cruel => fight([hero({ playstyles: cruel ? ["cruel"] : [], behavior: cruel ? { finishDowned: 0.4 } : {} }), foe(), foe({ id: "raider2" })]);

  test("a foe whose track is full is beaten (the table says what that means); a Cruel character kills it", () => {
    for ( const cruel of [false, true] ) {
      let fallen = 0;
      for ( let seed = 1; seed <= 30; seed++ ) {
        const r = replay(spec(cruel), ironswornRules, seed);
        for ( const id of ["raider", "raider2"] ) {
          const f = r.units[id].final;
          if ( f.status === "standing" ) continue;
          if ( f.status !== "beaten" && f.status !== "dead" ) continue;
          fallen++;
          expect(f.status).toBe(cruel ? "dead" : "beaten");
          const e = r.log.find(x => x.type === "beaten" && x.actorId === id);
          expect(!!e?.killed).toBe(cruel);
        }
      }
      expect(fallen).toBeGreaterThan(0);
    }
  });

  test("an ally going down weighs on the characters beside it: Endure Stress", () => {
    const run = createRun(prepareBattle(fight([hero(), hero({ id: "ash" }), foe()]), ironswornRules));
    run.rng = createRng(4);
    for ( const u of run.units ) ironswornRules.initUnit(u);
    const [kara, ash] = [run.byId.get("kara"), run.byId.get("ash")];
    const said = ironswornRules.onFall(run, ash, { dead: true });
    expect(said.map(s => s.unit)).toEqual([kara]);
    expect(said[0].data.stress).toBe(2);
    // (A foe falling weighs on nobody: foes have no spirit.)
    expect(ironswornRules.onFall(run, run.byId.get("raider"), {})).toEqual([]);
  });
});

describe("someone taking a side mid-fight", () => {
  /** Two characters, two raiders, and three taking no side: a team of two ("camp"), and one alone. */
  const setUp = ({ track = true, rank = 2, leader = null } = {}) => {
    const join = f => (track ? joinEncounter(f, { rank }) : f);
    const neutral = (id, group) => foe({ id, side: "neutralParty", ...(group ? { group } : {}) });
    const run = createRun(prepareBattle({
      ...fight([hero(), hero({ id: "ash" }), join(foe()), join(foe({ id: "raider2" })), neutral("hunter", "camp"), neutral("tracker", "camp"), neutral("loner")]),
      sides: { friendly: { label: "Ironsworn", enemies: ["hostile"] }, hostile: { label: "Foes", enemies: ["friendly"] }, neutralParty: { label: "Neutral", enemies: [] } },
      command: leader ? { camp: [{ id: leader, role: "leader" }] } : {}
    }, ironswornRules));
    run.rng = createRng(2);
    for ( const u of run.units ) ironswornRules.initUnit(u);
    const said = [];
    const turns = who => turnOn(run, run.byId.get(who), run.byId.get("kara"), "insulted", (u, e) => said.push(e));
    // (What it means is settled at the next turn.)
    const settle = () => [ironswornRules.startTurn(run, run.byId.get("raider"))].flat();
    return { run, said, turns, settle, raider: run.byId.get("raider"), kara: run.byId.get("kara") };
  };

  test("a whole team turning on the party: the objective is a step harder, and they're part of its track", () => {
    const { run, turns, settle, raider } = setUp();
    turns("hunter");
    turns("tracker");
    expect(run.byId.get("hunter")).toMatchObject({ sharedHp: ENCOUNTER, hp: raider.hp });
    const said = settle();
    expect(said).toEqual([expect.objectContaining({ data: expect.objectContaining({ move: "foe", trackRank: 3 }) })]);
    expect(raider).toMatchObject({ trackRank: 3, trackTicks: TICKS[3], convinceSteps: STEPS[3] });
    expect(run.byId.get("tracker").trackTicks).toBe(TICKS[3]);
    expect(ironswornRules.applyIwr(raider.spec.iwr, { harm: 2 }, raider)).toBe(2 * TICKS[3]);
    // (The fight's own change: the stored foe is as it was, for the next fight.)
    expect(raider.spec.iwr.ticksPerHarm).toBe(TICKS[2]);
    expect(trackProgress({ mode: "encounter", rank: 2, before: 0, foeIds: [], friendly: "friendly" }, { units: {}, log: said.map(x => x.data) }).rank).toBe(3);
  });

  test("a leader turning on the party makes it harder too; one of a team, or one alone, is stress", () => {
    const led = setUp({ leader: "hunter" });
    led.turns("hunter");
    expect(led.settle()[0].data.trackRank).toBe(3);
    for ( const who of ["hunter", "loner"] ) {
      const { turns, settle, raider } = setUp();
      turns(who);
      const said = settle();
      expect(said[0].data).toMatchObject({ move: "foe" });
      expect(said.slice(1).map(x => x.unit.id).sort()).toEqual(["ash", "kara"]);
      expect(said.slice(1).every(x => x.data.move === "stress")).toBe(true);
      expect(raider.trackRank ?? 2).toBe(2);
    }
  });

  test("never to epic: a step that would make it epic is stress instead; so is each foe on its own track", () => {
    for ( const opts of [{ rank: 4 }, { track: false }] ) {
      const { turns, settle } = setUp(opts);
      turns("hunter");
      turns("tracker");
      expect(settle().slice(1).every(x => x.data.move === "stress")).toBe(true);
    }
  });

  test("once a conflict: whoever turns on the party later changes nothing more", () => {
    const { turns, settle } = setUp();
    turns("loner");
    expect(settle().length).toBeGreaterThan(0);
    turns("hunter");
    turns("tracker");
    expect(settle()).toEqual([]);
  });

  test("joining the party, the first to: a success on the encounter's track (never the last), or +1 momentum each", () => {
    const { run, raider } = setUp();
    const said = [];
    joinSide(run, run.byId.get("hunter"), "friendly", (u, e) => said.push(e));
    expect(said.at(-1)).toMatchObject({ move: "ally", marked: TICKS[2] });
    expect(raider.hp).toBe(TRACK - TICKS[2]);
    // (Once a conflict.)
    expect(ironswornRules.onAllegiance(run, run.byId.get("tracker"), { joined: "friendly" })).toEqual([]);
    const near = setUp();
    near.raider.hp = near.run.byId.get("raider2").hp = 3;
    ironswornRules.onAllegiance(near.run, near.run.byId.get("hunter"), { joined: "friendly" });
    expect(near.raider.hp).toBe(1);
    const plain = setUp({ track: false });
    ironswornRules.onAllegiance(plain.run, plain.run.byId.get("hunter"), { joined: "friendly" });
    expect(plain.kara.resources.momentum).toBe(3);
  });
});

describe("spirit", () => {
  function setUp(over = {}) {
    const run = createRun(prepareBattle(fight([hero(over), foe({ nature: "horror" })]), ironswornRules));
    run.rng = createRng(3);
    for ( const u of run.units ) ironswornRules.initUnit(u);
    return { run, kara: run.byId.get("kara"), horror: run.byId.get("raider") };
  }

  test("a horror's price is stress: spirit, not health", () => {
    const { run, kara, horror } = setUp();
    const strike = kara.spec.actions.find(a => a.move === "strike");
    const cost = ironswornRules.backlash(run, kara, horror, strike, 1);
    expect(cost.damage).toBeUndefined();
    expect(cost.said.data.move).toBe("stress");
    expect(kara.hp).toBe(5);
    expect(kara.spirit).toBeLessThan(5 + 1);
  });

  test("at 0 spirit a miss marks it shaken; already shaken, the stress table may make it give up the fight", () => {
    let shaken = 0;
    let gaveUp = 0;
    for ( let seed = 1; seed <= 200; seed++ ) {
      const { run, kara } = setUp({ spirit: 0 });
      run.rng = createRng(seed);
      kara.shaken = seed % 2 === 0;
      const before = kara.shaken;
      const said = endureStress(run, kara, 2, run.rng);
      if ( !before && kara.shaken ) shaken++;
      if ( said.data.gaveUp ) {
        gaveUp++;
        expect(kara.status).toBe("fled");
      }
    }
    expect(shaken).toBeGreaterThan(0);
    expect(gaveUp).toBeGreaterThan(0);
  });

  test("Compel: a strong hit +1 momentum; a miss costs spirit, and a dire one a point of supply too", () => {
    const { run, kara, horror } = setUp({ valuables: { money: 3, denominations: [{ label: "supply", value: 1 }], stowed: [], wielded: [], pooled: true } });
    ironswornRules.afterTalk(run, kara, horror, { degree: 3 });
    expect(kara.resources.momentum).toBe(3);
    ironswornRules.afterTalk(run, kara, horror, { degree: 0 });
    expect(kara.concessions).toEqual([expect.objectContaining({ kind: "money", amount: 1, to: "raider", price: true })]);
    expect(kara.spirit).toBeLessThanOrEqual(5);
    // (A foe's own words cost it nothing: foes don't roll.)
    expect(ironswornRules.afterTalk(run, horror, kara, { degree: 0 })).toBe(null);
  });
});
