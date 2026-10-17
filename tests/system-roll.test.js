/**
 * API 19: a character's saves and checks in a turn FastFighting plays, rolled the ironsworn system's way (system-roll.js):
 * the move and stat each one is, the system's own roller with no dialog (its card in the chat), graded as a move card
 * is, and taken by the engine as it fell (rules.js asRolled), never burned.
 */
import { afterEach, describe, expect, test } from "vitest";
import { moveFor, rolledOf } from "../scripts/system-roll.js";
import { ironswornRules } from "../scripts/rules.js";
import { characterMoves, foeNumbers, SAVE_STATS, COMPEL_STATS } from "../scripts/build.js";
import { harm } from "../scripts/moves.js";
import { IronswornAdapter } from "../scripts/adapter.js";
import { rollCheck } from "../../FastFighting/scripts/engine/probability.js";
import { createRng } from "../../FastFighting/scripts/engine/rng.js";
import { beginLive, liveRound, liveTurn, NeedsDecision } from "../../FastFighting/scripts/engine/live.js";

const stats = { edge: 2, heart: 3, iron: 1, shadow: 1, wits: 2 };
const kara = { id: "tokKara", ruleset: "classic", stats };
const id = move => `move:${move}`;

describe("the move and stat a save or a check is rolled as", () => {
  test("a save is Face Danger, +the stat its key stands for; of several, the highest; any other key is the engine's", () => {
    expect(moveFor("save", { save: "edge", dc: 10 }, kara)).toEqual({ move: id("classic/adventure/face_danger"), stat: "edge", adds: 0 });
    expect(moveFor("save", { save: ["fortitude"], dc: 10 }, kara).stat).toBe("iron");
    expect(moveFor("save", { save: "will", dc: 10 }, kara).stat).toBe("heart");
    expect(moveFor("save", { save: ["fortitude", "will"], dc: 10 }, kara).stat).toBe("heart");
    expect(moveFor("save", { save: "con", dc: 10 }, kara)).toBeNull();
    // (A harder one, DC 16: two adds off, as the rules count it.)
    expect(moveFor("save", { save: "reflex", dc: 16 }, kara)).toMatchObject({ stat: "edge", adds: -2 });
  });

  test("the character's own ruleset's move: Starforged's, and Sundered Isles' (Starforged's)", () => {
    for ( const ruleset of ["starforged", "sundered_isles"] ) {
      expect(moveFor("save", { save: "edge", dc: 10 }, { ...kara, ruleset }).move).toBe(id("starforged/adventure/face_danger"));
    }
  });

  test("a check is the move the rules play, by the character's own action", () => {
    const check = (purpose, action, more = {}, who = kara) => moveFor("check", { purpose, dc: 10, action, ...more }, who);
    expect(check("aid", { id: "tokKara.advantage" })).toEqual({ move: id("classic/adventure/secure_an_advantage"), stat: "heart", adds: 0 });
    expect(check("aid", { id: "tokKara.advantage" }, {}, { ...kara, ruleset: "starforged" }).move).toBe(id("starforged/combat/gain_ground"));
    expect(check("aid", { id: "tokKara.aid" })).toMatchObject({ move: id("classic/relationship/aid_your_ally"), stat: "heart" });
    expect(check("heal", { id: "tokKara.heal" })).toMatchObject({ move: id("classic/adventure/heal"), stat: "wits" });
    expect(check("firstAid", { id: null, name: "bleeding" }, {}, { ...kara, ruleset: "starforged" })).toMatchObject({ move: id("starforged/recover/heal"), stat: "wits" });
    expect(check("theft", { id: null, name: "" })).toMatchObject({ move: id("classic/adventure/face_danger"), stat: "shadow" });
    // (Compel, by the way it talks; a foe of rank 3 is the harder to sway.)
    expect(check("talk", { id: null, name: "intimidate" }, { dc: 16 })).toEqual({ move: id("classic/relationship/compel"), stat: "iron", adds: -2 });
    expect(check("talk", { id: null, name: "deceive" }).stat).toBe("shadow");
    expect(Object.keys(COMPEL_STATS).map(k => check("talk", { id: null, name: k }).stat)).toEqual(["heart", "iron", "shadow"]);
  });

  test("anything else is the engine's: another's action, a taunt, a control, an escape", () => {
    const check = (purpose, action) => moveFor("check", { purpose, dc: 10, action }, kara);
    expect(check("aid", { id: "tokVex.advantage" })).toBeNull();
    expect(check("heal", { id: "tokKara.potion" })).toBeNull();
    expect(check("talk", { id: "tokKara.goad", name: "Goad" })).toBeNull();
    expect(check("talk", { id: null, name: "toString" })).toBeNull();
    for ( const purpose of ["control", "escape", "disengage", "cast"] ) expect(check(purpose, { id: null, name: "" })).toBeNull();
  });
});

describe("a roll the system made, graded as a move card is", () => {
  const rolled = (die, challenge, pre = {}) => ({ preRollOptions: { stat: { source: "Edge", value: 2 }, ...pre }, postRollOptions: {}, rawActionDieValue: die, rawChallengeDiceValues: challenge });

  test("a strong hit, a weak hit, a miss, a miss on a match; its challenge dice along", () => {
    expect(rolledOf(rolled(5, [3, 6]))).toEqual({ degree: 3, natural: 5, total: 7, dice: { challenge1: 3, challenge2: 6 } });
    expect(rolledOf(rolled(5, [3, 9])).degree).toBe(2);
    expect(rolledOf(rolled(1, [5, 9])).degree).toBe(1);
    expect(rolledOf(rolled(1, [8, 8])).degree).toBe(0);
    // (A strong hit on a match is a strong hit.)
    expect(rolledOf(rolled(6, [2, 2])).degree).toBe(3);
  });

  test("its adds, the cap at 10, and negative momentum cancelling a matching action die, as the system has them", () => {
    expect(rolledOf(rolled(6, [9, 9], { stat: { source: "Iron", value: 4 }, adds: 3 })).total).toBe(10);
    expect(rolledOf(rolled(4, [3, 5], { adds: -2 }))).toMatchObject({ total: 4, degree: 2 });
    expect(rolledOf(rolled(3, [1, 2], { momentum: -3 }))).toMatchObject({ natural: 3, total: 2, degree: 2 });
  });

  test("one not rolled is nothing", () => {
    expect(rolledOf(null)).toBeNull();
    expect(rolledOf({ preRollOptions: { stat: { source: "Edge", value: 2 } }, postRollOptions: {} })).toBeNull();
  });
});

describe("the system's own roller, its card in the chat", () => {
  afterEach(() => {
    delete globalThis.CONFIG;
    delete globalThis.Hooks;
  });

  /** foundry-ironsworn's roller (CONFIG.IRONSWORN.applications): each roll takes the next dice, each card is kept. */
  function system(dice) {
    const cards = [];
    const hooks = new Map();
    let n = 0;
    globalThis.Hooks = {
      on: (name, fn) => {
        hooks.set(++n, { name, fn });
        return n;
      },
      off: (name, key) => hooks.delete(key)
    };
    class IronswornRoll {
      constructor(pre = {}) {
        this.preRollOptions = pre;
        this.postRollOptions = {};
      }

      async evaluate() {
        const [die, c1, c2] = dice.shift();
        this.rawActionDieValue = die;
        this.rawChallengeDiceValues = [c1, c2];
      }
    }
    class IronswornRollMessage {
      constructor(roll, actor) {
        Object.assign(this, { roll, actor });
      }

      async createOrUpdate() {
        await this.roll.evaluate();
        const message = { speaker: { actor: this.actor.id }, mode: "public", applyMode(mode) { this.mode = mode; } };
        for ( const h of hooks.values() ) if ( h.name === "preCreateChatMessage" ) h.fn(message, {}, {}, game.user.id);
        cards.push({ ...this.roll.preRollOptions, mode: message.mode });
      }
    }
    globalThis.CONFIG = { IRONSWORN: { applications: { IronswornRoll, IronswornRollMessage } } };
    game.user = { id: "gm" };
    return { cards, hooks };
  }
  class IronswornCharacterSheetV2 {}
  class StarforgedCharacterSheet {}
  /** A token of a character on that sheet (its actor can't be written to: nothing here writes it). */
  const token = (sheet = new IronswornCharacterSheetV2(), type = "character") => ({
    id: "tokKara",
    actor: Object.freeze({ type, id: "actKara", sheet, system: Object.freeze({ ...stats, momentum: Object.freeze({ value: 5, max: 10, resetValue: 2 }) }) })
  });
  const adapter = new IronswornAdapter();

  test("a save: Face Danger, +the stat, the sheet's momentum along; no dialog, no momentum burned or spent", async () => {
    const { cards } = system([[5, 3, 9]]);
    const doc = token();
    expect(await adapter.rollSave(doc, { save: "edge", dc: 10, action: { id: "trap.t", name: "Trap" }, from: null })).toEqual({ degree: 2, natural: 5, total: 7, dice: { challenge1: 3, challenge2: 9 } });
    expect(cards).toEqual([{ stat: { source: game.i18n.localize("IRONSWORN.Edge"), value: 2 }, momentum: 5, moveDsId: id("classic/adventure/face_danger"), actorId: "actKara", mode: "public" }]);
    expect(doc.actor.system.momentum.value).toBe(5);
  });

  test("a check: the character's move, by its sheet's ruleset; the DC as adds", async () => {
    const { cards } = system([[6, 2, 4], [2, 9, 10]]);
    expect(await adapter.rollCheck(token(new StarforgedCharacterSheet()), { purpose: "aid", dc: 10, action: { id: "tokKara.advantage", name: "Gain Ground" } })).toMatchObject({ degree: 3, total: 9 });
    expect(await adapter.rollCheck(token(), { purpose: "talk", dc: 16, action: { id: null, name: "persuade" } })).toMatchObject({ degree: 1, total: 3 });
    expect(cards.map(c => [c.moveDsId, c.stat.value, c.adds ?? 0])).toEqual([[id("starforged/combat/gain_ground"), 3, 0], [id("classic/relationship/compel"), 3, -2]]);
  });

  test("for the GMs' eyes only: its card in the GMs' mode, and the hook gone after", async () => {
    const { cards, hooks } = system([[4, 1, 1]]);
    expect((await adapter.rollSave(token(), { save: "will", dc: 10, action: { id: null, name: "" }, secret: true })).degree).toBe(3);
    expect(cards[0].mode).toBe("gm");
    expect(hooks.size).toBe(0);
  });

  test("a foe never rolls, nor does anything the rules don't make a move: the engine's dice, and no card", async () => {
    const { cards } = system([[4, 1, 1]]);
    expect(await adapter.rollSave(token(undefined, "foe"), { save: "edge", dc: 10, action: { id: null, name: "" } })).toBeNull();
    expect(await adapter.rollCheck(token(undefined, "foe"), { purpose: "talk", dc: 10, action: { id: null, name: "persuade" } })).toBeNull();
    expect(await adapter.rollSave(token(), { save: "con", dc: 10, action: { id: null, name: "" } })).toBeNull();
    expect(await adapter.rollCheck(token(), { purpose: "control", dc: 10, action: { id: "tokKara.shove", name: "Shove" } })).toBeNull();
    expect(cards).toEqual([]);
    delete globalThis.CONFIG;
    expect(await adapter.rollSave(token(), { save: "edge", dc: 10, action: { id: null, name: "" } })).toBeNull();
  });

  test("a character's spec rolls as these do: its defenses by SAVE_STATS, its Compel pitches by COMPEL_STATS", async () => {
    globalThis.foundry = { utils: { getProperty: (o, path) => path.split(".").reduce((v, k) => v?.[k], o) } };
    try {
      const actor = {
        type: "character", id: "act", uuid: "Actor.act", name: "Kara", statuses: new Set(), effects: [], items: [],
        system: { ...stats, health: { value: 5, max: 5 }, spirit: { value: 5, max: 5 }, supply: { value: 3, max: 5 }, momentum: { value: 2, max: 10, resetValue: 2 }, debility: {} }
      };
      const spec = await adapter.toCombatantSpec({ id: "tok", uuid: "Scene.s.Token.tok", name: "Kara", actor, parent: null });
      for ( const [save, stat] of Object.entries(SAVE_STATS) ) expect([save, spec.defenses[save]]).toEqual([save, stats[stat]]);
      for ( const [kind, stat] of Object.entries(COMPEL_STATS) ) expect([kind, spec.social.pitches[kind].mod]).toEqual([kind, stats[stat]]);
    } finally {
      delete globalThis.foundry;
    }
  });
});

describe("the engine takes it as it fell", () => {
  test("its challenge dice for the story; a GM's say, or dice unread, as it stands", () => {
    const rng = createRng(1);
    expect(rollCheck(ironswornRules, rng, 2, 10, { kind: "save", rolled: { degree: 2, natural: 5, total: 7, dice: { challenge1: 3, challenge2: 9 } } }))
      .toMatchObject({ degree: 2, natural: 5, total: 7, challenge: [3, 9], match: false });
    expect(rollCheck(ironswornRules, rng, 2, 10, { kind: "save", rolled: { degree: 1 } })).toMatchObject({ degree: 1, natural: null, total: null });
    expect(rollCheck(ironswornRules, rng, 2, 10, { kind: "save", rolled: { degree: 1 } }).challenge).toBeUndefined();
  });

  /** A trap's turn in a live battle, its saves the system's (answered by `answer`), played through. */
  function trapTurn(answer, momentum = 8) {
    const hero = {
      id: "kara", name: "Kara", side: "friendly", kind: "pc", level: 1, mover: true, ruleset: "classic", stats,
      hp: { value: 5, max: 5, temp: 0 }, defenses: { ac: 10, fortitude: 1, reflex: 2, will: 3, ...stats }, initiative: { mod: 0 }, speeds: { walk: 30 },
      resources: { momentum }, momentumReset: 2, momentumMax: 10, control: true, iwr: { immune: [], weak: {}, resist: {} }, actions: characterMoves({ id: "kara", stats }),
      traits: {}, flags: {}, diesAtZero: false
    };
    const trap = {
      id: "trap", name: "Trap", side: "hostile", kind: "npc", ...foeNumbers({ id: "trap", rank: 2 }), hazard: { once: false }, defenses: { ac: 10 }, initiative: { mod: 0 },
      speeds: { walk: 0 }, resources: {}, traits: {}, flags: { fearless: true }, diesAtZero: true
    };
    trap.actions = [{ ...trap.actions[0], damage: [harm(2)] }];
    const spec = { combatants: [hero, trap], sides: { friendly: { label: "I", enemies: ["hostile"] }, hostile: { label: "F", enemies: ["friendly"] } }, options: { positioning: false, maxRounds: 3, talking: false } };
    const answers = [];
    const requests = [];
    for ( let tries = 0; tries < 30; tries++ ) {
      const run = beginLive(spec, ironswornRules, { seed: 3, players: ["kara"], systemRolls: ["save", "check"] });
      liveRound(run, 1);
      try {
        const { events } = liveTurn(run, "trap", { answers });
        return { run, events, requests };
      } catch ( err ) {
        if ( !(err instanceof NeedsDecision) ) throw err;
        requests.push(err.request);
        answers.push([err.request.key, answer(err.request)]);
      }
    }
    throw new Error("a turn that never stops asking");
  }

  test("a hazard's Face Danger (+edge), the system's: a weak hit gets clear at a point of momentum, never burned", () => {
    const { run, requests } = trapTurn(() => ({ degree: 2, natural: 5, total: 7, dice: { challenge1: 3, challenge2: 9 } }));
    const asked = requests.find(r => r.roll === "save");
    expect(asked).toMatchObject({ unitId: "kara", targetId: "trap", save: "edge", dc: 10 });
    expect(moveFor("save", asked, { id: "kara", ruleset: "classic", stats })).toMatchObject({ move: id("classic/adventure/face_danger"), stat: "edge" });
    const k = run.byId.get("kara");
    expect([k.hp, k.resources.momentum, k.burned ?? 0]).toEqual([5, 7, 0]);
  });

  test("a miss the system rolled stays a miss: no momentum burned on it", () => {
    const { run } = trapTurn(() => ({ degree: 1, natural: 1, total: 3, dice: { challenge1: 5, challenge2: 9 } }));
    const k = run.byId.get("kara");
    expect(k.burned ?? 0).toBe(0);
    expect(k.hp).toBeLessThan(5);
  });
});
