/**
 * Ironsworn and Starforged "Make it So": write one simulated outcome onto a token's actor, returning an undo record.
 * A character: health, momentum, a wound marked, and how it ended up (out cold, dying, dead). A foe: progress marked on
 * its track (the fight's harm, by its rank), the track completed when it was beaten, and its token marked defeated.
 *
 * Undo record shape (consumed by the core's make-it-so.js):
 *   { tokenUuid, actorUuid, actorUpdate, itemUpdates: [{id, update}], createdItems: [id], deletedItems: [data],
 *     createdEffects: [id], tokenUpdate, createdActors, createdTokens, deletedTokens, statuses: [{id, active}], combatant }
 */
import { STATUS } from "./core.js";
import { t } from "./words.js";
import { TRACK, TICKS } from "./moves.js";

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

/** Where a character's Supply is kept (a meter with a value, or a number), and how much it has. */
const supplyPath = actor => (typeof actor?.system?.supply === "object" ? "system.supply.value" : "system.supply");
export const supplyOf = actor => Math.max(0, Number(foundry.utils.getProperty(actor, supplyPath(actor))) || 0);

/** Does the system share Supply between every character (its own setting)? */
function sharedSupply() {
  try {
    return !!game.settings.get("foundry-ironsworn", "shared-supply");
  } catch ( err ) {
    return false;
  }
}

/**
 * What was given up to end a standoff (Make it So). Supply, a character's payment: its friendly side shares it, so
 * every character on the giver's side has that much less; with the system's shared Supply, so does every character
 * and starship it shares Supply with. Ground given, a foe's: progress marked on its own track, by its rank.
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

/** Human-readable list of what will change, for the confirmation dialog. */
export function describeIronswornOutcome(spec, final) {
  const lines = [];
  const s = final.system ?? {};
  if ( spec.mover ) {
    if ( final.hp !== spec.hp.value ) lines.push(t("Out.Health", { from: spec.hp.value, to: final.hp }));
    if ( Number.isFinite(s.momentum) && s.momentum !== spec.resources?.momentum ) lines.push(t("Out.Momentum", { from: spec.resources?.momentum ?? 0, to: s.momentum }) + (s.burned ? t("Out.Burned", { n: s.burned }) : ""));
    if ( s.wounded && !spec.wounded ) lines.push(t("Out.Wounded"));
    if ( final.status === STATUS.DEAD ) lines.push(t("Out.Dies"));
    else if ( final.status === STATUS.DOWN ) lines.push(s.deathbound ? t("Out.Deathbound") : final.stable ? t("Out.Cold") : t("Out.Dying"));
    else if ( final.status === STATUS.FLED ) lines.push(t("Out.Retreated"));
    return lines;
  }
  const before = ticks(spec.hp.value);
  const after = ticks(final.hp);
  if ( final.status === STATUS.DEAD ) lines.push(t("Out.Beaten", { n: Math.floor(after / 4) }));
  else if ( after > before ) lines.push(t("Out.Progress", { from: Math.floor(before / 4), to: Math.floor(after / 4), n: after - before }));
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

/**
 * @param {TokenDocument} tokenDoc
 * @param {object} spec
 * @param {object} final
 * @param {object} options  {fledMode}
 */
export async function commitIronswornOutcome(tokenDoc, spec, final, options = {}) {
  const actor = tokenDoc.actor;
  const undo = emptyRecord(tokenDoc, actor);
  const s = final.system ?? {};
  if ( spec.mover ) {
    const update = {};
    const set = (path, value) => {
      const before = foundry.utils.getProperty(actor, path);
      if ( before === value ) return;
      update[path] = value;
      undo.actorUpdate[path] = before ?? 0;
    };
    set("system.health.value", Math.max(0, final.hp));
    if ( Number.isFinite(s.momentum) ) set("system.momentum.value", s.momentum);
    if ( s.wounded ) set("system.debility.wounded", true);
    if ( final.status === STATUS.DEAD ) await setStatus(actor, "dead", true, undo, { overlay: true });
    else if ( final.status === STATUS.DOWN ) await setStatus(actor, "unconscious", true, undo);
    if ( Object.keys(update).length ) await actor.update(update);
    return undo;
  }
  // A foe: its track, as the fight left it.
  const track = actor.items.get(spec.progressItemId);
  if ( track ) {
    const marked = ticks(final.hp);
    const change = {};
    if ( marked !== track.system.current ) change["system.current"] = Math.max(track.system.current ?? 0, marked);
    if ( final.status === STATUS.DEAD && !track.system.completed ) change["system.completed"] = true;
    if ( Object.keys(change).length ) {
      undo.itemUpdates.push({ id: track.id, update: { "system.current": track.system.current ?? 0, "system.completed": !!track.system.completed } });
      await track.update(change);
    }
  }
  if ( final.status === STATUS.DEAD ) {
    await setStatus(actor, "dead", true, undo, { overlay: true });
    const combatant = game.combat?.getCombatantsByToken?.(tokenDoc)?.[0];
    if ( combatant && !combatant.defeated ) {
      await combatant.update({ defeated: true });
      undo.combatant = { uuid: combatant.uuid, defeated: false };
    }
  } else if ( final.status === STATUS.FLED && options.fledMode !== "leave" ) {
    undo.tokenUpdate = { hidden: tokenDoc.hidden };
    await tokenDoc.update({ hidden: true });
  }
  return undo;
}
