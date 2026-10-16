/**
 * What Ironsworn (and Starforged, and Sundered Isles) says about a character, for the one time FastFighting sets it up
 * by itself (the core's foundry/auto-config.js): the playstyles that fit it and its own answers to the tactics
 * questions ("Let this character decide"), from a character's assets (by the system's id for each:
 * "asset:classic/combat_talent/shield_bearer", the last part counting, so each ruleset's of the same name alike), the
 * abilities marked on them and the moves those abilities make, and its stats and supply; from a foe's nature and what
 * its kind is (its id: its drives and tactics); and its biography or description as plain text for the keywords, what's
 * said of it apart from its story. Pure.
 */
import { listItems } from "./core.js";
import { t, statName } from "./words.js";
import { assetLeanKey, speaks } from "./traits.js";

/** What each asset leans toward, by the last part of its id. */
const ASSETS = Object.freeze({
  shield_bearer: { tank: 0.6 }, ironclad: { tank: 0.4 }, armored: { tank: 0.4 },
  archer: { wallflower: 0.3 }, slinger: { wallflower: 0.3 }, sniper: { wallflower: 0.4 }, gunner: { wallflower: 0.3 },
  gunslinger: { wallflower: 0.3 }, fletcher: { wallflower: 0.2 },
  berserker: { brawler: 0.4, impatient: 0.3 }, brawler: { brawler: 0.6 }, sunderer: { brawler: 0.3 }, thunder_bringer: { brawler: 0.3 },
  swordmaster: { instigator: 0.3 }, blademaster: { instigator: 0.3 }, weapon_master: { instigator: 0.3 }, weaponmaster: { instigator: 0.3 },
  duelist: { instigator: 0.3 }, skirmisher: { speedRunner: 0.3 }, cutthroat: { cruel: 0.3, thief: 0.2 },
  banner_sworn: { leader: 0.3, martyr: 0.3 }, bannersworn: { leader: 0.3, martyr: 0.3 }, commander: { leader: 0.6 }, leader: { leader: 0.6 },
  herbalist: { enabler: 0.6 }, healer: { enabler: 0.6 },
  lorekeeper: { loreCollector: 0.5 }, lore_hunter: { loreCollector: 0.5 }, sleuth: { loreCollector: 0.4 },
  infiltrator: { thief: 0.4, wallflower: 0.2 }, shadow_kin: { thief: 0.3, wallflower: 0.3 }, shade: { thief: 0.3, wallflower: 0.3 },
  scoundrel: { thief: 0.4 }, trickster: { thief: 0.3, wildcard: 0.2 }, masked: { thief: 0.2, wallflower: 0.2 },
  ritualist: { unmundane: 0.5 }, seer: { unmundane: 0.4 }, kinetic: { unmundane: 0.5 }, empowered: { leader: 0.3 },
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

/* Its own answers to the tactics questions ------------------------------------------------------------------------- */

/**
 * The moves an asset's ability makes, as the system links them in its text (by the move's id: the last 16 hex digits of
 * the SHA-256 of its Datasworn id, "Ironsworn/Moves/Adventure/Secure_an_Advantage", the same in every world): what the
 * ability does. Securing an advantage (Starforged's Gain Ground too) is how assets are brought to bear in a fight;
 * Compel is talking; Heal, mending; Aid Your Ally, standing by a friend.
 */
export const MOVE_LINKS = Object.freeze({
  "4dd8468e095810a4": "advantage", // Ironsworn/Moves/Adventure/Secure_an_Advantage
  "a2d7793b23c17489": "advantage", // Starforged/Moves/Adventure/Secure_an_Advantage
  "3f5a834fa3fea5d1": "advantage", // Starforged/Moves/Combat/Gain_Ground
  "be95ca063ded2b19": "compel", // Ironsworn/Moves/Relationship/Compel
  "9f538fabf8998c5b": "compel", // Starforged/Moves/Adventure/Compel
  "3d315ee54e9ce845": "heal", // Ironsworn/Moves/Adventure/Heal
  "2051538f0c9d5d27": "heal", // Starforged/Moves/Recover/Heal
  "f762e8f471fe875f": "aid", // Ironsworn/Moves/Relationship/Aid_Your_Ally
  "f4dec946415d8e57": "aid" // Starforged/Moves/Adventure/Aid_Your_Ally
});

/** The moves an ability's text links to ("@Compendium[foundry-ironsworn.ironswornmoves.4dd8468e095810a4]{...}"), each once. */
export const abilityMoves = html => [...new Set([...String(html ?? "").matchAll(/([0-9a-f]{16})\]/g)].map(m => MOVE_LINKS[m[1]]).filter(Boolean))];

/** Kinds of asset that are a vehicle's, not the character's own: a starship's modules, a skiff. */
const VEHICLES = new Set(["command_vehicle", "support_vehicle", "incidental_vehicle", "module"]);

/**
 * What having an asset says of how its owner fights, by the last part of its id (marked abilities or not: the asset is
 * what it carries and who it is). The weapon it's for (its requirement): a bow, a sling, a rifle or pistols at range; a
 * shield guarding; a blade, an axe, a hammer, a staff or armor at close quarters; a dagger from the shadows. Then who it
 * is: a healer, one back from death, a monster-hunter, one with a warband or crew to fetch, a diplomat, a liar, a hired
 * sword, a trader, a courier, a fugitive, a maker of elixirs or explosives. Each answer is one of its question's choices.
 */
const ASSET_TACTICS = Object.freeze({
  archer: { style: "ranged" }, slinger: { style: "ranged" }, sniper: { style: "ranged" }, gunner: { style: "ranged" },
  gunslinger: { style: "ranged" }, musketeer: { style: "ranged" }, pistoleer: { style: "ranged" },
  shield_bearer: { style: "protector", target: "protect" },
  ironclad: { style: "frontline" }, armored: { style: "frontline" }, brawler: { style: "frontline" }, sunderer: { style: "frontline" },
  thunder_bringer: { style: "frontline" }, swordmaster: { style: "frontline" }, blademaster: { style: "frontline" },
  skirmisher: { style: "frontline" }, long_arm: { style: "frontline" }, swashbuckler: { style: "frontline" },
  berserker: { style: "frontline", target: "nearest", retreat: "never", selfRevived: "rejoin" },
  duelist: { style: "frontline", target: "dangerous" },
  cutthroat: { style: "skirmisher" }, dancer: { style: "skirmisher" }, shade: { style: "skirmisher" },
  herbalist: { healAggro: "aggressive", selfRevived: "healSelf" }, healer: { healAggro: "aggressive", selfRevived: "healSelf" },
  revenant: { retreat: "never", selfRevived: "rejoin" }, undead: { retreat: "never", selfRevived: "rejoin" },
  fated: { selfRevived: "rejoin" }, battle_scarred: { selfRevived: "rejoin" }, augmented: { selfRevived: "rejoin" },
  slayer: { target: "dangerous", beyond: "hunt" }, bounty_hunter: { target: "dangerous", beyond: "hunt" },
  commander: { beyond: "seekHelp" }, crew_commander: { beyond: "seekHelp" }, fleet_commander: { beyond: "seekHelp" }, cohort: { beyond: "seekHelp" },
  banner_sworn: { allyDying: "rescue", beyond: "seekHelp" }, loyalist: { allyDying: "rescue" }, bonded: { allyDying: "rescue" },
  diplomat: { talk: "first", offer: "noHarm" }, empath: { talk: "first", offer: "noHarm" },
  trickster: { talk: "opportune" }, pretender: { talk: "opportune" }, socialite: { talk: "opportune" }, spy: { talk: "opportune" },
  storyweaver: { talk: "opportune" }, leader: { talk: "opportune" }, scoundrel: { talk: "opportune", retreat: "losing" },
  mercenary: { retreat: "losing", expect: "money" }, fortune_hunter: { retreat: "losing", offer: "money" }, trader: { offer: "money" },
  pirate_captain: { expect: "money" }, courier: { expect: "passage" }, fugitive: { retreat: "hurt", offer: "leave" },
  alchemist: { consumables: "freely" }, demolitionist: { consumables: "freely" }
});

/**
 * Is it an asset for fighting at range (by its id: a bow, a sling, a rifle, pistols)? Not a Long-Arm's staff, a
 * Skirmisher's spear or a Fletcher's arrows, made and not shot.
 */
export const rangedAsset = id => ASSET_TACTICS[assetLeanKey(id)]?.style === "ranged";

/** Is it an asset that makes healing its owner's thing (a Herbalist, a Healer), not just the move anyone can make? */
export const healerAsset = id => !!ASSET_TACTICS[assetLeanKey(id)]?.healAggro;

/**
 * What a marked ability says (by the asset's key and the ability's number): burning momentum pays off for a
 * Swordmaster, a Veteran, a Swashbuckler, a Survivor, a Banner-Sworn in the fray (it burns it readily); a Kinetic's or a
 * Demolitionist's greatest feats need momentum at its max (it holds on to it).
 */
const ABILITY_TACTICS = Object.freeze({
  swordmaster: { 1: { resourceUse: "nova" } }, veteran: { 1: { resourceUse: "nova" } }, swashbuckler: { 1: { resourceUse: "nova" } },
  survivor: { 2: { resourceUse: "nova" } }, banner_sworn: { 3: { resourceUse: "nova" } },
  kinetic: { 3: { resourceUse: "conserve" } }, demolitionist: { 3: { resourceUse: "conserve" } }
});

/** Mystic powers a character calls on (besides its rituals): what it brings to bear when it secures an advantage. */
const MAGIC = new Set(["ritualist", "kinetic", "sorcerer", "windbinder", "shapechanger", "necromancer", "firebrand", "seer", "sighted"]);

/** (A Rider's Heal is for its horse.) */
const NOT_HEALERS = new Set(["rider"]);

/**
 * What the books say a foe's kind does (its drives and tactics), by its id's last part: a raider intimidates, takes
 * what's yours and dies gloriously; common folk stand together for their families; a giant would rather talk you into
 * leaving; a wolf pack runs down the weakest; a servitor protects its people and weighs its odds; scrap bandits get out
 * when it goes wrong. An offer or expectation is its kind ("money": Supply, as much as its rank says).
 */
const FOE_TACTICS = Object.freeze({
  // Ironsworn (and Delve): Ironlanders, Firstborn, animals, beasts, horrors.
  broken: { talk: "never", target: "nearest", beyond: "hunt" },
  common_folk: { target: "protect", allyDying: "rescue", beyond: "seekHelp", expect: "noHarm" },
  hunter: { retreat: "losing" }, mystic: { talk: "opportune" },
  raider: { talk: "first", retreat: "never", beyond: "hunt", expect: "money" },
  warrior: { target: "protect", retreat: "losing" }, zealot: { talk: "first", retreat: "never" },
  elf: { talk: "opportune", expect: "leave" },
  giant: { talk: "first", fallen: "spare", offer: "noHarm", expect: "leave" },
  primordial: { talk: "never" }, troll: { talk: "never", retreat: "hurt", allyDying: "retreat" },
  varou: { allyDying: "rescue", expect: "leave" }, merrow: { talk: "never", retreat: "never" },
  wolf: { target: "weakest", beyond: "hunt" }, bear: { retreat: "hurt" }, boar: { retreat: "never" },
  gaunt: { retreat: "hurt", allyDying: "retreat" }, mammoth: { target: "protect", allyDying: "rescue", retreat: "never" },
  cave_lion: { beyond: "hunt" }, chitter: { beyond: "seekHelp" }, iron_wracked_beast: { retreat: "never" },
  bonewalker: { target: "nearest", beyond: "hunt" }, chimera: { target: "nearest" }, bonehorde: { target: "nearest" },
  haunt: { selfRevived: "rejoin" }, hollow: { selfRevived: "rejoin" }, iron_revenant: { selfRevived: "rejoin" },
  wight: { target: "protect", beyond: "stay" },
  // Starforged.
  drift_pirate: { target: "weakest", retreat: "losing", expect: "money" },
  firestorm_trooper: { target: "weakest", beyond: "hunt", expect: "money" },
  scrap_bandit: { talk: "first", retreat: "losing", expect: "money" },
  warden: { retreat: "never" }, colossus: { target: "dangerous" }, servitor: { target: "protect", retreat: "losing" },
  chiton: { retreat: "never", beyond: "hunt" }, howlcat: { target: "weakest", beyond: "hunt" },
  sicklehorn: { target: "protect", allyDying: "rescue" }, void_shepherd: { target: "protect" }, sky_roost: { beyond: "seekHelp" },
  gnawling: { retreat: "hurt" }, water_witcher: { retreat: "hurt" }, risen: { target: "nearest", beyond: "hunt" }, worldbreaker: { beyond: "hunt" }
});

/** Answers in order, for "at least this much": the core's own answer stands where it's already that far. */
const SPECIALTY = ["none", "some", "strong", "always"];
const HEAL_AGGRO = ["conservative", "balanced", "aggressive", "allCosts"];

/** What it offers or expects, as the survey stores it: Supply (a coin worth 1), or a promise. */
const motive = (kind, amount = 1) => (kind === "money" ? { kind, amount: Math.max(1, amount), coin: 1 } : { kind });

/**
 * A count of what's said for each answer to each question, and by whom: the answer most say, with their names (a tie,
 * nothing: the character's own reading stands).
 */
function ballot() {
  const said = {};
  return {
    say(q, value, name) {
      const answers = (said[q] ??= new Map());
      const names = answers.get(value) ?? [];
      if ( !names.includes(name) ) names.push(name);
      answers.set(value, names);
    },
    has: q => !!said[q]?.size,
    winner(q) {
      const ranked = [...(said[q] ?? new Map())].sort((a, b) => b[1].length - a[1].length);
      if ( !ranked.length || (ranked[1] && ranked[1][1].length === ranked[0][1].length) ) return null;
      return { value: ranked[0][0], why: listItems(ranked[0][1]) };
    }
  };
}

/** The abilities it has (their numbers, from 1): those marked, else the first (taken with the asset). */
function markedAbilities(abilities = []) {
  const marked = abilities.map((a, i) => (a?.marked ? i + 1 : 0)).filter(Boolean);
  return marked.length || !abilities.length ? marked : [1];
}

/**
 * A character's answers: what its assets say (all it carries and is), what the abilities marked on them do (the moves
 * they make), and its stats.
 *  - style: its weapons (a bow at range, a shield guarding, a blade up close, a dagger from the shadows); none of those,
 *    the stat it fights with (iron up close, edge at range);
 *  - target, retreat, selfRevived, beyond, allyDying: who it is (a berserker charges the nearest and never breaks; a
 *    revenant gets back up; a slayer hunts the monster; a commander fetches its warband; a healer saves a friend);
 *  - specialty (securing an advantage with its assets): its abilities that secure an advantage, its rituals and mystic
 *    powers; resourceUse (burning momentum): abilities that pay off when it burns momentum, or need it at its max;
 *  - talk: a diplomat first, a liar when it could work, abilities that Compel; healAggro: a healer, abilities that Heal;
 *  - consumables: one who makes elixirs or explosives; offer and expect: a diplomat offers peace, a trader Supply, a
 *    mercenary wants paying, a courier passage, a fugitive would leave.
 */
function characterTactics({ stats = {}, assets = [], supply = 0 } = {}, calc = {}) {
  const votes = ballot();
  const points = { advantage: [], compel: [], heal: [], aid: [] };
  let specialty = 0;
  for ( const raw of assets ?? [] ) {
    const a = typeof raw === "string" ? { key: raw } : raw ?? {};
    const key = assetLeanKey(a.key);
    if ( !key ) continue;
    const name = a.name || key;
    for ( const [q, v] of Object.entries(ASSET_TACTICS[key] ?? {}) ) {
      if ( q === "healAggro" ) points.heal.push(name);
      else votes.say(q, v, name);
    }
    const marked = markedAbilities(a.abilities);
    for ( const n of marked ) for ( const [q, v] of Object.entries(ABILITY_TACTICS[key]?.[n] ?? {}) ) votes.say(q, v, name);
    if ( VEHICLES.has(a.category) ) continue;
    // What its marked abilities do.
    const moves = marked.flatMap(n => a.abilities?.[n - 1]?.moves ?? []);
    const count = m => moves.filter(x => x === m).length;
    const mystic = a.category === "ritual" || MAGIC.has(key) ? 1 : 0;
    if ( count("advantage") + mystic ) {
      specialty += count("advantage") + mystic;
      points.advantage.push(name);
    }
    for ( const m of ["compel", "aid"] ) for ( let i = 0; i < count(m); i++ ) points[m].push(name);
    if ( count("heal") && !NOT_HEALERS.has(key) ) points.heal.push(name);
  }

  const out = {};
  const unique = names => listItems([...new Set(names)]);
  const take = q => {
    const w = votes.winner(q);
    if ( w ) out[q] = w;
  };
  for ( const q of ["style", "target", "resourceUse", "consumables", "retreat", "selfRevived", "beyond"] ) take(q);

  // Fighting style, from its stats when its assets say nothing: iron up close, edge at range (Ironsworn's own).
  if ( !votes.has("style") ) {
    const iron = Number(stats?.iron) || 0;
    const edge = Number(stats?.edge) || 0;
    const stat = iron > edge ? "iron" : edge > iron ? "edge" : null;
    if ( stat ) out.style = { value: stat === "iron" ? "frontline" : "ranged", why: t("Reason.Stat", { name: statName(stat), n: stat === "iron" ? iron : edge }) };
  }

  // Its assets brought to bear: a little more often with two, much more with four.
  const level = specialty >= 4 ? "strong" : specialty >= 2 ? "some" : null;
  if ( level && SPECIALTY.indexOf(level) > SPECIALTY.indexOf(calc?.specialty) ) out.specialty = { value: level, why: unique(points.advantage) };

  // Talking: who it is; else how many of its abilities Compel.
  take("talk");
  if ( !out.talk && points.compel.length ) out.talk = { value: points.compel.length >= 3 ? "first" : "opportune", why: unique(points.compel) };

  // Healing others: a healer, or an ability that Heals (keeping everyone up, unless it would go further already).
  if ( points.heal.length && HEAL_AGGRO.indexOf(calc?.healAggro) < HEAL_AGGRO.indexOf("aggressive") ) out.healAggro = { value: "aggressive", why: unique(points.heal) };

  // A friend going down: those sworn to stand by friends, healers and those who Aid Your Ally rescue them.
  for ( const name of [...points.heal, ...points.aid] ) votes.say("allyDying", "rescue", name);
  take("allyDying");

  // What it offers (Supply only if it has some) and expects.
  for ( const q of ["offer", "expect"] ) {
    const w = votes.winner(q);
    if ( !w || (q === "offer" && w.value === "money" && !(Number(supply) >= 1)) ) continue;
    out[q] = { value: motive(w.value), why: w.why };
  }
  return out;
}

/**
 * A foe's answers: its nature's (horrors and machines never break; beasts and animals stay where the fight is; only
 * people and the Firstborn talk), then its kind's (FOE_TACTICS), each shown with its name. What it expects in Supply is
 * as much as its rank says (half its rank, rounded up).
 */
function foeTactics({ nature = "people", key = null, name = "", rank = 2 } = {}) {
  const out = {};
  const kind = t(`Nature.${nature}`);
  if ( nature === "horror" || nature === "machine" ) out.retreat = { value: "never", why: kind };
  if ( nature === "beast" || nature === "animal" ) out.beyond = { value: "stay", why: kind };
  if ( !speaks(nature) ) out.talk = { value: "never", why: kind };
  const why = name || key || kind;
  for ( const [q, v] of Object.entries(FOE_TACTICS[key] ?? {}) ) {
    if ( q !== "offer" && q !== "expect" ) out[q] = { value: v, why };
    else if ( speaks(nature) ) out[q] = { value: motive(v, Math.ceil((Number(rank) || 2) / 2)), why };
  }
  return out;
}

/**
 * Ironsworn's own answers to the tactics questions, where its data says something: {key: {value, why}}, each value one
 * of its question's choices (offer and expect as the survey stores them), why in the reader's language (an asset's or a
 * foe's name, a stat, a nature). Questions it says nothing about are left out (the core's reading stands).
 * @param {object} d
 * @param {boolean} [d.pc]     a character (else a foe)
 * A character's:
 * @param {object} [d.stats]   its edge, heart, iron, shadow, wits
 * @param {(string|{key: string, category?: string, name?: string, abilities?: {marked?: boolean, moves?: string[]}[]})[]} [d.assets]
 *        by their id ("asset:classic/path/herbalist", or just "herbalist"), its kind ("path", "ritual", "module"), its
 *        name, and its abilities: each marked or not, and the moves it makes (abilityMoves)
 * @param {number} [d.supply]  its supply
 * A foe's:
 * @param {string} [d.nature]  people | firstborn | animal | beast | horror | machine
 * @param {string} [d.key]     its kind, its id's last part ("raider")
 * @param {string} [d.name]
 * @param {number} [d.rank]    1 troublesome ... 5 epic
 * @param {object} [calc]      the core's answers (an answer it already takes further stands)
 */
export function ironswornTactics(d = {}, calc = {}) {
  return d?.pc ? characterTactics(d, calc) : foeTactics(d);
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
