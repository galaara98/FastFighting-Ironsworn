/**
 * FastFighting Ironsworn: teaches FastFighting Core how Ironsworn and Starforged fight. Registers the
 * foundry-ironsworn adapter (characters and foes, the moves and their dice, personality defaults, leadership, Make it
 * So) through the core's public API.
 */
import { IronswornAdapter } from "./adapter.js";

export const MODULE_ID = "fast-fighting-ironsworn";

/** The core API this helper is written against (its system hooks for dice and moves of their own). */
const NEEDS_API = 6;

Hooks.once("init", () => {
  // Ironsworn: a deadly weapon (a sword, an axe, a spear, a bow) inflicts 2 harm; unarmed or a simple weapon, 1.
  // Characters' sheets don't say what they carry, so the GM says what's usual at their table.
  game.settings.register(MODULE_ID, "deadlyWeapons", {
    name: "FFIRONSWORN.Settings.deadlyWeapons.Name",
    hint: "FFIRONSWORN.Settings.deadlyWeapons.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  // With more than one ruleset on, Ironsworn, Starforged and Sundered Isles have moves of the same name (Strike, Clash,
  // Endure Harm, Enter the Fray ...) that play differently: which one a character makes.
  game.settings.register(MODULE_ID, "rulesPreference", {
    name: "FFIRONSWORN.Settings.rulesPreference.Name",
    hint: "FFIRONSWORN.Settings.rulesPreference.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      classic: "FFIRONSWORN.Settings.rulesPreference.classic",
      starforged: "FFIRONSWORN.Settings.rulesPreference.starforged",
      sundered_isles: "FFIRONSWORN.Settings.rulesPreference.sundered_isles"
    },
    default: "classic"
  });
});

Hooks.once("fastFighting.init", api => {
  // module.json limits this module to foundry-ironsworn worlds; this guard covers anything that slips past.
  if ( game.system.id !== "foundry-ironsworn" ) {
    console.warn(`${MODULE_ID} | not an Ironsworn world (${game.system.id}); FastFighting Ironsworn stays inactive.`);
    return;
  }
  if ( (api.version ?? 1) < NEEDS_API ) {
    console.error(`${MODULE_ID} | FastFighting Core is too old for this version of FastFighting Ironsworn; update it.`);
    ui.notifications?.error(game.i18n.localize("FFIRONSWORN.CoreTooOld"), { permanent: true });
    return;
  }
  api.registerAdapter("foundry-ironsworn", IronswornAdapter, { priority: 10, source: MODULE_ID });
});

Hooks.once("ready", () => {
  if ( !game.modules.get("fast-fighting")?.active && game.user.isGM ) {
    ui.notifications.warn(game.i18n.localize("FFIRONSWORN.NeedsCore"));
  }
});
