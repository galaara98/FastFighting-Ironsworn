/**
 * FastFighting Ironsworn: teaches FastFighting Core how Ironsworn and Starforged fight. Registers the
 * foundry-ironsworn adapter (characters and foes, the moves and their dice, personality defaults, leadership, live
 * battles) through the core's public API.
 */
import { IronswornAdapter } from "./adapter.js";
import { registerLoreBoost } from "./lore.js";
import { DOOR_HARM } from "./conflict.js";
import { hideBurn } from "./system-roll.js";

export const MODULE_ID = "fast-fighting-ironsworn";

/** "Rules preference": follow the character sheets, or prefer one ruleset's moves when the names match. */
const PREFERENCES = ["sheet", "classic", "starforged", "sundered_isles"];

/**
 * The core API majors this helper is known to work with (the core's api.major). Its own call: the core never refuses a
 * helper. Older than the oldest, it doesn't run (it uses what came since); any other it doesn't know, it runs, and the
 * GM is told it hasn't been tried with that core yet. Add a major once this helper has been tried with it.
 */
const KNOWN_API = Object.freeze([19]);

/** The core's API major, when it's one this helper doesn't know: the GM is told when the world is ready. */
let untested = null;

/**
 * The last translation module we knew of for this game system, by language: in a language other than English, this
 * module's settings recommend it when it isn't on (FastFighting Core's api.adviseTranslation). None known yet.
 */
const KNOWN_TRANSLATIONS = {};

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
  // Ironsworn: how much harm a locked door stands up to, hacked at (conflict.js doorsFor). Starforged's door is a step
  // of progress, one hit, whatever this says.
  game.settings.register(MODULE_ID, "doorHarm", {
    name: "FFIRONSWORN.Settings.doorHarm.Name",
    hint: "FFIRONSWORN.Settings.doorHarm.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: DOOR_HARM.min, max: DOOR_HARM.max, step: DOOR_HARM.step },
    default: DOOR_HARM.default
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
  const major = Number(api.major) || 0;
  if ( major < Math.min(...KNOWN_API) ) {
    console.error(`${MODULE_ID} | FastFighting Core is too old for this version of FastFighting Ironsworn; update it.`);
    ui.notifications?.error(game.i18n.localize("FFIRONSWORN.CoreTooOld"), { permanent: true });
    return;
  }
  if ( !KNOWN_API.includes(major) ) untested = major;
  api.registerAdapter("foundry-ironsworn", IronswornAdapter, { priority: 10, source: MODULE_ID });
  api.adviseTranslation(MODULE_ID, game.system.title, KNOWN_TRANSLATIONS);
  // Words kept in English for now, while the system isn't translated (hardcoded-toEN.json).
  api.keepEnglish(MODULE_ID);
});

// The cards FastFighting rolls in its turns: no burn button on them, which would change the sheet and not the turn
// (system-roll.js).
Hooks.on("renderChatMessageHTML", hideBurn);

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
  if ( untested !== null && game.user.isGM ) ui.notifications.warn(game.i18n.format("FFIRONSWORN.CoreUntested", { major: untested }));
  if ( !game.modules.get("fast-fighting")?.active && game.user.isGM ) {
    ui.notifications.warn(game.i18n.localize("FFIRONSWORN.NeedsCore"));
  }
});
