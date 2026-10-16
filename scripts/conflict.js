/**
 * A conflict as Ironsworn and Starforged play it, in FastFighting's terms. Pure, unit-tested.
 *
 * Success is progress on a track; things going wrong cost health (harm), spirit (stress, despair) or supply (anything
 * material lost), and momentum.
 *  - Ironsworn: each foe has a track of its own, at its rank; harm marks progress on it (troublesome 3 boxes a harm,
 *    epic 1 tick), and End the Fight is a progress roll against that foe's track ("each foe's own track").
 *  - Starforged (and Sundered Isles): the fight has an objective, a track at a rank the GM sets; every Strike and Clash
 *    marks progress on it, and Take Decisive Action is a progress roll against it: a hit achieves the objective (the
 *    foes are beaten, driven off or out of it), a miss loses it ("one track for the encounter"). The track is kept on
 *    one of the characters (the GM's pick in the planner; the others can follow it by hand).
 * In the engine, one track for the encounter is hit points every foe shares (sharedHp): what one takes, all of them take,
 * and they fall together. Talking marks progress on it too, each success a mark (a strong hit two), and the encounter's
 * rank says how many it takes to talk a foe round. Either way, each foe's harm (its own rank) is what it costs a
 * character who pays the price.
 */
import { TICKS, TRACK } from "./moves.js";

/** The challenge ranks, 1 troublesome ... 5 epic, by the system's own word for each (IRONSWORN.CHALLENGERANK.*). */
export const RANK_KEYS = Object.freeze({ 1: "Troublesome", 2: "Dangerous", 3: "Formidable", 4: "Extreme", 5: "Epic" });

/** How the encounter is tracked: one track for it (Starforged's objective), or each foe's own (Ironsworn's). */
export const TRACK_MODES = Object.freeze(["encounter", "foes"]);

/**
 * Successes it takes to talk a foe round, at the encounter's rank: the marks that fill its track far enough (six boxes)
 * for a progress roll that's more likely to win than not.
 */
export const STEPS = Object.freeze({ 1: 2, 2: 3, 3: 6, 4: 12, 5: 24 });

/** The key every foe on one encounter track shares (spec.sharedHp). */
export const ENCOUNTER = "encounter";

/** The track a creature is part of in the fight (one who joined it mid-fight: its own; else its spec's), or null. */
export const sharedOf = u => u?.sharedHp ?? u?.spec?.sharedHp ?? null;

/** The encounter's rank as the fight has left it (a newcomer turning on the party raises it a step). */
export const trackRankOf = u => u?.trackRank ?? u?.spec?.objectiveRank ?? null;

/** A rank from anything (a setting's string, a foe's rank): 1-5, or null. */
export const rankOf = v => (Number.isFinite(Number(v)) && Number(v) >= 1 && Number(v) <= 5 ? Math.round(Number(v)) : null);

/** The default way to track it: one track for the encounter where any character plays Starforged's moves, else each foe's own. */
export function defaultMode(rulesets) {
  return rulesets.some(r => r === "starforged" || r === "sundered_isles") ? "encounter" : "foes";
}

/** The default rank for the encounter's track: its most dangerous foe's, else dangerous. */
export function defaultRank(foeRanks) {
  const ranks = foeRanks.map(rankOf).filter(Boolean);
  return ranks.length ? Math.max(...ranks) : 2;
}

/**
 * A foe as part of the encounter's track: its hit points are the ticks left on the track (shared with every other foe
 * on it), harm marks progress at the encounter's rank, and talking it round takes the rank's successes. Its own rank
 * still says how hard it hits back.
 * @param {object} foe        its CombatantSpec
 * @param {object} track      {rank: 1-5, current: ticks already marked}
 */
export function joinEncounter(foe, { rank, current = 0 }) {
  const marked = Math.max(0, Math.min(TRACK, Number(current) || 0));
  return {
    ...foe,
    sharedHp: ENCOUNTER,
    hp: { value: TRACK - marked, max: TRACK, temp: 0 },
    iwr: { ...foe.iwr, ticksPerHarm: TICKS[rank] },
    objectiveRank: rank,
    social: foe.social ? { ...foe.social, steps: STEPS[rank] } : foe.social
  };
}

/**
 * What the encounter's track came to: ticks marked going in, coming out (the fight's progress, the foes' shared track;
 * and the words', a mark for each success at a foe on it, two for a strong hit), and how it ended for the objective.
 * @param {object} plan     spec.options.system ({mode, rank, before, foeIds, friendly})
 * @param {object} replay   the fight ({units: {id: {final}}, log})
 * @returns {{before: number, after: number, fought: number, talked: number, achieved: boolean, lost: boolean}}
 */
export function trackProgress(plan, replay) {
  const foes = (plan.foeIds ?? []).map(id => replay.units?.[id]?.final).filter(Boolean);
  const before = Math.max(0, Math.min(TRACK, plan.before ?? 0));
  const left = foes.length ? Math.min(...foes.map(f => Math.max(0, f.hp ?? TRACK))) : TRACK - before;
  const fought = Math.max(0, TRACK - left - before);
  const onTrack = new Set(plan.foeIds ?? []);
  const marks = (replay.log ?? []).filter(e => e.type === "talk" && e.degree >= 2 && onTrack.has(e.targetId) && e.side === plan.friendly)
    .reduce((s, e) => s + (e.degree === 3 ? 2 : 1), 0);
  // (The rank as the fight left it: raised by someone turning on the party.)
  const rank = [...(replay.log ?? [])].reverse().find(e => e.trackRank)?.trackRank ?? plan.rank;
  const talked = marks * (TICKS[rank] ?? 0);
  const after = Math.min(TRACK, before + fought + talked);
  const end = (replay.log ?? []).find(e => e.type === "end");
  const lost = end?.resolved === "objectiveLost";
  const achieved = !lost && (left <= 0 || (!!end && (end.winners ?? []).includes(plan.friendly)));
  return { before, after, fought, talked, achieved, lost, rank };
}

/** How much harm a locked door stands up to in Ironsworn: a world setting, 1 to 3 (3: a deadly weapon's two hits). */
export const DOOR_HARM = Object.freeze({ min: 1, max: 3, step: 1, default: 3 });

/** The door harm setting's value within its bounds, whole (the default for anything that isn't a number). */
export const doorHarmOf = v => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.max(DOOR_HARM.min, Math.min(DOOR_HARM.max, Math.round(Number(v)))) : DOOR_HARM.default);

/**
 * The scene's doors (spec.doors) as tough as this conflict makes them, where a door's own hit points (its wall's flags)
 * don't say. Tracked Ironsworn's way (each foe's own track), a door stands up to the world's door harm; Starforged's
 * (one track for the encounter), getting past it is a step of progress forward, so one hit is enough. A mixed party
 * goes by how the encounter is tracked: Starforged's where any character plays its moves, unless the GM says otherwise.
 * @param {object} doors          {id: {locked, x, y, ...its own numbers}}
 * @param {object} d
 * @param {string} d.mode         how the encounter is tracked: "encounter" | "foes"
 * @param {number} [d.harm]       the world's door harm (1-3)
 */
export function doorsFor(doors, { mode, harm = DOOR_HARM.default } = {}) {
  if ( !doors ) return doors;
  const hp = mode === "encounter" ? 1 : doorHarmOf(harm);
  return Object.fromEntries(Object.entries(doors).map(([id, d]) => [id, d?.hp === undefined || d?.hp === null ? { ...d, hp } : d]));
}

/** Whole boxes on a track (four ticks a box), 0-10. */
export const boxes = ticks => Math.max(0, Math.min(10, Math.floor((Number(ticks) || 0) / 4)));
