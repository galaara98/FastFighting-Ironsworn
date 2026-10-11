/**
 * FastFighting Ironsworn: teaches FastFighting Core how Ironsworn and Starforged fight. Registers the
 * foundry-ironsworn adapter (characters and foes, the moves and their dice, personality defaults, leadership, Make it
 * So) through the core's public API.
 */
import { IronswornAdapter } from "./adapter.js";
import { registerLoreBoost } from "./lore.js";

export const MODULE_ID = "fast-fighting-ironsworn";

/** "Rules preference": follow the character sheets, or prefer one ruleset's moves when the names match. */
const PREFERENCES = ["sheet", "classic", "starforged", "sundered_isles"];

/** The core API this helper is written against (its system hooks for dice and moves of their own). */
const NEEDS_API = 7;

Hooks.once("init", () => {
  // How much a Lore-Collector's sizing a foe up pays off (lore.js).
  registerLoreBoost();
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
  // Endure Harm, Enter the Fray ...) that play differently: which one a character makes. Shown as pills, one on at a time.
  game.settings.register(MODULE_ID, "rulesPreference", {
    name: "FFIRONSWORN.Settings.rulesPreference.Name",
    hint: "FFIRONSWORN.Settings.rulesPreference.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: Object.fromEntries(PREFERENCES.map(k => [k, `FFIRONSWORN.Settings.rulesPreference.${k}`])),
    default: "sheet"
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

/** The rules preference as pills: one click, one on at a time (the setting's own select, hidden, keeps the value). */
Hooks.on("renderSettingsConfig", (app, element) => {
  const root = element instanceof HTMLElement ? element : element?.[0];
  const select = root?.querySelector(`select[name="${MODULE_ID}.rulesPreference"]`);
  if ( !select || select.nextElementSibling?.classList.contains("ffi-pills") ) return;
  const pills = document.createElement("div");
  pills.className = "ffi-pills";
  pills.setAttribute("role", "radiogroup");
  for ( const option of select.options ) {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "ffi-pill";
    pill.dataset.value = option.value;
    pill.textContent = option.textContent;
    pill.setAttribute("role", "radio");
    pills.append(pill);
  }
  const show = () => {
    for ( const pill of pills.children ) {
      const on = pill.dataset.value === select.value;
      pill.classList.toggle("active", on);
      pill.setAttribute("aria-checked", String(on));
    }
  };
  pills.addEventListener("click", event => {
    const pill = event.target.closest(".ffi-pill");
    if ( !pill || pill.disabled ) return;
    select.value = pill.dataset.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    show();
  });
  select.hidden = true;
  select.after(pills);
  show();
});

Hooks.once("ready", () => {
  if ( !game.modules.get("fast-fighting")?.active && game.user.isGM ) {
    ui.notifications.warn(game.i18n.localize("FFIRONSWORN.NeedsCore"));
  }
});
