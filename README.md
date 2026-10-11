# FastFighting Ironsworn

> **AI use:** This module used AI in its creation.
> - **Programming:** I am a skilled programmer by profession, but AI was used heavily as a co-pilot.
> - **Strings:** ALL initial strings were created by AI. An AI-made Spanish translation was used to test localization and has since been removed.

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

- **Enter the Fray** on a character's first turn: +shadow when its side springs an ambush, +wits when ambushed; otherwise Ironsworn's +heart, or Starforged's best of +edge, +heart and +iron. A strong hit, the initiative and +2 momentum; a weak hit, the initiative; a miss, a bad spot (Ironsworn: and Pay the Price, -1 momentum).
- **Strike** with the initiative (in control), **Clash** without it: +iron up close, +edge at range. A hit marks progress on the foe's track, as many ticks a mark as its rank allows (troublesome 12, dangerous 8, formidable 4, extreme 2, epic 1). Ironsworn: a deadly weapon inflicts 2 harm, a simple one or bare hands 1 (characters' sheets don't say, so a world setting does: deadly by default); a strong Strike inflicts +1 harm and keeps the initiative; a weak Strike loses it; a strong Clash takes it. Starforged: a hit on a Strike marks progress twice; a strong hit keeps you in control.
- **Pay the Price:** a miss, or a weak Clash, costs the foe's harm (its rank; one more on matching challenge dice).
- **Endure Harm:** after any harm, +health or +iron: a strong hit shakes it off (+1 health; Ironsworn's for a point of momentum, Starforged's free if not wounded) or embraces the pain (+1 momentum); a weak hit presses on (Starforged: a point of momentum for +1 health, if not wounded); a miss costs a point of momentum (Starforged: -1 health, or -2 momentum). At 0 health a character fights on, harm beyond its health coming off its momentum; a miss there marks it wounded, or (already wounded) rolls on the harm table: mortal (Face Death, +heart: survive, survive deathbound, or die), dying, out cold, reeling, or still standing.
- **End the Fight** (Starforged: Take Decisive Action): with the initiative and the foe's track at least half full, a progress roll. A hit ends that foe's part in the fight (a weak one costs momentum); a miss loses it, and the price is paid.
- **Burning momentum:** when it turns a miss into a hit (or, with plenty to spare, a weak hit into a strong one); momentum resets after. Never on a progress roll.
- **Securing an advantage** (in control), with the character's best approach (its highest stat): Ironsworn's **Secure an Advantage** (a strong hit: +1 on the next move; a weak hit: +1 momentum) or Starforged's **Gain Ground** (a strong hit: +1 on the next move and +2 momentum; a weak hit: +1 on the next move). **Aid Your Ally** gives the same to a friend, and a strong hit puts both in control. A miss pays the price: -1 momentum, and the upper hand lost. A Strike usually does more, so a character secures an advantage when it fights poorly next to a friend who fights well, when it's set on helping (a stated desire), or when a friend asks it to (a friend's "Be bolstered by" desire, and a language in common). Momentum counts for something: a step toward burning it.
- **A Lore-Collector** sizes a foe up by Securing an Advantage, assessing it (+wits). A hit makes its next attack, or its next Compel (persuading, threatening, deceiving), likelier to succeed, at whoever it's aimed, by the **Lore-Collector advantage** setting (1.25× to 3×; default 2.35×: what it takes for that one roll to make up for the move it cost, with +3 wits hitting 77% of the time and a miss paying the price). Ironsworn's dice cap a roll near 95%, so a Strike gets all it can by about 1.5× (+2 iron) or 1.75× (+1); the rest helps Compel a hardier foe, where the odds start low. A miss pays the price.
- **Talking:** Compel, by heart (persuade), iron (threaten) or shadow (bluff), against challenge dice, harder against a foe of higher rank.
- **Paying, and giving ground:** there are no coins or goods. A character who pays (to strike a deal, or talked into it) pays in Supply, which its side shares: what one pays, all of them have that much less of. A foe made to give something up gives ground instead: a mark of progress on its own track, the winners' reward. What a character can offer or expect in a standoff is Supply, or a promise.

## Rules preference

With more than one ruleset on in the world, Ironsworn, Starforged and Sundered Isles have moves of the same name that play differently: Strike, Clash, Endure Harm, Enter the Fray. **Settings → FastFighting Ironsworn → Rules preference** says which version a character makes, one pill on at a time:

- **Follow character sheets** (the default): every character makes the moves of the sheet it's on now, the token's own choice of sheet over its actor's (an Ironsworn sheet's; a Starforged sheet's, or Sundered Isles' in a world with that on and not Starforged), even where that sheet shows other rulesets' moves too. A sheet that's neither (the compact sheet) goes by the rulesets the world has on, Ironsworn first.
- **Prefer Ironsworn**, **Prefer Starforged**, **Prefer Sundered Isles**: where that ruleset has a move of the same name (and the world has it on), every character makes that ruleset's version. Of the combat moves, Sundered Isles has its own Enter the Fray. Moves called differently stay the character's own (End the Fight, Take Decisive Action), and so do the words for who has the upper hand (the initiative, in control). A deadly weapon's harm counts only on Ironsworn's Strike and Clash; Starforged's mark progress.

## Make it So

- A character: health, momentum, a wound marked, and how it ended (out cold, dying, dead, or deathbound after Face Death).
- A foe: progress marked on its track, the track completed when it was beaten (and its token marked defeated); a foe that fled is hidden.
- Supply paid: lowered for every character on the payer's side, and (with the system's Shared Supply Tracker on, as it is by default) every character and starship it shares Supply with. Ground given: a mark of progress on the foe's track.

Undo puts it all back.

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
