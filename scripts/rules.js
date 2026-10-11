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
 *
 * Who's in a fight is "a mover" (spec.mover: a character, who rolls) or a foe (spec.rank). Foes still act against
 * creatures that aren't characters (a companion, a hired hand), with a plain attack.
 */
import { DOWNED_MODELS, STATUS } from "./core.js";
import { movesFor, MOMENTUM, grade, chances, burnGrade, harmTable } from "./moves.js";
import { t, statName } from "./words.js";

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
  stealCost: { action: 1 },
  feintCost: {},
  standCost() {
    return { move: 15 };
  },
  door: { ac: 10, hp: 12, threshold: 0, forceDC: 10, pickDC: 10 },
  doorCosts: { open: {}, force: { action: 1 }, pick: { action: 1 } },

  /** A character's own state for the fight: a wound already marked, its momentum's ceiling, the initiative if a fight is under way. */
  initUnit(u) {
    if ( !isMover(u) ) return;
    u.wounded = !!u.spec.wounded;
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
  minimumDamage: 0,
  /** The few saves there are (a foe's attack on a companion): a strong hit avoids it. */
  saveMultiplier(degree) {
    return degree >= 3 ? 0 : 1;
  },
  critical(parts) {
    return parts ?? [];
  },
  /** Harm on a foe marks its track (ticks by its rank); on anyone else it's health. */
  applyIwr(iwr, byType) {
    let total = 0;
    for ( const [type, amount] of Object.entries(byType) ) {
      if ( amount <= 0 || iwr?.immune?.includes(type) ) continue;
      total += type === "harm" && iwr?.ticksPerHarm ? amount * iwr.ticksPerHarm : amount;
    }
    return total;
  },

  /* Moves ----------------------------------------------------------------- */
  /** Strike only with the initiative (in control), Clash only without; End the Fight with it, once the foe's track is half full. */
  usable(run, u, action, target) {
    if ( !isMover(u) || !action.move ) return true;
    if ( action.move === "strike" ) return !!u.control;
    if ( action.move === "clash" ) return !u.control;
    if ( action.move === "finish" ) return !!u.control && !!target?.spec.rank && progressScore(target) >= 5;
    // Securing an advantage (Secure an Advantage, Gain Ground, Aid Your Ally) is for one in control.
    if ( action.move === "advantage" ) return !!u.control;
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
  /** Foes don't roll: they press a character only through the character's own moves. */
  canTarget(run, attacker, target) {
    return isMover(attacker) || !isMover(target);
  },
  /**
   * The first turn: Enter the Fray, +shadow to spring an ambush, +wits ambushed; otherwise Ironsworn's +heart, or
   * Starforged's best of +edge (on the move), +heart (facing off) and +iron (in the thick of it). A miss: Ironsworn's
   * Pay the Price (-1 momentum here), Starforged's bad spot alone.
   */
  startTurn(run, u) {
    if ( !isMover(u) || u.control !== undefined ) return null;
    const m = movesOf(u);
    const surprise = run.prep.options.surpriseSide;
    const stats = u.spec.stats ?? {};
    const stat = surprise === u.side ? "shadow" : surprise ? "wits"
      : (m.fray.stats ?? ["heart"]).reduce((best, s) => ((stats[s] ?? 1) > (stats[best] ?? 1) ? s : best));
    const roll = actionRoll(run.rng, stats[stat] ?? 1);
    u.control = roll.degree >= 2;
    if ( roll.degree === 3 ) setMomentum(u, momentumOf(u) + 2);
    if ( roll.degree <= 1 && m.fray.missMomentum ) setMomentum(u, momentumOf(u) + m.fray.missMomentum);
    const lost = m.fray.missMomentum ? t("MomentumChange", { n: m.fray.missMomentum }) : "";
    const what = { 3: `${m.control.on}${t("MomentumChange", { n: "+2" })}`, 2: m.control.on, 1: `${m.control.off}${lost}`, 0: `${m.control.off}${lost}` }[roll.degree];
    return { text: t("MoveRoll", { move: m.fray.name, stat: statName(stat), total: roll.total, dice: roll.challenge.join(", "), what }), data: { move: "fray", stat, total: roll.total, challenge: roll.challenge, degree: roll.degree } };
  },
  /** Burning momentum: when it turns a miss into a hit, or (with plenty to spare) a weak hit into a strong one. */
  adjustRoll(run, u, roll, ctx) {
    if ( !isMover(u) || !roll?.challenge || ctx?.action?.progressRoll ) return roll;
    const momentum = momentumOf(u);
    const better = burnGrade(momentum, roll.challenge);
    if ( better === null || better <= roll.degree || momentum <= resetOf(u) ) return roll;
    const worth = roll.degree <= 1 ? (ctx?.stakes ?? 0.3) >= 0.1 : momentum >= 6 || (ctx?.stakes ?? 0) >= 0.5;
    if ( !worth ) return roll;
    setMomentum(u, resetOf(u));
    u.burned = (u.burned ?? 0) + 1;
    return { ...roll, total: momentum, degree: better, burned: momentum,
      said: { text: t(better === 3 ? "Burn.Strong" : "Burn.Weak", { n: momentum, label: ctx?.label ?? t("TheRoll") }), data: { momentum, degree: better, label: ctx?.label ?? "" } } };
  },
  /** Who has the initiative after a move. */
  afterRoll(run, u, roll, ctx) {
    if ( !isMover(u) || ctx?.kind !== "attack" ) return;
    const move = ctx.action?.move;
    if ( move === "strike" ) u.control = roll.degree === 3;
    else if ( move === "clash" ) u.control = roll.degree === 3;
    else if ( move === "finish" ) {
      u.control = roll.degree >= 2;
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
    return { label: movesOf(u).price.name, damage: harm(amount) };
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

  /* Dying ----------------------------------------------------------------- */
  /**
   * A foe whose track is full is out of the fight (defeated). A character at 0 health fights on, the rest of the harm
   * coming off its momentum (Endure Harm decides what more happens).
   */
  onDropped(c, { model = DOWNED_MODELS.SIMULATE, overflow = 0 } = {}) {
    if ( !isMover(c) ) {
      c.status = STATUS.DEAD;
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

  /** What Make it So needs beyond the core's: momentum, a wound, who has the initiative, Face Death. */
  capture(u) {
    return {
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

/** A foe's progress score: whole boxes filled on its track (4 ticks a box), 0-10. */
export function progressScore(u) {
  return clamp(Math.floor((u.maxHp - Math.max(0, u.hp)) / 4), 0, 10);
}
