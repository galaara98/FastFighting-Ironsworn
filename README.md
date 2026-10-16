# FastFighting Ironsworn

> **AI use:** This module used AI in its creation.
> - **Programming:** I am a skilled programmer by profession, but AI was used heavily as a co-pilot.
> - **Strings:** ALL initial strings were created by AI. An AI-made Spanish translation was used to test localization and has since been removed.

Ironsworn and Starforged support for [FastFighting Core](https://github.com/galaara98/FastFighting), the Foundry VTT module that simulates a fight (or a tense standoff) thousands of times, tells the story of one fair draw, and plays it for real on the Combat Tracker, a turn at a time, with **Do it For Real Now**.

- **Foundry:** v14
- **System:** Ironsworn & Starforged (`foundry-ironsworn`) 1.20 or later (written against 1.28)
- **Needs:** FastFighting Core (API 16)

## Installation

Install FastFighting Core first, then this module. In Foundry, go to **Add-on Modules → Install Module** and paste:

```
https://github.com/galaara98/FastFighting/releases/latest/download/module.json
https://github.com/galaara98/FastFighting-Ironsworn/releases/latest/download/module.json
```

## What it reads

- **Characters:** edge, heart, iron, shadow and wits; health, momentum (its reset and its ceiling, as impacts leave them); a wound already marked; and, in a fight already under way, who has the initiative (the sheet's combat position). A character's sheet says which rules it plays by: the Ironsworn sheet the classic moves, the Starforged sheet Starforged's.
- **Fighting at range:** a character with an asset for it, by its id (Archer, Slinger, Sniper, Gunner, Gunslinger, Musketeer, Pistoleer; not the Long-Arm's staff), or more edge than iron, can Strike and Clash at a distance (+edge) as well as up close (+iron).
- **Foes:** the foe's progress track: its rank (troublesome to epic) and the ticks already marked on it. What it is comes from its id (Ironlanders, Firstborn, Animals, Beasts, Horrors, Anomalies; Starforged's foes as the book has each: human, creature, monster, machine, horror), else where its compendium files it, else its words: people and the Firstborn can be talked to; horrors and machines don't break; beasts fight on instinct.

## Personality

Each trait's tooltip in the planner lists where it started and every part that moved it.

- **A character** starts as the usual hero (bold, loyal, unselfish, a good head) and everything on its sheet moves it a little:
  - its **stats**, against the usual spread's (3, 2, 2, 1, 1: on average, the usual hero): wits for Tactical; heart for Brave and Loyal, and less Selfish; iron for Brave; shadow more Selfish, a little less Loyal; edge a little more careful;
  - its **assets**, by their id (Ironsworn's, Starforged's and Sundered Isles' of the same name alike), a little more for each upgrade: a Shield-Bearer or Banner-Sworn more loyal and bold, an Outcast or Fugitive less loyal, a Cutthroat or Mercenary more selfish, a Berserker bolder and less careful, the Honorbound, a Devotant or a Healer less selfish, a Lorekeeper or Sleuth a planner; a companion at its side a little more loyal;
  - how far it has come: its upgrades, and the assets it took on beyond its first three (its ship aside), for Tactical;
  - its **debilities or impacts**, for now: shaken, traumatized, tormented, wounded or maimed, less bold; corrupted, more selfish and less loyal; indebted or unprepared, more selfish; cursed (Ironsworn) or doomed, bound to death's quest, bolder;
  - its **bonds** (Ironsworn) or **connections** (Starforged; one it has forged a bond with counts twice), beyond the first, for Loyal;
  - its **vows**: sworn to more than the usual two, more loyal and less selfish; the more dangerous they are, the bolder; each one fulfilled, its word kept;
  - its **legacies** (Starforged, Sundered Isles): quests for Brave, bonds for Loyal, discoveries for Tactical.
- **A foe:** what it is (horrors and machines fearless, animals quick to flee, the Firstborn canny) and its rank (the higher, the bolder); then what the books say its kind is like, by its id (a raider greedy and bold and stands with its kin, common folk fearful for their families, a wolf with its pack, a servitor made to protect, a troll sly and selfish); and one that comes as many (a pack, a swarm, a boarding party) stands together.

## A conflict

As the game plays it, success is progress on a track, and things going wrong cost health (harm), spirit (stress, despair) or supply (anything material lost), and momentum. The planner has a **Conflict** row for it:

- **Track:**
  - **One for the encounter** (Starforged's objective; the default where anyone plays Starforged or Sundered Isles): every foe is part of one track. Every Strike and Clash marks progress on it, at the encounter's rank, whichever foe it's aimed at, and every success in words marks it too (a strong hit twice). Fill it and the foes are beaten together; Take Decisive Action, once it's well along (seven boxes), is a progress roll against it: a hit achieves the objective, a miss loses it, and the fight with it.
  - **Each foe's own** (Ironsworn's, the default otherwise): harm marks progress on each foe's own track, at its own rank, and End the Fight takes that foe out of it.
- **Rank** (one track): Troublesome to Epic, how hard the objective is: how much each mark fills (troublesome 3 boxes, dangerous 2, formidable 1, extreme 2 ticks, epic 1), and how many successes it takes to talk a foe round (2, 3, 6, 12, 24). By default, its most dangerous foe's.
- **Kept on** (one track): the character whose sheet keeps the track (the party's leader by default); the others can follow it by hand. Do it For Real Now writes it there: the track it keeps for this scene's encounters, else a new one named for the scene, completed when the objective is achieved.

Either way, a foe's own rank says how hard it hits back, and a foe whose track is full is **beaten**: out of the fight, and the players decide what that means (killed, out of action, fled, surrendered). A Cruel character kills a foe it beats, and the story says so (Do it For Real Now marks it dead; a beaten foe is only marked defeated).

**Going wrong:** an ally going down weighs on the characters beside it (Endure Stress, 1; 2 when it's killed).

**Someone taking a side mid-fight** (one taking no side, won over or turning on one) has exactly one effect in a conflict, each way:
- **Joining the party**, the first to: a success, a mark of progress on the encounter's track (never the last; the fight still has to win it), or, with each foe's own track, +1 momentum for each character.
- **Turning on the party**: it's part of the encounter's track from then on. What it means is settled once, the first time it happens, with whoever else turned at the same moment: a whole neutral team (of the up to three) or a leader among them makes the objective a step harder (the rank up one, never to Epic); anyone else, or with no step to take (Extreme already, or each foe's own track), each character endures stress (1).

## How a fight plays

The characters make the moves, as in the game; foes never roll.

- **Enter the Fray** on a character's first turn: +shadow when its side springs an ambush, +wits when ambushed; otherwise Ironsworn's +heart, or Starforged's best of +edge, +heart and +iron. A strong hit, the initiative and +2 momentum; a weak hit, the initiative; a miss, a bad spot (Ironsworn: and Pay the Price, -1 momentum).
- **Strike** with the initiative (in control), **Clash** without it: +iron up close, +edge at range. A hit marks progress on the foe's track, as many ticks a mark as its rank allows (troublesome 12, dangerous 8, formidable 4, extreme 2, epic 1). Ironsworn: a deadly weapon inflicts 2 harm, a simple one or bare hands 1 (characters' sheets don't say, so a world setting does: deadly by default); a strong Strike inflicts +1 harm and keeps the initiative; a weak Strike loses it; a strong Clash takes it. Starforged: a hit on a Strike marks progress twice; a strong hit keeps you in control.
- **Pay the Price:** a miss, or a weak Clash, costs the foe's harm (its rank; one more on matching challenge dice).
- **Endure Harm:** after any harm, +health or +iron: a strong hit shakes it off (+1 health; Ironsworn's for a point of momentum, Starforged's free if not wounded) or embraces the pain (+1 momentum); a weak hit presses on (Starforged: a point of momentum for +1 health, if not wounded); a miss costs a point of momentum (Starforged: -1 health, or -2 momentum). At 0 health a character fights on, harm beyond its health coming off its momentum; a miss there marks it wounded, or (already wounded) rolls on the harm table: mortal (Face Death, +heart: survive, survive deathbound, or die), dying, out cold, reeling, or still standing.
- **End the Fight** (Starforged: Take Decisive Action): with the initiative and the foe's track at least half full, a progress roll. A hit ends that foe's part in the fight (a weak one costs momentum); a miss loses it, and the price is paid.
- **Burning momentum:** when it turns a miss into a hit (or, with plenty to spare, a weak hit into a strong one); momentum resets after. Never on a progress roll.
- **Securing an advantage** (in control), with the character's best approach (its highest stat): Ironsworn's **Secure an Advantage** (a strong hit: +1 on the next move; a weak hit: +1 momentum) or Starforged's **Gain Ground** (a strong hit: +1 on the next move and +2 momentum; a weak hit: +1 on the next move). **Aid Your Ally** gives the same to a friend, and a strong hit puts both in control. A miss pays the price: -1 momentum, and the upper hand lost. A Strike usually does more, so a character secures an advantage when it fights poorly next to a friend who fights well, when it's set on helping (a stated desire), or when a friend asks it to (a friend's "Be bolstered by" desire, and a language in common). Momentum counts for something: a step toward burning it.
- **A Lore-Collector** sizes a foe up by Securing an Advantage, assessing it (+wits). A hit makes its next attack, or its next Compel (persuading, threatening, deceiving), likelier to succeed, at whoever it's aimed, by the **Lore-Collector advantage** setting (1.25× to 3×; default 2.35×: what it takes for that one roll to make up for the move it cost, with +3 wits hitting 77% of the time and a miss paying the price). Ironsworn's dice cap a roll near 95%, so a Strike gets all it can by about 1.5× (+2 iron) or 1.75× (+1); the rest helps Compel a hardier foe, where the odds start low. A miss pays the price.
- **Talking:** Compel, by heart (persuade), iron (threaten) or shadow (bluff), against challenge dice, harder against a foe of higher rank. A strong hit: +1 momentum. A miss pays the price: a refusal that weighs on the character (Endure Stress, 1); a miss on matching dice is also a demand that costs it dearly (a point of supply, to whoever it was talking to).
- **Stress:** a horror's price is dread (Endure Stress, its rank) rather than harm. **Endure Stress** plays as Endure Harm does, on spirit (+spirit or +heart): a strong hit shakes it off or embraces the darkness (+1 momentum); a weak hit presses on; a miss costs momentum (Starforged: worse than it seemed). At 0 spirit a miss marks the character shaken; already shaken, it may falter (-1 momentum) or be overwhelmed: Face Desolation (+heart), and on a miss it gives up the fight.
- **Paying, and giving ground:** there are no coins or goods. A character who pays (to strike a deal, or talked into it) pays in Supply, which its side shares: what one pays, all of them have that much less of. A foe made to give something up gives ground instead: a mark of progress on its own track, the winners' reward. What a character can offer or expect in a standoff is Supply, or a promise; a foe can ask for Supply (as a raider would), but has none to give.
- **Breaking free, and freeing a friend:** a character tied up or held breaks free with **Face Danger**, using the better of +edge (slipping out) and +iron (forcing it). A strong hit gets it free (+1 momentum); a weak hit gets it free at a cost (-1 momentum); a miss leaves it held and pays the price (-1 momentum, and the upper hand lost). Momentum is burned only to turn a miss into a hit. Untying a friend takes no roll, unless a foe is beside the one untying: then it's Face Danger too. Either takes the turn's move. Foes don't roll: whether one gets loose is the core's chance.

## Playstyles in Ironsworn

Every perk a playstyle (or a tactics answer) can switch on does something here. Most play as they do in any system (who a character goes for, when it loses heart, whom it listens to, how it talks). Foes don't roll, so what they would do comes through the characters' own moves. These are Ironsworn's own:

| Perk (playstyles) | In Ironsworn |
| --- | --- |
| Drawing attacks, guarding, taunting (Tank, Martyr, Instigator, Redeem-Seeker; guards: Enabler, Moralist, Wants to Lead; taunters: Tank, Instigator, Martyr, Brawler, Redeem-Seeker) | A foe's attention is the price a character pays. When a friend misses, **Pay the Price** may put it **in harm's way** instead (one of the books' own prices). That's always a friend whose taunt the foe is under (Compel, provoking it). Otherwise it's one who draws attacks or guards its friends, as likely as its perk. |
| Hard to spot (Chicken, Fragile, Wallflower) | When it misses, the foe's eye may slide to a friend beside it, who pays the price. On its first turn it may **Enter the Fray** moving into position unseen (+shadow), if that's its best. |
| Hard to taunt (Relentless, Skeptic, Peacekeeper, Puzzle-Maniac, Diplomat, Chicken, Wallflower, Lazy) | A foe the GM made a taunter doesn't roll: it provokes. The character it would draw **Faces Danger** (+heart) to keep its head. On a miss it rises to it and wants to go for that foe, unless it shrugs taunts off. A foe provokes as often as a playstyle taunt takes hold (the Taunting setting). |
| Spoiling, weak spots (Instigator most; Cruel, Wants to Lead, Wallflower, Puzzle-Maniac) | There are no conditions to lay and no damage types. **Secure an Advantage** (Gain Ground) is how it gains leverage or finds a weak point, likelier the more of a spoiler or Puzzle-Maniac it is. |
| In a hurry (Impatient, Speed-Runner) | It takes on **End the Fight** (Take Decisive Action) two boxes sooner: at three boxes of a foe's own track, five of the encounter's. It doesn't stop to Secure an Advantage. |
| Helping (Enabler, People-Pleaser, Moralist, Martyr, Redeem-Seeker, Tank) | **Aid Your Ally**. |
| Mending, healing, rescue (Fragile, Moralist, Martyr, Enabler; "a friend falling: rescue") | **Heal** (+wits), in control. A hit gives +2 health (a weak hit costs a point of momentum). A miss pays the price. |
| Thief | Lifts something with **Face Danger** (+shadow). A foe gives ground (a mark of progress on its track); a character gives up Supply. |
| Trap avoiders (Thief, Puzzle-Maniac, Skeptic, Lore-Collector, Chicken, Wallflower) | A hazard (anything the GM marks as one) makes those it reaches **Face Danger** (+edge). A miss takes its harm; a weak hit gets clear at a cost (-1 momentum); a strong hit gets clear. A trap avoider may spot it and keep clear. |
| Casters as targets (Puzzle-Maniac) | Horrors and the Firstborn count as casters: they have powers of that kind, if no spells. |
| Lore-Collector | Sizes a foe up by Securing an Advantage (+wits): see **How a fight plays**. |
| Finishing the fallen (Cruel); sparing them (Moralist, Peacekeeper, Diplomat) | A Cruel character kills a foe it beats. The rest leave a beaten foe for the table to decide. |
| Acting first (Instigator) | The order the characters take their turns. |

Tactics answers:

- **Magic and specialties** (an Un-Mundane character leans on them): a character with assets (a companion, a path, a ritual) brings them to bear by Securing an Advantage (Gain Ground), so that is its specialty; without assets, it has none. Strike, Clash, Compel, Aid Your Ally and Heal are what anyone could do, so Heal alone makes no one a healer (an Enabler or Moralist); for a Herbalist or a Healer (by the asset's id), healing is its thing, and Heal its specialty too.
- **Resources** (conserve, balanced, nova): how readily it burns momentum. Conserving, it burns it only to turn a miss into a hit that matters, never a weak hit into a strong one. All out, it burns it to turn any miss into a hit, and a weak hit into a strong one with 4 or more.

**Homebrew** (the books leave these to the table; this module's reading, kept to the game's own moves):
- Who is put in harm's way, and when.
- A foe's provocation as Face Danger (+heart).
- Theft as Face Danger (+shadow), and what a hit takes.
- A hazard's Face Danger (+edge), and a weak hit's cost.
- Breaking free as Face Danger (+edge or +iron), and untying a friend with no roll unless a foe is beside it.
- Heal in a fight only for one in control, and +wits for its own wounds too (the books say the lower of wits and iron).
- End the Fight two boxes sooner for one in a hurry.
- +shadow in the fray for one keeping a low profile.

## Set up by itself

When FastFighting sets a character up by itself (the first time it sees it: see the core's README), Ironsworn has its say on its playstyles:
- **A character's assets,** by the system's id for each (the last part of it, so Ironsworn's, Starforged's and Sundered Isles' of the same name count alike):
  - Shield-Bearer, Ironclad or Armored a Tank (guarding its friends); Archer, Slinger, Sniper, Gunner and the like a Wallflower (fighting at range); Berserker or Brawler a Brawler; Swordmaster, Blademaster or Duelist an Instigator;
  - Banner-Sworn a Martyr who'd lead; Commander or Leader leads; Herbalist or Healer an Enabler (healing readily); Lorekeeper, Lore Hunter or Sleuth a Lore-Collector;
  - Infiltrator, Shadow-Kin, Shade or Scoundrel a Thief; Ritualist, Seer, Kinetic and every ritual Un-Mundane; Revenant or Slayer Relentless; Oathbreaker a Redeem-Seeker; Loyalist a People-Pleaser;
  - Fortune Hunter, Mercenary or Bounty Hunter a Mercenary; Diplomat or Empath a Diplomat; Firebrand an Instigator.
- **A foe's nature:** horrors and machines Relentless (they never break); beasts and animals Brawlers (they stay where the fight is).
- **Keywords:** what's said of a character (a Starforged sheet's characteristics) in full; its notes (an Ironsworn sheet's notes) and its vows, its story, a little. A foe's description in full; its quest starter, a story, a little.

### Let this character decide

What "Let this character decide" stands for, question by question, where Ironsworn's data says something; the GM sees each answer with its reason (an asset's or a foe's name, a stat, a nature). Anything it says nothing about is the core's reading of the character's hidden scores.

**A character**, from its assets (by the system's id; the asset itself for who it is, the abilities marked on it for what it does, the first one counting if none is marked; a ship's or vehicle's modules aren't its own), its stats and its supply. Where its assets disagree, the answer most of them give, and none on a tie:
- **Fighting style:** the weapon its asset is for: a bow, sling, rifle, heavy gun or pistols at range (Archer, Slinger, Sniper, Gunner, Gunslinger, Musketeer, Pistoleer); a shield guarding (Shield-Bearer, who also goes for whoever attacks its friends); a blade, axe, hammer, staff or armor up close (Swordmaster, Blademaster, Duelist, Sunderer, Thunder-Bringer, Long-Arm, Brawler, Berserker, Ironclad, Armored, Swashbuckler); a dagger or a veil from the shadows (Cutthroat, Dancer, Shade). No such asset: iron up close, edge at range, whichever is higher.
- **Who to attack first:** a Berserker the nearest; a Duelist, Slayer or Bounty Hunter the most dangerous.
- **Magic and specialties** (securing an advantage with its assets): its marked abilities that Secure an Advantage or Gain Ground (the system's links to those moves in their text), each ritual, and mystic powers (Ritualist, Kinetic, Sorcerer, Windbinder, Shapechanger, Necromancer, Firebrand, Seer, Sighted): two of them a little more often, four much more.
- **Resources** (burning momentum): readily, with an ability marked that pays off when it burns momentum (Swordmaster, Veteran, Swashbuckler, Survivor, a Banner-Sworn in the fray); holding on to it, with one that needs momentum at its max (Kinetic, Demolitionist).
- **Talking:** a Diplomat or Empath talks first; a Scoundrel, Trickster, Pretender, Socialite, Spy, Storyweaver or Leader when it could work; otherwise, marked abilities that Compel (one or two, when it could work; three, first).
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

## Rules preference

With more than one ruleset on in the world, Ironsworn, Starforged and Sundered Isles have moves of the same name that play differently: Strike, Clash, Endure Harm, Enter the Fray. **Settings → FastFighting Ironsworn → Rules preference** says which version a character makes, one pill on at a time:

- **Follow character sheets** (the default): every character makes the moves of the sheet it's on now, the token's own choice of sheet over its actor's (an Ironsworn sheet's; a Starforged sheet's, or Sundered Isles' in a world with that on and not Starforged), even where that sheet shows other rulesets' moves too. A sheet that's neither (the compact sheet) goes by the rulesets the world has on, Ironsworn first.
- **Prefer Ironsworn**, **Prefer Starforged**, **Prefer Sundered Isles**: where that ruleset has a move of the same name (and the world has it on), every character makes that ruleset's version. Of the combat moves, Sundered Isles has its own Enter the Fray. Moves called differently stay the character's own (End the Fight, Take Decisive Action), and so do the words for who has the upper hand (the initiative, in control). A deadly weapon's harm counts only on Ironsworn's Strike and Clash; Starforged's mark progress.

## Do it For Real Now

In a live battle, each turn's changes go onto the sheets as the turn is played:
- A character: health, spirit, momentum, its debilities or impacts (a wound or shaken the fight marks, and any the GM marks or clears in the Battle Vantage, which offers them by the system's names), and how it ended (out cold, dying, dead, or deathbound after Face Death). What a player marks or clears on the sheet between turns counts from the next one.
- One track for the encounter: its progress, on the sheet of the character who keeps it (completed when the objective is achieved); the foes' own tracks are left as they were.
- A foe: progress marked on its track, the track completed when it was beaten (and its token marked defeated); a foe that fled is hidden.
- Supply paid: lowered for every character on the payer's side, and (with the system's Shared Supply Tracker on, as it is by default) every character and starship it shares Supply with. Ground given: a mark of progress on the foe's track.

Rewind Turn takes one turn back; Rewind This Encounter, all of it.

## Development

The tests import FastFighting Core from a checkout beside this one (`../FastFighting`; override with `FASTFIGHTING_CORE`):

```
npm install
npm test
```

Junction or symlink this folder into Foundry as `Data/modules/fast-fighting-ironsworn`.

Every word this module shows is in `languages/en.json`: the code holds keys, never the English. Translating it takes only a copy of that file (see **Translating** in the core README). `npm run test:reworded` runs the tests again with every word in the language files reworded, so they never depend on the wording.

`hardcoded-toEN.json` lists words that stay in English for now, whatever the reader's language: keys of `languages/en.json` (or a group, `"FFIRONSWORN.Move"`) whose translation would contradict a game system that isn't translated yet. It has the date it was last updated (`lastUpdated`) and the list (`keys`). It's plain JSON, edited like the language files.

## License

MIT for this module's code. Ironsworn and Starforged are by Shawn Tomkin, under CC BY 4.0; this module isn't affiliated with or endorsed by their author.
