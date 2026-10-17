/**
 * Ironsworn, Starforged and Sundered Isles personality defaults. Pure, unit-tested.
 *
 * A character starts as the usual hero (the core's PC_BASELINE) and everything on its sheet moves it a little, each part
 * shown in the trait's reason: its five stats against the usual spread's (3, 2, 2, 1, 1: 1.8 each, on average), its
 * assets (by the last part of their id, a little more as they're upgraded), its debilities or impacts (a shaken or
 * corrupted hero is a different one for now), its bonds or connections, its vows (how many, how dangerous, how many
 * kept), its legacies, and how far it has come (its assets' upgrades, and those beyond its first three).
 * A foe is read from what it is (its id says: Ironlanders, Firstborn, Animals, Beasts, Horrors; or the folder its
 * compendium files it under, or its words) and its rank: the higher, the bolder. Then what its kind is like (the books'
 * drives and tactics for it), and whether it's a group.
 */
import { clamp, partsOf, traitsFromParts, PC_BASELINE } from "./core.js";
import { t, statName } from "./words.js";

/* What a foe is ------------------------------------------------------------------------------------------------------ */

/** What each collection of foes is, by its id ("npc:classic/animals/bear": animals). */
const COLLECTIONS = Object.freeze({ ironlanders: "people", firstborn: "firstborn", animals: "animal", beasts: "beast", horrors: "horror", anomalies: "horror" });

/** Starforged's sample foes, by their id's last part: what the book says each is (human, creature, monster, machine, horror). */
const STARFORGED_NATURES = Object.freeze({
  drift_pirate: "people", firestorm_trooper: "people", scrap_bandit: "people", warden: "people",
  colossus: "machine", iron_auger: "machine", servitor: "machine",
  ghost: "horror", risen: "horror",
  chiton: "beast", puppet_vine: "beast", technoplasm: "beast",
  crystallid: "animal", ember_wisp: "animal", flarewing_shark: "animal", gnawling: "animal", howlcat: "animal", pyralis: "animal",
  sicklehorn: "animal", sky_roost: "animal", void_shepherd: "animal", water_witcher: "animal", worldbreaker: "animal"
});

/**
 * A foe's id, in parts: "npc:classic/animals/bear" is {collection: "animals", key: "bear"}; a variant
 * ("npc.variant:starforged/sample_npcs/chiton.chiton_queen") also has its own ("chiton_queen").
 * @param {string} dsid
 * @returns {{collection: string, key: string, variant: string|null}|null}
 */
export function foeId(dsid) {
  const m = /^npc(?:\.variant)?:[\w-]+\/([\w-]+)\/([\w-]+)(?:\.([\w-]+))?/.exec(String(dsid ?? ""));
  return m ? { collection: m[1], key: m[2], variant: m[3] ?? null } : null;
}

/** What kind of foe this is: from its id, else its compendium folder, else its name and words. */
export function natureOf({ dsid = "", folder = "", name = "", text = "" } = {}) {
  const id = foeId(dsid);
  const known = id && (COLLECTIONS[id.collection] ?? STARFORGED_NATURES[id.key]);
  if ( known ) return known;
  const f = String(folder).toLowerCase();
  if ( /ironlander|human|firstborn|people|npc/.test(f) ) return f.includes("firstborn") ? "firstborn" : "people";
  if ( /animal/.test(f) ) return "animal";
  if ( /beast|creature/.test(f) ) return "beast";
  if ( /horror|undead|anomal/.test(f) ) return "horror";
  const words = `${name} ${text}`.toLowerCase();
  if ( /\b(?:bonewalker|haunt|hollow|sodden|revenant|ghost|wraith|wight|thrall|horde|abomination|husk)\b/.test(words) ) return "horror";
  if ( /\b(?:wolf|wolves|bear|boar|rat|gaunt|lion|spider|crab|newt|beast|wyvern|wyrm|mammoth|leviathan|basilisk|kraken|swarm|stampede|brood|mites|youngling)\b/.test(words) ) return "beast";
  if ( /\b(?:machine|drone|automaton|bot|dropship|colossus|sentinel)\b/.test(words) ) return "machine";
  return "people";
}

/** Who can be talked to: people and the Firstborn (and anyone, if the GM ignores languages). */
export const speaks = nature => nature === "people" || nature === "firstborn";

/**
 * What the books say of a foe's kind (its drives and tactics), by its id's last part: a raider's greed and its kin, the
 * common folk's fear for their families, a wolf's pack, a servitor made to protect.
 */
const FOE_LEANS = Object.freeze({
  // Ironsworn (and Delve): Ironlanders, Firstborn, animals, beasts, horrors.
  broken: { tactical: -12, loyal: -8, brave: 5 }, common_folk: { brave: -12, loyal: 8, selfish: -5 }, hunter: { tactical: 8, brave: -4 },
  mystic: { tactical: 8 }, raider: { selfish: 10, brave: 6, loyal: 5 }, warrior: { tactical: 4, brave: 5, loyal: 5 },
  husk: { tactical: -8 }, zealot: { brave: 8, loyal: 8, tactical: -4 },
  elf: { tactical: 8, loyal: 4 }, giant: { brave: -8, loyal: 5, selfish: -5 }, primordial: { selfish: 8, loyal: -8 },
  troll: { selfish: 12, brave: -8, loyal: -8 }, varou: { loyal: 8, brave: 4 },
  bear: { loyal: 5 }, boar: { brave: 5, loyal: 5 }, gaunt: { brave: -12 }, marsh_rat: { selfish: 10, brave: -8 }, wolf: { loyal: 10, tactical: 5 },
  basilisk: { tactical: 5 }, elder_beast: { brave: 8, selfish: 5 }, harrow_spider: { tactical: 5 }, mammoth: { loyal: 8 },
  bonewalker: { tactical: -8 }, chimera: { tactical: -8 }, hollow: { selfish: -8 }, iron_revenant: { loyal: 10 },
  bonehorde: { tactical: -8 }, thrall: { loyal: 12 }, wight: { tactical: 8, loyal: 8 },
  // Starforged.
  chiton: { loyal: 12, selfish: -8 }, crystallid: { loyal: 5 }, drift_pirate: { selfish: 12, loyal: -5 }, ember_wisp: { loyal: 5 },
  firestorm_trooper: { loyal: 8, tactical: 5 }, gnawling: { brave: -8, selfish: 8 }, howlcat: { loyal: 8, tactical: 5 },
  risen: { tactical: -8 }, scrap_bandit: { loyal: 8, selfish: 8 }, servitor: { loyal: 12, selfish: -8 }, sicklehorn: { loyal: 8, brave: -4 },
  sky_roost: { brave: -8 }, void_shepherd: { selfish: -12, loyal: 8 }, warden: { brave: 8, loyal: -5 }, water_witcher: { brave: -8, selfish: -8 }
});

/** A foe that comes as many (a pack, a swarm, a boarding party): they stand together, and take heart from it. */
const GROUP = /(?:^|_)(?:pack|swarm|horde|brood|party|team|cohort|congregation|stampede|pod|mites)(?:_|$)/;

/* A character -------------------------------------------------------------------------------------------------------- */

/** The usual hero's stats: 3, 2, 2, 1 and 1, 1.8 on average. Each stat moves a trait by how far it is from that. */
const USUAL_STAT = 1.8;

/**
 * What each stat says of who has it, a point at a time (as Ironsworn describes them): wits its expertise and
 * observation; heart its courage, empathy and loyalty; iron its strength and aggressiveness; shadow its trickery and
 * stealth; edge its quickness, at a distance.
 */
const STAT_LEANS = Object.freeze({
  wits: { tactical: 5 },
  heart: { brave: 4, selfish: -3, loyal: 5 },
  iron: { brave: 3, tactical: -1.5 },
  shadow: { selfish: 4, loyal: -2, tactical: 1.5, brave: -1 },
  edge: { tactical: 1, brave: -1 }
});

/**
 * What an asset says of who took it, by the last part of its id (each ruleset's of the same name alike): a shield-bearer
 * or banner-sworn more loyal and bold, an outcast or fugitive less loyal, a cutthroat or mercenary more selfish, a
 * berserker bolder and less careful, the honorbound and the devoted less selfish.
 */
const ASSET_LEANS = Object.freeze({
  // Paths and deeds.
  alchemist: { tactical: 2 }, animal_kin: { selfish: -1 }, battle_scarred: { brave: 3 }, banner_sworn: { loyal: 5, brave: 2 },
  bannersworn: { loyal: 5, brave: 2 }, blade_bound: { brave: 2, loyal: 2 }, bonded: { loyal: 5, selfish: -2 }, commander: { tactical: 4, loyal: 2 },
  devotant: { selfish: -4, loyal: 2 }, empowered: { selfish: 2 }, fated: { brave: 4 }, fortune_hunter: { selfish: 5 }, herbalist: { selfish: -3 },
  honorbound: { selfish: -4, loyal: 3 }, improviser: { tactical: 2 }, infiltrator: { tactical: 2, selfish: 1 }, loyalist: { loyal: 6, selfish: -2 },
  lorekeeper: { tactical: 3 }, oathbreaker: { loyal: -3, brave: 1 }, outcast: { loyal: -5, selfish: 2 }, pretender: { selfish: 3, loyal: -2 },
  revenant: { brave: 5 }, ritualist: { tactical: 1 }, shadow_kin: { tactical: 2, selfish: 2 }, slayer: { brave: 4 }, spirit_bound: { loyal: 2 },
  storyweaver: { loyal: 1 }, trickster: { selfish: 3, tactical: 1 }, veteran: { tactical: 3, brave: 2 }, weaponmaster: { brave: 2 },
  weapon_master: { brave: 2 }, wright: { tactical: 2 },
  ace: { brave: 2, tactical: -1 }, armored: { brave: 2 }, blademaster: { brave: 2, tactical: 1 }, bounty_hunter: { selfish: 4, tactical: 1 },
  courier: { loyal: 2, selfish: -1 }, demolitionist: { brave: 2, tactical: -1 }, diplomat: { tactical: 2, selfish: -1 },
  empath: { selfish: -4, loyal: 2 }, explorer: { brave: 2 }, fugitive: { loyal: -4, selfish: 2, brave: -2 }, gearhead: { tactical: 2 },
  gunslinger: { brave: 2 }, haunted: { brave: -2, loyal: 1 }, healer: { selfish: -4 }, leader: { loyal: 3, tactical: 3 },
  lore_hunter: { tactical: 3 }, mercenary: { selfish: 6, loyal: -3 }, navigator: { tactical: 2 }, scavenger: { selfish: 3 },
  scoundrel: { selfish: 4, loyal: -2 }, shade: { tactical: 2, selfish: 1 }, sleuth: { tactical: 4 }, tech: { tactical: 2 }, trader: { selfish: 3 },
  vestige: { brave: 3 }, homesteader: { loyal: 3 }, survivor: { brave: 2, selfish: 2 }, vanguard: { brave: 3 },
  crew_commander: { tactical: 3, loyal: 3 }, harpooner: { brave: 2 }, musician: { loyal: 2 }, musketeer: { tactical: 2 }, peddler: { selfish: 3 },
  pirate_captain: { selfish: 3, brave: 2, tactical: 2 }, pistoleer: { brave: 2 }, scholar: { tactical: 4 }, shipwright: { tactical: 2 },
  socialite: { selfish: 2 }, spy: { tactical: 3, loyal: -2 }, swashbuckler: { brave: 4, tactical: -2 }, urchin: { selfish: 3 },
  cohort: { loyal: 3 }, damned: { brave: 3, selfish: 2 }, fleet_commander: { tactical: 3, loyal: 2 }, old_salt: { brave: 2, tactical: 2 },
  undead: { brave: 4, loyal: -2 },
  // Combat talents (and the paths like them).
  archer: { tactical: 2, brave: -1 }, berserker: { brave: 6, tactical: -5 }, brawler: { brave: 3, tactical: -2 }, cutthroat: { selfish: 5, tactical: 1 },
  duelist: { brave: 2, tactical: 1 }, fletcher: { tactical: 1 }, ironclad: { brave: 3 }, long_arm: { tactical: 1 },
  shield_bearer: { loyal: 4, brave: 3, selfish: -2 }, skirmisher: { tactical: 2 }, slinger: { tactical: 1 }, sunderer: { brave: 2, tactical: -1 },
  swordmaster: { brave: 2, tactical: 1 }, thunder_bringer: { brave: 3, tactical: -2 }, gunner: { tactical: 1 }, sniper: { tactical: 3, brave: -1 },
  cannoneer: { tactical: 1 }, scattershot: { brave: 1, tactical: -2 },
  // Rituals.
  leech: { selfish: 2 }
});

/** What a kind of asset says, by its id's middle part: a companion at its side. */
const CATEGORY_LEANS = Object.freeze({ companion: { loyal: 2 } });

/** Kinds of asset that aren't among a character's first three, nor bought with experience: its ship, a vehicle on loan. */
const FREE_ASSETS = new Set(["command_vehicle", "incidental_vehicle"]);

/**
 * What a debility or impact says of who bears it, for now: shaken or traumatized, less bold; corrupted, darker; in debt,
 * out for itself. Cursed is a bane in Ironsworn (death's quest); in Starforged it's a vehicle's.
 */
const DEBILITY_LEANS = Object.freeze({
  shaken: { brave: -6, tactical: -2 }, wounded: { brave: -3 }, unprepared: { selfish: 2, tactical: -1 }, maimed: { brave: -3 },
  corrupted: { selfish: 6, loyal: -4 }, tormented: { brave: -3, tactical: -1 }, permanentlyharmed: { brave: -2 }, traumatized: { brave: -4 },
  doomed: { brave: 2 }, indebted: { selfish: 3 }
});
const CLASSIC_DEBILITY_LEANS = Object.freeze({ cursed: { brave: 2 } });

/** The usual hero's vows: its background vow and its first (epic or extreme, and formidable or dangerous). */
const USUAL_VOWS = 2;
const USUAL_VOW_RANK = 3.5;

/** An asset's key: the last part of its id, lower case ("Shield-Bearer", from an older id, is "shield_bearer"). */
export const assetLeanKey = id => String(id ?? "").split("/").pop().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || null;

/**
 * A player character's parts: everything on its sheet that moves it from the usual hero.
 * @param {object} d   see deriveIronswornTraits
 * @returns {{trait: string, n: number, why: string}[]}
 */
export function pcParts(d) {
  // (The words shown are the system's, from the adapter; without them, the identifiers: a bondset's bonds, a "bond" or
  // "vow" progress track, a legacy's key, a debility's key.)
  const names = d.names ?? {};
  const parts = [];
  const add = (trait, n, why) => parts.push({ trait, n, why });

  // Its stats, against the usual hero's.
  for ( const [stat, lean] of Object.entries(STAT_LEANS) ) {
    const v = Number(d.stats?.[stat]);
    if ( !Number.isFinite(v) ) continue;
    parts.push(...partsOf(lean, t("Reason.Stat", { name: statName(stat), n: v }), v - USUAL_STAT));
  }

  // Its assets: what each says of who took it, more as it's upgraded (a third ability half as much again).
  let advances = 0;
  let owned = 0;
  for ( const a of d.assets ?? [] ) {
    const key = assetLeanKey(a.key);
    const enabled = Math.max(0, Number(a.enabled) || 0);
    advances += Math.max(0, enabled - 1);
    if ( !FREE_ASSETS.has(a.category) ) owned += 1;
    const lean = { ...CATEGORY_LEANS[a.category] };
    for ( const [k, n] of Object.entries(ASSET_LEANS[key] ?? {}) ) lean[k] = (lean[k] ?? 0) + n;
    parts.push(...partsOf(lean, a.name ?? key ?? "", 1 + 0.25 * Math.max(0, enabled - 1)));
  }
  // How far it has come: its upgrades, and the assets it took on beyond its first three. A seasoned hero thinks ahead.
  advances += Math.max(0, owned - 3);
  if ( advances > 0 ) add("tactical", Math.min(6, advances), t("Reason.Advances", { n: advances }));

  // Its debilities or impacts, as they stand.
  const classic = d.ruleset === "classic";
  for ( const k of d.debilities ?? [] ) {
    const lean = DEBILITY_LEANS[k] ?? (classic ? CLASSIC_DEBILITY_LEANS[k] : null);
    if ( lean ) parts.push(...partsOf(lean, names.debilities?.[k] ?? k));
  }

  // Its friends: its bonds (Ironsworn), its connections (a bond forged with one counts twice). The first is the usual hero's.
  const bonds = Number(d.bonds) || 0;
  if ( bonds > 1 ) add("loyal", Math.min(8, 2 * (bonds - 1)), t("Reason.Count", { name: names.bonds ?? "bonds", n: bonds }));
  const connections = d.connections ?? [];
  if ( connections.length ) {
    const weight = connections.length + connections.filter(c => c.bonded).length;
    if ( weight > 1 ) add("loyal", Math.min(8, 1.5 * (weight - 1)), t("Reason.Count", { name: names.connections ?? "bond", n: connections.length }));
  }

  // Its vows: more than the usual hero's two, it's sworn to others; the more dangerous, the bolder; those kept, its word.
  const open = (d.vows ?? []).filter(v => !v.completed);
  const kept = (d.vows ?? []).filter(v => v.completed).length;
  const vowsName = names.vows ?? "vow";
  if ( open.length > USUAL_VOWS ) {
    const why = t("Reason.Count", { name: vowsName, n: open.length });
    add("loyal", Math.min(4, open.length - USUAL_VOWS), why);
    add("selfish", -Math.min(4, open.length - USUAL_VOWS), why);
  }
  if ( open.length ) {
    const rank = open.reduce((sum, v) => sum + clamp(Number(v.rank) || 1, 1, 5), 0) / open.length;
    const r = Math.round(rank);
    add("brave", clamp(2 * (rank - USUAL_VOW_RANK), -5, 4), t("Reason.VowRank", { name: vowsName, rank: names.ranks?.[r] ?? r }));
  }
  if ( kept ) add("loyal", Math.min(4, kept), t("Reason.Kept", { name: vowsName, n: kept }));

  // Its legacies (Starforged, Sundered Isles), a box at a time: quests made it bolder, bonds closer, discoveries wiser.
  const LEGACY = { quests: "brave", bonds: "loyal", discoveries: "tactical" };
  for ( const [k, trait] of Object.entries(LEGACY) ) {
    const boxes = Math.floor((Number(d.legacies?.[k]) || 0) / 4);
    if ( boxes > 0 ) add(trait, Math.min(6, 0.75 * boxes), t("Reason.Legacy", { name: names.legacies?.[k] ?? k, n: boxes }));
  }
  return parts;
}

/**
 * @param {object} d
 * @param {boolean} d.pc
 * A character's:
 * @param {object} [d.stats]   its edge, heart, iron, shadow, wits
 * @param {{key: string, category?: string, name?: string, enabled?: number}[]} [d.assets]   by their id ("asset:classic/path/outcast"
 *        or just "outcast"), its kind ("path", "companion", "command_vehicle"), and how many of its abilities are marked
 * @param {string[]} [d.debilities]   the debilities or impacts marked ("shaken", "corrupted")
 * @param {string} [d.ruleset]   classic | starforged | sundered_isles: the sheet it's on
 * @param {number} [d.bonds]   its bonds (Ironsworn's)
 * @param {{bonded?: boolean}[]} [d.connections]   its connections (Starforged's), each bonded or not
 * @param {{rank: number, completed?: boolean}[]} [d.vows]
 * @param {{quests?: number, bonds?: number, discoveries?: number}} [d.legacies]   ticks on each legacy track
 * @param {object} [d.names]   the words shown: {debilities: {key: label}, bonds, connections, vows, legacies: {quests, bonds, discoveries}, ranks: {1: label ...}}
 * A foe's:
 * @param {number} [d.rank]    1 troublesome ... 5 epic
 * @param {string} [d.nature]  people | firstborn | animal | beast | horror | machine
 * @param {string} [d.dsid]    its id ("npc:classic/ironlanders/raider"), for what its kind is like
 * @param {string} [d.name]    its name, shown with what its kind is like
 * @returns {{traits, flags, reasons}}
 */
export function deriveIronswornTraits(d) {
  const { pc, rank = 2, nature = "people" } = d ?? {};
  const flags = {};
  if ( pc ) {
    const built = traitsFromParts(PC_BASELINE, pcParts(d), { from: t("Reason.Pc") });
    return { traits: built.traits, flags, reasons: built.reasons };
  }
  const r = clamp(Number(rank) || 2, 1, 5);
  const base = {
    people: { tactical: 50, brave: 50, selfish: 50, loyal: 55 },
    firstborn: { tactical: 60, brave: 60, selfish: 45, loyal: 60 },
    animal: { tactical: 20, brave: 45, selfish: 65, loyal: 50 },
    beast: { tactical: 25, brave: 65, selfish: 60, loyal: 40 },
    horror: { tactical: 30, brave: 90, selfish: 70, loyal: 30 },
    machine: { tactical: 45, brave: 90, selfish: 40, loyal: 80 }
  }[nature] ?? { tactical: 50, brave: 50, selfish: 50, loyal: 50 };
  const start = { ...base, brave: clamp(base.brave + 5 * (r - 2), 5, 100) };
  const kind = t(`Nature.${nature}`);
  const reasons = { tactical: kind, brave: t("Reason.Rank", { nature: kind, r }), selfish: kind, loyal: kind };
  if ( nature === "horror" || nature === "machine" ) flags.fearless = true;
  if ( nature === "animal" || nature === "beast" ) flags.beast = true;

  // What its kind is like, and whether it comes as many.
  const id = foeId(d.dsid);
  const parts = [];
  if ( id ) {
    parts.push(...partsOf(FOE_LEANS[id.key], d.name || id.key));
    if ( id.variant && GROUP.test(id.variant) ) parts.push(...partsOf({ loyal: 5, brave: 5 }, t("Reason.Group")));
  }
  const built = traitsFromParts(start, parts, { lead: reasons, min: 0, max: 100 });
  return { traits: built.traits, flags, reasons: built.reasons };
}
