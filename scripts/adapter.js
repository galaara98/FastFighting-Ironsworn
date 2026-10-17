/**
 * Ironsworn and Starforged adapter: reads foundry-ironsworn characters and foes into CombatantSpecs and writes a live
 * battle's turns back onto their sheets. Written against foundry-ironsworn 1.28 on Foundry v14.
 *
 * A character: its stats, health and momentum (its reset and ceiling as its impacts leave them), its debilities or
 * impacts (as the engine's conditions, by the system's ids: in a live battle the GM may mark or clear one, and it's
 * written on the sheet), who has the initiative if a fight is under way (Starforged's combat position), and whether it
 * fights at range (an asset like Archer or Gunner, by its id; or more edge than iron). Its moves: Strike and Clash
 * (+iron close, +edge at range), End the Fight (Take Decisive Action in Starforged), as its sheet's ruleset plays them;
 * a move of the same name in the ruleset the world prefers (the "Rules preference" setting, when that ruleset is on) is
 * played that way. Heal, which anyone can make: a specialty only for one whose assets make healing its thing (a
 * Herbalist, a Healer).
 * Its personality (traits.js), from everything on its sheet: its stats, assets, debilities or impacts, bonds or
 * connections, vows and legacies.
 * A foe: its progress track (its rank, and the ticks already marked) and what it is (its id: Ironlanders, Firstborn,
 * Animals, Beasts, Horrors; else the folder its compendium files it under, or its words), which says whether it can be
 * talked to, how it fights, and (with its rank and its kind) its personality.
 * The encounter (the planner's Ironsworn section, conflict.js): one track for it (Starforged's objective, at the rank
 * the GM gives it, kept on one of the characters) or each foe's own (Ironsworn's).
 */
import { SystemAdapter, hasWords, localize, plainText } from "./core.js";
import { ironswornRules, DEBILITIES, DEBILITY_KEYS } from "./rules.js";
import { characterMoves, foeNumbers, loreSizeUp, doorWork } from "./build.js";
import { loreBoost } from "./lore.js";
import { movesFor, TRACK } from "./moves.js";
import { deriveIronswornTraits, natureOf, speaks, assetLeanKey, foeId } from "./traits.js";
import { rankIronswornLeaders } from "./leadership.js";
import { commitIronswornChanges, commitEncounterTurn, describeIronswornOutcome, commitIronswornConcession, supplyOf, meterOf, encounterTrack, keptTrack, describeEncounterTrack } from "./commit.js";
import { readIronswornTurn } from "./read-turn.js";
import { TRACK_MODES, RANK_KEYS, DOOR_HARM, defaultMode, defaultRank, rankOf, joinEncounter, doorHarmOf, doorsFor } from "./conflict.js";
import { t, moveName, statName } from "./words.js";
import { ironswornHints, ironswornTactics, abilityMoves, assetKey, rangedAsset, healerAsset, characterBiography, foeBiography } from "./auto.js";

/** The rulesets on in the world (the system's "ruleset-..." settings). */
const RULESET_KEYS = ["classic", "starforged", "sundered_isles"];
const enabledRulesets = () => RULESET_KEYS.filter(r => { try { return !!game.settings.get("foundry-ironsworn", `ruleset-${r}`); } catch { return false; } });
/** The world's rules preference: "sheet" (each character's own sheet's moves), or the ruleset whose moves it prefers. */
const rulesPreference = () => {
  try {
    return game.settings.get("fast-fighting-ironsworn", "rulesPreference") ?? "sheet";
  } catch ( err ) {
    return "sheet";
  }
};
const deadlyWeapons = () => {
  try {
    return game.settings.get("fast-fighting-ironsworn", "deadlyWeapons") !== false;
  } catch ( err ) {
    return true;
  }
};
/** How much harm a locked door stands up to in Ironsworn (a world setting, 1 to 3). */
const doorHarm = () => {
  try {
    return doorHarmOf(game.settings.get("fast-fighting-ironsworn", "doorHarm"));
  } catch ( err ) {
    return DOOR_HARM.default;
  }
};
/** The system's word for a key, or null when it has none. */
const systemWord = key => (hasWords(key) ? localize(key) : null);
/** The system's flags on a document (its dsid: "asset:classic/path/outcast", "npc:classic/ironlanders/raider"). */
const ironFlags = doc => doc?.flags?.["foundry-ironsworn"] ?? {};
/**
 * An asset as the system knows it: its id (else its older id, else its name), what kind it is (its id's middle part:
 * "path", "ritual", "module"; else its category) and its name.
 */
const assetOf = i => {
  const dsid = String(ironFlags(i).dsid ?? "");
  const path = dsid.replace(/^asset:/, "").split("/");
  return { key: dsid || String(ironFlags(i).dfid ?? "") || i.name, category: path.length === 3 ? path[1] : assetLeanKey(i.system?.category), name: i.name };
};
/** A foe's id, on it or on its progress track. */
const foeDsid = (actor, track) => String(ironFlags(actor).dsid || ironFlags(track).dsid || "");
/** A key's first letter in capitals, as the system's language keys have it ("permanentlyharmed": Permanentlyharmed). */
const capital = k => `${k.charAt(0).toUpperCase()}${k.slice(1)}`;
/** The debilities or impacts its sheet has marked, as the engine's conditions ({wounded: 1, ...}). */
const debilitiesOf = sys => Object.fromEntries(DEBILITY_KEYS.filter(k => sys?.debility?.[k] === true).map(k => [k, 1]));

export class IronswornAdapter extends SystemAdapter {
  static systemId = "foundry-ironsworn";

  /** Compendium source -> the folder it's filed under (what kind of foe it is). */
  #folders = new Map();

  get label() {
    return t("Label");
  }

  get rules() {
    return ironswornRules;
  }

  canHandle(actor) {
    return !!actor && ["character", "foe"].includes(actor.type);
  }

  async toCombatantSpec(tokenDoc) {
    const actor = tokenDoc.actor;
    if ( !this.canHandle(actor) ) return null;
    return actor.type === "character" ? this.#character(tokenDoc, actor) : this.#foe(tokenDoc, actor);
  }

  /**
   * The ruleset a character plays by: the sheet it's on now (the sheet open for it, or the one that would open: a
   * token's own choice over its actor's), since a sheet can show other rulesets' moves too. An Ironsworn sheet plays
   * Ironsworn; a Starforged sheet Starforged (Sundered Isles, in a world that has that on and not Starforged). A sheet
   * that's neither (the compact sheet): the rulesets the world has on, Ironsworn first.
   */
  #ruleset(actor) {
    const on = r => enabledRulesets().includes(r);
    let sheet = "";
    try {
      sheet = actor.sheet?.constructor?.name ?? "";
    } catch ( err ) { /* no sheet to be had: its configured one */ }
    sheet ||= actor._getSheetClass?.()?.name ?? String(actor.flags?.core?.sheetClass ?? "");
    if ( /starforged/i.test(sheet) ) return on("sundered_isles") && !on("starforged") ? "sundered_isles" : "starforged";
    if ( /ironsworn/i.test(sheet) ) return "classic";
    if ( on("classic") || !(on("starforged") || on("sundered_isles")) ) return "classic";
    return on("starforged") ? "starforged" : "sundered_isles";
  }

  #character(tokenDoc, actor) {
    const sys = actor.system;
    const stat = k => Number(sys[k]) || 0;
    const stats = { edge: stat("edge"), heart: stat("heart"), iron: stat("iron"), shadow: stat("shadow"), wits: stat("wits") };
    const ruleset = this.#ruleset(actor);
    // The moves of the sheet it's on (its ruleset preferred where names match), unless the world prefers another
    // ruleset's of the same name (and has it on).
    const preference = rulesPreference();
    const moveRules = movesFor(ruleset, preference === "sheet" ? ruleset : preference, enabledRulesets());
    const assets = actor.items.filter(i => i.type === "asset");
    // (Its assets by the system's ids, as its tactics read them: a bow or a rifle to fight at range; a healer's path.)
    const keys = assets.map(a => assetOf(a).key);
    const ranged = keys.some(rangedAsset) || stats.edge > stats.iron;
    const health = Number(sys.health?.value ?? 5);
    const position = sys.combatPosition;
    const derived = deriveIronswornTraits(this.#traitFacts(actor, ruleset));
    return {
      id: tokenDoc.id,
      tokenId: tokenDoc.id,
      actorId: actor.id,
      actorUuid: actor.uuid,
      name: tokenDoc.name ?? actor.name,
      img: tokenDoc.texture?.src ?? actor.img,
      kind: "pc",
      level: 1,
      mover: true,
      ruleset,
      moveRules,
      stats,
      hp: { value: Math.max(0, health), max: Number(sys.health?.max ?? 5) || 5, temp: 0 },
      // (The stats too: facing a hazard's danger is +edge.)
      defenses: { ac: 10, fortitude: stats.iron, reflex: stats.edge, will: stats.heart, ...stats },
      shield: null,
      initiative: { mod: stats.wits, stealth: stats.shadow },
      speeds: { walk: 30 },
      // (Ironsworn: armed with a deadly weapon, 2 harm a hit; a world setting for tables where that isn't so.)
      actions: characterMoves({ id: tokenDoc.id, stats, ruleset, ranged, moves: moveRules, extraHarm: deadlyWeapons() ? 1 : 0, assets: assets.length > 0, healer: keys.some(healerAsset) }),
      iwr: { immune: [], weak: {}, resist: {} },
      resources: { momentum: Number(sys.momentum?.value ?? 2) },
      momentumReset: Number(sys.momentumReset ?? sys.momentum?.resetValue ?? 2),
      momentumMax: Number(sys.momentumMax ?? sys.momentum?.max ?? 10),
      wounded: !!sys.debility?.wounded,
      // Spirit, for stress (mental shock, despair); shaken, already.
      spirit: { value: meterOf(actor, "spirit"), max: Number(sys.spirit?.max ?? 5) || 5 },
      shaken: !!sys.debility?.shaken,
      // (Every debility or impact marked, as a condition: the GM may mark or clear one in a live battle.)
      conditions: debilitiesOf(sys),
      control: position === "inControl" ? true : position === "inABadSpot" ? false : undefined,
      // No coins or goods: paying costs Supply, which the side shares (what one pays, all have that much less of).
      valuables: { money: supplyOf(actor), denominations: [{ label: game.i18n.localize("IRONSWORN.Supply"), value: 1 }], stowed: [], wielded: [], pooled: true },
      traits: Object.fromEntries(Object.entries(derived.traits).map(([k, v]) => [k, { base: v, fudge: 0 }])),
      traitReasons: derived.reasons,
      flags: { ...derived.flags },
      diesAtZero: false,
      perception: stats.wits,
      // Sizing a foe up (a Lore-Collector): Secure an Advantage, +wits; its next attack or words likelier (the setting).
      sizeUp: { ...loreSizeUp(stats, loreBoost()), label: game.i18n.localize("FFIRONSWORN.SecureAnAdvantage") },
      // A Thief lifting something: Face Danger, +shadow (the foe gives ground; a character, Supply).
      theft: { skill: t("SkillMove", { move: moveName("FaceDanger"), stat: statName("shadow") }), mod: stats.shadow },
      // A locked door: Face Danger, +iron to force it, +shadow or +wits to pick it.
      doorWork: doorWork(stats),
      creatureTraits: ["human"],
      social: {
        pitches: {
          persuade: { skill: game.i18n.localize("FFIRONSWORN.CompelHeart"), mod: stats.heart },
          intimidate: { skill: game.i18n.localize("FFIRONSWORN.CompelIron"), mod: stats.iron },
          deceive: { skill: game.i18n.localize("FFIRONSWORN.CompelShadow"), mod: stats.shadow }
        },
        resist: Object.fromEntries(["persuade", "intimidate", "deceive"].map(k => [k, { dc: 12, label: game.i18n.localize("FFIRONSWORN.Heart") }])),
        resolve: stats.heart - 2,
        languages: ["common"]
      },
      leadership: { id: tokenDoc.id, name: actor.name, heart: stats.heart, pc: true }
    };
  }

  async #foe(tokenDoc, actor) {
    const track = actor.items.find(i => i.type === "progress");
    const rank = Number(track?.system.rank) || 2;
    const n = foeNumbers({ id: tokenDoc.id, rank, current: track?.system.current ?? 0 });
    const nature = this.#nature(actor, track, await this.#folderOf(actor));
    const derived = deriveIronswornTraits({ pc: false, rank: n.rank, nature, dsid: foeDsid(actor, track), name: actor.name });
    const talks = speaks(nature);
    return {
      id: tokenDoc.id,
      tokenId: tokenDoc.id,
      actorId: actor.id,
      actorUuid: actor.uuid,
      name: tokenDoc.name ?? actor.name,
      img: tokenDoc.texture?.src ?? actor.img,
      kind: "npc",
      level: n.level,
      rank: n.rank,
      nature,
      progressItemId: track?.id ?? null,
      hp: n.hp,
      defenses: { ac: 10, fortitude: n.rank, reflex: n.rank, will: n.rank },
      shield: null,
      initiative: { mod: n.rank - 2 },
      speeds: { walk: 30 },
      actions: n.actions,
      iwr: n.iwr,
      resources: {},
      traits: Object.fromEntries(Object.entries(derived.traits).map(([k, v]) => [k, { base: v, fudge: 0 }])),
      traitReasons: derived.reasons,
      flags: { ...derived.flags },
      diesAtZero: true,
      perception: n.rank,
      creatureTraits: [nature],
      creatureKind: nature, // (the planner groups neutrals by it)
      // (No spells, but powers of that kind: horrors and the Firstborn are what a Puzzle-Maniac goes for as casters.)
      caster: nature === "horror" || nature === "firstborn",
      social: {
        pitches: talks ? Object.fromEntries(["persuade", "intimidate", "deceive"].map(k => [k, { skill: game.i18n.localize("FFIRONSWORN.Compel"), mod: n.rank - 1 }])) : {},
        // (Compelling a foe in the middle of a fight is hard, and the harder the higher its rank.)
        resist: Object.fromEntries(["persuade", "intimidate", "deceive"].map(k => [k, { dc: 12 + 2 * n.rank, label: game.i18n.localize("FFIRONSWORN.Rank") }])),
        resolve: n.rank - 2,
        languages: talks ? ["common"] : [],
        mindless: nature === "machine"
      },
      // (Nothing to pay with: made to give something up, it gives ground, a mark of progress on its track. It may ask
      // for Supply, as a raider would: what one of the side it asks pays, all of them have that much less of.)
      valuables: { money: 0, denominations: [{ label: game.i18n.localize("IRONSWORN.Supply"), value: 1 }], stowed: [], wielded: [], progress: 1 },
      leadership: { id: tokenDoc.id, name: actor.name, rank: n.rank, pc: false }
    };
  }

  /** The folder a foe's compendium entry is filed under (Animals, Horrors ...), or "". */
  async #folderOf(actor) {
    const source = actor._stats?.compendiumSource ?? actor.flags?.core?.sourceId ?? null;
    if ( !source ) return "";
    if ( this.#folders.has(source) ) return this.#folders.get(source);
    let name = "";
    try {
      const doc = await fromUuid(source);
      name = doc?.folder?.name ?? "";
    } catch ( err ) {
      name = "";
    }
    this.#folders.set(source, name);
    return name;
  }

  /**
   * What a character's system says for setting it up by itself (auto.js): a character's assets (by the system's ids), a
   * foe's nature (by its id, where its compendium files it, as read for its spec, or its words).
   */
  #facts(actor) {
    if ( actor.type === "character" ) {
      const ids = actor.items.filter(i => i.type === "asset").map(i => String(i.flags?.["foundry-ironsworn"]?.dsid ?? ""));
      return { assets: ids.map(assetKey).filter(Boolean), rituals: ids.filter(id => id.includes("/ritual/")).length };
    }
    return { nature: this.#nature(actor, actor.items.find(i => i.type === "progress")) };
  }

  /**
   * What kind of foe it is: by its id (Ironlanders, Animals, Horrors ...; Starforged's by what the book says each is),
   * else the folder its compendium files it under (as read for its spec, unless given), else its words.
   */
  #nature(actor, track, folder = null) {
    const source = actor._stats?.compendiumSource ?? actor.flags?.core?.sourceId ?? null;
    return natureOf({ dsid: foeDsid(actor, track), folder: folder ?? this.#folders.get(source) ?? "", name: actor.name, text: plainText(track?.system.description) });
  }

  /**
   * What a character's sheet says of who it is, for its traits (traits.js): its stats; its assets (by the system's id
   * for each, else their names), what kind each is and how many of its abilities are marked; its debilities or impacts;
   * its bonds (Ironsworn) or connections (Starforged); its vows; its legacies; and the system's words for them.
   */
  #traitFacts(actor, ruleset = this.#ruleset(actor)) {
    const sys = actor.system ?? {};
    const assets = actor.items.filter(i => i.type === "asset").map(i => ({ ...assetOf(i), enabled: (i.system?.abilities ?? []).filter(a => a?.enabled).length }));
    const progress = actor.items.filter(i => i.type === "progress");
    const debility = sys.debility ?? {};
    const debilities = Object.keys(debility).filter(k => debility[k] === true);
    // (The sheet's own word: an Ironsworn sheet's debilities, a Starforged sheet's impacts.)
    const label = k => {
      const keys = [`IRONSWORN.DEBILITY.${capital(k)}`, `IRONSWORN.IMPACT.${capital(k)}`];
      return (ruleset === "classic" ? keys : keys.reverse()).map(systemWord).find(Boolean) ?? k;
    };
    const LEGACIES = ["quests", "bonds", "discoveries"];
    return {
      pc: true,
      ruleset,
      stats: Object.fromEntries(["edge", "heart", "iron", "shadow", "wits"].map(k => [k, Number(sys[k]) || 0])),
      assets,
      debilities,
      bonds: actor.items.filter(i => i.type === "bondset").reduce((n, i) => n + (i.system?.bonds?.length ?? 0), 0),
      connections: progress.filter(i => i.system?.subtype === "bond").map(i => ({ bonded: !!i.system.completed })),
      vows: progress.filter(i => i.system?.subtype === "vow").map(i => ({ rank: Number(i.system.rank) || 1, completed: !!i.system.completed })),
      legacies: Object.fromEntries(LEGACIES.map(k => [k, Number(sys.legacies?.[k]) || 0])),
      names: {
        debilities: Object.fromEntries(debilities.map(k => [k, label(k)])),
        bonds: systemWord("IRONSWORN.ITEMS.TypeBond"),
        connections: systemWord("IRONSWORN.ITEMS.SubtypeConnection"),
        vows: systemWord("IRONSWORN.ITEMS.SubtypeVow"),
        legacies: Object.fromEntries(LEGACIES.map(k => [k, systemWord(`IRONSWORN.LEGACY.${capital(k)}`)])),
        ranks: Object.fromEntries(Object.entries(RANK_KEYS).map(([r, k]) => [r, systemWord(`IRONSWORN.CHALLENGERANK.${k}`)]))
      }
    };
  }

  /** The playstyles Ironsworn says fit it (auto.js). */
  playstyleHints(actor) {
    return ironswornHints(this.#facts(actor));
  }

  /**
   * Its own answers to the tactics questions, and what it offers and expects (auto.js): a character's from its assets
   * (the abilities marked on them, and the moves they make), its stats and its supply; a foe's from its nature and its
   * kind (its id).
   */
  tacticHints(actor, spec, calc) {
    return ironswornTactics(this.#tacticFacts(actor, spec), calc);
  }

  /**
   * What the tactics answers are read from (auto.js): a character's stats, its supply and its assets (by the system's id
   * for each, else their names; its kind; its name; each ability marked or not, and the moves its text links to); a
   * foe's nature (as read for its spec), its kind (its id's last part), its name and its rank.
   */
  #tacticFacts(actor, spec) {
    if ( actor.type === "character" ) {
      const sys = actor.system ?? {};
      return {
        pc: true,
        stats: Object.fromEntries(["edge", "heart", "iron", "shadow", "wits"].map(k => [k, Number(sys[k]) || 0])),
        supply: supplyOf(actor),
        assets: actor.items.filter(i => i.type === "asset").map(i => ({
          ...assetOf(i),
          abilities: (i.system?.abilities ?? []).map(a => ({ marked: !!a?.enabled, moves: abilityMoves(a?.description) }))
        }))
      };
    }
    const track = actor.items.find(i => i.type === "progress");
    return {
      pc: false,
      nature: spec?.nature ?? this.#nature(actor, track),
      key: foeId(foeDsid(actor, track))?.key ?? null,
      name: actor.name,
      rank: Number(track?.system.rank) || 2
    };
  }

  /**
   * Its words, for the keywords (auto.js): a Starforged sheet's characteristics are said of the character itself; its
   * notes, an Ironsworn sheet's notes (kept as its biography) and its vows are its story. A foe's description is about
   * it; its quest starter is a story.
   */
  biography(actor) {
    if ( actor.type !== "character" ) return foeBiography(actor.items.find(i => i.type === "progress")?.system.description);
    return characterBiography({
      classic: this.#ruleset(actor) === "classic",
      biography: actor.system?.biography,
      notes: actor.system?.notes,
      vows: actor.items.filter(i => i.type === "progress" && i.system?.subtype === "vow").map(i => ({ name: i.name, description: i.system.description }))
    });
  }

  /** Its personality (traits.js): a character's from everything on its sheet; a foe's from what it is and its rank. */
  deriveTraits(actor) {
    if ( actor.type === "character" ) return deriveIronswornTraits(this.#traitFacts(actor));
    const track = actor.items.find(i => i.type === "progress");
    return deriveIronswornTraits({ pc: false, rank: track?.system.rank ?? 2, nature: this.#nature(actor, track), dsid: foeDsid(actor, track), name: actor.name });
  }

  detectLeaders(specs) {
    return rankIronswornLeaders(specs.map(s => s.leadership).filter(Boolean));
  }

  /**
   * How this encounter is tracked: the planner's answers (setup.system), else the defaults. One track for the encounter
   * where any character plays Starforged's moves, at its most dangerous foe's rank, kept on the party's leader (else
   * its first character); else each foe's own.
   */
  #conflict({ roster, resolved, setup, leaderId = null }) {
    const sideOf = e => resolved[e.token.id];
    const friendly = roster.filter(e => sideOf(e) === "friendly" && e.spec.mover);
    const foes = roster.filter(e => sideOf(e) && sideOf(e) !== "friendly" && sideOf(e) !== "neutralParty" && !e.spec.mover && !e.spec.hazard);
    const asked = setup.system ?? {};
    const mode = TRACK_MODES.includes(asked.track) ? asked.track : defaultMode(friendly.map(e => e.spec.ruleset));
    const rank = rankOf(asked.rank) ?? defaultRank(foes.map(e => e.spec.rank));
    const holder = friendly.find(e => e.token.id === asked.holder) ?? friendly.find(e => e.token.id === leaderId) ?? friendly[0] ?? null;
    return { mode, rank, holder, friendly, foes };
  }

  /** The planner's Ironsworn section: how the encounter is tracked, and (one track) its rank and who keeps it. */
  plannerSettings({ roster, setup, resolved, chains }) {
    const plan = this.#conflict({ roster, resolved, setup, leaderId: chains?.friendly?.[0]?.id ?? null });
    const fields = [{
      key: "track", type: "pills", label: t("Conflict.Track"), hint: t("Conflict.TrackHint"), value: plan.mode,
      choices: [
        { value: "encounter", label: t("Conflict.Encounter"), hint: t("Conflict.EncounterHint") },
        { value: "foes", label: t("Conflict.Foes"), hint: t("Conflict.FoesHint") }
      ]
    }];
    if ( plan.mode === "encounter" ) {
      fields.push({
        key: "rank", type: "pills", label: t("Conflict.Rank"), hint: t("Conflict.RankHint"), value: String(plan.rank),
        choices: Object.entries(RANK_KEYS).map(([r, k]) => ({ value: r, label: game.i18n.localize(`IRONSWORN.CHALLENGERANK.${k}`) }))
      });
      if ( plan.friendly.length ) {
        fields.push({
          key: "holder", type: "select", label: t("Conflict.Holder"), hint: t("Conflict.HolderHint"), value: plan.holder?.token.id ?? "",
          choices: plan.friendly.map(e => ({ value: e.token.id, label: e.spec.name }))
        });
      }
    }
    return { title: t("Conflict.Title"), hint: t("Conflict.Hint"), fields };
  }

  /**
   * One track for the encounter: every foe joins it (conflict.js), starting where the track kept on that character
   * stands (the one this scene's encounters keep there), and the battle is told where it's kept, for its live turns.
   */
  applyPlannerSettings(spec, settings, { roster, resolved, setup }) {
    const plan = this.#conflict({ roster, resolved, setup, leaderId: spec.command?.friendly?.[0]?.id ?? null });
    spec.options.system = { mode: plan.mode, rank: plan.rank, friendly: "friendly" };
    // (Its locked doors as tough as this conflict makes them: Ironsworn's harm, the setting; Starforged's, one hit.)
    spec.doors = doorsFor(spec.doors, { mode: plan.mode, harm: doorHarm() });
    if ( plan.mode !== "encounter" ) return;
    const actor = plan.holder?.token.actor ?? null;
    // (The battle's scene: its tokens', not whichever the GM looks at later.)
    const sceneId = plan.holder?.token.parent?.id ?? canvas.scene?.id ?? null;
    const track = actor ? encounterTrack(actor, sceneId) : null;
    const before = Number(track?.system.current) || 0;
    const onTrack = new Set(plan.foes.map(e => e.token.id));
    spec.combatants = spec.combatants.map(c => (onTrack.has(c.id) ? joinEncounter(c, { rank: plan.rank, current: before }) : c));
    Object.assign(spec.options.system, {
      before, foeIds: [...onTrack], holderTokenId: plan.holder?.token.id ?? null, holderName: plan.holder?.spec.name ?? "", trackId: track?.id ?? null, sceneId
    });
  }

  /** The encounter's track, for the planner's summary of a fight. */
  describeEncounter(spec, replay) {
    return describeEncounterTrack(spec.options?.system, replay);
  }

  get supportsLive() {
    return true;
  }

  /**
   * A token's sheet mid-fight: a character's debilities or impacts among its conditions (its spec's). A foe has none:
   * whatever the GM puts on one, FastFighting keeps. A foe on the encounter's one track: its hit points are the ticks
   * left on that track (on the character who keeps it, as the table marks it), not on a track of its own.
   */
  async readLiveState(tokenDoc, { spec = null } = {}) {
    const state = await super.readLiveState(tokenDoc);
    if ( state && tokenDoc.actor?.type !== "character" ) state.carries = () => false;
    const plan = spec?.options?.system;
    if ( !state || plan?.mode !== "encounter" || !(plan.foeIds ?? []).includes(tokenDoc.id) ) return state;
    const holder = plan.holderTokenId ? tokenDoc.parent?.tokens.get(plan.holderTokenId)?.actor : null;
    const track = holder ? keptTrack(holder, plan, tokenDoc.parent?.id) : null;
    const marked = Math.max(0, Math.min(TRACK, track ? Number(track.system.current) || 0 : Number(plan.before) || 0));
    state.hp = TRACK - marked;
    state.maxHp = TRACK;
    if ( state.status !== "dead" ) state.status = state.hp > 0 ? "standing" : "down";
    return state;
  }

  /** No initiative: the GM gives the spotlight to the character who acts. */
  get liveTurns() {
    return "spotlight";
  }

  /**
   * A character's sheet carries its debilities or impacts (written as system.debility.<id>, read back as the same key);
   * a foe's, none. The engine's own conditions the core keeps.
   */
  sheetCarries(key, actor) {
    return DEBILITY_KEYS.includes(key) && (!actor || actor.type === "character");
  }

  /**
   * A debility's or impact's name, the system's (its first letter in capitals, as a list shows it): its impact's word
   * first, as the system has it, unless the world plays Ironsworn alone.
   */
  conditionLabel(key) {
    if ( !DEBILITY_KEYS.includes(key) ) return null;
    const on = enabledRulesets();
    const keys = [`IRONSWORN.IMPACT.${capital(key)}`, `IRONSWORN.DEBILITY.${capital(key)}`];
    const word = (on.length && on.every(r => r === "classic") ? keys.reverse() : keys).map(systemWord).find(Boolean);
    return word ? `${word.charAt(0).toLocaleUpperCase(game.i18n.lang)}${word.slice(1)}` : null;
  }

  /**
   * The debilities and impacts of the rulesets the world has on (Sundered Isles: Starforged's; with none known, both),
   * then the core's own.
   */
  conditionChoices() {
    const on = enabledRulesets().map(r => (r === "classic" ? "classic" : "starforged"));
    const own = [...new Set((on.length ? on : Object.keys(DEBILITIES)).flatMap(r => DEBILITIES[r]))];
    // (One the core has too, cursed or doomed: the system's, whichever ruleset has it.)
    return [...own.map(key => ({ key })), ...super.conditionChoices().filter(c => !DEBILITY_KEYS.includes(c.key))];
  }

  /** A live battle: one turn's changes (commit.js commitIronswornChanges). */
  async commitChanges(tokenDoc, spec, changes, final, options) {
    return commitIronswornChanges(tokenDoc, spec, changes, final, options);
  }

  /** A live turn's progress on the encounter's track (one track for the encounter). */
  async commitTurn(before, after, options = {}) {
    return commitEncounterTurn(options.spec?.options?.system, before, after, options.events ?? []);
  }

  /** A character's spotlight, read from the ironsworn system's move cards (read-turn.js). */
  readTurn(messages, context) {
    return readIronswornTurn(messages, context);
  }

  /**
   * Ironsworn's words: no armor class and no levels; harm costs health (the system's word for it, else FastFighting's);
   * paying costs Supply.
   */
  term(key) {
    if ( key === "money" ) return game.i18n.localize("IRONSWORN.Supply");
    if ( key === "hp" ) return systemWord("IRONSWORN.Health");
    return ["ac", "level"].includes(key) ? false : null;
  }

  resourceLabel(key) {
    return key === "momentum" ? game.i18n.localize("FFIRONSWORN.Momentum") : null;
  }

  describeOutcome(spec, final) {
    return describeIronswornOutcome(spec, final);
  }

  async commitConcession(giverDoc, receiverDoc, concession, options) {
    return commitIronswornConcession(giverDoc, receiverDoc, concession, options);
  }
}
