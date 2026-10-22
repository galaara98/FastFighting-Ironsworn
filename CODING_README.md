# FastFighting Ironsworn: developer notes

How this helper plugs into FastFighting Core and how it works inside. For play, see [README.md](README.md). The core's API is in its [developer docs](https://github.com/galaara98/FastFighting/blob/main/CODING_README.md).

## How it plugs in

`module.json` loads `scripts/main.js` (an ES module), `styles/ironsworn.css` and `languages/en.json`. It requires FastFighting Core 0.4.0 or later and the `foundry-ironsworn` system 1.20.0 or later. `scripts/core.js` is the module's only import of the core: it re-exports `../../fast-fighting/scripts/core-api.js`, since both modules sit side by side in `Data/modules`.

`main.js` hooks:

- `init`: registers four world settings. `loreBoost` (lore.js, through the core's `numberSetting`: 1.25 to 3, step 0.05, default 2.35); `deadlyWeapons` (Boolean, default true); `doorHarm` (Number, 1 to 3, step 1, default 3: conflict.js `DOOR_HARM`); `rulesPreference` (String: `sheet`, `classic`, `starforged` or `sundered_isles`; default `sheet`).
- `fastFighting.init`: stays inactive outside `foundry-ironsworn` worlds. The core's API version is `major.bug` (`api.version` "24.0", `api.major`, `api.bug`), and whether this helper works with a core is its own call (the core never refuses a helper): `KNOWN_API` lists the majors it's known to work with ([24]). Older than the oldest, it shows a permanent error (`FFIRONSWORN.CoreTooOld`) and stays out; any other major it doesn't know, it runs with, and the GM is told once at ready (`FFIRONSWORN.CoreUntested`). Add a major to `KNOWN_API` once the helper has been tried with it. Then `api.registerAdapter("foundry-ironsworn", IronswornAdapter, { priority: 10, source: MODULE_ID })`, `api.adviseTranslation(MODULE_ID, game.system.title, KNOWN_TRANSLATIONS)` (no translation module known yet) and `api.keepEnglish(MODULE_ID)` (hardcoded-toEN.json).
- `renderChatMessageHTML`: a card FastFighting rolled loses its burn button (system-roll.js `hideBurn`, below).
- `renderSettingsConfig`: shows `rulesPreference` as pills (`.ffi-pills`, a radiogroup); the select, hidden, keeps the value.
- `ready`: warns a GM when FastFighting Core isn't active (`FFIRONSWORN.NeedsCore`).

What it takes up of the core since API 19:
- **20:** every move a character makes is a table roll a live battle shows. A roll the core makes through `rules.roll` returns `shown` (the core's `split`): the action die with its score (at most 10), then each challenge die as a roll of its own; a progress roll, the challenge dice alone. The moves the rules roll themselves go through `moveRoll` (rules.js), recorded with the move's name: Endure Harm, Face Death, Endure Stress, Face Desolation, Face Danger (breaking free, a door, a provoked character's) and Enter the Fray. The harm and stress tables' d100s are recorded too (`tableD100`: `FFIRONSWORN.Rolls.HarmTable`, `.StressTable`), and `persistentFlatCheck` (a d10, 6 or more, as a flat check). The Statistics Engine's own randoms stay unrecorded: `harmsWay`'s shuffle and chances, provoke's `goadLuck` d100 and `tauntProof` chance, the rush chance. The draws are the same as before.
- **22:** `workerRules()` gives the planner's background workers `rules.js`'s `ironswornRules`: it and what it imports touch nothing of Foundry's, and the world's settings reach the rules through the specs. `tests/workers-ironsworn.test.js` plays batches on real threads.
- **23:** `spec.aptitudes` for a character (traits.js `aptitudesOf`: its stats as they stand, 0 to 4; wits smart and wise, iron strong, edge fast, heart charismatic). A foe has none: the core's reading (`flags.beast` an animal's wits; a machine mindless).

When new functionality needs something the core can't handle "close enough" with what it already offers, request a new core hook. Don't force a poor fit or work around the core.

## Files

| File | What it holds |
| --- | --- |
| `adapter.js` | `IronswornAdapter`: characters and foes as CombatantSpecs, the planner's Conflict row, live battles |
| `rules.js` | `ironswornRules`, the engine's rules object; `DEBILITIES`, `DEBILITY_KEYS`, `endureStress`, `progressScore` |
| `moves.js` | the dice and each ruleset's moves: `TICKS`, `TRACK`, `MOMENTUM`, `RULESETS`, `movesFor`, `grade`, `chances`, `burnGrade`, `harmTable`, `stressTable` |
| `build.js` | a character's stats (`STATS`; `SAVE_STATS`, `COMPEL_STATS`: the stat a save or a way of talking stands for), its actions (`characterMoves`, `healMove`, `advantageMoves`, `loreSizeUp`, `doorWork`) and a foe's numbers (`foeNumbers`) |
| `conflict.js` | the encounter's track: `TRACK_MODES`, `RANK_KEYS`, `STEPS`, `defaultMode`, `defaultRank`, `joinEncounter`, `trackProgress`; doors: `DOOR_HARM`, `doorsFor` |
| `commit.js` | live-battle writes, concessions, the encounter's track, the planner's outcome lines |
| `read-turn.js` | a player's turn, read from the system's move cards |
| `system-roll.js` | a live battle's saves and checks, rolled the system's way: `moveFor`, `rolledOf`, `rollIronswornMove` |
| `traits.js` | personality; a foe's nature (`natureOf`, `speaks`, `foeId`) |
| `auto.js` | setting a character up by itself: playstyle hints, tactics answers, its words for the keywords |
| `leadership.js` | who leads |
| `lore.js` | the Lore-Collector setting |
| `words.js` | `t`, `moveName`, `statName` |

`rules.js`, `moves.js`, `build.js`, `conflict.js`, `traits.js`, `auto.js` and `leadership.js` are pure (no Foundry globals) and unit-tested.

## Numbers

- **Action roll:** a d6 + stat + adds, at most 10, against two d10s. Degrees: 3 a strong hit, 2 a weak hit, 1 a miss, 0 a miss on matching dice. A DC becomes adds, `round((10 - DC) / 3)`; the core's advantage is one add either way. A total changed after the dice (the engine's Luck) grades 8 or more strong, 4 or more weak. `rollPoint` 0.25: a point on this roll moves about a quarter more hits.
- **Progress roll:** the progress score (whole boxes, 0 to 10) against the challenge dice; momentum can't change it.
- **Tracks:** 40 ticks (`TRACK`). One mark at rank 1 to 5 fills `TICKS` 12, 8, 4, 2, 1 ticks.
- **Momentum** (`MOMENTUM`): -6 to 10, reset 2; the sheet's reset and max come first. The reset is worked out as the system does: the sheet's reset value (`momentumResetValue`) less one for each debility or impact marked now, those marked in this fight among them.
- **Harm table** (d100: at 0 health, already wounded, on a missed Endure Harm): 1-10 mortal (Face Death, +heart), 11-20 dying, 21-35 out cold, 36-50 reeling (-1 momentum), 51-100 still standing.
- **Stress table** (d100: at 0 spirit, already shaken): 1-10 overwhelmed (Face Desolation, +heart), 11-50 falters (-1 momentum), 51-100 perseveres.
- **`STEPS`** (successes to talk a foe round, by the encounter's rank): 2, 3, 6, 12, 24: the marks that fill the track to six boxes, where a progress roll is likelier to win than not.
- **End the Fight** is usable in control at a progress score of 5 (a foe's own track) or 7 (the encounter's), 2 less when hurried.
- **Pay the Price:** the foe's rank in harm, +1 on matching dice, +1 on a missed finish. A horror's is stress.
- **A fall:** 1 harm per 10 feet, at most 3; no prone. A condition's harm each turn: 1.

## The character spec

`#character` builds: `kind: "pc"`, `mover: true`, `level: 1`, `ruleset` (the sheet's), `moveRules` (`movesFor(ruleset, preference, enabledRulesets())`), `stats`, `hp` from health, `defenses` (ac 10, fortitude iron, reflex edge, will heart, and every stat by name, for Face Danger), `initiative: {mod: wits, stealth: shadow}`, `actions` (`characterMoves`; `extraHarm` 1 with deadly weapons), `resources.momentum`, `momentumReset`, `momentumResetValue` (before its impacts), `momentumMax`, `wounded`, `spirit`, `shaken`, `conditions` (every debility marked), `control` (from `system.combatPosition`: `inControl` true, `inABadSpot` false, else undefined), `valuables` (Supply as money, `pooled`), `traits` and `traitReasons`, `diesAtZero: false`, `perception` (wits), `sizeUp`, `theft` (Face Danger, +shadow), `doorWork` (force +iron; pick the better of +shadow and +wits), `social` (pitches: Compel by heart, iron, shadow; resisted at DC 12 by heart; `resolve` heart - 2; language common) and `leadership`.

A character fights at range when any asset passes `rangedAsset` (auto.js `ASSET_TACTICS` style `ranged`) or its edge beats its iron. `healerAsset` (Herbalist, Healer) makes its Heal a specialty; any asset makes Securing an Advantage one.

## The foe spec

`#foe`: its first progress item is its track (rank 2 if none). `kind: "npc"`, `level` and `rank` (1 to 5), `nature`, `progressItemId`, `hp` (40 less the ticks marked), `iwr.ticksPerHarm` (`TICKS[rank]`), defenses at its rank, `initiative.mod` rank - 2, one plain attack (rank + 2, harm equal to its rank) for anyone who isn't a character, `diesAtZero: true`, `perception` (rank), `creatureTraits` and `creatureKind` (its nature: the planner groups neutrals by it), `caster` for horrors and the Firstborn, `social` (for people and the Firstborn, pitches by Compel at rank - 1; resisted at DC 12 + 2 × rank; `resolve` rank - 2; `mindless` for machines) and `valuables` (no money; `progress: 1`, so it gives ground).

`natureOf` reads its Datasworn id's collection (`ironlanders`, `firstborn`, `animals`, `beasts`, `horrors`, `anomalies`) or a Starforged sample foe's key (`STARFORGED_NATURES`), else its compendium folder (`#folderOf`, cached, through `fromUuid` of its compendium source), else its name and track description; the default is people.

## The ruleset and its moves

`#ruleset(actor)` reads the sheet class name (the open sheet, else `_getSheetClass()` or `flags.core.sheetClass`): `/starforged/` is `starforged` (`sundered_isles` when that's on and Starforged isn't), `/ironsworn/` is `classic`. Any other sheet goes by the world's `foundry-ironsworn` `ruleset-*` settings, classic first.

`movesFor(own, preference, enabled)` starts from the character's ruleset (`RULESETS`). With a preferred ruleset that's on, each of that ruleset's own moves (`OWN_MOVES`; Sundered Isles has only `fray`) replaces the one with the same key. Then it names the moves in the reader's language. The `control` words (has initiative, is in control) stay the character's own.

Each ruleset's table in moves.js: `strike` and `clash` (progress or harm on a strong and a weak hit; `harm` when the weapon's harm counts, Ironsworn only), `finish`, `advantage` (`next` and `momentum` on a strong and a weak hit), `aid`, `fray` (its stats, besides +shadow and +wits in an ambush; `missMomentum`), `endure` (`shakeCost`, `weakTrade`, `miss`), `price`, `face`, `stress`, `desolation`, `control`.

## The rules object

`ironswornRules` (rules.js), by area:

- **Turn:** one move a turn (`turn`, `costOf`, `basicAction`, `talkCost`, `tauntCost`, `stealCost`); `feintCost` free; `standCost` 15 feet; `mainPool` "action", `movement` "feet".
- **Rolls:** `roll`, `distribution`, `degreeOfSuccess`, `asRolled` (a roll the system made: its challenge dice, for the story), `attackPenalty` 0, `rollPoint`; `modifiers.attack` gives a finish the foe's progress score.
- **Conditions:** `ownConditions` (`DEBILITY_KEYS`: the core's bonuses and penalties don't apply); `initUnit` makes wounded and shaken read and write the condition of that key (`playedAsCondition`), and sets spirit, `momentumMax` and `control`; `conditionWeight` 0, `conditionMods` null; `storyCondition` (`STORY_DEBILITIES`: wounded as the story's bloodied, shaken, maimed, permanently harmed as maimed, the rest not told).
- **Harm:** `applyIwr` (harm times the ticks per harm on a track: the foe's, or the encounter's as the fight has left it), `conditionHarm`, `fallDamage`, `fallProne` false, `minimumDamage` 0, `critical` (no extra), `saveMultiplier` (a Face Danger save clears on any hit, other saves on a strong hit), `healCheckMultiplier`.
- **Moves:** `usable`, `gainResource`, `resourceWorth` (a point of momentum: 0.2 of a Strike's expected ticks), `onOutcome` (`price`, `takeControl`), `canTarget` (foes target only non-characters; hazards anyone), `initRun` (a hazard's strikes become Face Danger +edge saves), `startTurn` (`settleJoins`, `enterTheFray`, hurry, `provoke`), `adjustRoll` (burning momentum; on a save the system rolled, burned on its card first: below), `afterRoll` (control; Heal's and a hazard's costs; a finish's outcome, `objectiveLost` on the encounter's track), `backlash` (Pay the Price, `harmsWay`), `afterTalk` (Compel), `afterHarm` (Endure Harm), `onFall` (Endure Stress for the characters on its side who see it, `coverOf` short of total, or are within 60 feet, `edgeDistance`; without positions, all of them), `onAllegiance`.
- **Surprise (API 19):** `surprise` (the planner's Follow System: a side with hidden tokens ambushes, `by`) and `surpriseRound: false` (no rounds: the plan's own choices give surprise without one); `enterTheFray` reads `run.surprise.by`: +shadow for the ambushers, +wits for the ambushed.
- **Down:** `onDropped` (a foe is beaten; a character fights on, the overflow off its momentum), `onHealed`, `recoveryCheck` null, `persistentFlatCheck`, `retreatAt` 0.01.
- **Holds and doors:** `breakFree` and `tryDoor`, both through `faceDanger`; `door` (ac 10, hp 3, force and pick DC 10); `doorCosts`.
- **Live:** `nextSpotlight` (the next character able to act after the last to have it; foes only when no character can act); `capture` (spirit, shaken, momentum, wounded, control, deathbound, burned).
- **Story:** `storyDamageType` (harm is told as bludgeoning).
- **Also:** `typical`, `isImmune`, `resistShare` 0.5.

## The adapter

`IronswornAdapter extends SystemAdapter`, `systemId` "foundry-ironsworn":

- `canHandle` (`character` and `foe` actors) and `toCombatantSpec`.
- `plannerSettings` and `applyPlannerSettings`: the Conflict row. `#conflict` works out the mode (`defaultMode` over the friendly characters' rulesets), the rank (`defaultRank` over the foes') and the holder (the head of the friendly chain of command, else the first character). It writes `spec.options.system` (`mode`, `rank`, `friendly`; with one track also `before`, `foeIds`, `holderTokenId`, `holderName`, `trackId`, `sceneId`), turns each foe into part of the track (`joinEncounter`: `sharedHp: "encounter"`, hp the ticks left, `ticksPerHarm`, `objectiveRank`, `social.steps`), and sets `spec.doors` (`doorsFor`: 1 hp with one track, else the setting, where the wall's flags don't say).
- `describeEncounter` (the track, for the planner's summary), `describeOutcome`, `commitConcession`.
- **Live:** `supportsLive` true; `liveTurns` "spotlight"; `readLiveState` (a foe carries no conditions; a foe on the encounter's track has the ticks left on the keeper's track as hp); `sheetCarries` (debilities, on characters only); `conditionLabel` (the system's impact word first, its debility word when the world plays Ironsworn alone); `conditionChoices` (the debilities and impacts of the rulesets on, then the core's); `commitChanges`, `commitTurn`, `readTurn`; `rollSave`, `rollCheck` and `adjustRolled` (API 19: system-roll.js, below).
- `term` (money: `IRONSWORN.Supply`; hp: `IRONSWORN.Health`; no ac or level) and `resourceLabel` (momentum).
- `playstyleHints`, `tacticHints`, `biography`, `deriveTraits`, `detectLeaders`.

## Live battles

- `commitIronswornChanges` (commit.js): a character's `system.health.value`, spirit, `system.momentum.value` and `system.debility.<id>`, and the `dead` status (as an overlay) or `unconscious`. A foe's track: `system.current` (never lowered) and `system.completed` when it's beaten; its combatant `defeated`, `dead` when killed, its token hidden when it fled (unless the core's `fledMode` is `leave`). Each write returns the core's undo record.
- `commitEncounterTurn`: the encounter's progress (what the fight marked, plus a mark per success in words and two per strong hit, at the rank as the fight left it), rank and completion, on the keeper's track. `keptTrack` finds it: the plan's `trackId`, else `encounterTrack` (an uncompleted track of subtype `progress` flagged `fast-fighting-ironsworn.encounter` with the scene's id). It is never a vow, bond or connection (`isTrack`), since a player can write that flag. With none, it creates a progress track named for the scene (its `navName`, else its name).
- `commitIronswornConcession`: Supply lowered for every character on the giver's side and, with the system's `shared-supply` setting on, every character and starship; ground given: `TICKS[rank]` × amount on the giver's track.
- `readIronswornTurn` (read-turn.js) reads each card's `data-ironswornroll` JSON for the actor (or its token, without an `actorId`), by the last part of the move's Datasworn id: `strike`, `clash`, `end_the_fight` and `take_decisive_action` give attack events (`targetId` null, `aimless`, `finish` for the last two); `compel` gives a talk event (persuade). `outcomeOf` reads replaced or preset dice, a burn (`replacedOutcome`) and progress rolls. Every event is `sure: false`.
- **The system's rolls** (API 19 `rollSave`, `rollCheck`, `adjustRolled`; system-roll.js): in a turn FastFighting plays, a character's save or check is rolled as the system's move dialog rolls, with no dialog: `new CONFIG.IRONSWORN.applications.IronswornRoll({stat, adds, momentum, moveDsId, actorId})`, then `new IronswornRollMessage(roll, actor).createOrUpdate()`, which posts the system's card. The roll object is graded by `outcomeOf`; its challenge dice go back as `dice: {challenge1, challenge2}`, for `asRolled`, and the card's message id as `card`.
  - `moveFor`: a save is Face Danger, +the stat its key stands for (`SAVE_STATS`: fortitude iron, reflex edge, will heart; or a stat by name; of several, the highest). A check: `aid` by the action's id (`<token>.advantage`: Secure an Advantage, Starforged's Gain Ground; `<token>.aid`: Aid Your Ally), +the highest stat; `heal` (`<token>.heal`) and `firstAid`, Heal +wits; `talk`, Compel by the pitch's kind (`COMPEL_STATS`; the core names an action-less check by its label, the kind); `theft`, Face Danger +shadow. Anything else, and every foe (foes never roll), is null: the engine's dice. The move is the character's own ruleset's (Sundered Isles: Starforged's Datasworn ids).
  - The DC goes on the card as adds (`addsFor`); the sheet's momentum too, as the system's dialog has it (a negative one cancels a matching action die). FastFighting's own adds (Secure an Advantage's +1 on the next move) aren't on the card.
  - Momentum is burned as on the engine's own dice: `adjustRoll` decides the same way (the engine asks it after a save, `ctx.rolled`). It burns only with the roll's `card`, and asks first: `run.live.roll(run, {kind: "adjust", unitId, card, adjust: "burnMomentum"})`, the momentum burned left in `burnsAsked` (rules.js, by card id: the rules and the live side run in the GM's browser). The live side calls `adjustRolled`; `burnOnCard` does what the card's own button does (`IronswornRollMessage.burnMomentum`) but with the engine's momentum: the card's roll (`rollOf`, `IronswornRoll.fromJson`) gets `postRollOptions.replacedOutcome` (that momentum against the same challenge dice, `IRONSWORN.MomentumBurnt`), and `createOrUpdate()` makes the card again. Only on `{done: true}` does the engine reset momentum; otherwise, or with no card, the roll stands as it fell.
  - The sheet's momentum isn't written on the card's burn: the end-of-turn write (`commitIronswornChanges`) writes the turn's momentum, reset included, with the turn's other changes, and its undo record takes it back on Rewind. Rewind deletes the turn's cards, the burned one with them. (The system's own `burnMomentum()` would write the sheet mid-turn from the sheet's own numbers, which lag the turn's until its end.)
  - Every card it rolls is flagged (`flags["fast-fighting-ironsworn"].rolled`, in the same `preCreateChatMessage` hook as `secret`). `hideBurn` (`renderChatMessageHTML`) replaces the card's `.momentum-burn` section with `FFIRONSWORN.Burn.Handled`: a burn from that button would change the sheet, not the turn already played. A card it burned has no button anyway.
  - `secret`: the card is made in the GMs' mode (a `preCreateChatMessage` hook, for that card only). No `{gm: true}`: each is a move and a stat the rules have already chosen.
  - Still the engine's dice: the rules' own rolls (Enter the Fray, Endure Harm and Endure Stress, Face Danger against a provoking foe, breaking free, a locked door), and every strike (no `rollStrike`).

## Personality and set-up

### Personality (traits.js)

Each trait's tooltip in the planner lists where it started and every part that moved it.

- **A character** starts as the usual hero (the core's `PC_BASELINE`: bold, loyal, unselfish, a good head), and everything on its sheet moves it a little:
  - its **stats**, against the usual spread's (3, 2, 2, 1, 1: 1.8 on average): wits for Tactical; heart for Brave and Loyal, and less Selfish; iron for Brave; shadow more Selfish, a little less Loyal; edge a little more careful;
  - its **assets**, by their id (Ironsworn's, Starforged's and Sundered Isles' of the same name alike), a little more for each upgrade: a Shield-Bearer or Banner-Sworn more loyal and bold, an Outcast or Fugitive less loyal, a Cutthroat or Mercenary more selfish, a Berserker bolder and less careful, the Honorbound, a Devotant or a Healer less selfish, a Lorekeeper or Sleuth a planner; a companion at its side a little more loyal;
  - how far it has come: its upgrades, and the assets it took on beyond its first three (its ship aside), for Tactical;
  - its **debilities or impacts**, for now: shaken, traumatized, tormented, wounded or maimed, less bold; corrupted, more selfish and less loyal; indebted or unprepared, more selfish; cursed (Ironsworn) or doomed, bound to death's quest, bolder;
  - its **bonds** (Ironsworn) or **connections** (Starforged; one it has forged a bond with counts twice), beyond the first, for Loyal;
  - its **vows**: sworn to more than the usual two, more loyal and less selfish; the more dangerous they are, the bolder; each one fulfilled, its word kept;
  - its **legacies** (Starforged, Sundered Isles): quests for Brave, bonds for Loyal, discoveries for Tactical.
- **A foe:** what it is (horrors and machines fearless, animals quick to flee, the Firstborn canny) and its rank (the higher, the bolder); then what the books say its kind is like, by its id (`FOE_LEANS`: a raider greedy and bold and stands with its kin, common folk fearful for their families, a wolf with its pack, a servitor made to protect, a troll sly and selfish); and one that comes as many (a pack, a swarm, a boarding party) stands together.

### Set up by itself (auto.js)

When the core sets a character up by itself (the first time it sees it), Ironsworn has its say on its playstyles:

- **A character's assets,** by the last part of the system's id for each (so Ironsworn's, Starforged's and Sundered Isles' of the same name count alike):
  - Shield-Bearer, Ironclad or Armored a Tank (guarding its friends); Archer, Slinger, Sniper, Gunner and the like a Wallflower (fighting at range); Berserker or Brawler a Brawler; Swordmaster, Blademaster or Duelist an Instigator;
  - Banner-Sworn a Martyr who'd lead; Commander or Leader leads; Herbalist or Healer an Enabler (healing readily); Lorekeeper, Lore Hunter or Sleuth a Lore-Collector;
  - Infiltrator, Shadow-Kin, Shade or Scoundrel a Thief; Ritualist, Seer, Kinetic and every ritual Un-Mundane; Revenant or Slayer Relentless; Oathbreaker a Redeem-Seeker; Loyalist a People-Pleaser;
  - Fortune Hunter, Mercenary or Bounty Hunter a Mercenary; Diplomat or Empath a Diplomat; Firebrand an Instigator.
- **A foe's nature:** horrors and machines Relentless (they never break); beasts and animals Brawlers (they stay where the fight is).
- **Keywords:** what's said of a character (a Starforged sheet's characteristics) in full; its notes (an Ironsworn sheet's notes) and its vows, its story, a little. A foe's description in full; its quest starter, a story, a little.

### Let this character decide

What "Let this character decide" stands for, question by question, where Ironsworn's data says something. The GM sees each answer with its reason (an asset's or a foe's name, a stat, a nature). Anything it says nothing about is the core's reading of the character's hidden scores.

**A character**, from its assets (by the system's id: the asset itself for who it is, the abilities marked on it for what it does, the first one counting if none is marked; a ship's or vehicle's modules aren't its own), its stats and its supply. Where its assets disagree, the answer most of them give, and none on a tie:

- **Fighting style:** the weapon its asset is for: a bow, sling, rifle, heavy gun or pistols at range (Archer, Slinger, Sniper, Gunner, Gunslinger, Musketeer, Pistoleer); a shield guarding (Shield-Bearer, who also goes for whoever attacks its friends); a blade, axe, hammer, staff or armor up close (Swordmaster, Blademaster, Duelist, Sunderer, Thunder-Bringer, Long-Arm, Brawler, Berserker, Ironclad, Armored, Swashbuckler); a dagger or a veil from the shadows (Cutthroat, Dancer, Shade). No such asset: iron up close, edge at range, whichever is higher.
- **Who to pursue first:** a Berserker the nearest; a Duelist, Slayer or Bounty Hunter the most dangerous.
- **Magic and specialties** (securing an advantage with its assets): its marked abilities that Secure an Advantage or Gain Ground (the system's links to those moves in their text), each ritual, and mystic powers (Ritualist, Kinetic, Sorcerer, Windbinder, Shapechanger, Necromancer, Firebrand, Seer, Sighted): two of them a little more often, four much more.
- **Spell slots, focus and limited abilities** (burning momentum): readily, with an ability marked that pays off when it burns momentum (Swordmaster, Veteran, Swashbuckler, Survivor, a Banner-Sworn in the fray); holding on to it, with one that needs momentum at its max (Kinetic, Demolitionist).
- **Talking instead of fighting:** a Diplomat or Empath talks first; a Scoundrel, Trickster, Pretender, Socialite, Spy, Storyweaver or Leader when it could work; otherwise, marked abilities that Compel (one or two, when it could work; three, first).
- **Healing others:** a Herbalist or Healer, or a marked ability that Heals (a Rider's is its horse's), keeps everyone up (unless the character would go further already).
- **When an ally is dying:** healers, the Loyalist, the Bonded, a Banner-Sworn and a marked ability that aids an ally drop everything to save them.
- **After I'm revived:** back into the fight for a Berserker, Revenant, Undead, Fated, Battle-Scarred or Augmented; a healer heals itself first.
- **When to retreat:** never for a Berserker, Revenant or Undead; when the battle turns for a Mercenary, Fortune Hunter or Scoundrel; when badly hurt for a Fugitive.
- **Others nearby:** a Slayer or Bounty Hunter hunts them down; a Commander, Crew Commander, Fleet Commander, Banner-Sworn or one with a Cohort runs for help.
- **Consumables:** an Alchemist (elixirs) or Demolitionist (explosives) uses them freely.
- **Offer and expect:** a Diplomat or Empath offers not to harm them; a Trader or Fortune Hunter offers a Supply (if it has any); a Fugitive offers to leave; a Mercenary or Pirate Captain expects a Supply; a Courier expects to be let through.

**A foe**, from its nature, then its kind (by its id: what its drives and tactics say), each shown with its name:

- Horrors and machines never break; beasts and animals stay with the fight; only people and the Firstborn talk.
- Raiders talk first (to intimidate), never break, burn everything down (hunting whoever's near) and expect Supply; scrap bandits talk first, get out when it goes wrong and expect Supply; drift pirates and firestorm troopers go for the weakest and expect Supply. What a foe expects is half its rank in Supply, rounded up.
- Common folk protect their own, rescue a friend, run for help and want not to be harmed; a warrior protects those in its charge; warriors and hunters live to fight another day; a zealot talks first and never breaks; the broken never talk and go for whoever's nearest.
- A giant talks first, spares lives, offers peace and wants you gone; elves and the varou want you gone; trolls never talk and run when hurt; merrow and primordials never talk.
- A wolf pack or howlcats go for the weakest and hunt; a cave lion and worldbreakers hunt; mammoths and sicklehorns protect their young and rescue them (mammoths to the death); a boar never breaks; a gaunt, a bear, gnawlings and water witchers flee when hurt; chitters and sky roosts call for help.
- Bonewalkers, the risen, chimeras and bonehordes go for the nearest (bonewalkers and the risen hunt on); haunts, hollows and iron revenants rise again; a wight guards; a colossus ignores the small fry for the most dangerous; a servitor protects its people and weighs its odds; chiton never break and hunt; wardens never break.

Ironsworn has no potions, no shields to raise and no signature attacks: those questions are always the core's.

## Leadership

`rankIronswornLeaders` (leadership.js) scores a character by its heart and a foe by its rank - 1, +2 for a title in its name (chief, chieftain, captain, commander, warlord, leader, elder, queen, king, lord, lady, boss, warden, overseer). `leaderBonus`: a score of 4 or more gives brave +20 and a tactical floor of 55; 3, +15 and 45; 2, +10 and 35; less, +5.

## Development

The tests import FastFighting Core from a checkout beside this one (`../FastFighting`; override with `FASTFIGHTING_CORE`):

```
npm install
npm test
```

Junction or symlink this folder into Foundry as `Data/modules/fast-fighting-ironsworn`.

Every word this module shows is in `languages/en.json`: the code holds keys, never the English. Translating it takes only a copy of that file (see **Translating** in the core README). `npm run test:reworded` runs the tests again with every word in the language files reworded, so they never depend on the wording.

`hardcoded-toEN.json` lists words that stay in English for now, whatever the reader's language: keys of `languages/en.json` (or a group, `"FFIRONSWORN.Move"`) whose translation would contradict a game system that isn't translated yet. It has the date it was last updated (`lastUpdated`) and the list (`keys`). It's plain JSON, edited like the language files.
