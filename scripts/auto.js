/**
 * What Ironsworn (and Starforged, and Sundered Isles) says about a character, for the one time FastFighting sets it up
 * by itself (the core's foundry/auto-config.js): the playstyles that fit it and its own answers to the tactics
 * questions, from a character's assets (by the system's id for each: "asset:classic/combat_talent/shield_bearer", the
 * last part counting, so each ruleset's of the same name alike) and a foe's nature; and its biography or description as
 * plain text for the keywords, what's said of it apart from its story. Pure.
 */

/** What each asset leans toward, by the last part of its id. */
const ASSETS = Object.freeze({
  shield_bearer: { tank: 0.6 }, ironclad: { tank: 0.4 }, armored: { tank: 0.4 },
  archer: { wallflower: 0.3 }, slinger: { wallflower: 0.3 }, long_arm: { wallflower: 0.3 }, sniper: { wallflower: 0.4 }, gunner: { wallflower: 0.3 },
  gunslinger: { wallflower: 0.3 }, fletcher: { wallflower: 0.2 },
  berserker: { brawler: 0.4, impatient: 0.3 }, brawler: { brawler: 0.6 }, sunderer: { brawler: 0.3 }, thunder_bringer: { brawler: 0.3 },
  swordmaster: { instigator: 0.3 }, blademaster: { instigator: 0.3 }, weapon_master: { instigator: 0.3 }, weaponmaster: { instigator: 0.3 },
  duelist: { instigator: 0.3 }, skirmisher: { speedRunner: 0.3 }, cutthroat: { cruel: 0.3, thief: 0.2 },
  banner_sworn: { leader: 0.3, martyr: 0.3 }, bannersworn: { leader: 0.3, martyr: 0.3 }, commander: { leader: 0.6 }, leader: { leader: 0.6 },
  herbalist: { enabler: 0.6 }, healer: { enabler: 0.6 },
  lorekeeper: { loreCollector: 0.5 }, lore_hunter: { loreCollector: 0.5 }, sleuth: { loreCollector: 0.4 },
  infiltrator: { thief: 0.4, wallflower: 0.2 }, shadow_kin: { thief: 0.3, wallflower: 0.3 }, shade: { thief: 0.3, wallflower: 0.3 },
  scoundrel: { thief: 0.4 }, trickster: { thief: 0.3, wildcard: 0.2 }, masked: { thief: 0.2, wallflower: 0.2 },
  ritualist: { unmundane: 0.5 }, seer: { unmundane: 0.4 }, kinetic: { unmundane: 0.5 }, empowered: { unmundane: 0.4 },
  spirit_bound: { unmundane: 0.3 }, sighted: { unmundane: 0.3 },
  revenant: { relentless: 0.4 }, slayer: { relentless: 0.3, vengeful: 0.2 }, oathbreaker: { redeemSeeker: 0.6 },
  outcast: { wallflower: 0.3 }, fugitive: { wallflower: 0.3 }, honorbound: { moralist: 0.3 }, devotant: { moralist: 0.3 },
  loyalist: { peoplePleaser: 0.4 }, fortune_hunter: { mercenary: 0.4 }, mercenary: { mercenary: 0.5 }, bounty_hunter: { mercenary: 0.4 },
  scavenger: { mercenary: 0.2 }, trader: { mercenary: 0.2 }, diplomat: { diplomat: 0.5 }, empath: { diplomat: 0.3, peacekeeper: 0.2 },
  storyweaver: { diplomat: 0.3 }, firebrand: { instigator: 0.4 }, battle_scarred: { relentless: 0.2, tank: 0.1 }, veteran: { relentless: 0.2 },
  fated: { martyr: 0.2 }, improviser: { puzzleManiac: 0.3 }, wright: { puzzleManiac: 0.3 }, alchemist: { puzzleManiac: 0.3 },
  gearhead: { puzzleManiac: 0.3 }, tech: { puzzleManiac: 0.3 }, demolitionist: { puzzleManiac: 0.2, instigator: 0.2 }, haunted: { fragile: 0.2 }
});

/** What a foe's nature leans toward. */
const NATURES = Object.freeze({
  beast: { brawler: 0.4, relentless: 0.2 }, animal: { brawler: 0.3 }, horror: { relentless: 0.5 }, machine: { relentless: 0.6 }
});

/** The last part of an asset's id ("asset:classic/combat_talent/shield_bearer" -> "shield_bearer"). */
export const assetKey = id => String(id ?? "").split("/").pop() || null;

/** The playstyles that fit: {id: -1 to 1}. */
export function ironswornHints({ assets = [], rituals = 0, nature = null } = {}) {
  const out = {};
  const add = map => { for ( const [k, v] of Object.entries(map ?? {}) ) out[k] = (out[k] ?? 0) + v; };
  for ( const a of assets ) add(ASSETS[a]);
  // (A ritual is a mystic's: each a little more Un-Mundane.)
  if ( rituals > 0 ) add({ unmundane: 0.2 * rituals });
  add(NATURES[nature]);
  for ( const k of Object.keys(out) ) out[k] = Math.max(-1, Math.min(1, out[k]));
  return out;
}

/** Ironsworn's own answers to the tactics questions, where it knows better than the numbers: {key: answer}. */
export function ironswornTactics({ assets = [], nature = null } = {}) {
  const out = {};
  const has = (...keys) => keys.some(k => assets.includes(k));
  if ( has("archer", "slinger", "long_arm", "sniper", "gunner", "gunslinger") ) out.style = "ranged";
  if ( has("shield_bearer", "ironclad", "armored", "banner_sworn", "bannersworn") ) Object.assign(out, { style: "protector", target: "protect" });
  if ( has("herbalist", "healer") ) out.healAggro = "aggressive";
  // (Horrors and machines don't break; beasts and animals stay where the fight is.)
  if ( ["horror", "machine"].includes(nature) ) out.retreat = "never";
  if ( ["beast", "animal"].includes(nature) ) out.beyond = "stay";
  return out;
}

/** Text from the sheet's HTML. */
export function plainText(html) {
  return String(html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, "\"").replace(/\s+/g, " ").trim();
}

/** Pieces of text as one, for the keywords (the pieces apart, so no word runs into the next). */
const together = texts => texts.filter(Boolean).join(". ");

/**
 * A character's words, for the keywords (the core counts what's said of it in full, its story a little). A Starforged
 * (or Sundered Isles) sheet's characteristics are said of the character itself; its notes, an Ironsworn sheet's notes
 * (kept as its biography), and its vows (their names and descriptions) are its story. The sheets have no dislikes.
 * @param {object} d
 * @param {boolean} [d.classic]   on an Ironsworn sheet
 * @param {string} [d.biography]  (HTML)
 * @param {string} [d.notes]      (HTML)
 * @param {{name?: string, description?: string}[]} [d.vows]
 * @returns {{about: string, story: string, against: string}}
 */
export function characterBiography({ classic = false, biography = "", notes = "", vows = [] } = {}) {
  const sworn = (vows ?? []).flatMap(v => [plainText(v?.name), plainText(v?.description)]);
  return {
    about: classic ? "" : plainText(biography),
    story: together([classic ? plainText(biography) : "", plainText(notes), ...sworn]),
    against: ""
  };
}

/** A quest starter in a foe's description: the book's hook for a story with it. */
const QUEST_STARTER = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;

/**
 * A foe's words, for the keywords: its description (its features, drives, tactics and lore) is about it; its quest
 * starter is a story others are in.
 * @param {string} html   its progress track's description
 * @returns {{about: string, story: string, against: string}}
 */
export function foeBiography(html) {
  const text = String(html ?? "");
  return {
    about: plainText(text.replace(QUEST_STARTER, " ")),
    story: together([...text.matchAll(QUEST_STARTER)].map(m => plainText(m[1]))),
    against: ""
  };
}
