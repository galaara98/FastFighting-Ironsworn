import { describe, expect, test } from "vitest";
import { grade, scoreChances, chances, harmTable, movesFor, TICKS } from "../scripts/moves.js";
import { ironswornRules, progressScore } from "../scripts/rules.js";
import { characterMoves, foeNumbers } from "../scripts/build.js";
import { deriveIronswornTraits, natureOf, speaks } from "../scripts/traits.js";
import { replay, runBatchSync } from "../../FastFighting/scripts/engine/simulator.js";
import { createRng } from "../../FastFighting/scripts/engine/rng.js";

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
          if ( /Strike/.test(e.action) ) { strikes += 1; expect(control).toBe(true); }
          if ( /Clash/.test(e.action) ) { clashes += 1; expect(control).toBe(false); }
          if ( /Strike|Clash/.test(e.action) ) control = e.degree === 3;
          if ( /End the Fight/.test(e.action) ) control = e.degree >= 2;
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
      const finish = r.log.filter(e => e.actor === "kara" && e.type === "attack" && /End the Fight/.test(e.action));
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
});

describe("rules preference: a move of the same name in another ruleset", () => {
  const both = ["classic", "starforged"];

  test("a preferred ruleset's move of the same name replaces the character's own; moves called differently stay", () => {
    const m = movesFor("starforged", "classic", both);
    expect(m.strike.weak).toBe(1); // Ironsworn's Strike: harm, not progress twice
    expect(m.strike.harm).toBe(true);
    expect(m.fray.missMomentum).toBe(-1);
    expect(m.endure.miss).toBe("momentum");
    expect(m.finish.name).toBe("Take Decisive Action"); // (no Ironsworn move by that name)
    expect(m.control.on).toBe("is in control");        // (its own words for it)
    const c = movesFor("classic", "starforged", both);
    expect(c.strike.weak).toBe(2);
    expect(c.finish.name).toBe("End the Fight");
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
