/**
 * Live battles in Ironsworn and Starforged: a character's spotlight read from the ironsworn system's move cards, and
 * whom FastFighting would spotlight next.
 */
import { describe, expect, test } from "vitest";
import { readIronswornTurn, rollOf, outcomeOf } from "../scripts/read-turn.js";
import { ironswornRules } from "../scripts/rules.js";
import { characterMoves, foeNumbers } from "../scripts/build.js";
import { beginLive, liveRound, pcTurnBegin, pcTurnEnd, nextSpotlight } from "../../FastFighting/scripts/engine/live.js";
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
