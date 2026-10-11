# FastFighting Ironsworn

Ironsworn and Starforged support for [FastFighting Core](https://github.com/galaara98/FastFighting), the Foundry VTT module that simulates a fight (or a tense standoff) thousands of times, tells the story of one fair draw, and commits it to the tokens with **Make it So**.

- **Foundry:** v14
- **System:** Ironsworn & Starforged (`foundry-ironsworn`) 1.20 or later (written against 1.28)
- **Needs:** FastFighting Core (API 6)

## Installation

Install FastFighting Core first, then this module. In Foundry, go to **Add-on Modules → Install Module** and paste:

```
https://github.com/galaara98/FastFighting/releases/latest/download/module.json
https://github.com/galaara98/FastFighting-Ironsworn/releases/latest/download/module.json
```

## What it reads

- **Characters:** edge, heart, iron, shadow and wits; health, momentum (its reset and its ceiling, as impacts leave them); a wound already marked; and, in a fight already under way, who has the initiative (the sheet's combat position). A character's sheet says which rules it plays by: the Ironsworn sheet the classic moves, the Starforged sheet Starforged's.
- **Fighting at range:** a character with an asset for it (Archer, Slinger, Gunner, Sniper, a sidearm ...), or more edge than iron, can Strike and Clash at a distance (+edge) as well as up close (+iron).
- **Foes:** the foe's progress track: its rank (troublesome to epic) and the ticks already marked on it. What it is comes from where its compendium files it (Ironlanders, Firstborn, Animals, Beasts, Horrors, Anomalies) or its words: people and the Firstborn can be talked to; horrors and machines don't break; beasts fight on instinct; the higher the rank, the bolder.

## How a fight plays

The characters make the moves, as in the game; foes never roll.

- **Enter the Fray** (Starforged: Enter the Fight) on a character's first turn, +heart (+shadow when its side springs an ambush, +wits when ambushed): a strong hit, the initiative and +2 momentum; a weak hit, the initiative; a miss, a bad spot and -1 momentum.
- **Strike** with the initiative (in control), **Clash** without it: +iron up close, +edge at range. A hit marks progress on the foe's track, as many ticks a mark as its rank allows (troublesome 12, dangerous 8, formidable 4, extreme 2, epic 1). Ironsworn: a deadly weapon inflicts 2 harm, a simple one or bare hands 1 (characters' sheets don't say, so a world setting does: deadly by default); a strong Strike inflicts +1 harm and keeps the initiative; a weak Strike loses it; a strong Clash takes it. Starforged: a hit on a Strike marks progress twice; a strong hit keeps you in control.
- **Pay the Price:** a miss, or a weak Clash, costs the foe's harm (its rank; one more on matching challenge dice).
- **Endure Harm:** after any harm, +health or +iron: a strong hit shakes it off (+1 health, if not wounded) or embraces the pain (+1 momentum); a weak hit presses on; a miss costs a point of momentum. At 0 health a character fights on, harm beyond its health coming off its momentum; a miss there marks it wounded, or (already wounded) rolls on the harm table: mortal (Face Death, +heart: survive, survive deathbound, or die), dying, out cold, reeling, or still standing.
- **End the Fight** (Starforged: Take Decisive Action): with the initiative and the foe's track at least half full, a progress roll. A hit ends that foe's part in the fight (a weak one costs momentum); a miss loses it, and the price is paid.
- **Burning momentum:** when it turns a miss into a hit (or, with plenty to spare, a weak hit into a strong one); momentum resets after. Never on a progress roll.
- **Talking:** Compel, by heart (persuade), iron (threaten) or shadow (bluff), against challenge dice, harder against a foe of higher rank.

## Make it So

- A character: health, momentum, a wound marked, and how it ended (out cold, dying, dead, or deathbound after Face Death).
- A foe: progress marked on its track, the track completed when it was beaten (and its token marked defeated); a foe that fled is hidden.

Undo puts it all back.

## Development

The tests import FastFighting Core from a checkout beside this one (`../FastFighting`; override with `FASTFIGHTING_CORE`):

```
npm install
npm test
```

Junction or symlink this folder into Foundry as `Data/modules/fast-fighting-ironsworn`.

## License

MIT for this module's code. Ironsworn and Starforged are by Shawn Tomkin, under CC BY 4.0; this module isn't affiliated with or endorsed by their author.
