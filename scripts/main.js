/**
 * FastFighting Ironsworn: teaches FastFighting Core how Ironsworn and Starforged fight. Registers the
 * foundry-ironsworn adapter (characters and foes, the moves and their dice, personality defaults, leadership, Make it
 * So) through the core's public API.
 */
import { IronswornAdapter } from "./adapter.js";

export const MODULE_ID = "fast-fighting-ironsworn";

/** The core API this helper is written against (its system hooks for dice and moves of their own). */
const NEEDS_API = 6;

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
