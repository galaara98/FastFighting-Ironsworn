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
 */
import { SystemAdapter } from "./core.js";
import { ironswornRules } from "./rules.js";
import { characterMoves, foeNumbers } from "./build.js";
import { movesFor } from "./moves.js";
import { deriveIronswornTraits, natureOf, speaks } from "./traits.js";
import { rankIronswornLeaders } from "./leadership.js";
import { commitIronswornOutcome, describeIronswornOutcome } from "./commit.js";

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
    return "Ironsworn / Starforged";
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
      defenses: { ac: 10, fortitude: stats.iron, reflex: stats.edge, will: stats.heart },
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
      control: position === "inControl" ? true : position === "inABadSpot" ? false : undefined,
      traits: Object.fromEntries(Object.entries(derived.traits).map(([k, v]) => [k, { base: v, fudge: 0 }])),
      traitReasons: derived.reasons,
      flags: { ...derived.flags },
      diesAtZero: false,
      perception: stats.wits,
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
      social: {
        pitches: talks ? Object.fromEntries(["persuade", "intimidate", "deceive"].map(k => [k, { skill: game.i18n.localize("FFIRONSWORN.Compel"), mod: n.rank - 1 }])) : {},
        // (Compelling a foe in the middle of a fight is hard, and the harder the higher its rank.)
        resist: Object.fromEntries(["persuade", "intimidate", "deceive"].map(k => [k, { dc: 12 + 2 * n.rank, label: game.i18n.localize("FFIRONSWORN.Rank") }])),
        resolve: n.rank - 2,
        languages: talks ? ["common"] : [],
        mindless: nature === "machine"
      },
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

  /** Ironsworn has no encounter budget to compare with. */
  difficultyCrossCheck() {
    return null;
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
}
