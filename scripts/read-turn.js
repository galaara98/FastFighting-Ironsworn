/**
 * A character's spotlight in a live battle, read from the move cards the ironsworn system made for it (the roll it
 * keeps on the card: data-ironswornroll, with the move's Datasworn id): what FastFighting's engine would have logged,
 * so the turn is told like any other.
 *   - Strike, Clash, End the Fight (Take Decisive Action): a blow at the foe (a strong hit, a weak hit, a miss); its
 *     harm is the progress marked on the foe's track (the sheets say how much).
 *   - Compel: words, as well as they went, for the GM to confirm.
 * The cards name no foe: a blow goes to the one whose track moved, or the GM says (the core's reconcile and review;
 * `aimless`: unsure only of whom it was at).
 * Each event says whether it's `sure`.
 */
import { t, moveName } from "./words.js";

/** The moves read, by the last part of their Datasworn id: what they are, and the helper's word for them. */
const MOVES = {
  strike: { type: "attack", key: "Strike" },
  clash: { type: "attack", key: "Clash" },
  end_the_fight: { type: "attack", key: "EndtheFight", finish: true },
  take_decisive_action: { type: "attack", key: "TakeDecisiveAction", finish: true },
  compel: { type: "talk" }
};

/** HTML's escapes, undone (as Handlebars writes an attribute). */
const unescape = s => s.replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&#x60;/g, "`").replace(/&#x3D;/g, "=")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/**
 * The roll a move card keeps, or null. (The template quotes the attribute with ' ; a card as Foundry stores it, with ".)
 */
export function rollOf(m) {
  const found = /data-ironswornroll=(?:'([^']*)'|"([^"]*)")/.exec(String(m.content ?? ""));
  if ( !found ) return null;
  try {
    return JSON.parse(unescape(found[1] ?? found[2]));
  } catch ( err ) {
    return null;
  }
}

/** The roll's outcome in the engine's degrees (3 a strong hit, 2 a weak hit, 1 a miss, 0 a miss on a match), and its score. */
export function outcomeOf(r) {
  const pre = r.preRollOptions ?? {};
  const post = r.postRollOptions ?? {};
  const challenge = [1, 2].map(i => post[`replacedChallenge${i}`]?.value ?? pre[`presetChallenge${i}`]?.value ?? r.rawChallengeDiceValues?.[i - 1]);
  const action = pre.presetActionDie?.value ?? pre.progress?.value ?? r.rawActionDieValue;
  const canceled = !pre.progress && Number.isFinite(pre.momentum) && pre.momentum === -action;
  const score = pre.progress ? Number(pre.progress.value) : (canceled ? 0 : Number(action)) + (Number(pre.stat?.value) || 0) + (Number(pre.adds) || 0);
  const capped = Math.min(10, score);
  const told = post.replacedOutcome?.value ?? pre.automaticOutcome?.value;
  const beats = Number.isFinite(told) ? told : challenge.filter(c => capped > c).length;
  const match = challenge[0] !== undefined && challenge[0] === challenge[1];
  return { degree: beats === 2 ? 3 : beats === 1 ? 2 : match ? 0 : 1, score: Number.isFinite(capped) ? capped : null, challenge, match, burned: !!post.replacedOutcome };
}

/**
 * @param {ChatMessage[]} messages  the cards made during the turn, oldest first
 * @param {object} context          {actorId, tokenId}
 * @returns {object[]} engine log events, each with `sure`
 */
export function readIronswornTurn(messages, { actorId = null, tokenId = null } = {}) {
  const events = [];
  for ( const m of messages ) {
    const r = rollOf(m);
    if ( !r ) continue;
    const pre = r.preRollOptions ?? {};
    const whose = pre.actorId ?? m.speaker?.actor ?? null;
    if ( whose !== actorId && !(tokenId && m.speaker?.token === tokenId && !pre.actorId) ) continue;
    const move = MOVES[String(pre.moveDsId ?? "").split("/").pop()];
    if ( !move ) continue;
    const { degree, score } = outcomeOf(r);
    if ( move.type === "attack" ) {
      events.push({
        type: "attack", targetId: null, action: moveName(move.key), degree, natural: r.rawActionDieValue ?? null, total: score, dc: null, margin: 0,
        melee: true, damage: 0, finish: !!move.finish, sure: false, aimless: true
      });
    } else {
      events.push({ type: "talk", targetId: null, kind: "persuade", skill: t("Compel"), degree, natural: r.rawActionDieValue ?? null, total: score, sure: false });
    }
  }
  return events;
}
