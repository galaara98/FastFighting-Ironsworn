/**
 * A live battle's saves and checks in a turn FastFighting plays (core API 19 rollSave and rollCheck; adjustRolled for
 * momentum burned on them), rolled the foundry-ironsworn system's way: an action roll for one of its moves, +a stat,
 * its card in the chat, as its move dialog makes one (its own IronswornRoll and IronswornRollMessage,
 * CONFIG.IRONSWORN.applications), with no dialog. The card is graded as a player's move card is (read-turn.js
 * outcomeOf).
 *   - Only a character rolls. A foe never does: the engine rolls for one (null).
 *   - A save is Face Danger, +the stat its key stands for (build.js SAVE_STATS, or a stat by name: a hazard's +edge); of
 *     several, the highest.
 *   - A check is the move the rules play: Secure an Advantage (Starforged: Gain Ground) or Aid Your Ally, +the highest
 *     stat; Heal, and first aid, +wits; Compel, +heart, +iron or +shadow as the pitch persuades, threatens or deceives;
 *     a theft, Face Danger +shadow. Any other (a control, a taunt, an escape) is the engine's.
 *   - The move is the character's own ruleset's (Sundered Isles plays Starforged's). The DC goes on as adds, as the
 *     rules count it (rules.js addsFor), and the sheet's momentum with it, as the system's dialog has it (a negative one
 *     cancels a matching action die). The engine's own adds (Secure an Advantage's +1 on the next move) aren't on it.
 *   - Momentum is burned as the rules burn it on the engine's own dice (rules.js adjustRoll): a save's, and the result
 *     names its card (`card`, its message id) for that. The burn is carried out on the card as its own button does
 *     (IronswornRollMessage.burnMomentum: the outcome the burned momentum gets against the same challenge dice, its
 *     replacedOutcome, the card made again), with the momentum the engine burned (rules.js burnsAsked). The sheet's
 *     momentum is reset with the turn's other changes, at its end (commit.js), so Rewind takes it back with them, and
 *     the card goes with the turn's other cards.
 *   - Each card is marked as FastFighting's (flags["fast-fighting-ironsworn"].rolled): its own burn button, which would
 *     change the sheet and not the turn already played, is gone (hideBurn).
 * No GM's say ({gm: true}): each is a move and a stat the rules have already chosen.
 */
import { RULESETS } from "./moves.js";
import { addsFor, burnsAsked } from "./rules.js";
import { STATS, SAVE_STATS, COMPEL_STATS } from "./build.js";
import { outcomeOf, rollOf } from "./read-turn.js";
import { t } from "./words.js";

/** This module's flags' scope. */
const MODULE = "fast-fighting-ironsworn";

/** The moves rolled here, by their keys (moves.js), in Ironsworn and in Starforged: their Datasworn ids. */
const MOVE_IDS = Object.freeze({
  classic: Object.freeze({
    FaceDanger: "move:classic/adventure/face_danger", SecureanAdvantage: "move:classic/adventure/secure_an_advantage",
    AidYourAlly: "move:classic/relationship/aid_your_ally", Heal: "move:classic/adventure/heal", Compel: "move:classic/relationship/compel"
  }),
  starforged: Object.freeze({
    FaceDanger: "move:starforged/adventure/face_danger", GainGround: "move:starforged/combat/gain_ground",
    AidYourAlly: "move:starforged/adventure/aid_your_ally", Heal: "move:starforged/recover/heal", Compel: "move:starforged/adventure/compel"
  })
});

/** A key's first letter in capitals, as the system's language keys have it ("edge": IRONSWORN.Edge). */
const capital = k => `${k.charAt(0).toUpperCase()}${k.slice(1)}`;

/**
 * The move and stat a save or a check is rolled as (above): {move (its Datasworn id), stat, adds}, or null (the engine
 * rolls it).
 * @param {"save"|"check"} kind
 * @param {object} options   rollSave's {save, dc} or rollCheck's {purpose, dc, action}
 * @param {object} who       the character: {id (its token's), ruleset, stats}
 */
export function moveFor(kind, options = {}, { id, ruleset = "classic", stats = {} } = {}) {
  const highest = keys => keys.filter(k => Number.isFinite(stats[k])).reduce((best, k) => (best === null || stats[k] > stats[best] ? k : best), null);
  const of = (table, k) => (Object.hasOwn(table, k) ? table[k] : null);
  // (One of its own actions, by the id the adapter gave it: "<token id>.heal".)
  const own = String(options.action?.id ?? "").startsWith(`${id}.`) ? options.action.id.slice(String(id).length + 1) : null;
  let key = null;
  let stat = null;
  if ( kind === "save" ) {
    key = "FaceDanger";
    stat = highest([].concat(options.save ?? []).map(s => of(SAVE_STATS, s) ?? (STATS.includes(s) ? s : null)).filter(Boolean));
  } else if ( options.purpose === "aid" && (own === "advantage" || own === "aid") ) {
    key = own === "aid" ? "AidYourAlly" : (RULESETS[ruleset] ?? RULESETS.classic).advantage.key;
    stat = highest(STATS);
  } else if ( (options.purpose === "heal" && own === "heal") || options.purpose === "firstAid" ) {
    [key, stat] = ["Heal", "wits"];
  } else if ( options.purpose === "talk" && !options.action?.id ) {
    // (A pitch: the core names it by its kind.)
    [key, stat] = ["Compel", of(COMPEL_STATS, options.action?.name)];
  } else if ( options.purpose === "theft" ) {
    [key, stat] = ["FaceDanger", "shadow"];
  }
  const move = MOVE_IDS[ruleset === "classic" ? "classic" : "starforged"][key];
  return move && stat ? { move, stat, adds: addsFor(Number(options.dc)) } : null;
}

/**
 * A roll the system made, as the engine takes it: graded as a move card is (read-turn.js outcomeOf), its challenge dice
 * along (rules.js asRolled), or null where it wasn't rolled.
 * @param {object} roll   the system's IronswornRoll, rolled
 */
export function rolledOf(roll) {
  if ( !roll?.rawChallengeDiceValues?.length ) return null;
  const { degree, score, challenge } = outcomeOf(roll);
  if ( !Number.isFinite(score) || !challenge.every(Number.isFinite) ) return null;
  return { degree, natural: Number(roll.rawActionDieValue) || 0, total: score, dice: { challenge1: challenge[0], challenge2: challenge[1] } };
}

/**
 * A save or a check rolled with the system's own roller (moveFor's move), its card in the chat: {degree, natural, total,
 * dice, card}, or null where it isn't a character's or the system has no roller to hand (the engine rolls it).
 * @param {TokenDocument} token
 * @param {object} how                moveFor's {move, stat, adds}
 * @param {object} [options]
 * @param {boolean} [options.secret]  for the GMs only (its card in the GMs' mode)
 */
export async function rollIronswornMove(token, how, { secret = false } = {}) {
  const actor = token?.actor;
  const apps = globalThis.CONFIG?.IRONSWORN?.applications;
  const value = Number(actor?.system?.[how?.stat]);
  if ( actor?.type !== "character" || !apps?.IronswornRoll || !apps.IronswornRollMessage || !Number.isFinite(value) ) return null;
  const roll = new apps.IronswornRoll({
    // (The stat as the system's dialog names it.)
    stat: { source: game.i18n.localize(`IRONSWORN.${capital(how.stat)}`), value },
    ...(how.adds ? { adds: how.adds } : {}),
    momentum: Number(actor.system.momentum?.value) || 0,
    moveDsId: how.move,
    actorId: actor.id
  });
  // (Its card, as it's made: marked as FastFighting's; for the GMs' eyes only, in the GMs' mode.)
  const hook = Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
    if ( userId !== game.user?.id || message.speaker?.actor !== actor.id ) return;
    message.updateSource({ flags: { [MODULE]: { rolled: true } } });
    if ( secret ) message.applyMode?.("gm");
  });
  let made = null;
  try {
    made = await new apps.IronswornRollMessage(roll, actor).createOrUpdate();
  } finally {
    Hooks.off("preCreateChatMessage", hook);
  }
  const out = rolledOf(roll);
  const card = made?.id ?? roll.chatMessageId;
  return out && typeof card === "string" ? { ...out, card } : out;
}

/**
 * Momentum burned on a card FastFighting rolled (the adapter's adjustRolled, "burnMomentum"), as the card's own button
 * burns it: its outcome the momentum's against the same challenge dice, in the system's words (IRONSWORN.MomentumBurnt),
 * and the card made again. The momentum is the one the rules burned (rules.js burnsAsked); the sheet's is reset with the
 * turn's other changes. {done: true}, or null where it can't (the rules keep the roll as it fell).
 * @param {TokenDocument} token
 * @param {string} card   the card's message id
 */
export async function burnOnCard(token, card) {
  const asked = burnsAsked.get(card);
  burnsAsked.delete(card);
  const message = typeof card === "string" ? game.messages?.get(card) : null;
  const apps = globalThis.CONFIG?.IRONSWORN?.applications;
  const json = message ? rollOf(message) : null;
  if ( !Number.isFinite(asked?.momentum) || !json || token?.actor?.type !== "character" || !apps?.IronswornRoll || !apps.IronswornRollMessage ) return null;
  // (Only an action roll not burned already.)
  if ( json.preRollOptions?.progress || json.postRollOptions?.replacedOutcome ) return null;
  const roll = apps.IronswornRoll.fromJson(json);
  roll.postRollOptions ??= {};
  roll.chatMessageId = message.id;
  roll.roll = message.rolls?.[0];
  const { degree, challenge } = outcomeOf(roll);
  const beats = challenge.filter(c => asked.momentum > c).length;
  if ( (beats === 2 ? 3 : beats === 1 ? 2 : 1) <= degree ) return null;
  roll.postRollOptions.replacedOutcome = { value: beats, source: game.i18n.localize("IRONSWORN.MomentumBurnt") };
  await new apps.IronswornRollMessage(roll, token.actor).createOrUpdate();
  return { done: true };
}

/** Is this card one FastFighting rolled in a turn it played (rollIronswornMove)? */
export const rolledHere = message => !!message?.flags?.[MODULE]?.rolled;

/**
 * A card of FastFighting's, rendered (renderChatMessageHTML): its burn button gone (the turn was played with the roll as
 * FastFighting left it), a line saying so in its place.
 */
export function hideBurn(message, html) {
  if ( !rolledHere(message) ) return;
  for ( const section of html?.querySelectorAll?.(".momentum-burn") ?? [] ) {
    const note = globalThis.document ? Object.assign(globalThis.document.createElement("span"), { textContent: t("Burn.Handled") }) : null;
    section.replaceChildren(...(note ? [note] : []));
  }
}
