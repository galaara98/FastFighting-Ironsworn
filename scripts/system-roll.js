/**
 * A live battle's saves and checks in a turn FastFighting plays (core API 19 rollSave and rollCheck), rolled the
 * foundry-ironsworn system's way: an action roll for one of its moves, +a stat, its card in the chat, as its move dialog
 * makes one (its own IronswornRoll and IronswornRollMessage, CONFIG.IRONSWORN.applications), with no dialog. The card is
 * graded as a player's move card is (read-turn.js outcomeOf).
 *   - Only a character rolls. A foe never does: the engine rolls for one (null).
 *   - A save is Face Danger, +the stat its key stands for (build.js SAVE_STATS, or a stat by name: a hazard's +edge); of
 *     several, the highest.
 *   - A check is the move the rules play: Secure an Advantage (Starforged: Gain Ground) or Aid Your Ally, +the highest
 *     stat; Heal, and first aid, +wits; Compel, +heart, +iron or +shadow as the pitch persuades, threatens or deceives;
 *     a theft, Face Danger +shadow. Any other (a control, a taunt, an escape) is the engine's.
 *   - The move is the character's own ruleset's (Sundered Isles plays Starforged's). The DC goes on as adds, as the
 *     rules count it (rules.js addsFor), and the sheet's momentum with it, as the system's dialog has it (a negative one
 *     cancels a matching action die). The engine's own adds (Secure an Advantage's +1 on the next move) aren't on it.
 *   - Nothing burns momentum: the system never does by itself, and the engine doesn't after a roll the system made. The
 *     card's own button is the player's; the turn has been played with the roll as it fell.
 * No GM's say ({gm: true}): each is a move and a stat the rules have already chosen.
 */
import { RULESETS } from "./moves.js";
import { addsFor } from "./rules.js";
import { STATS, SAVE_STATS, COMPEL_STATS } from "./build.js";
import { outcomeOf } from "./read-turn.js";

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
 * dice}, or null where it isn't a character's or the system has no roller to hand (the engine rolls it).
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
  // (For the GMs' eyes only: its card in the GMs' mode, as it's made.)
  const hook = secret ? Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
    if ( userId === game.user?.id && message.speaker?.actor === actor.id ) message.applyMode?.("gm");
  }) : null;
  try {
    await new apps.IronswornRollMessage(roll, actor).createOrUpdate();
  } finally {
    if ( hook !== null ) Hooks.off("preCreateChatMessage", hook);
  }
  return rolledOf(roll);
}
