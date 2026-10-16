import { describe, expect, test } from "vitest";
import { grade, scoreChances, chances, harmTable, movesFor, TICKS } from "../scripts/moves.js";
import { ironswornRules, progressScore } from "../scripts/rules.js";
import { characterMoves, foeNumbers, advantageMoves, loreSizeUp, doorWork } from "../scripts/build.js";
import { deriveIronswornTraits, natureOf, speaks } from "../scripts/traits.js";
import { IronswornAdapter } from "../scripts/adapter.js";
import { doorsFor } from "../scripts/conflict.js";
import { replay, runBatchSync, beginRun, beginRound, takeTurn, prepareBattle } from "../../FastFighting/scripts/engine/simulator.js";
import { holdsOf, tryHold, isBound, escapeCost, untieCost } from "../../FastFighting/scripts/engine/behavior/holds.js";
import { createRng } from "../../FastFighting/scripts/engine/rng.js";
import { maneuverOf } from "../../FastFighting/scripts/story/master.js";
import { text } from "./foundry-i18n.js";

/** A move's name, as the language file has it ("EndtheFight": End the Fight). */
const move = key => text(`FFIRONSWORN.Move.${key}`);
/** Was this log line's action that move? */
const made = (e, key) => String(e.action ?? "").includes(move(key));

const traits = t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { base: v, fudge: 0 }]));

function hero({ id = "kara", stats = { edge: 2, heart: 2, iron: 3, shadow: 1, wits: 1 }, ruleset = "classic", momentum = 2, health = 5, ...over } = {}) {
  return {
    id, name: id, side: "friendly", kind: "pc", level: 1, mover: true, ruleset, stats,
    hp: { value: health, max: 5, temp: 0 }, defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 }, initiative: { mod: 0 }, speeds: { walk: 30 },
    resources: { momentum }, momentumReset: 2, momentumMax: 10, iwr: { immune: [], weak: {}, resist: {} },
    actions: characterMoves({ id, stats, ruleset }), traits: traits(deriveIronswornTraits({ pc: true, stats }).traits), flags: {}, diesAtZero: false,
    social: { pitches: { persuade: { skill: "heart", mod: stats.heart }, intimidate: { skill: "iron", mod: stats.iron }, deceive: { skill: "shadow", mod: stats.shadow } }, resist: {}, languages: ["common"] },
    ...over
  };
}
function foe({ id = "raider", rank = 2, current = 0, nature = "people", ...over } = {}) {
  const n = foeNumbers({ id, rank, current });
  return {
    id, name: id, side: "hostile", kind: "npc", ...n, defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 }, initiative: { mod: 0 }, speeds: { walk: 30 },
    resources: {}, traits: traits(deriveIronswornTraits({ pc: false, rank, nature }).traits), flags: { fearless: true }, diesAtZero: true,
    social: speaks(nature) ? { pitches: {}, resist: {}, languages: ["common"] } : null, ...over
  };
}
const fight = (combatants, options = {}) => ({ combatants, sides: { friendly: { label: "Ironsworn", enemies: ["hostile"] }, hostile: { label: "Foes", enemies: ["friendly"] } }, options: { positioning: false, maxRounds: 12, talking: false, ...options } });

describe("dice", () => {
  test("a strong hit beats both challenge dice, a weak hit one; a miss on a match is dire", () => {
    expect(grade(7, [3, 6])).toBe(3);
    expect(grade(7, [3, 7])).toBe(2);
    expect(grade(4, [5, 9])).toBe(1);
    expect(grade(4, [8, 8])).toBe(0);
  });

  test("the chances add up, and match a few thousand rolls", () => {
    for ( let s = 0; s <= 10; s++ ) expect(scoreChances(s).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(scoreChances(10)).toEqual([0.01, 0, 0.18, 0.81].map(x => expect.closeTo(x, 10)));
    const rng = createRng(5);
    const tally = [0, 0, 0, 0];
    const n = 20000;
    for ( let i = 0; i < n; i++ ) tally[ironswornRules.roll(rng, 3, 10).degree] += 1;
    const expected = chances(3);
    tally.forEach((t, i) => expect(t / n).toBeCloseTo(expected[i], 1));
  });

  test("a progress roll is the score alone; the engine's harder talk takes adds off", () => {
    expect(ironswornRules.distribution(6, 10, { progress: true })).toEqual(scoreChances(6));
    expect(ironswornRules.distribution(2, 16)[3]).toBeLessThan(ironswornRules.distribution(2, 10)[3]);
  });

  test("the harm table", () => {
    expect(["mortal", "dying", "out", "reeling", "standing"]).toEqual([5, 15, 30, 40, 90].map(harmTable));
  });
});

describe("foes and progress", () => {
  test("harm marks a foe's track by its rank; its score is the boxes filled", () => {
    expect(ironswornRules.applyIwr({ ticksPerHarm: TICKS[2] }, { harm: 2 })).toBe(16);
    expect(ironswornRules.applyIwr({}, { harm: 2 })).toBe(2); // on a character: health
    expect(progressScore({ maxHp: 40, hp: 40 - 22 })).toBe(5);
  });

  test("natures: who speaks, and how they fight", () => {
    expect(natureOf({ folder: "Animals" })).toBe("animal");
    expect(natureOf({ folder: "Ironlanders" })).toBe("people");
    expect(natureOf({ name: "Bonewalker" })).toBe("horror");
    expect(speaks("people") && speaks("firstborn") && !speaks("beast")).toBe(true);
    expect(deriveIronswornTraits({ pc: false, rank: 4, nature: "beast" }).traits.brave).toBeGreaterThan(deriveIronswornTraits({ pc: false, rank: 1, nature: "beast" }).traits.brave);
  });
});

describe("a fight", () => {
  test("the character makes every move: foes never press a character on their own", () => {
    for ( let seed = 1; seed <= 6; seed++ ) {
      const r = replay(fight([hero(), foe()]), ironswornRules, seed);
      expect(r.log.some(e => e.actor === "raider" && e.type === "attack")).toBe(false);
      expect(r.log.some(e => e.actor === "kara" && e.type === "startTurn")).toBe(true); // Enter the Fray
    }
  });

  test("Strike with the initiative, Clash without; a miss is Pay the Price, then Endure Harm", () => {
    let strikes = 0;
    let clashes = 0;
    let prices = 0;
    let endured = 0;
    for ( let seed = 1; seed <= 10; seed++ ) {
      const r = replay(fight([hero(), foe({ rank: 3 })]), ironswornRules, seed);
      let control = null;
      for ( const e of r.log ) {
        if ( e.type === "startTurn" ) control = e.degree >= 2;
        if ( e.actor === "kara" && e.type === "attack" && !e.retort ) {
          if ( made(e, "Strike") ) { strikes += 1; expect(control).toBe(true); }
          if ( made(e, "Clash") ) { clashes += 1; expect(control).toBe(false); }
          if ( made(e, "Strike") || made(e, "Clash") ) control = e.degree === 3;
          if ( made(e, "EndtheFight") ) control = e.degree >= 2;
        }
        // (Heal, only in control: a miss pays the price, the upper hand with it.)
        if ( e.actor === "kara" && e.type === "heal" ) {
          expect(control).toBe(true);
          if ( (e.check?.degree ?? 2) <= 1 ) control = false;
        }
        if ( e.type === "backlash" ) prices += 1;
        if ( e.type === "endure" ) endured += 1;
      }
    }
    expect(strikes).toBeGreaterThan(0);
    expect(clashes).toBeGreaterThan(0);
    expect(prices).toBeGreaterThan(0);
    expect(endured).toBe(prices);
  });

  test("a troublesome foe falls fast; an epic one hardly at all", () => {
    const easy = runBatchSync(fight([hero(), foe({ rank: 1 })]), ironswornRules, { runs: 200 });
    const hard = runBatchSync(fight([hero(), foe({ rank: 5 })]), ironswornRules, { runs: 200 });
    expect(easy.sides.friendly.pWin).toBeGreaterThan(0.8);
    expect(hard.sides.friendly.pWin).toBeLessThan(easy.sides.friendly.pWin);
    expect(hard.rounds.mean).toBeGreaterThan(easy.rounds.mean);
  });

  test("End the Fight once the foe's track is half full; a hit ends the foe", () => {
    let ended = 0;
    for ( let seed = 1; seed <= 10; seed++ ) {
      const r = replay(fight([hero(), foe({ rank: 2, current: 24 })]), ironswornRules, seed);
      const finish = r.log.filter(e => e.actor === "kara" && e.type === "attack" && made(e, "EndtheFight"));
      for ( const e of finish ) if ( e.degree >= 2 ) ended += 1;
    }
    expect(ended).toBeGreaterThan(3);
  });

  test("momentum is burned to turn a miss into a hit", () => {
    let burned = 0;
    for ( let seed = 1; seed <= 15; seed++ ) burned += replay(fight([hero({ momentum: 9 }), foe({ rank: 4 })]), ironswornRules, seed).log.filter(e => e.type === "adjust").length;
    expect(burned).toBeGreaterThan(0);
  });

  test("at 0 health a character fights on, wounded, until the harm table takes it out", () => {
    let wounded = 0;
    let table = 0;
    for ( let seed = 1; seed <= 20; seed++ ) {
      const r = replay(fight([hero({ health: 1, stats: { edge: 1, heart: 1, iron: 1, shadow: 1, wits: 1 } }), foe({ rank: 4 })]), ironswornRules, seed);
      if ( r.log.some(e => e.type === "endure" && e.wounded) ) wounded += 1;
      if ( r.log.some(e => e.type === "endure" && e.result) ) table += 1;
      expect(r.units.kara.final === undefined || true).toBe(true);
    }
    expect(wounded).toBeGreaterThan(5);
    expect(table).toBeGreaterThan(0);
  });

  test("Starforged: a weak Strike still marks progress twice", () => {
    const [strike] = characterMoves({ id: "x", stats: { iron: 2 }, ruleset: "starforged" });
    expect(strike.damage[0].flat).toBe(2);
    const [classic] = characterMoves({ id: "y", stats: { iron: 2 } });
    expect(classic.damage[0].flat).toBe(1);
  });

  test("at range, Strike and Clash are named as the language file says (the move's name in its words)", () => {
    const names = characterMoves({ id: "x", stats: { iron: 1, edge: 2 }, ranged: true }).filter(a => a.kind === "strike" && !a.finish).map(a => a.name);
    expect(names).toEqual([move("Strike"), move("Clash"), text("FFIRONSWORN.AtRange", { move: move("Strike") }), text("FFIRONSWORN.AtRange", { move: move("Clash") })]);
  });
});

describe("rules preference: a move of the same name in another ruleset", () => {
  const both = ["classic", "starforged"];

  test("a preferred ruleset's move of the same name replaces the character's own; moves called differently stay", () => {
    // Following the character sheets: its own sheet's, always.
    expect(movesFor("starforged", "sheet", both).strike.weak).toBe(2);
    expect(movesFor("classic", "sheet", both).strike.weak).toBe(1);
    // A Starforged sheet in a Sundered Isles world: Starforged's moves, with Sundered Isles' Enter the Fray.
    const isles = movesFor("sundered_isles", "sundered_isles", ["sundered_isles"]);
    expect([isles.strike.weak, isles.finish.name, isles.fray.stats.includes("iron")]).toEqual([2, move("TakeDecisiveAction"), true]);
    const m = movesFor("starforged", "classic", both);
    expect(m.strike.weak).toBe(1); // Ironsworn's Strike: harm, not progress twice
    expect(m.strike.harm).toBe(true);
    expect(m.fray.missMomentum).toBe(-1);
    expect(m.endure.miss).toBe("momentum");
    expect(m.finish.name).toBe(move("TakeDecisiveAction")); // (no Ironsworn move by that name)
    expect(m.control.on).toBe(text("FFIRONSWORN.Control.isincontrol"));        // (its own words for it)
    const c = movesFor("classic", "starforged", both);
    expect(c.strike.weak).toBe(2);
    expect(c.finish.name).toBe(move("EndtheFight"));
  });

  test("only when the world has the preferred ruleset on; Sundered Isles brings only its own moves", () => {
    expect(movesFor("starforged", "classic", ["starforged"]).strike.weak).toBe(2);
    const si = movesFor("classic", "sundered_isles", ["classic", "sundered_isles"]);
    expect(si.fray.stats).toContain("iron"); // its Enter the Fray (played as Starforged's)
    expect(si.fray.missMomentum).toBe(0);
    expect(si.strike.weak).toBe(1);          // no Strike of its own: Ironsworn's stays
  });

  test("a deadly weapon's harm counts on Ironsworn's Strike, not on Starforged's progress", () => {
    const [ironsworn] = characterMoves({ id: "a", stats: { iron: 2 }, extraHarm: 1, moves: movesFor("starforged", "classic", both) });
    expect([ironsworn.damage[0].flat, ironsworn.critDamage[0].flat]).toEqual([2, 3]);
    const [starforged] = characterMoves({ id: "b", stats: { iron: 2 }, extraHarm: 1, moves: movesFor("classic", "starforged", both) });
    expect([starforged.damage[0].flat, starforged.critDamage[0].flat]).toEqual([2, 2]);
  });

  test("Endure Harm's miss: Ironsworn's costs momentum, Starforged's health", () => {
    // A d6 of 1 against two 10s: a miss.
    const miss = { die: faces => (faces === 6 ? 1 : 10), next: () => 0 };
    const unit = moves => ({ spec: { moveRules: moves, mover: true, stats: { iron: 1 } }, status: "standing", hp: 3, maxHp: 5, resources: { momentum: 4 }, wounded: false });
    const classic = unit(movesFor("classic"));
    ironswornRules.afterHarm({}, classic, 1, miss);
    expect([classic.hp, classic.resources.momentum]).toEqual([3, 3]);
    const starforged = unit(movesFor("starforged"));
    ironswornRules.afterHarm({}, starforged, 1, miss);
    expect([starforged.hp, starforged.resources.momentum]).toEqual([2, 4]);
  });
});

describe("securing an advantage", () => {
  test("Secure an Advantage (Gain Ground in a Starforged fight): what each hit gives, by the ruleset; a miss, the price", () => {
    const [classic, aid] = advantageMoves({ id: "k", stats: { edge: 2, heart: 1, iron: 3, shadow: 1, wits: 2 }, moves: movesFor("classic") });
    expect(classic).toMatchObject({ name: move("SecureanAdvantage"), targets: "self", move: "advantage", check: { mod: 3 } });
    expect(classic.onDegree[3]).toMatchObject({ mods: { attack: 1, checks: 1 }, uses: 1, label: text("FFIRONSWORN.Gives.Next", { n: "+1" }) });
    expect(classic.onDegree[2]).toMatchObject({ resources: { momentum: 1 }, label: text("FFIRONSWORN.Gives.Momentum", { n: "+1" }) });
    expect(classic.onDegree[1]).toMatchObject({ price: true, failed: true, label: move("PaythePrice") });
    expect(aid).toMatchObject({ name: move("AidYourAlly"), includeSelf: false });
    expect(aid.onDegree[3].takeControl).toBe(true);
    const [sf] = advantageMoves({ id: "k", stats: { iron: 2 }, moves: movesFor("starforged") });
    expect(sf.name).toBe(move("GainGround"));
    expect(sf.onDegree[3]).toMatchObject({ mods: { attack: 1 }, resources: { momentum: 2 } });
    expect(sf.onDegree[2]).toMatchObject({ mods: { attack: 1 }, uses: 1 });
  });

  test("only in control; the price costs momentum and the upper hand; a strong hit aiding a friend puts both in control", () => {
    const k = { spec: { mover: true }, control: false, resources: { momentum: 4 }, momentumMax: 10 };
    const f = { spec: { mover: true }, control: false, resources: { momentum: 2 }, momentumMax: 10 };
    expect(ironswornRules.usable(null, k, { move: "advantage" }, null)).toBe(false);
    k.control = true;
    expect(ironswornRules.usable(null, k, { move: "advantage" }, null)).toBe(true);
    ironswornRules.onOutcome(null, k, k, { price: true, failed: true });
    expect([k.resources.momentum, k.control]).toEqual([3, false]);
    ironswornRules.onOutcome(null, k, f, { takeControl: true });
    expect([k.control, f.control]).toEqual([true, true]);
    ironswornRules.gainResource(f, "momentum", 20);
    expect(f.resources.momentum).toBe(10);
  });

  test("maneuvers the story knows: Secure an Advantage (Gain Ground) gains ground, Aid Your Ally aids", () => {
    for ( const ruleset of ["classic", "starforged"] ) {
      const [self, aid] = advantageMoves({ id: "k", stats: { edge: 2 }, moves: movesFor(ruleset) });
      expect([maneuverOf(self), maneuverOf(aid)]).toEqual(["gainGround", "aid"]);
    }
    // (And so a fight's log says, for the story to tell it as what it is.)
    let secured = 0;
    for ( let seed = 1; seed <= 10; seed++ ) {
      const r = replay(fight([hero({ control: true, behavior: { hinders: 6, exploitWeakness: 6 } }), foe({ rank: 3 })], { maxRounds: 4 }), ironswornRules, seed);
      for ( const e of r.log.filter(l => l.type === "buff" && l.actorId === "kara") ) {
        expect([e.action, e.maneuver]).toEqual([move("SecureanAdvantage"), "gainGround"]);
        secured += 1;
      }
    }
    expect(secured).toBeGreaterThan(0);
  });

  test("a friend who asks for it (and can be heard) gets it: Aid Your Ally, while the aider is in control", () => {
    let aided = 0;
    for ( let seed = 1; seed <= 20; seed++ ) {
      const kara = hero({ id: "kara", stats: { edge: 3, heart: 3, iron: 1, shadow: 1, wits: 3 }, control: true, initiative: { mod: 20 } });
      const brand = hero({ id: "brand", stats: { edge: 1, heart: 1, iron: 3, shadow: 1, wits: 1 }, desires: [{ kind: "bolstered", targetId: "kara", level: 90 }] });
      const r = replay(fight([kara, brand, foe({ rank: 3 })], { maxRounds: 2 }), ironswornRules, seed);
      const given = r.log.filter(e => e.type === "buff" && e.actorId === "kara");
      for ( const e of given ) expect(e.targetIds).toEqual(["brand"]);
      aided += given.length;
    }
    expect(aided).toBeGreaterThan(0);
  });
});

describe("a Lore-Collector in Ironsworn", () => {
  test("sizes a foe up by Securing an Advantage (+wits): a hit makes its next attack or words 25% likelier; a miss pays the price", () => {
    expect(loreSizeUp({ wits: 3 })).toMatchObject({ mod: 3, label: move("SecureanAdvantage"), boost: 2.35, uses: 1, anyFoe: true, missOutcome: { price: true } });
    let boostedAfterHit = 0;
    let prices = 0;
    for ( let seed = 1; seed <= 30; seed++ ) {
      const scholar = hero({ id: "sage", stats: { edge: 1, heart: 2, iron: 2, shadow: 1, wits: 3 }, control: true, behavior: { study: 1 }, sizeUp: loreSizeUp({ wits: 3 }), initiative: { mod: 20 } });
      const r = replay(fight([scholar, foe({ rank: 2 })], { maxRounds: 3 }), ironswornRules, seed);
      const study = r.log.find(e => e.type === "study" && e.actorId === "sage");
      if ( !study ) continue;
      const boosted = r.log.filter(e => e.type === "attack" && e.actorId === "sage" && e.boost > 0);
      if ( study.worked ) {
        expect(boosted.length).toBeLessThanOrEqual(1); // one roll only
        boostedAfterHit += boosted.length;
      } else {
        expect(boosted).toHaveLength(0);
        expect(study.price).toBe(move("PaythePrice"));
        prices++;
      }
    }
    expect(boostedAfterHit).toBeGreaterThan(0);
    expect(prices).toBeGreaterThan(0);
  });
});

/** A fight a round in, its log kept. */
const begun = (list, seed = 1) => {
  const run = beginRun(prepareBattle(fight(list), ironswornRules), seed, { log: true });
  beginRound(run, 1);
  return run;
};
/** Dice that come up as given (the d6, then the two challenge dice). */
const dice = (...values) => ({ ...createRng(1), die: () => values.shift() });

describe("breaking free, and freeing a friend", () => {
  const tie = u => Object.assign(u, { bound: true, boundBy: null, status: "bound" });
  const bonds = { key: "bound", others: "untie" };
  const roll = (key, data) => text("FFIRONSWORN.MoveRoll", { move: move("FaceDanger"), ...data, what: text(`FFIRONSWORN.Hold.${key}`, key === "Miss" ? { price: move("PaythePrice"), control: text("FFIRONSWORN.Control.losesinitiative") } : null) });

  test("a character Faces Danger to get loose: a strong hit +1 momentum, a weak hit at a cost, a miss pays the price", () => {
    const run = begun([hero({ stats: { edge: 3, heart: 1, iron: 1, shadow: 1, wits: 1 } }), foe()]);
    const kara = Object.assign(run.byId.get("kara"), { control: true });
    const stat = text("FFIRONSWORN.Stat.edge");
    run.rng = dice(4, 2, 5);
    expect(ironswornRules.breakFree(run, kara, bonds)).toEqual({ success: true, degree: 3, said: { text: roll("Strong", { stat, total: 7, dice: "2, 5" }), data: expect.objectContaining({ stat: "edge", degree: 3 }) } });
    expect(kara.resources.momentum).toBe(3);
    run.rng = dice(1, 2, 6);
    expect(ironswornRules.breakFree(run, kara, bonds)).toMatchObject({ success: true, degree: 2, said: { text: roll("Weak", { stat, total: 4, dice: "2, 6" }) } });
    expect(kara.resources.momentum).toBe(2);
    run.rng = dice(1, 7, 9);
    expect(ironswornRules.breakFree(run, kara, bonds)).toMatchObject({ success: false, degree: 1, said: { text: roll("Miss", { stat, total: 4, dice: "7, 9" }) } });
    expect([kara.resources.momentum, kara.control]).toEqual([1, false]);
  });

  test("the better of +edge (slipping out, first for bonds) and +iron (forcing it, first for a grab); no d20 against a DC", () => {
    const run = begun([hero({ stats: { edge: 2, heart: 1, iron: 2, shadow: 1, wits: 1 } }), hero({ id: "bran", stats: { edge: 1, heart: 1, iron: 3, shadow: 1, wits: 1 } }), foe()]);
    const stat = (u, hold) => ironswornRules.breakFree(run, run.byId.get(u), hold).said.data.stat;
    expect([stat("kara", bonds), stat("kara", { key: "grabbed", others: null }), stat("bran", bonds)]).toEqual(["edge", "iron", "iron"]);
    const got = ironswornRules.breakFree(run, run.byId.get("kara"), bonds);
    expect([got.natural, got.mod, got.total, got.dc]).toEqual([undefined, undefined, undefined, undefined]);
  });

  test("momentum is burned to turn a miss into a hit, never a weak hit into a strong one", () => {
    const run = begun([hero({ stats: { edge: 2, heart: 1, iron: 1, shadow: 1, wits: 1 }, momentum: 8 }), foe()]);
    const kara = run.byId.get("kara");
    run.rng = dice(1, 5, 9);
    const got = ironswornRules.breakFree(run, kara, bonds);
    expect(got).toMatchObject({ success: true, degree: 2, said: { data: { burned: 8 } } });
    expect(got.said.text).toContain(text("FFIRONSWORN.Burn.Weak", { n: 8, label: move("FaceDanger") }));
    expect(kara.resources.momentum).toBe(1); // (reset to 2, then the weak hit's cost)
    kara.resources.momentum = 9;
    run.rng = dice(3, 3, 7);
    expect(ironswornRules.breakFree(run, kara, bonds)).toMatchObject({ degree: 2, said: { data: { burned: 0 } } });
    expect(kara.resources.momentum).toBe(8);
  });

  test("a character tied up struggles on its turn by Face Danger; a foe doesn't roll (the core's chance)", () => {
    for ( let seed = 1; seed <= 5; seed++ ) {
      const run = begun([hero(), foe()], seed);
      const kara = tie(run.byId.get("kara"));
      takeTurn(run, kara);
      const e = run.log.find(l => l.type === "escape" && l.actorId === "kara");
      expect(e).toMatchObject({ hold: "bound", said: expect.stringContaining(move("FaceDanger")) });
      expect(e.natural).toBeUndefined();
      expect([kara.status === "bound", isBound(kara)]).toEqual([!e.success, !e.success]);
    }
    const run = begun([hero(), foe()]);
    const raider = tie(run.byId.get("raider"));
    expect(ironswornRules.breakFree(run, raider, bonds)).toBe(null);
    takeTurn(run, raider);
    const e = run.log.find(l => l.type === "escape" && l.actorId === "raider");
    expect(e).toMatchObject({ hold: "bound" });
    expect([e.said, e.degree]).toEqual([undefined, undefined]);
  });

  test("untying a friend: no move with no foe beside (the core's untie, no roll); with one, Face Danger", () => {
    const run = begun([hero(), hero({ id: "bran" }), foe()]);
    const kara = run.byId.get("kara");
    const bran = tie(run.byId.get("bran"));
    const hold = holdsOf(run, bran)[0];
    expect(hold).toMatchObject({ key: "bound", others: "untie" });
    expect(ironswornRules.breakFree(run, kara, hold, { freeing: true })).toBe(null);
    expect(tryHold(run, kara, hold, { freeing: true })).toEqual({ success: true });
    kara.adjacent.add("raider");
    run.rng = dice(4, 2, 5);
    expect(tryHold(run, kara, hold, { freeing: true })).toMatchObject({ success: true, degree: 3, said: { data: { freeing: true } } });
    // (What the system says a friend needs a roll for: Face Danger, foe or none.)
    kara.adjacent.clear();
    run.rng = dice(1, 7, 9);
    expect(tryHold(run, kara, { key: "restrained", others: "check" }, { freeing: true })).toMatchObject({ success: false, degree: 1 });
  });

  test("a try is the turn's one move; debilities and impacts hold no one", () => {
    const run = begun([hero(), hero({ id: "bran" }), foe()]);
    const [kara, bran] = ["kara", "bran"].map(id => run.byId.get(id));
    expect(escapeCost(ironswornRules, kara, bonds)).toEqual({ action: 1 });
    expect(untieCost(ironswornRules, kara, bran, bonds)).toEqual({ action: 1 });
    kara.wounded = true;
    kara.baseConds.shaken = 1;
    expect(holdsOf(run, kara)).toEqual([]);
  });
});

describe("a locked door", () => {
  const stats = { edge: 1, heart: 1, iron: 3, shadow: 1, wits: 2 };
  const roll = (key, data) => text("FFIRONSWORN.MoveRoll", { move: move("FaceDanger"), ...data, what: text(`FFIRONSWORN.Hold.${key}`, key === "Miss" ? { price: move("PaythePrice"), control: text("FFIRONSWORN.Control.losesinitiative") } : null) });
  /** A character, a foe beyond a door 20 feet off (the way the fight found runs through it), as the core's own tests have it. */
  const behindDoor = (over = {}, rounds = 4) => {
    const kara = hero({ stats, position: { x: 0, y: 0, size: 5 }, desires: [{ kind: "hurt", targetId: "raider", level: 90 }], ...over });
    const spec = fight([kara, foe({ position: { x: 40, y: 0, size: 5 } })], { positioning: true, maxRounds: rounds, aftermath: "none" });
    spec.doors = { d1: { locked: true, x: 20, y: 0 } };
    spec.approach = { kara: { raider: { dist: 35, mult: 1, speed: 25, mode: "walk", los: true, meleeOk: true, doors: ["d1"] } } };
    return spec;
  };
  const doorEvents = r => r.log.filter(e => e.type === "door" && e.actorId === "kara");

  test("Face Danger: +iron to force it, the better of +shadow and +wits to pick it; anyone may try either", () => {
    expect(doorWork(stats)).toEqual({ force: { mod: 3, stat: "iron" }, pick: { mod: 2, stat: "wits" } });
    expect(doorWork({ iron: 1, shadow: 3, wits: 2 }).pick).toEqual({ mod: 3, stat: "shadow" });
    expect(doorWork({ iron: 2, shadow: 2, wits: 2 }).pick.stat).toBe("shadow");
    expect(doorWork({}).force).toEqual({ mod: 1, stat: "iron" });
  });

  test("a character's sheet gives it that Face Danger", async () => {
    globalThis.foundry = { utils: { getProperty: (o, path) => path.split(".").reduce((v, k) => v?.[k], o) } };
    try {
      const actor = {
        type: "character", id: "act", uuid: "Actor.act", name: "Kara", statuses: new Set(), effects: [], items: [],
        system: { ...stats, health: { value: 5, max: 5 }, spirit: { value: 5, max: 5 }, supply: { value: 3, max: 5 }, momentum: { value: 2, max: 10, resetValue: 2 }, debility: {} }
      };
      const spec = await new IronswornAdapter().toCombatantSpec({ id: "tok", uuid: "Scene.s.Token.tok", name: "Kara", actor, parent: null });
      expect(spec.doorWork).toEqual(doorWork(stats));
    } finally {
      delete globalThis.foundry;
    }
  });

  test("a try: a strong hit gets through (+1 momentum), a weak hit at a cost, a miss pays the price; as hard as the door", () => {
    const run = begun([hero({ stats, doorWork: doorWork(stats) }), foe()]);
    const kara = Object.assign(run.byId.get("kara"), { control: true });
    const [iron, wits] = [text("FFIRONSWORN.Stat.iron"), text("FFIRONSWORN.Stat.wits")];
    run.rng = dice(4, 2, 5);
    expect(ironswornRules.tryDoor(run, kara, { id: "d1" }, { method: "force", mod: 3, dc: 10 })).toEqual({
      success: true, degree: 3, said: { text: roll("Strong", { stat: iron, total: 7, dice: "2, 5" }), data: expect.objectContaining({ move: "faceDanger", stat: "iron", method: "force", door: "d1" }) }
    });
    expect(kara.resources.momentum).toBe(3);
    run.rng = dice(1, 2, 6);
    expect(ironswornRules.tryDoor(run, kara, { id: "d1" }, { method: "pick", mod: 2, dc: 10 })).toMatchObject({ success: true, degree: 2, said: { text: roll("Weak", { stat: wits, total: 3, dice: "2, 6" }) } });
    expect(kara.resources.momentum).toBe(2);
    // (A harder door, DC 16: two adds off. 4 + 3 would beat both dice; 5 beats neither.)
    run.rng = dice(4, 5, 6);
    expect(ironswornRules.tryDoor(run, kara, { id: "d1" }, { method: "force", mod: 3, dc: 16 })).toMatchObject({ success: false, degree: 1, said: { text: roll("Miss", { stat: iron, total: 5, dice: "5, 6" }) } });
    expect([kara.resources.momentum, kara.control]).toEqual([1, false]);
    // A foe doesn't roll: the core's.
    expect(ironswornRules.tryDoor(run, run.byId.get("raider"), { id: "d1" }, { method: "force", mod: 2, dc: 10 })).toBe(null);
  });

  test("in a fight, a character forces its way through with its Face Danger (+iron), and is on to the foe beyond", () => {
    let through = 0;
    for ( let seed = 1; seed <= 6; seed++ ) {
      const r = replay(behindDoor({ doorWork: doorWork(stats) }), ironswornRules, seed);
      const tries = doorEvents(r).filter(e => e.method !== "giveup");
      expect(tries.length).toBeGreaterThan(0);
      // (Quicker than hacking at it: always Face Danger, the system's own try, told in its words.)
      for ( const e of tries ) expect([e.method, String(e.said ?? "").includes(move("FaceDanger")), e.natural]).toEqual(["force", true, undefined]);
      if ( tries.some(e => e.success) && r.log.some(e => e.actorId === "kara" && e.type === "attack" && e.targetId === "raider") ) through += 1;
    }
    expect(through).toBeGreaterThan(3);
  });

  /**
   * The hits it takes to hack the door down (each [harm, broke]), in every fight of a few where it did: by a character of
   * that ruleset with a deadly weapon or none, the conflict tracked as `mode` says, the world's door harm `harm`.
   */
  const hacking = ({ ruleset = "classic", extraHarm = 1, mode = "foes", harm = 3 }) => {
    // (No way past it but blows: the one who can't Face Danger it here.)
    const actions = characterMoves({ id: "kara", stats, ruleset, extraHarm });
    const out = [];
    for ( let seed = 1; seed <= 6; seed++ ) {
      const spec = behindDoor({ ruleset, actions, doorWork: { force: { mod: -20 }, pick: { mod: -20 } } }, 8);
      spec.doors = doorsFor(spec.doors, { mode, harm });
      const hits = doorEvents(replay(spec, ironswornRules, seed)).filter(e => e.method === "attack" && e.hit);
      if ( hits.some(e => e.success) ) out.push(hits.map(e => [e.damage, e.success]));
    }
    expect(out.length).toBeGreaterThan(3);
    return [...new Set(out.map(h => JSON.stringify(h)))].map(h => JSON.parse(h));
  };

  /** Each way the door went down is one of `ways` (a strong hit does the Strike's strong harm), and `most` is among them. */
  const wentDown = (seen, ways, most) => {
    for ( const s of seen ) expect(ways).toContainEqual(s);
    expect(seen).toContainEqual(most);
  };

  test("hacked at in Ironsworn, it stands up to the world's door harm (3 unless it says less): a deadly weapon's two hits, or one strong one", () => {
    expect(ironswornRules.door).toMatchObject({ hp: 3, ac: 10, forceDC: 10, pickDC: 10 });
    // (A deadly weapon: 2 harm on a weak hit, 3 on a strong one. Unarmed: 1 and 2.)
    wentDown(hacking({ harm: 3 }), [[[2, false], [2, true]], [[2, false], [3, true]], [[3, true]]], [[2, false], [2, true]]);
    wentDown(hacking({ harm: 2 }), [[[2, true]], [[3, true]]], [[2, true]]);
    wentDown(hacking({ harm: 2, extraHarm: 0 }), [[[1, false], [1, true]], [[1, false], [2, true]], [[2, true]]], [[1, false], [1, true]]);
    wentDown(hacking({ harm: 1, extraHarm: 0 }), [[[1, true]], [[2, true]]], [[1, true]]);
  });

  test("in Starforged a door overcome is a step of progress forward: one hit, whatever the setting", () => {
    wentDown(hacking({ ruleset: "starforged", mode: "encounter", harm: 3 }), [[[2, true]], [[3, true]]], [[2, true]]);
    wentDown(hacking({ ruleset: "classic", extraHarm: 0, mode: "encounter", harm: 3 }), [[[1, true]], [[2, true]]], [[1, true]]);
  });

  test("a battle's doors are made so as it's set up (the planner's settings): Ironsworn's or Starforged's, by its tracking", () => {
    const adapter = new IronswornAdapter();
    globalThis.canvas = { scene: null };
    game.settings = { get: (id, key) => (key === "doorHarm" ? 2 : undefined) };
    try {
      const doorsOf = ruleset => {
        const kara = hero({ ruleset });
        const roster = [{ token: { id: "kara", actor: null }, spec: kara }, { token: { id: "raider" }, spec: foe() }];
        const spec = fight([kara, foe()]);
        spec.doors = { d1: { locked: true, x: 20, y: 0 }, d2: { locked: true, x: 40, y: 0, hp: 5 } };
        adapter.applyPlannerSettings(spec, {}, { roster, resolved: { kara: "friendly", raider: "hostile" }, setup: {} });
        return [spec.doors.d1.hp, spec.doors.d2.hp];
      };
      // (Ironsworn: the setting's 2; Starforged, one track for the encounter: one hit. A door's own numbers stay.)
      expect(doorsOf("classic")).toEqual([2, 5]);
      expect(doorsOf("starforged")).toEqual([1, 5]);
    } finally {
      delete globalThis.canvas;
    }
  });
});
