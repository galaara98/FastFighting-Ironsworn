/**
 * Ironsworn and Starforged rules for the FastFighting engine. Pure functions only: no Foundry globals.
 *
 * The characters make the moves; foes never roll. With the initiative (Starforged: in control) a character Strikes;
 * without it, it Clashes. A hit marks progress on the foe's track, so many ticks a mark by the foe's rank (a foe's
 * "hit points" are the ticks left on its track); a strong hit marks more and keeps (or takes) the initiative. A miss,
 * and a weak Clash, means Pay the Price: the foe's harm (its rank) to the character, who then Endures Harm: a roll
 * (+health or +iron) to shake it off (+1 health, or +1 momentum), press on, or lose a point of momentum. At 0 health
 * a character fights on, harm beyond its health coming off its momentum; a miss there marks it wounded, or (already
 * wounded) rolls on the harm table: the harm may be mortal (Face Death: +heart, or die), dying, out cold, reeling, or
 * nothing much. With the foe's progress far enough along, a character in control may End the Fight (Starforged: Take
 * Decisive Action), a progress roll: a hit ends that foe's part in the fight; a miss loses it, and the price is paid.
 * Momentum is burned when it turns a miss into a hit (or a weak hit into a strong one, when there's plenty).
 * A character held (tied up, grabbed) breaks free by Face Danger (+edge or +iron); untying a friend is no move unless
 * a foe is beside it.
 *
 * Spirit: horrors' price is stress (Endure Stress, on spirit, as Endure Harm is on health; at 0 spirit, shaken, then
 * the stress table, where Face Desolation may make it give up the fight). Talking is Compel: a strong hit +1 momentum;
 * a miss pays the price in stress, and a miss on matching dice is a demand that costs dearly, a point of supply.
 * One track for the encounter (conflict.js): Take Decisive Action once it's well along (7 boxes); a miss loses the
 * objective, and the fight with it.
 * A foe whose track is full is beaten: out of the fight, however the table decides (killed, out of action, fled,
 * surrendered); the core has one who would kill (the Cruel) kill it. An ally going down weighs on the characters
 * beside it: Endure Stress (1; 2 when it's killed).
 *
 * Who's in a fight is "a mover" (spec.mover: a character, who rolls) or a foe (spec.rank). Foes still act against
 * creatures that aren't characters (a companion, a hired hand), with a plain attack.
 *
 * Playstyles, in the game's terms. The price of a miss may be a friend put in harm's way (one of the books' own
 * prices): a friend who goaded that foe, one who draws attacks or guards, or, when the one who missed keeps a low
 * profile, a friend beside it. A foe that taunts doesn't roll: it provokes, and the character Faces Danger (+heart) to
 * keep its head. Heal (+wits) mends a friend or itself; a Thief lifts something (+shadow) and the foe gives ground; a
 * hazard makes those it reaches Face Danger (+edge). One in a hurry takes End the Fight on sooner; how freely a
 * character uses resources says how readily it burns momentum.
 */
import { DOWNED_MODELS, STATUS, localize, behaviorOf, applyOutcome, dropCondition, tauntProof, goadLuck, isStanding, edgeDistance } from "./core.js";
import { movesFor, MOMENTUM, TICKS, TRACK, grade, chances, burnGrade, harmTable, stressTable } from "./moves.js";
import { sharedOf, trackRankOf, ENCOUNTER, STEPS, RANK_KEYS } from "./conflict.js";
import { t, statName, moveName } from "./words.js";

const BASE_DC = 10;
/** The engine's difficulty (a DC; 10 is ordinary) as adds: a hard talk, a friendly one. */
const addsFor = dc => (Number.isFinite(dc) ? Math.round((BASE_DC - dc) / 3) : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** The moves a character makes: as its spec says (its ruleset's, with the world's preference), else its ruleset's. */
const movesOf = u => u.spec.moveRules ?? movesFor(u.spec.ruleset);
const isMover = u => !!u?.spec?.mover;
const harm = n => [{ dice: [], flat: n, type: "harm", persistent: false, category: null }];

/** A plain action roll: a d6 + mod (+ adds), at most 10, against two challenge dice. */
function actionRoll(rng, mod, { adds = 0, progress = false } = {}) {
  const die = progress ? 0 : rng.die(6);
  const score = progress ? clamp(mod, 0, 10) : Math.min(10, die + mod + adds);
  const challenge = [rng.die(10), rng.die(10)];
  return { natural: die, total: score, challenge, match: challenge[0] === challenge[1], degree: grade(score, challenge) };
}

/**
 * The debilities (Ironsworn) and impacts (Starforged; Sundered Isles has Starforged's) a character's sheet marks, as the
 * engine's conditions: each by the system's own id for it (system.debility.<id>), on or off. The rules play wounded and
 * shaken (Endure Harm, Endure Stress); the system counts every one against the sheet's momentum.
 */
export const DEBILITIES = Object.freeze({
  classic: Object.freeze(["wounded", "shaken", "unprepared", "encumbered", "maimed", "corrupted", "cursed", "tormented"]),
  starforged: Object.freeze(["wounded", "shaken", "unprepared", "permanentlyharmed", "traumatized", "doomed", "tormented", "indebted", "battered", "cursed"])
});
/** Every one, whichever ruleset's sheet marks it. */
export const DEBILITY_KEYS = Object.freeze([...new Set(Object.values(DEBILITIES).flat())]);

/** The debilities the rules play. */
const PLAYED = ["wounded", "shaken"];

/**
 * A character's wounded or shaken (u.wounded, u.shaken), as the rules read and mark it, is its condition of that key:
 * the sheet's, the GM's (the Battle Vantage) and the fight's own alike. Marking it marks the condition (and so the
 * sheet, once the turn is written); the GM or the sheet taking the condition off takes it off for the rules too.
 */
function playedAsCondition(u, key) {
  Object.defineProperty(u, key, {
    configurable: true,
    enumerable: true,
    get() {
      return (Number(this.conds?.[key]) || 0) > 0;
    },
    set(on) {
      if ( !!on === this[key] ) return;
      if ( !on ) {
        dropCondition(this, key);
        return;
      }
      (this.baseConds ??= {})[key] = 1;
      (this.conds ??= {})[key] = 1;
    }
  });
}

const momentumOf = u => u.resources?.momentum ?? 0;
const setMomentum = (u, v) => { u.resources.momentum = clamp(v, MOMENTUM.min, u.momentumMax ?? MOMENTUM.max); };
/** Momentum's reset, less one for each impact marked in this fight (a wound). */
const resetOf = u => Math.max(0, (u.spec.momentumReset ?? MOMENTUM.reset) - (u.wounded && !u.spec.wounded ? 1 : 0));

export const ironswornRules = {
  id: "foundry-ironsworn",

  /* Turn ------------------------------------------------------------------ */
  mainPool: "action",
  movement: "feet",
  /** One move a turn (and getting where it needs to be). */
  turn(u) {
    return { action: 1, move: u.spec.speeds?.walk ?? 30 };
  },
  costOf(action) {
    return action.economy === "free" ? {} : { action: 1 };
  },
  basicAction: { action: 1 },
  talkCost: { action: 1 },
  /** A playstyle's taunt: a move (Compel, provoking a foe), the turn's one. */
  tauntCost: { action: 1 },
  stealCost: { action: 1 },
  feintCost: {},
  standCost() {
    return { move: 15 };
  },
  door: { ac: 10, hp: 12, threshold: 0, forceDC: 10, pickDC: 10 },
  doorCosts: { open: {}, force: { action: 1 }, pick: { action: 1 } },

  /**
   * A character's own state for the fight: a wound or shaken already marked (its conditions, as its sheet gives them;
   * or its spec says so), its momentum's ceiling, the initiative if a fight is under way.
   */
  initUnit(u) {
    if ( !isMover(u) ) return;
    for ( const key of PLAYED ) {
      playedAsCondition(u, key);
      if ( u.spec[key] ) u[key] = true;
    }
    u.spirit = clamp(Number(u.spec.spirit?.value ?? 5), 0, Number(u.spec.spirit?.max ?? 5));
    u.spiritMax = Number(u.spec.spirit?.max ?? 5);
    u.momentumMax = u.spec.momentumMax ?? MOMENTUM.max;
    if ( typeof u.spec.control === "boolean" ) u.control = u.spec.control;
  },

  /* Rolls ----------------------------------------------------------------- */
  roll(rng, mod, dc, options = {}) {
    return actionRoll(rng, mod, { adds: Math.sign(options.advantage ?? 0) + (options.progress ? 0 : addsFor(dc)), progress: !!options.progress });
  },
  distribution(mod, dc, { advantage = 0, progress = false } = {}) {
    return chances(mod, { adds: progress ? 0 : Math.sign(advantage) + addsFor(dc), progress });
  },
  /** Only for a total changed after the dice (the engine's Luck): the likeliest degree for that score. */
  degreeOfSuccess(natural, total) {
    return total >= 8 ? 3 : total >= 4 ? 2 : 1;
  },
  attackPenalty() {
    return 0;
  },
  /** A point on an action roll (a d6 against two d10s) moves far more than one on a d20: about a quarter more hits. */
  rollPoint: 0.25,
  /**
   * Its debilities and impacts are its own (cursed, doomed and encumbered among them, which the core has too): they
   * mean what the rules make of them, none of the core's bonuses and penalties.
   */
  ownConditions: DEBILITY_KEYS,
  /** What a condition harms each turn (a fire, radiation, a gullet's acid): a point of harm, whatever it is. */
  conditionHarm() {
    return harm(1);
  },
  /** A fall: a point of harm for each 10 feet, 3 at most; there's no lying prone. */
  fallDamage(feet) {
    const n = Math.min(3, Math.floor((Number(feet) || 0) / 10));
    return n > 0 ? harm(n) : [];
  },
  fallProne: false,
  minimumDamage: 0,
  /**
   * The few saves there are (a foe's attack on a companion): a strong hit avoids it. Facing a hazard's danger: any hit
   * gets clear of it (a weak hit at a cost: afterRoll).
   */
  saveMultiplier(degree, save) {
    if ( save?.faceDanger ) return degree >= 2 ? 0 : 1;
    return degree >= 3 ? 0 : 1;
  },
  /** Heal: a hit, weak or strong, gives its +2 health (a weak hit's cost is afterRoll's). */
  healCheckMultiplier(degree) {
    return degree >= 2 ? 1 : 0;
  },
  critical(parts) {
    return parts ?? [];
  },
  /**
   * Harm on a foe marks its track (ticks by its rank, or the encounter's as the fight has left it); on anyone else it's
   * health.
   */
  applyIwr(iwr, byType, target = null) {
    const per = target?.trackTicks ?? iwr?.ticksPerHarm;
    let total = 0;
    for ( const [type, amount] of Object.entries(byType) ) {
      if ( amount <= 0 || iwr?.immune?.includes(type) ) continue;
      total += type === "harm" && per ? amount * per : amount;
    }
    return total;
  },

  /* Moves ----------------------------------------------------------------- */
  /** Strike only with the initiative (in control), Clash only without; End the Fight with it, once the foe's track is half full. */
  usable(run, u, action, target) {
    if ( !isMover(u) || !action.move ) return true;
    if ( action.move === "strike" ) return !!u.control;
    if ( action.move === "clash" ) return !u.control;
    // (The encounter's objective: only well along, since a miss loses it.)
    // (One in a hurry, an Impatient or Speed-Runner one, takes it on two boxes sooner.)
    if ( action.move === "finish" ) return !!u.control && !!target?.spec.rank && progressScore(target) >= (sharedOf(target) ? 7 : 5) - (u.hurried ? 2 : 0);
    // Securing an advantage (Secure an Advantage, Gain Ground, Aid Your Ally), or taking the time to Heal, is for one in
    // control.
    if ( action.move === "advantage" || action.move === "heal" ) return !!u.control;
    return true;
  },
  /** Momentum a move gives (or costs), within its bounds; anything else as it is. */
  gainResource(u, key, amount) {
    if ( key === "momentum" ) {
      if ( isMover(u) ) setMomentum(u, momentumOf(u) + amount);
      return;
    }
    u.resources[key] = (u.resources[key] ?? 0) + amount;
  },
  /**
   * What momentum is worth to a character: each point a step toward burning it, which turns a miss into a hit. About a
   * fifth of what one of its Strikes does (against the foes here).
   */
  resourceWorth(run, u, key, amount) {
    if ( key !== "momentum" || !isMover(u) ) return 0;
    const strike = (u.prep?.offense ?? []).find(a => a.move === "strike");
    if ( !strike ) return 0;
    const ticks = Math.max(1, ...run.units.filter(o => o.side !== u.side && o.spec.iwr?.ticksPerHarm).map(o => o.spec.iwr.ticksPerHarm));
    const [, , weak, strong] = chances(Number(strike.bonus) || 0);
    const harmOf = parts => (parts ?? []).reduce((s, p) => s + (Number(p.flat) || 0), 0);
    return amount * 0.2 * ticks * (weak * harmOf(strike.damage) + strong * harmOf(strike.critDamage ?? strike.damage));
  },
  /** What else a move's outcome does: the price on a miss (-1 momentum, and the upper hand lost); both in control. */
  onOutcome(run, by, t, outcome) {
    if ( outcome?.price && isMover(by) ) {
      setMomentum(by, momentumOf(by) - 1);
      by.control = false;
    }
    if ( outcome?.takeControl ) {
      if ( isMover(t) ) t.control = true;
      if ( isMover(by) ) by.control = true;
    }
  },
  /** Foes don't roll: they press a character only through the character's own moves. A hazard catches anyone (Face Danger). */
  canTarget(run, attacker, target) {
    return isMover(attacker) || !isMover(target) || !!attacker.spec.hazard;
  },
  /**
   * A hazard (a trap, a raging river: anything the GM marks as one) catches a character as the game has it: it Faces
   * Danger (+edge) against it. A miss, the hazard's harm; a weak hit, clear at a cost (-1 momentum); a strong hit, clear.
   */
  initRun(run) {
    for ( const u of run.units ) {
      if ( !u.spec.hazard ) continue;
      u.prep.offense = u.prep.offense.map(a => (a.kind === "strike" ? { ...a, kind: "save", save: { type: "edge", dc: BASE_DC, faceDanger: true }, bonus: undefined } : a));
    }
  },
  /**
   * The start of a turn: whoever turned on the party since the last one settles what that means (settleJoins); and a
   * character's first turn is Enter the Fray.
   */
  startTurn(run, u) {
    const said = settleJoins(run);
    const fray = enterTheFray(run, u);
    // In a hurry this turn (its playstyles' rush): End the Fight sooner (usable).
    const rush = behaviorOf(u).rush ?? 0;
    u.hurried = isMover(u) && rush > 0 && run.rng.chance(rush);
    return [...said, fray, provoke(run, u)].filter(Boolean);
  },
  /** Burning momentum: when it turns a miss into a hit, or (with plenty to spare) a weak hit into a strong one. */
  adjustRoll(run, u, roll, ctx) {
    if ( !isMover(u) || !roll?.challenge || ctx?.action?.progressRoll ) return roll;
    const momentum = momentumOf(u);
    const better = burnGrade(momentum, roll.challenge);
    if ( better === null || better <= roll.degree || momentum <= resetOf(u) ) return roll;
    // (How freely it uses resources: conserving, only to turn a miss into a hit that matters; all out, readily, and a
    // weak hit into a strong one with less to spare.)
    const use = u.tac?.resourceUse;
    const stakes = ctx?.stakes ?? 0.3;
    const worth = roll.degree <= 1
      ? stakes >= (use === "conserve" ? 0.3 : use === "nova" ? 0 : 0.1)
      : use !== "conserve" && (momentum >= (use === "nova" ? 4 : 6) || (ctx?.stakes ?? 0) >= (use === "nova" ? 0.3 : 0.5));
    if ( !worth ) return roll;
    setMomentum(u, resetOf(u));
    u.burned = (u.burned ?? 0) + 1;
    return { ...roll, total: momentum, degree: better, burned: momentum,
      said: { text: t(better === 3 ? "Burn.Strong" : "Burn.Weak", { n: momentum, label: ctx?.label ?? t("TheRoll") }), data: { momentum, degree: better, label: ctx?.label ?? "" } } };
  },
  /** Who has the initiative after a move; what Heal and facing a hazard cost. */
  afterRoll(run, u, roll, ctx) {
    if ( !isMover(u) ) return;
    // Heal: a weak hit costs a point of momentum; a miss pays the price (a point, and the upper hand).
    if ( ctx?.kind === "heal" ) {
      if ( roll.degree <= 2 ) setMomentum(u, momentumOf(u) - 1);
      if ( roll.degree <= 1 ) u.control = false;
      return;
    }
    // Facing a hazard: a weak hit gets clear at a cost.
    if ( ctx?.kind === "save" && ctx.type === "edge" && roll.degree === 2 ) {
      setMomentum(u, momentumOf(u) - 1);
      return;
    }
    if ( ctx?.kind !== "attack" ) return;
    const move = ctx.action?.move;
    if ( move === "strike" ) u.control = roll.degree === 3;
    else if ( move === "clash" ) u.control = roll.degree === 3;
    else if ( move === "finish" ) {
      u.control = roll.degree >= 2;
      // One track for the encounter: a miss loses the objective, and the fight with it.
      if ( roll.degree <= 1 && sharedOf(ctx.target) ) run.resolved ??= { side: ctx.target.side, outcome: "objectiveLost" };
      // A weak hit wins it, at a cost (here: a little of its edge).
      if ( roll.degree === 2 ) setMomentum(u, momentumOf(u) - 2);
    }
  },
  /** Pay the Price: on a miss, or a weak Clash, the foe's harm (its rank; one more on matching dice). */
  backlash(run, u, target, action, degree) {
    if ( !isMover(u) || !action.move ) return null;
    const pays = degree <= 1 || (action.move === "clash" && degree === 2);
    if ( !pays ) return null;
    const amount = (target.spec.rank ?? 1) + (degree === 0 ? 1 : 0) + (action.move === "finish" && degree <= 1 ? 1 : 0);
    // A horror's price is dread: stress, not harm.
    if ( target.spec.nature === "horror" && u.status === STATUS.STANDING ) return { label: movesOf(u).price.name, said: endureStress(run, u, amount, run.rng) };
    const to = harmsWay(run, u, target);
    if ( !to ) return { label: movesOf(u).price.name, damage: harm(amount) };
    return { label: movesOf(u).price.name, damage: harm(amount), to, said: { text: t("HarmsWay", { name: to.spec.name }), data: { move: "price", to: to.id } } };
  },
  /**
   * Compel, for a character: a strong hit, +1 momentum; a miss pays the price, a refusal that weighs on it (Endure
   * Stress, 1); a miss on matching dice is also a demand that costs it dearly (a point of supply, to whoever it was
   * talking to).
   */
  afterTalk(run, talker, target, roll) {
    if ( !isMover(talker) || talker.status !== STATUS.STANDING ) return null;
    if ( roll.degree === 3 ) {
      setMomentum(talker, momentumOf(talker) + 1);
      return { text: t("CompelOutcome.Strong"), data: { move: "compel", degree: 3 } };
    }
    if ( roll.degree >= 2 ) return null;
    const lines = [];
    if ( roll.degree === 0 && supplyLeft(talker) > 0 ) {
      const v = talker.spec.valuables;
      (talker.concessions ??= []).push({ kind: "money", amount: 1, denominations: v.denominations ?? null, to: target.id, toName: target.spec.name, round: run.round, price: true });
      lines.push(t("CompelOutcome.Demand", { what: v.denominations?.[0]?.label ?? "" }));
    }
    const said = endureStress(run, talker, 1, run.rng);
    return { text: [t("CompelOutcome.Price", { price: movesOf(talker).price.name }), ...lines].join(" · ") + ` · ${said.text}`, data: { ...said.data, move: "compel", degree: roll.degree } };
  },
  /**
   * Endure Harm, for a character hurt (and still in the fight). A strong hit shakes it off (+1 health; Ironsworn's at
   * a point of momentum, and only above 0 health; Starforged's free, if not wounded) or embraces the pain (+1
   * momentum). A weak hit presses on (Starforged: a point of momentum for +1 health, if not wounded). A miss costs a
   * point of momentum (Starforged: it's worse than you thought, -1 health or -2 momentum). At 0 health, a wound or
   * the harm table.
   */
  afterHarm(run, u, amount, rng) {
    if ( !isMover(u) || u.status !== STATUS.STANDING ) return null;
    const m = movesOf(u);
    const stat = Math.max(Math.max(0, u.hp), u.spec.stats?.iron ?? 1);
    const roll = actionRoll(rng, stat);
    const e = m.endure;
    const base = t("MoveRoll", { move: e.name, stat, total: roll.total, dice: roll.challenge.join(", "), what: "" });
    const data = { move: "endure", total: roll.total, challenge: roll.challenge, degree: roll.degree, harm: amount };
    if ( roll.degree === 3 ) {
      const can = u.hp < u.maxHp && (e.shakeCost ? u.hp > 0 && momentumOf(u) - e.shakeCost >= resetOf(u) : !u.wounded);
      if ( can ) {
        u.hp += 1;
        if ( e.shakeCost ) setMomentum(u, momentumOf(u) - e.shakeCost);
        return { text: base + (e.shakeCost ? t("Endure.ShakeCost", { n: e.shakeCost }) : t("Endure.Shake")), data: { ...data, shook: true } };
      }
      setMomentum(u, momentumOf(u) + 1);
      return { text: base + t("Endure.Embrace"), data };
    }
    if ( roll.degree === 2 ) {
      // (Starforged: a point of momentum for a point of health, when it's worth it.)
      if ( e.weakTrade && !u.wounded && u.hp < u.maxHp && momentumOf(u) - 1 >= resetOf(u) ) {
        u.hp += 1;
        setMomentum(u, momentumOf(u) - 1);
        return { text: base + t("Endure.PressTrade"), data: { ...data, shook: true } };
      }
      return { text: base + t("Endure.Press"), data };
    }
    if ( e.miss === "worse" ) {
      // Starforged: it's worse than you thought: -1 health, or -2 momentum when health is what's short.
      if ( u.hp > 1 ) {
        u.hp -= 1;
        return { text: base + t("Endure.WorseHealth"), data };
      }
      setMomentum(u, momentumOf(u) - 2);
      if ( u.hp > 0 ) return { text: base + t("Endure.WorseMomentum"), data };
    } else {
      setMomentum(u, momentumOf(u) - 1);
      if ( u.hp > 0 ) return { text: base + t("Endure.Reels"), data };
    }
    // At 0 health: a wound, or (already wounded) the harm table.
    if ( !u.wounded ) {
      u.wounded = true;
      return { text: base + t("Endure.Wounded"), data: { ...data, wounded: true } };
    }
    const d100 = rng.die(100);
    const result = harmTable(d100);
    const said = { ...data, d100, result };
    if ( result === "mortal" ) {
      // Face Death: +heart. A strong hit casts you back; a weak hit leaves a deathbound quest; a miss is death.
      const face = actionRoll(rng, u.spec.stats?.heart ?? 1);
      said.faceDeath = face.degree;
      if ( face.degree <= 1 ) {
        u.status = STATUS.DEAD;
        return { text: base + t("Endure.MortalDies", { d100, face: m.face.name }), data: said };
      }
      u.status = STATUS.DOWN;
      u.stable = true;
      u.deathbound = face.degree === 2;
      return { text: base + (face.degree === 3 ? t("Endure.MortalBack", { d100, face: m.face.name })
        : t("Endure.MortalBound", { d100, face: m.face.name })), data: said };
    }
    if ( result === "dying" ) {
      u.status = STATUS.DOWN;
      u.stable = false;
      u.dying = 1;
      return { text: base + t("Endure.Dying", { d100 }), data: said };
    }
    if ( result === "out" ) {
      u.status = STATUS.DOWN;
      u.stable = true;
      return { text: base + t("Endure.Out", { d100 }), data: said };
    }
    if ( result === "reeling" ) {
      setMomentum(u, momentumOf(u) - 1);
      return { text: base + t("Endure.Reeling", { d100 }), data: said };
    }
    return { text: base + t("Endure.Standing", { d100 }), data: said };
  },

  /**
   * An ally going down (or beaten, or killed) weighs on the characters fighting beside it: each Endures Stress, 1
   * (2 when it's killed).
   */
  onFall(run, u, { dead = false } = {}) {
    const out = [];
    for ( const c of run.units ) {
      if ( c === u || !isMover(c) || c.side !== u.side || c.status !== STATUS.STANDING || u.spec.hazard ) continue;
      out.push({ unit: c, ...endureStress(run, c, dead ? 2 : 1, run.rng) });
    }
    return out;
  },

  /**
   * Someone taking a side mid-fight (one taking no side, won over or turning on one), once in a conflict each way.
   * Joining the party (or turning on its enemies), the first to: a success, a mark of progress on the encounter's
   * track (never the last: the fight still has to win it), or, with each foe's own track, +1 momentum for each
   * character. Turning on the party (or joining its enemies): part of the encounter's track, and the first moment it
   * happens settles what it means (settleJoins).
   */
  onAllegiance(run, u, { joined = null, against = null } = {}) {
    const foes = run.prep.sides[PARTY]?.enemies ?? new Set();
    const helps = joined === PARTY || (!!against && foes.has(against));
    const hinders = (!!joined && foes.has(joined)) || against === PARTY;
    if ( helps === hinders ) return [];
    const state = run.sideTaken ??= { helped: false, hindered: false, pending: null };
    // (Everyone on the encounter's track, whatever its side: one who turned on the party is on it too.)
    const track = run.units.filter(o => o !== u && sharedOf(o) === ENCOUNTER && o.status === STATUS.STANDING);
    const characters = run.units.filter(o => isMover(o) && o.side === PARTY && o.status === STATUS.STANDING);
    if ( hinders ) {
      // Part of the encounter's track now (one objective covers every foe), as hard as it is.
      if ( track.length ) {
        u.sharedHp = ENCOUNTER;
        u.maxHp = TRACK;
        u.hp = track[0].hp;
        u.trackRank = trackRankOf(track[0]);
        u.trackTicks = track[0].trackTicks ?? track[0].spec.iwr?.ticksPerHarm;
        u.convinceSteps = track[0].convinceSteps ?? track[0].spec.social?.steps;
      }
      // (What it means is settled once, at the next turn, with whoever else turned at the same moment: settleJoins.)
      if ( !state.hindered ) (state.pending ??= new Set()).add(u.id);
      return [];
    }
    // (Once in a conflict: the first to join the party.)
    if ( state.helped ) return [];
    state.helped = true;
    {
      if ( track.length ) {
        const ticks = track[0].trackTicks ?? track[0].spec.iwr?.ticksPerHarm ?? 0;
        for ( const o of track ) o.hp = Math.max(1, o.hp - ticks);
        return [{ unit: u, text: t("Allegiance.Success", { n: ticks }), data: { move: "ally", marked: ticks } }];
      }
      if ( !characters.length ) return [];
      for ( const c of characters ) setMomentum(c, momentumOf(c) + 1);
      return [{ unit: u, text: t("Allegiance.Bolster"), data: { move: "ally" } }];
    }
  },

  /* Dying ----------------------------------------------------------------- */
  /**
   * A foe whose track is full is beaten: out of the fight, however the table decides. A character at 0 health fights
   * on, the rest of the harm coming off its momentum (Endure Harm decides what more happens).
   */
  onDropped(c, { model = DOWNED_MODELS.SIMULATE, overflow = 0 } = {}) {
    if ( !isMover(c) ) {
      c.status = STATUS.BEATEN;
      return c.status;
    }
    c.hp = 0;
    if ( overflow > 0 ) setMomentum(c, momentumOf(c) - overflow);
    if ( model === DOWNED_MODELS.DEAD ) c.status = STATUS.DEAD;
    else if ( model === DOWNED_MODELS.OUT ) {
      c.status = STATUS.DOWN;
      c.stable = true;
    }
    return c.status;
  },
  onHealed(c, amount) {
    c.hp = Math.min(c.maxHp, Math.max(0, c.hp) + amount);
    if ( c.status === STATUS.DOWN && c.hp > 0 ) {
      c.status = STATUS.STANDING;
      c.dying = 0;
      c.stable = false;
    }
  },
  /** Dying, a character waits for help; nothing changes in the fight itself. */
  recoveryCheck() {
    return null;
  },
  persistentFlatCheck(rng) {
    return rng.die(10) >= 6;
  },

  /* Holds ----------------------------------------------------------------- */
  /**
   * Breaking free (of bonds, a grab, anything an action breaks), or freeing a friend: Face Danger, with the better of
   * +edge (slipping out, working the knots; first for bonds) and +iron (forcing it; first for a grab). A strong hit gets
   * free, +1 momentum; a weak hit gets free at a cost (-1 momentum); a miss is still held, and pays the price (-1
   * momentum, the upper hand lost). Momentum is burned to turn a miss into a hit, never a weak hit into a strong one
   * (that would only spare a point). Untying a friend with no foe beside it is no move at all: the core's untie, no
   * roll; with one, it's risky, and Face Danger. Foes don't roll: their struggle is the core's chance (null).
   * No DC and no d20: the roll's numbers are in its words. (Debilities and impacts hold no one, so there's no
   * escapeFrom; a try is the turn's one move, the core's default cost.)
   */
  breakFree(run, who, hold, { freeing = false } = {}) {
    if ( !isMover(who) ) return null;
    if ( freeing && hold.others === "untie" && !foeBeside(run, who) ) return null;
    const m = movesOf(who);
    const stats = who.spec.stats ?? {};
    const stat = (hold.key === "grabbed" ? ["iron", "edge"] : ["edge", "iron"]).reduce((best, s) => ((stats[s] ?? 1) > (stats[best] ?? 1) ? s : best));
    const label = moveName("FaceDanger");
    const first = actionRoll(run.rng, stats[stat] ?? 1);
    const roll = first.degree <= 1 ? ironswornRules.adjustRoll(run, who, first, { kind: "check", label }) : first;
    // (A strong hit, +1 momentum; a weak hit's cost and a miss's price, -1; a miss loses the upper hand too.)
    if ( roll.degree === 3 ) setMomentum(who, momentumOf(who) + 1);
    else setMomentum(who, momentumOf(who) - 1);
    if ( roll.degree <= 1 ) who.control = false;
    const what = roll.degree === 3 ? t("Hold.Strong") : roll.degree === 2 ? t("Hold.Weak") : t("Hold.Miss", { price: m.price.name, control: m.control.off });
    const line = t("MoveRoll", { move: label, stat: statName(stat), total: first.total, dice: first.challenge.join(", "), what });
    return {
      success: roll.degree >= 2, degree: roll.degree,
      said: { text: roll.said ? `${line} · ${roll.said.text}` : line, data: { move: "faceDanger", stat, total: roll.total, challenge: roll.challenge, degree: roll.degree, burned: roll.burned ?? 0, freeing } }
    };
  },

  /* What's typical, by rank -------------------------------------------- */
  typical: {
    ac: () => BASE_DC,
    save: () => 2,
    skill: () => 2,
    dc: () => BASE_DC
  },

  /* Situations ------------------------------------------------------------ */
  modifiers: {
    exposed({ target }) {
      return !!target.prone;
    },
    defense() {
      return 0;
    },
    /** An End the Fight rolls the foe's progress score, nothing else. */
    attack({ target, action }) {
      if ( action?.progressRoll ) return { score: progressScore(target), bonus: 0, advantage: 0 };
      return { bonus: 0, advantage: 0 };
    },
    save() {
      return { bonus: 0, advantage: 0 };
    },
    check() {
      return { bonus: 0, advantage: 0 };
    },
    steal() {
      return { bonus: 0, advantage: 0 };
    },
    actionsLost() {
      return 0;
    }
  },
  isImmune(target, action) {
    const immune = new Set(target.spec.iwr?.immune ?? []);
    return (action.traits ?? []).some(t => immune.has(t));
  },
  conditionWeight() {
    return 0;
  },
  conditionMods() {
    return null;
  },
  resistShare() {
    return 0.5;
  },

  /**
   * A live battle's next spotlight (no initiative: the GM gives it): the next character able to act, in turn after the
   * last to have it. Foes never take one of their own (they answer the characters' moves), unless no character can act.
   */
  nextSpotlight(run, { last = null, up = {} } = {}) {
    const order = run.order;
    const able = u => u.active && u.status === STATUS.STANDING;
    const movers = order.filter(u => isMover(u) && able(u));
    const list = movers.length ? movers : order.filter(able);
    if ( !list.length ) return null;
    const lastMover = order.filter(isMover).reduce((best, u) => ((up[u.id] ?? -1) > (best ? up[best.id] ?? -1 : -1) ? u : best), null);
    const from = movers.length ? lastMover : last;
    const at = from ? order.indexOf(from) : -1;
    return list.find(u => order.indexOf(u) > at) ?? list[0];
  },

  /**
   * What writing a turn onto the sheets (commit.js) and the planner's summary need beyond the core's: spirit, shaken,
   * momentum, a wound, who has the initiative, Face Death.
   */
  capture(u) {
    return {
      spirit: isMover(u) ? u.spirit ?? null : null,
      shaken: !!u.shaken,
      momentum: u.resources?.momentum ?? null,
      wounded: !!u.wounded,
      control: u.control ?? null,
      deathbound: !!u.deathbound,
      burned: u.burned ?? 0
    };
  },

  secondsPerRound: 6,
  /** A hero whose answer is "retreat when hurt" does so at 0 health: before that, it fights on. */
  retreatAt: 0.01,

  storyDamageType(type) {
    return type === "harm" ? "bludgeoning" : type;
  }
};

/** The party's side: the characters'. */
const PARTY = "friendly";

/** A foe beside it, still fighting (close in a fight, or within 5 feet on a map). */
function foeBeside(run, u) {
  const enemies = run.prep.sides[u.side]?.enemies ?? new Set();
  const near = o => u.adjacent?.has(o.id) || (!!run.prep.options.positioning && (edgeDistance(u, o) ?? Infinity) <= 5);
  return run.units.some(o => enemies.has(o.side) && isStanding(o) && near(o));
}

/**
 * Pay the Price: "a friend is put in harm's way" (one of the books' own prices). Who: a friend whose taunt that foe is
 * under; else a friend who draws attacks (its playstyles' drawAggro) or guards its friends (their protect), as likely
 * as its perk; else, when the one who missed keeps a low profile (lowProfile), the foe's eye slides to a friend beside
 * it who doesn't. Only a friend in the thick of it: beside the foe or the one who missed (without positions, any still
 * fighting). Null: it pays itself.
 */
function harmsWay(run, u, foe) {
  const near = o => !run.prep.options.positioning || o.adjacent?.has(foe.id) || o.adjacent?.has(u.id) || (edgeDistance(o, foe) ?? Infinity) <= 5;
  const friends = run.units.filter(o => o !== u && o.side === u.side && isStanding(o) && !o.spec.hazard && near(o));
  if ( !friends.length ) return null;
  const taunter = friends.find(o => (foe.effects ?? []).some(e => e.taunt && e.sourceId === o.id));
  if ( taunter ) return taunter;
  const rng = run.rng;
  for ( const o of rng.shuffle([...friends]) ) {
    const draws = Math.max(Number(behaviorOf(o).drawAggro) || 0, Math.min(0.5, (Number(o.spec.desireStyle?.protect) || 0) / 50));
    if ( draws > 0 && rng.chance(draws) ) return o;
  }
  const low = Number(behaviorOf(u).lowProfile) || 0;
  const open = friends.filter(o => !(Number(behaviorOf(o).lowProfile) > 0));
  return low > 0 && open.length && rng.chance(low) ? rng.pick(open) : null;
}

/**
 * A foe that taunts (its playstyles' taunt: a Tank, an Instigator, a Brawler the GM made it) doesn't roll: it provokes,
 * as often as a playstyle taunt takes hold (the Taunting setting times its share), the character it would draw: one
 * pressing it, else the nearest. That character Faces Danger (+heart) to keep its head: a hit, it does; a miss, it rises
 * to it (the core's taunt: it wants to go for that foe) unless it shrugs taunts off (its playstyles' tauntProof).
 */
function provoke(run, foe) {
  if ( isMover(foe) || foe.spec.hazard || run.prep.options.talking === false || !foe.spec.social?.languages?.length ) return null;
  const share = Math.min(1, Number(behaviorOf(foe).taunt) || 0);
  if ( !(share > 0) ) return null;
  const enemies = run.prep.sides[foe.side]?.enemies ?? new Set();
  const marks = run.units.filter(o => isMover(o) && isStanding(o) && enemies.has(o.side) && !(o.effects ?? []).some(e => e.taunt && e.sourceId === foe.id));
  if ( !marks.length || run.rng.die(100) > goadLuck(run, { goad: share }) ) return null;
  const mark = marks.find(o => o.targetId === foe.id) ?? marks.sort((a, b) => (edgeDistance(a, foe) ?? 0) - (edgeDistance(b, foe) ?? 0))[0];
  const roll = actionRoll(run.rng, mark.spec.stats?.heart ?? 1);
  let what = "Holds";
  if ( roll.degree <= 1 ) {
    what = run.rng.chance(tauntProof(mark)) ? "Shrugs" : "Rises";
    if ( what === "Rises" ) applyOutcome(mark, { taunt: true, rounds: 1, label: "" }, foe.id, { id: `${foe.id}.provoke` });
  }
  const line = t("MoveRoll", { move: moveName("FaceDanger"), stat: statName("heart"), total: roll.total, dice: roll.challenge.join(", "), what: t(`Provoke.${what}`) });
  return { unit: mark, text: t("Provoke.Line", { foe: foe.spec.name, roll: line }), data: { move: "faceDanger", provokedBy: foe.id, degree: roll.degree, taunted: what === "Rises" } };
}

/**
 * A character's first turn: Enter the Fray, +shadow to spring an ambush, +wits ambushed; otherwise Ironsworn's +heart,
 * or Starforged's best of +edge (on the move), +heart (facing off) and +iron (in the thick of it); one keeping a low
 * profile (its playstyles' lowProfile) may move into position unseen instead, +shadow. A miss: Ironsworn's Pay the
 * Price (-1 momentum here), Starforged's bad spot alone. Null for anyone else, or later.
 */
function enterTheFray(run, u) {
  if ( !isMover(u) || u.control !== undefined ) return null;
    const m = movesOf(u);
    const surprise = run.prep.options.surpriseSide;
    const stats = u.spec.stats ?? {};
    const ways = (behaviorOf(u).lowProfile ?? 0) > 0 ? [...(m.fray.stats ?? ["heart"]), "shadow"] : m.fray.stats ?? ["heart"];
    const stat = surprise === u.side ? "shadow" : surprise ? "wits" : ways.reduce((best, s) => ((stats[s] ?? 1) > (stats[best] ?? 1) ? s : best));
    const roll = actionRoll(run.rng, stats[stat] ?? 1);
    u.control = roll.degree >= 2;
    if ( roll.degree === 3 ) setMomentum(u, momentumOf(u) + 2);
    if ( roll.degree <= 1 && m.fray.missMomentum ) setMomentum(u, momentumOf(u) + m.fray.missMomentum);
    const lost = m.fray.missMomentum ? t("MomentumChange", { n: m.fray.missMomentum }) : "";
    const what = { 3: `${m.control.on}${t("MomentumChange", { n: "+2" })}`, 2: m.control.on, 1: `${m.control.off}${lost}`, 0: `${m.control.off}${lost}` }[roll.degree];
    return { text: t("MoveRoll", { move: m.fray.name, stat: statName(stat), total: roll.total, dice: roll.challenge.join(", "), what }), data: { move: "fray", stat, total: roll.total, challenge: roll.challenge, degree: roll.degree } };
}

/** A neutral's team (one of up to three): the others taking no side in its friend group, and it. With none, it's alone. */
const teamOf = (run, u) => (u.spec.group ? run.units.filter(o => o.spec.side === "neutralParty" && o.spec.group === u.spec.group) : [u]);

/** Does it lead: a boss, or the head of its group's chain of command? */
const leads = (run, u) => !!u.isBoss || Object.values(run.prep.command ?? {}).some(chain => chain?.[0]?.id === u.id);

/**
 * Whoever turned on the party at one moment (the first: once in a conflict), settled at the next turn. A whole neutral
 * team (two or more of them, every one still standing), or a leader among them: a harder fight, the encounter's rank up
 * a step, never to epic (one track for the encounter). Anyone else, or no step to take: each character endures stress
 * (1).
 */
function settleJoins(run) {
  const state = run.sideTaken;
  if ( !state?.pending ) return [];
  const turned = state.pending;
  state.pending = null;
  state.hindered = true;
  const joiners = [...turned].map(id => run.byId.get(id)).filter(Boolean);
  if ( !joiners.length ) return [];
  const wholeTeam = joiners.some(j => {
    const team = teamOf(run, j);
    return team.length >= 2 && team.every(o => turned.has(o.id) || o.status !== STATUS.STANDING);
  });
  const many = wholeTeam || joiners.some(j => leads(run, j));
  const track = run.units.filter(o => sharedOf(o) === ENCOUNTER && o.status === STATUS.STANDING);
  const rank = trackRankOf(track[0]);
  if ( many && track.length && rank && rank + 1 <= 4 ) {
    const next = rank + 1;
    for ( const o of track ) {
      o.trackRank = next;
      o.trackTicks = TICKS[next];
      o.convinceSteps = STEPS[next];
    }
    return [{ unit: joiners[0], text: t("Allegiance.Harder", { rank: localize(`IRONSWORN.CHALLENGERANK.${RANK_KEYS[next]}`) }), data: { move: "foe", trackRank: next } }];
  }
  const characters = run.units.filter(o => isMover(o) && o.side === PARTY && o.status === STATUS.STANDING);
  if ( !characters.length ) return [];
  return [{ unit: joiners[0], text: t("Allegiance.Dread"), data: { move: "foe" } }, ...characters.map(c => ({ unit: c, ...endureStress(run, c, 1, run.rng) }))];
}

/** What's left of a character's supply, which its side shares (after anything any of them paid). */
function supplyLeft(u) {
  const v = u.spec.valuables;
  if ( !v?.pooled ) return 0;
  const paid = (u.pool ?? [u]).flatMap(o => o.concessions ?? []).filter(c => !c.kept && c.kind === "money").reduce((s, c) => s + c.amount, 0);
  return Math.max(0, (v.money ?? 0) - paid);
}

/**
 * Endure Stress: -spirit (at 0, the rest comes off momentum), then a roll (+spirit or +heart). It plays as Endure Harm
 * does, by the ruleset: a strong hit shakes it off (+1 spirit; Ironsworn's at a point of momentum, Starforged's free
 * if not shaken) or embraces the darkness (+1 momentum); a weak hit presses on (Starforged: a point of momentum for +1
 * spirit, if not shaken); a miss costs a point of momentum (Starforged: worse than it seemed, -1 spirit or -2
 * momentum). At 0 spirit on a miss: shaken, or (already shaken) the stress table: overwhelmed, it Faces Desolation
 * (+heart), and on a miss gives up the fight.
 * @returns {{text: string, data: object}}
 */
export function endureStress(run, u, amount, rng) {
  const m = movesOf(u);
  const e = m.endure;
  const over = Math.max(0, amount - u.spirit);
  u.spirit = Math.max(0, u.spirit - amount);
  if ( over ) setMomentum(u, momentumOf(u) - over);
  const stat = Math.max(u.spirit, u.spec.stats?.heart ?? 1);
  const roll = actionRoll(rng, stat);
  const base = t("MoveRoll", { move: m.stress.name, stat, total: roll.total, dice: roll.challenge.join(", "), what: "" });
  const data = { move: "stress", total: roll.total, challenge: roll.challenge, degree: roll.degree, stress: amount };
  if ( roll.degree === 3 ) {
    const can = u.spirit < u.spiritMax && (e.shakeCost ? u.spirit > 0 && momentumOf(u) - e.shakeCost >= resetOf(u) : !u.shaken);
    if ( can ) {
      u.spirit += 1;
      if ( e.shakeCost ) setMomentum(u, momentumOf(u) - e.shakeCost);
      return { text: base + (e.shakeCost ? t("Stress.ShakeCost", { n: e.shakeCost }) : t("Stress.Shake")), data };
    }
    setMomentum(u, momentumOf(u) + 1);
    return { text: base + t("Stress.Embrace"), data };
  }
  if ( roll.degree === 2 ) {
    if ( e.weakTrade && !u.shaken && u.spirit < u.spiritMax && momentumOf(u) - 1 >= resetOf(u) ) {
      u.spirit += 1;
      setMomentum(u, momentumOf(u) - 1);
      return { text: base + t("Stress.PressTrade"), data };
    }
    return { text: base + t("Stress.Press"), data };
  }
  if ( e.miss === "worse" ) {
    if ( u.spirit > 1 ) {
      u.spirit -= 1;
      return { text: base + t("Stress.WorseSpirit"), data };
    }
    setMomentum(u, momentumOf(u) - 2);
    if ( u.spirit > 0 ) return { text: base + t("Stress.WorseMomentum"), data };
  } else {
    setMomentum(u, momentumOf(u) - 1);
    if ( u.spirit > 0 ) return { text: base + t("Stress.Reels"), data };
  }
  // At 0 spirit: shaken, or (already shaken) the stress table.
  if ( !u.shaken ) {
    u.shaken = true;
    return { text: base + t("Stress.Shaken"), data: { ...data, shaken: true } };
  }
  const d100 = rng.die(100);
  const result = stressTable(d100);
  if ( result === "desolation" ) {
    const face = actionRoll(rng, u.spec.stats?.heart ?? 1);
    if ( face.degree >= 2 ) return { text: base + t("Stress.DesolateHolds", { d100, face: m.desolation.name }), data: { ...data, d100, result, face: face.degree } };
    // It gives up the fight: out of it, as one who ran.
    for ( const id of u.adjacent ?? [] ) run.byId.get(id)?.adjacent.delete(u.id);
    u.adjacent?.clear();
    u.status = STATUS.FLED;
    u.fellRound ??= run.round;
    u.ranRound = run.round;
    return { text: base + t("Stress.Desolate", { d100, face: m.desolation.name }), data: { ...data, d100, result, face: face.degree, gaveUp: true } };
  }
  if ( result === "falters" ) {
    setMomentum(u, momentumOf(u) - 1);
    return { text: base + t("Stress.Falters", { d100 }), data: { ...data, d100, result } };
  }
  return { text: base + t("Stress.Perseveres", { d100 }), data: { ...data, d100, result } };
}

/** A foe's progress score: whole boxes filled on its track (4 ticks a box), 0-10. */
export function progressScore(u) {
  return clamp(Math.floor((u.maxHp - Math.max(0, u.hp)) / 4), 0, 10);
}
