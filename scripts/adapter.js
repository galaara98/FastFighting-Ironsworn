/**
 * Ironsworn and Starforged adapter: reads foundry-ironsworn characters and foes into CombatantSpecs and commits
 * outcomes back. Written against foundry-ironsworn 1.28 on Foundry v14.
 *
 * A character: its stats, health and momentum (its reset and ceiling as its impacts leave them), a wound already
 * marked, who has the initiative if a fight is under way (Starforged's combat position), and whether it fights at
 * range (an asset like Archer or Gunner, or more edge than iron). Its moves: Strike and Clash (+iron close, +edge at
 * range), End the Fight (Take Decisive Action in Starforged), as its sheet's ruleset plays them; a move of the same name
 * in the ruleset the world prefers (the "Rules preference" setting, when that ruleset is on) is played that way.
 * A foe: its progress track (its rank, and the ticks already marked) and what it is (the folder its compendium files
 * it under: Ironlanders, Firstborn, Animals, Beasts, Horrors; or its words), which says whether it can be talked to and
 * how it fights.
 * The encounter (the planner's Ironsworn section, conflict.js): one track for it (Starforged's objective, at the rank
 * the GM gives it, kept on one of the characters) or each foe's own (Ironsworn's).
 */
import { SystemAdapter } from "./core.js";
import { ironswornRules } from "./rules.js";
import { characterMoves, foeNumbers, loreSizeUp } from "./build.js";
import { loreBoost } from "./lore.js";
import { movesFor } from "./moves.js";
import { deriveIronswornTraits, natureOf, speaks } from "./traits.js";
import { rankIronswornLeaders } from "./leadership.js";
import { commitIronswornOutcome, describeIronswornOutcome, commitIronswornConcession, supplyOf, meterOf, encounterTrack, describeEncounterTrack, commitEncounterTrack } from "./commit.js";
import { TRACK_MODES, RANK_KEYS, defaultMode, defaultRank, rankOf, joinEncounter } from "./conflict.js";
import { t, moveName, statName } from "./words.js";

/** Assets (and the like) for fighting at range. */
const RANGED = /\b(?:archer|bow|crossbow|sling(?:er)?|javelin|gunner|gunslinger|sniper|sidearm|long-?arm|blaster|rifle|pistol|marksman|shooter|spear-?thrower)\b/i;
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
const plain = html => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

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
    const ranged = assets.some(a => RANGED.test(a.name)) || stats.edge > stats.iron;
    const health = Number(sys.health?.value ?? 5);
    const position = sys.combatPosition;
    const derived = deriveIronswornTraits({ pc: true, stats });
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
      actions: characterMoves({ id: tokenDoc.id, stats, ruleset, ranged, moves: moveRules, extraHarm: deadlyWeapons() ? 1 : 0 }),
      iwr: { immune: [], weak: {}, resist: {} },
      resources: { momentum: Number(sys.momentum?.value ?? 2) },
      momentumReset: Number(sys.momentumReset ?? sys.momentum?.resetValue ?? 2),
      momentumMax: Number(sys.momentumMax ?? sys.momentum?.max ?? 10),
      wounded: !!sys.debility?.wounded,
      // Spirit, for stress (mental shock, despair); shaken, already.
      spirit: { value: meterOf(actor, "spirit"), max: Number(sys.spirit?.max ?? 5) || 5 },
      shaken: !!sys.debility?.shaken,
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
    const folder = await this.#folderOf(actor);
    const nature = natureOf({ folder, name: actor.name, text: plain(track?.system.description) });
    const derived = deriveIronswornTraits({ pc: false, rank: n.rank, nature });
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
      // (Nothing to pay with: made to give something up, it gives ground, a mark of progress on its track.)
      valuables: { money: 0, denominations: null, stowed: [], wielded: [], progress: 1 },
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

  deriveTraits(actor) {
    if ( actor.type === "character" ) {
      const sys = actor.system;
      return deriveIronswornTraits({ pc: true, stats: { edge: sys.edge, heart: sys.heart, iron: sys.iron, shadow: sys.shadow, wits: sys.wits } });
    }
    const track = actor.items.find(i => i.type === "progress");
    return deriveIronswornTraits({ pc: false, rank: track?.system.rank ?? 2, nature: natureOf({ name: actor.name, text: plain(track?.system.description) }) });
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
   * stands (the one this scene's encounters keep there), and Make it So is told where it's kept.
   */
  applyPlannerSettings(spec, settings, { roster, resolved, setup }) {
    const plan = this.#conflict({ roster, resolved, setup, leaderId: spec.command?.friendly?.[0]?.id ?? null });
    spec.options.system = { mode: plan.mode, rank: plan.rank, friendly: "friendly" };
    if ( plan.mode !== "encounter" ) return;
    const actor = plan.holder?.token.actor ?? null;
    const track = actor ? encounterTrack(actor, canvas.scene?.id) : null;
    const before = Number(track?.system.current) || 0;
    const onTrack = new Set(plan.foes.map(e => e.token.id));
    spec.combatants = spec.combatants.map(c => (onTrack.has(c.id) ? joinEncounter(c, { rank: plan.rank, current: before }) : c));
    Object.assign(spec.options.system, {
      before, foeIds: [...onTrack], holderTokenId: plan.holder?.token.id ?? null, holderName: plan.holder?.spec.name ?? "", trackId: track?.id ?? null
    });
  }

  /** The encounter's track, for Make it So's confirmation. */
  describeEncounter(spec, replay) {
    return describeEncounterTrack(spec.options?.system, replay);
  }

  /** The encounter's track, written on the character who keeps it. */
  async commitEncounter(spec, replay, options) {
    return commitEncounterTrack(spec.options?.system, replay);
  }

  /** Ironsworn's words: no armor class; paying costs Supply. */
  term(key) {
    if ( key === "money" ) return game.i18n.localize("IRONSWORN.Supply");
    return key === "ac" ? false : null;
  }

  resourceLabel(key) {
    return key === "momentum" ? game.i18n.localize("FFIRONSWORN.Momentum") : null;
  }

  async commitOutcome(tokenDoc, spec, final, options) {
    return commitIronswornOutcome(tokenDoc, spec, final, options);
  }

  describeOutcome(spec, final) {
    return describeIronswornOutcome(spec, final);
  }

  async commitConcession(giverDoc, receiverDoc, concession, options) {
    return commitIronswornConcession(giverDoc, receiverDoc, concession, options);
  }
}
