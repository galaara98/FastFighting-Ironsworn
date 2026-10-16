/**
 * Ironsworn and Starforged live battles: each turn's changes written onto a token's actor, returning an undo record.
 * A character: health, spirit, momentum, its debilities or impacts marked or cleared (a wound, shaken, the GM's), and
 * how it ended up (out cold, dead). A foe: progress marked on its track (the turn's harm, by its rank), the track
 * completed when it was beaten, and its token marked defeated; on one track for the encounter, that track instead, kept
 * on one of the characters. Also: what was given up to end a standoff, and (for the planner's summary) what a fight
 * changes.
 *
 * Undo record shape (consumed by the core's make-it-so.js):
 *   { tokenUuid, actorUuid, actorUpdate, itemUpdates: [{id, update}], createdItems: [id], deletedItems: [data],
 *     createdEffects: [id], tokenUpdate, createdActors, createdTokens, deletedTokens, statuses: [{id, active}], combatant }
 */
import { STATUS } from "./core.js";
import { t } from "./words.js";
import { TRACK, TICKS } from "./moves.js";
import { RANK_KEYS, trackProgress, boxes } from "./conflict.js";
import { DEBILITY_KEYS } from "./rules.js";

/** This module's flags (the encounter a track is kept for). */
const MODULE = "fast-fighting-ironsworn";

export function statusesOf(actor) {
  const out = new Set(actor?.statuses ?? []);
  for ( const e of actor?.effects ?? [] ) if ( !e.disabled ) for ( const s of e.statuses ?? [] ) out.add(s);
  return out;
}

const emptyRecord = (tokenDoc, actor) => ({
  tokenUuid: tokenDoc?.uuid ?? null, actorUuid: actor.uuid, actorUpdate: {}, itemUpdates: [], createdItems: [], deletedItems: [], createdEffects: [],
  tokenUpdate: null, createdActors: [], createdTokens: [], deletedTokens: [], statuses: [],
  statusesBefore: [...statusesOf(actor)]
});

/** Ticks a foe's track had marked going in, and coming out. */
const ticks = hp => Math.max(0, Math.min(TRACK, TRACK - Math.max(0, hp)));

/** Where a character's meter is kept (a meter with a value, or a number: supply, spirit), and how much it has. */
const meterPath = (actor, key) => (typeof actor?.system?.[key] === "object" ? `system.${key}.value` : `system.${key}`);
export const meterOf = (actor, key) => Math.max(0, Number(foundry.utils.getProperty(actor, meterPath(actor, key))) || 0);
const supplyPath = actor => meterPath(actor, "supply");
export const supplyOf = actor => meterOf(actor, "supply");

/** Does the system share Supply between every character (its own setting)? */
function sharedSupply() {
  try {
    return !!game.settings.get("foundry-ironsworn", "shared-supply");
  } catch ( err ) {
    return false;
  }
}

/**
 * What was given up to end a standoff. Supply, a character's payment: its friendly side shares it, so every character
 * on the giver's side has that much less; with the system's shared Supply, so does every character and starship it
 * shares Supply with. Ground given, a foe's: progress marked on its own track, by its rank.
 * @param {TokenDocument} giverDoc
 * @param {TokenDocument|null} receiverDoc
 * @param {object} concession   {kind: "money" (Supply) | "progress", amount}
 * @param {object} [options]    {allies: the giver's side's tokens}
 * @returns {Promise<object[]>} undo records
 */
export async function commitIronswornConcession(giverDoc, receiverDoc, concession, { allies = [] } = {}) {
  const giver = giverDoc?.actor;
  if ( !giver ) return [];
  if ( concession.kind === "progress" ) {
    const track = giver.items.find(i => i.type === "progress");
    if ( !track ) return [];
    const before = Number(track.system.current) || 0;
    const after = Math.min(TRACK, before + (TICKS[Number(track.system.rank) || 2] ?? 8) * (concession.amount ?? 1));
    if ( after === before ) return [];
    const undo = emptyRecord(giverDoc, giver);
    undo.itemUpdates.push({ id: track.id, update: { "system.current": before } });
    await track.update({ "system.current": after });
    return [undo];
  }
  if ( concession.kind !== "money" ) return [];
  const value = Math.max(0, supplyOf(giver) - concession.amount);
  const sharing = new Map();
  for ( const doc of [giverDoc, ...allies] ) if ( doc?.actor?.type === "character" ) sharing.set(doc.actor.uuid, { doc, actor: doc.actor });
  if ( sharedSupply() ) {
    for ( const actor of game.actors ?? [] ) {
      if ( ["character", "starship"].includes(actor.type) && !sharing.has(actor.uuid) ) sharing.set(actor.uuid, { doc: null, actor });
    }
  }
  const records = [];
  for ( const { doc, actor } of sharing.values() ) {
    const path = supplyPath(actor);
    const was = foundry.utils.getProperty(actor, path);
    if ( was === undefined || Number(was) === value ) continue;
    const undo = emptyRecord(doc, actor);
    undo.actorUpdate[path] = was;
    await actor.update({ [path]: value });
    records.push(undo);
  }
  return records;
}

/** The track a character keeps for this scene's encounters (one for the encounter, not yet completed), or null. */
export function encounterTrack(actor, sceneId) {
  if ( !actor || !sceneId ) return null;
  return actor.items.find(i => i.type === "progress" && i.getFlag?.(MODULE, "encounter") === sceneId && !i.system.completed) ?? null;
}

const rankName = rank => game.i18n.localize(`IRONSWORN.CHALLENGERANK.${RANK_KEYS[rank] ?? "Dangerous"}`);

/** The encounter's track, for the planner's summary of a fight: {title, lines}, or null when nothing changes on it. */
export function describeEncounterTrack(plan, replay) {
  if ( plan?.mode !== "encounter" || !plan.holderTokenId ) return null;
  const p = trackProgress(plan, replay);
  if ( p.after === p.before && !p.achieved && !p.lost ) return null;
  const lines = [t("Conflict.Progress", { from: boxes(p.before), to: boxes(p.after), rank: rankName(p.rank), holder: plan.holderName ?? "" })];
  if ( p.achieved ) lines.push(t("Conflict.Achieved"));
  else if ( p.lost ) lines.push(t("Conflict.Lost"));
  return { title: t("Conflict.Record"), lines };
}

/**
 * A live turn's progress on the encounter's track (one track for the encounter), written on the character who keeps
 * it: what the fight marked this turn, and what a strong talk did; completed when the objective was achieved. Returns
 * undo records.
 */
export async function commitEncounterTurn(plan, before, after, events = []) {
  if ( plan?.mode !== "encounter" || !plan.holderTokenId ) return [];
  const left = units => {
    const foes = (plan.foeIds ?? []).map(id => units?.[id]).filter(Boolean);
    return foes.length ? Math.min(...foes.map(f => Math.max(0, f.hp ?? TRACK))) : null;
  };
  const was = left(before);
  const now = left(after);
  const fought = was !== null && now !== null ? Math.max(0, was - now) : 0;
  const onTrack = new Set(plan.foeIds ?? []);
  const rank = [...events].reverse().find(e => e.trackRank)?.trackRank ?? plan.rank;
  const marks = events.filter(e => e.type === "talk" && e.degree >= 2 && onTrack.has(e.targetId) && e.side === plan.friendly)
    .reduce((s, e) => s + (e.degree === 3 ? 2 : 1), 0);
  const talked = marks * (TICKS[rank] ?? 0);
  const end = events.find(e => e.type === "end");
  const lost = end?.resolved === "objectiveLost";
  const achieved = !lost && ((now !== null && now <= 0) || (!!end && (end.winners ?? []).includes(plan.friendly)));
  if ( !fought && !talked && !achieved ) return [];
  const tokenDoc = canvas.scene?.tokens.get(plan.holderTokenId);
  const actor = tokenDoc?.actor;
  if ( !actor ) return [];
  const undo = emptyRecord(tokenDoc, actor);
  const existing = (plan.trackId ? actor.items.get(plan.trackId) : null) ?? encounterTrack(actor, canvas.scene?.id);
  if ( existing ) {
    const current = Number(existing.system.current) || 0;
    // (Only what changed: the system tells the table of every change, "rank changed from Dangerous to Dangerous" too.)
    const change = {};
    const was = {};
    const next = { "system.current": Math.min(TRACK, current + fought + talked), "system.rank": rank, "system.completed": achieved || !!existing.system.completed };
    const had = { "system.current": current, "system.rank": existing.system.rank, "system.completed": !!existing.system.completed };
    for ( const [k, v] of Object.entries(next) ) if ( v !== had[k] ) { change[k] = v; was[k] = had[k]; }
    if ( !Object.keys(change).length ) return [];
    undo.itemUpdates.push({ id: existing.id, update: was });
    await existing.update(change);
  } else {
    const [item] = await actor.createEmbeddedDocuments("Item", [{
      type: "progress",
      name: t("Conflict.TrackName", { scene: canvas.scene?.name ?? "" }),
      system: { subtype: "progress", rank, current: Math.min(TRACK, (plan.before ?? 0) + fought + talked), completed: achieved, hasTrack: true },
      flags: { [MODULE]: { encounter: canvas.scene?.id ?? null } }
    }]);
    if ( item ) undo.createdItems.push(item.id);
  }
  return [undo];
}

/**
 * A live battle: one turn's changes (the core's engine/changes.js) written onto a token. A character: health, and
 * spirit, momentum as the turn moved them (options.before); its debilities or impacts as the turn marked or cleared
 * them (a wound, shaken, or the GM's word: changes.conditions); out cold, dead. A foe: the progress marked on its track
 * this turn, the track completed when it was beaten, its token defeated.
 * @returns {Promise<object>} an undo record (its shape above)
 */
export async function commitIronswornChanges(tokenDoc, spec, changes, final, options = {}) {
  const actor = tokenDoc.actor;
  const undo = emptyRecord(tokenDoc, actor);
  const s = final.system ?? {};
  const was = options.before?.system ?? {};
  if ( spec.mover ) {
    const update = {};
    const set = (path, value, blank = 0) => {
      const before = foundry.utils.getProperty(actor, path);
      if ( before === value ) return;
      update[path] = value;
      undo.actorUpdate[path] = before ?? blank;
    };
    if ( changes.hp ) set("system.health.value", Math.max(0, changes.hp.to ?? 0));
    if ( Number.isFinite(s.spirit) && s.spirit !== was.spirit ) set(meterPath(actor, "spirit"), Math.max(0, s.spirit));
    if ( Number.isFinite(s.momentum) && s.momentum !== was.momentum ) set("system.momentum.value", s.momentum);
    // (The engine's conditions that are debilities, by the system's ids; any others the core keeps.)
    const debility = (key, on) => {
      if ( DEBILITY_KEYS.includes(key) ) set(`system.debility.${key}`, on, false);
    };
    for ( const key of Object.keys(changes.conditions?.set ?? {}) ) debility(key, true);
    for ( const key of changes.conditions?.cleared ?? [] ) debility(key, false);
    if ( changes.died ) await setStatus(actor, "dead", true, undo, { overlay: true });
    else if ( changes.fell ) await setStatus(actor, "unconscious", true, undo);
    if ( changes.revived ) await setStatus(actor, "unconscious", false, undo);
    if ( Object.keys(update).length ) await actor.update(update);
    return undo;
  }
  // A foe: the progress marked on its track this turn. (On one track for the encounter: commitEncounterTurn.)
  const beaten = changes.died || changes.status?.to === STATUS.BEATEN;
  const track = spec.sharedHp ? null : actor.items.get(spec.progressItemId);
  if ( track ) {
    const change = {};
    const current = Number(track.system.current) || 0;
    if ( changes.hp && ticks(changes.hp.to) > current ) change["system.current"] = ticks(changes.hp.to);
    if ( beaten && !track.system.completed ) change["system.completed"] = true;
    if ( Object.keys(change).length ) {
      undo.itemUpdates.push({ id: track.id, update: { "system.current": current, "system.completed": !!track.system.completed } });
      await track.update(change);
    }
  }
  if ( beaten ) {
    if ( changes.died ) await setStatus(actor, "dead", true, undo, { overlay: true });
    const combatant = game.combat?.getCombatantsByToken?.(tokenDoc)?.[0];
    if ( combatant && !combatant.defeated ) {
      await combatant.update({ defeated: true });
      undo.combatant = { uuid: combatant.uuid, defeated: false };
    }
  } else if ( changes.status?.to === STATUS.FLED && options.fledMode !== "leave" ) {
    undo.tokenUpdate = { hidden: tokenDoc.hidden };
    await tokenDoc.update({ hidden: true });
  }
  return undo;
}

/** Human-readable list of what a fight changes for one creature, for the planner's summary of a fight. */
export function describeIronswornOutcome(spec, final) {
  const lines = [];
  const s = final.system ?? {};
  if ( spec.mover ) {
    if ( final.hp !== spec.hp.value ) lines.push(t("Out.Health", { from: spec.hp.value, to: final.hp }));
    if ( Number.isFinite(s.spirit) && s.spirit !== spec.spirit?.value ) lines.push(t("Out.Spirit", { from: spec.spirit?.value ?? 0, to: s.spirit }));
    if ( s.shaken && !spec.shaken ) lines.push(t("Out.Shaken"));
    if ( Number.isFinite(s.momentum) && s.momentum !== spec.resources?.momentum ) lines.push(t("Out.Momentum", { from: spec.resources?.momentum ?? 0, to: s.momentum }) + (s.burned ? t("Out.Burned", { n: s.burned }) : ""));
    if ( s.wounded && !spec.wounded ) lines.push(t("Out.Wounded"));
    if ( final.status === STATUS.DEAD ) lines.push(t("Out.Dies"));
    else if ( final.status === STATUS.DOWN ) lines.push(s.deathbound ? t("Out.Deathbound") : final.stable ? t("Out.Cold") : t("Out.Dying"));
    else if ( final.status === STATUS.FLED ) lines.push(t("Out.Retreated"));
    return lines;
  }
  const before = ticks(spec.hp.value);
  const after = ticks(final.hp);
  // (On one track for the encounter, its progress is the encounter's: shown once, as that track's.)
  if ( !spec.sharedHp && after > before && after < TRACK ) lines.push(t("Out.Progress", { from: Math.floor(before / 4), to: Math.floor(after / 4), n: after - before }));
  // Beaten: however the table decides; killed, by one who would kill.
  if ( final.status === STATUS.BEATEN ) lines.push(spec.sharedHp ? t("Out.Defeated") : t("Out.Beaten", { n: Math.floor(after / 4) }));
  else if ( final.status === STATUS.DEAD ) lines.push(t("Out.Killed"));
  if ( final.status === STATUS.FLED ) lines.push(final.swayed ? t("Out.TalkedAway") : t("Out.Fled"));
  else if ( final.status === STATUS.SURRENDERED ) lines.push(t("Out.Surrenders"));
  else if ( final.status === STATUS.STOOD_DOWN ) lines.push(t("Out.StandsDown"));
  return lines;
}

async function setStatus(actor, id, active, undo, { overlay = false } = {}) {
  if ( statusesOf(actor).has(id) === active ) return;
  await actor.toggleStatusEffect(id, { active, overlay });
  undo.statuses.push({ id, active: !active, overlay });
}
