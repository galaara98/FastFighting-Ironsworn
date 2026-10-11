/**
 * Ironsworn leadership: a character's heart (those who inspire, lead), a foe's rank and a title. Pure.
 */
import { t } from "./words.js";
const TITLE = /\b(?:chief(?:tain)?|captain|commander|warlord|leader|elder|queen|king|lord|lady|boss|warden|overseer)\b/i;

/**
 * @param {object[]} entries  [{id, name, heart (a character's), rank (a foe's), pc}]
 * @returns {{id, score, reason, bonus}[]} best first
 */
export function rankIronswornLeaders(entries) {
  const out = [];
  for ( const e of entries ) {
    if ( !e ) continue;
    const reasons = [];
    let score = e.pc ? (e.heart ?? 0) : Math.max(0, (e.rank ?? 1) - 1);
    reasons.push(e.pc ? t("Lead.Heart", { n: e.heart ?? 0 }) : t("Lead.Rank", { n: e.rank ?? 1 }));
    if ( TITLE.test(e.name ?? "") ) {
      score += 2;
      reasons.push(t("Lead.Title"));
    }
    out.push({ id: e.id, score, reason: reasons.join("; "), bonus: leaderBonus(score) });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function leaderBonus(score) {
  if ( score >= 4 ) return { brave: 20, tacticalFloor: 55, attack: 0, ac: 0 };
  if ( score >= 3 ) return { brave: 15, tacticalFloor: 45, attack: 0, ac: 0 };
  if ( score >= 2 ) return { brave: 10, tacticalFloor: 35, attack: 0, ac: 0 };
  return { brave: 5, tacticalFloor: 0, attack: 0, ac: 0 };
}
