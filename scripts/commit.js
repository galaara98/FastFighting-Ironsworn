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
import { TRACK } from "./moves.js";

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

/** Human-readable list of what will change, for the confirmation dialog. */
export function describeIronswornOutcome(spec, final) {
  const lines = [];
  const s = final.system ?? {};
  if ( spec.mover ) {
    if ( final.hp !== spec.hp.value ) lines.push(`Health ${spec.hp.value} → ${final.hp}`);
    if ( Number.isFinite(s.momentum) && s.momentum !== spec.resources?.momentum ) lines.push(`Momentum ${spec.resources?.momentum ?? 0} → ${s.momentum}${s.burned ? ` (burned ${s.burned}×)` : ""}`);
    if ( s.wounded && !spec.wounded ) lines.push("Wounded");
    if ( final.status === STATUS.DEAD ) lines.push("DIES");
    else if ( final.status === STATUS.DOWN ) lines.push(s.deathbound ? "Survives Face Death, bound to a deathbound quest; out cold" : final.stable ? "Out cold" : "Dying: needs healing within an hour or two, or Face Death");
    else if ( final.status === STATUS.FLED ) lines.push("Retreated from the fight");
    return lines;
  }
  const before = ticks(spec.hp.value);
  const after = ticks(final.hp);
  if ( final.status === STATUS.DEAD ) lines.push(`Beaten: track complete (${Math.floor(after / 4)}/10)`);
  else if ( after > before ) lines.push(`Progress ${Math.floor(before / 4)}/10 → ${Math.floor(after / 4)}/10 (${after - before} ticks)`);
  if ( final.status === STATUS.FLED ) lines.push(final.swayed ? "Talked into leaving (token hidden)" : "Fled (token hidden)");
  else if ( final.status === STATUS.SURRENDERED ) lines.push("Surrenders");
  else if ( final.status === STATUS.STOOD_DOWN ) lines.push("Stands down");
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
