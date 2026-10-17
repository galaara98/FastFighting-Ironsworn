# FastFighting Ironsworn

> **AI use:** This module used AI in its creation.
> - **Programming:** I am a skilled programmer by profession, but AI was used heavily as a co-pilot.
> - **Strings:** ALL initial strings were proposed by a LLM to get the concepts out, ALL strings were  tracked to make sure they were re-written (for simple or ttrpg/game specific phrases, approved by) a native speaker.

FastFighting Core plays a fight with a large but fixed set of options: conditions, maneuvers, holds, reactions, resources, outcomes and the like. Each system helper maps its game into those options. This one maps Ironsworn, Starforged and Sundered Isles, so the core can simulate a fight, tell its story, and play it for real on the Combat Tracker with **Do it For Real Now**.

- **Foundry:** v14
- **System:** Ironsworn & Starforged (`foundry-ironsworn`) 1.20 or later (written against 1.28)
- **Needs:** FastFighting Core 0.3.0 or later (API 18)

## Installation

Install FastFighting Core first, then this module. In Foundry, go to **Add-on Modules → Install Module** and paste:

```
https://github.com/galaara98/FastFighting/releases/latest/download/module.json
https://github.com/galaara98/FastFighting-Ironsworn/releases/latest/download/module.json
```

## How Ironsworn maps onto FastFighting

The game's ideas, one by one, and what the core makes of each.

### Characters roll; foes don't

Ironsworn's foes never roll against the characters, so FastFighting plays every foe through the characters' moves. A foe hurts a character when that character's move pays the price: a miss on a Strike costs the foe's harm, which is its rank. Foes do attack anyone who isn't a character (a companion, a hired hand), with a plain attack at their rank.

### A progress track is a foe's hit points

The ticks left on a foe's progress track (10 boxes, 40 ticks) are its hit points, and the ticks already marked count. Harm marks progress at the foe's rank, as the game paces it: each point of harm marks 3 boxes on a troublesome foe, 2 on a dangerous one, 1 on a formidable one, 2 ticks on an extreme one and 1 tick on an epic one. A full track beats the foe: it leaves the fight, and the table decides what that means (killed, out of action, fled, surrendered). A Cruel character kills a foe it beats.

**End the Fight** (Starforged: **Take Decisive Action**) is a progress roll, made in control once the foe's track is half full. A hit ends that foe's part in the fight (a weak hit costs 2 momentum). A miss loses the initiative and pays the price (the foe's harm, plus 1).

### The initiative decides Strike or Clash

With the initiative (Starforged: in control) a character Strikes; without it, it Clashes. Both roll +iron up close or +edge at range. A character fights at range with an asset for it (Archer, Slinger, Sniper, Gunner, Gunslinger, Musketeer, Pistoleer) or with more edge than iron. A miss, or a weak Clash, pays the price: the foe's harm (1 more on matching challenge dice).

- **Ironsworn:** a hit inflicts the weapon's harm (the **Characters fight with deadly weapons** setting). A strong hit inflicts 1 more and takes or keeps the initiative; a weak Strike loses it.
- **Starforged:** a Strike marks progress twice on any hit, a Clash twice on a strong hit; a strong hit puts the character in control.

**Enter the Fray** is each character's first move, unless its sheet already shows its combat position: +shadow when its side springs an ambush, +wits when ambushed, otherwise Ironsworn's +heart or Starforged's best of +edge, +heart and +iron. A strong hit gives the initiative and +2 momentum, a weak hit the initiative, and a miss a bad spot (Ironsworn: and -1 momentum).

### Momentum is a resource to burn

Momentum is a resource, as the core counts them: each point is worth a step toward a burn. A character burns it to turn a miss into a hit or, with plenty to spare, a weak hit into a strong one, never on a progress roll; momentum then resets. Its **Resources** tactics answer sets how readily: conserving, only for a miss that matters; all out, for any miss, and for a weak hit with 4 or more.

### Health, spirit and supply

Trouble costs health (harm), spirit (stress) or supply, and momentum.

- **Endure Harm** follows any harm, +health or +iron, as the character's ruleset plays it. At 0 health a character fights on, and harm beyond its health comes off its momentum. A miss there marks it wounded; already wounded, it rolls on the harm table: mortal (Face Death), dying, out cold, reeling, or still standing.
- **Endure Stress** plays the same way on spirit (+spirit or +heart). A horror's price is stress (its rank) instead of harm, and an ally going down costs each character beside it 1 stress (2 when it's killed). At 0 spirit a miss marks the character shaken; already shaken, it may falter or Face Desolation, and on a miss there it gives up the fight.
- **Supply is the money.** There are no coins or goods: a character pays in Supply, which its side shares, so what one pays, all have that much less of. A foe made to give something up gives ground instead: a mark of progress on its own track. In a standoff a character can offer or expect Supply or a promise; a foe can ask for Supply but has none to give.

### Debilities and impacts are conditions

Each debility (Ironsworn) or impact (Starforged) is a core condition under the system's own id, so the sheet and the fight agree. The rules play wounded and shaken. The rest stay on the sheet, where the system counts them against momentum, and change no move. The story tells wounded as badly hurt, shaken as rattled, and maimed or permanently harmed as a crippling injury; it leaves out the rest, which nobody watching would see.

### Talking is Compel

The core's three ways of talking are Compel: by heart (persuade), iron (threaten) or shadow (bluff), against challenge dice, harder against a foe of higher rank. A strong hit gives +1 momentum. A miss pays the price: a refusal that costs 1 stress, and on matching dice a demand that costs a point of Supply, to whoever it was talking to. Only people and the Firstborn can be talked to.

### What a foe is

A foe's kind comes from its id (Ironsworn's Ironlanders, Firstborn, Animals, Beasts, Horrors and Anomalies; Starforged's foes as the book has each), else the folder its compendium files it under, else its words. When FastFighting sets a foe up by itself, horrors and machines never break, and beasts and animals stay where the fight is. A foe's own rank sets how hard it hits back.

### Securing an advantage

The core's buffs are the game's moves for the upper hand. In control, a character can **Secure an Advantage** (Starforged: **Gain Ground**) with its best stat, or **Aid Your Ally** to give the same to a friend.

- **Ironsworn:** a strong hit gives +1 on the next move; a weak hit, +1 momentum.
- **Starforged:** a strong hit gives +1 on the next move and +2 momentum; a weak hit, +1 on the next move.

A strong hit on Aid Your Ally puts both in control. A miss pays the price: -1 momentum, and the upper hand lost. A Strike usually does more, so a character secures an advantage when it fights poorly beside a friend who fights well, when it's set on helping, or when a friend asks (a "Be bolstered by" desire, in a language they share). It is also how a character's assets come into play, so for one with assets it counts as its specialty (the **Magic and specialties** tactics answer).

A **Lore-Collector** sizes a foe up the same way, +wits. A hit makes its next attack or Compel likelier to succeed, by the **Lore-Collector advantage** setting.

### Heal

**Heal** (+wits), in control, mends a friend or the character itself: a hit gives +2 health (a weak hit costs a point of momentum), and a miss pays the price. Anyone can Heal, so Heal makes no one a healer; for a Herbalist or a Healer it is a specialty.

### Face Danger: holds, doors and hazards

The game has one move for getting past trouble, so the core's holds and locked doors become **Face Danger**:

- **Breaking free** (tied up or held): the better of +edge and +iron. Untying a friend takes no roll, unless a foe is beside the one untying.
- **A locked door:** +iron to force it, the better of +shadow and +wits to pick its lock, or hacking at it, whichever is quickest. Hacked at, an Ironsworn door stands up to 1 to 3 harm (a setting), and a Starforged door gives way to one hit; a strong hit does a strong Strike's harm. A fight with one track for the encounter counts as Starforged's. A GM's own numbers for a door (in its wall's flags) come first: hit points are harm, and each 3 of a DC over 10 is an add off the roll.

A strong hit gets through (+1 momentum), a weak hit gets through at a cost (-1 momentum), and a miss pays the price (-1 momentum, and the upper hand lost). Momentum is burned only to turn a miss into a hit. Foes don't roll: whether one gets loose is the core's chance.

A **hazard** (anything the GM marks as one) makes those it reaches Face Danger (+edge): a strong hit gets clear, a weak hit gets clear at -1 momentum, and a miss takes its harm.

### Taking a side mid-fight

Someone taking a side mid-fight (won over, or turning) has one effect in a conflict, each way:

- **Joining the party:** the first to do so counts as a success: a mark of progress on the encounter's track (never the mark that fills it), or, with each foe's own track, +1 momentum for each character.
- **Turning on the party:** it becomes part of the encounter's track, if there is one. The first time it happens, a whole neutral team or a leader among them raises the encounter's rank a step (never to Epic); anyone else, or with no step to take, costs each character 1 stress.

### Personality, playstyles and tactics

A character starts as the usual hero, and its sheet moves each trait a little: its stats, assets, debilities or impacts, bonds or connections, vows, legacies, and how far it has come. A Shield-Bearer is more loyal and bold; a corrupted character, more selfish. A foe's traits come from its kind, its rank (the higher, the bolder), what the books say of its kind (a raider is greedy and bold), and whether it comes as many. Each trait's tooltip in the planner lists every part that moved it.

When FastFighting sets a character up by itself, its assets suggest playstyles (a Shield-Bearer a Tank, a Berserker a Brawler, an Archer a Wallflower). **Let this character decide** answers from a character's assets, stats and supply (a Berserker goes for the nearest foe and never retreats), or from a foe's kind (raiders talk first, to intimidate, and expect Supply). The GM sees each answer with its reason. [CODING_README.md](CODING_README.md#personality-and-set-up) lists every mapping.

## The encounter's one track

Starforged gives a fight one objective; Ironsworn gives each foe its own track. The planner's **Conflict** row chooses:

- **Track:** **One for the encounter** (the default when any character plays Starforged or Sundered Isles) or **Each foe's own** (the default otherwise).
- **Rank** (one track): Troublesome to Epic, by default the most dangerous foe's. It sets how much each mark fills, and how many successes talk a foe round (2, 3, 6, 12, 24).
- **Kept on** (one track): the character whose sheet keeps the track, by default the party's leader. The others can follow it by hand.

With one track, every foe is part of it. Every Strike and Clash marks progress on it at the encounter's rank, whichever foe it's aimed at, and so does every success in words (a strong hit twice). Fill it and the foes are beaten together. Once it has seven boxes, Take Decisive Action (or End the Fight) is a progress roll against it: a hit achieves the objective; a miss loses it, and the fight with it.

## Live battles: the spotlight

Ironsworn has no turn order; its initiative is only who has the upper hand. In a live battle the Battle Vantage gives the spotlight to the next character able to act, or to whoever the GM picks. Foes take no turns of their own unless no character can act.

After a player's turn, FastFighting reads the system's move cards for Strike, Clash, End the Fight, Take Decisive Action and Compel. The cards name no foe, so a blow goes to the foe whose track moved, or the GM says which.

Each turn writes onto the sheets:

- **A character:** health, spirit, momentum, debilities or impacts (the GM can mark or clear any in the Battle Vantage), and the unconscious or dead status when it falls. A player's own changes between turns count from the next turn.
- **A foe:** progress on its track, completed when it's beaten (its combatant defeated; dead, if a Cruel character killed it). A fled foe is hidden, unless the core's **Do it For Real Now: fled combatants** setting leaves it.
- **One track for the encounter:** progress on the keeper's sheet, on the track kept for this scene's encounters, else a new one named for the scene; completed when the objective is achieved.
- **Supply paid:** lowered for every character on the payer's side and, with the system's Shared Supply Tracker on (the default), every character and starship sharing it. **Ground given:** progress on the foe's track.

**Rewind** takes a turn back; **Rewind This Encounter**, the whole battle.

## Settings

In **Settings → FastFighting Ironsworn**:

- **Rules preference:** with more than one ruleset on, which version a character makes of a move they share (Strike, Clash, Endure Harm, Enter the Fray). One pill is on at a time.
  - **Follow character sheets** (the default): the sheet the character is on now, the token's choice over its actor's. A Starforged sheet makes Sundered Isles' moves in a world with Sundered Isles on and Starforged off. The compact sheet goes by the rulesets the world has on, Ironsworn first.
  - **Prefer Ironsworn**, **Prefer Starforged**, **Prefer Sundered Isles:** that ruleset's version, where the world has it on. Of the combat moves, Sundered Isles has only its own Enter the Fray. End the Fight and Take Decisive Action stay the character's own, as do the words for the upper hand (the initiative, in control).
- **Characters fight with deadly weapons** (on by default): Ironsworn's Strike and Clash inflict 2 harm a hit, 3 on a strong hit; off, 1 and 2, as a simple weapon or bare hands do. Sheets don't say what a character carries, so the GM does.
- **Ironsworn only: harm to break down a locked door** (1 to 3, default 3: a deadly weapon's two hits, or one strong hit).
- **Lore-Collector advantage** (1.25× to 3×, default 2.35×). At 2.35× the boosted roll makes up for the move spent sizing up, with +3 wits hitting 77% of the time and a miss paying the price. Ironsworn's dice cap a roll near 95%, so a Strike gets all it can by about 1.5× (+2 iron) or 1.75× (+1 iron); the rest helps Compel a hardier foe, where the odds start low.

## Playstyles in Ironsworn

Every perk a playstyle (or a tactics answer) can switch on does something here, and most play as in any system; the core's README lists which playstyles have each. Foes don't roll against the characters, so what they would do comes through the characters' moves. These are Ironsworn's own:

| Perk | In Ironsworn |
| --- | --- |
| Drawing attacks, guarding, taunting | When a friend misses, Pay the Price may put this character **in harm's way** instead (one of the books' own prices): always one whose taunt the foe is under; otherwise one who draws attacks or guards, as likely as its perk. |
| Hard to spot | When it misses, the foe's eye may slide to a friend beside it, who pays the price. On its first turn it may Enter the Fray moving into position unseen (+shadow). |
| Hard to taunt | A taunting foe doesn't roll: it provokes, as often as the Taunting setting lets a taunt take hold. The character it would draw Faces Danger (+heart); on a miss it wants to go for that foe, unless it shrugs taunts off. |
| Spoiling, weak spots | There are no conditions to lay and no damage types: it Secures an Advantage (Gain Ground) more often. |
| In a hurry | It takes on End the Fight two boxes sooner (three boxes of a foe's own track, five of the encounter's) and doesn't stop to Secure an Advantage. |
| Helping | Aid Your Ally. |
| Mending, healing, rescue | Heal. |
| Thief | Face Danger (+shadow): a foe gives ground (a mark of progress on its track); a character gives up Supply. |
| Trap avoiders | It may spot a hazard and keep clear of it. |
| Casters as targets | Horrors and the Firstborn count as casters: they have powers, if no spells. |
| Finishing or sparing the fallen | A Cruel character kills a foe it beats; one who spares the fallen leaves a beaten foe to the table. |
| Acting first | The order the characters take their turns. |

## What isn't played

- Foes never roll against the characters, and there's no turn order.
- Ironsworn has no potions, shields to raise or signature attacks: those tactics questions stay the core's.
- Debilities and impacts other than wounded and shaken change no move.
- Of a player's move cards, FastFighting reads only Strike, Clash, End the Fight, Take Decisive Action and Compel.

**Homebrew.** The books leave these to the table, and this module rules them with the game's own moves: who is put in harm's way, and when; provocation, theft, hazards, breaking free and locked doors as Face Danger, with the stats and costs above; a door's 1 to 3 harm (Ironsworn) or one hit (Starforged); Heal in a fight only in control, and +wits for the character's own wounds too (the books say the lower of wits and iron); End the Fight two boxes sooner for one in a hurry; +shadow in the fray for one keeping a low profile.

## License

MIT for this module's code. Ironsworn and Starforged are by Shawn Tomkin, under CC BY 4.0; this module isn't affiliated with or endorsed by their author.

---

Developer notes: [CODING_README.md](CODING_README.md). FastFighting itself: [FastFighting Core](https://github.com/galaara98/FastFighting) and its [developer docs](https://github.com/galaara98/FastFighting/blob/main/CODING_README.md).
