/**
 * Building the engine's actions and numbers for Ironsworn and Starforged characters and foes. Pure, unit-tested.
 */
import { movesFor, TICKS, TRACK } from "./moves.js";
import { LORE_BOOST } from "./lore.js";
import { t, moveName } from "./words.js";
import { listItems } from "./core.js";

const harm = n => ({ dice: [], flat: n, type: "harm", persistent: false, category: null });

/**
 * A character's combat moves: Strike and Clash at close quarters (+iron) and, for one who fights at range, at a
 * distance (+edge); and End the Fight (Starforged: Take Decisive Action), a progress roll.
 * @param {object} d
 * @param {string} d.id
 * @param {object} d.stats            {edge, heart, iron, shadow, wits}
 * @param {string} [d.ruleset]        classic | starforged | sundered_isles
 * @param {boolean} [d.ranged]        it fights at range too (a bow, a sidearm)
 * @param {number} [d.extraHarm]      harm added to each hit that inflicts harm (a deadly weapon, an asset)
 * @param {object} [d.moves]          the moves it makes (movesFor: its ruleset's, with the world's preference)
 * @param {boolean} [d.assets]        it has assets (a companion, a path, a ritual): Securing an Advantage is how it
 *                                    brings them to bear, its specialty (what "magic and specialties" means here)
 * @param {boolean} [d.healer]        its assets make healing its thing (a Herbalist, a Healer): its Heal is its
 *                                    specialty too, not only the move anyone can make
 */
export function characterMoves({ id, stats, ruleset = "classic", ranged = false, extraHarm = 0, moves = null, assets = false, healer = false }) {
  const m = moves ?? movesFor(ruleset);
  const out = [];
  const forms = [{ key: "close", stat: "iron", melee: true }];
  if ( ranged ) forms.push({ key: "range", stat: "edge", melee: false });
  for ( const f of forms ) {
    const reach = f.melee ? { melee: true, reach: 5, range: null } : { melee: false, range: { increment: 60, max: 120, noPenalty: true } };
    const label = f.melee ? "" : t("AtRange");
    for ( const move of ["strike", "clash"] ) {
      out.push({
        id: `${id}.${move}.${f.key}`, name: `${m[move].name}${label}`, kind: "strike", cost: 1, move, bonus: stats?.[f.stat] ?? 1, stat: f.stat, ...reach,
        // (A weapon's harm counts only where the move inflicts harm: Ironsworn's; Starforged's marks progress.)
        damage: [harm(m[move].weak + (m[move].harm ? extraHarm : 0))], critDamage: [harm(m[move].strong + (m[move].harm ? extraHarm : 0))], traits: [], weapon: true
      });
    }
  }
  out.push({
    id: `${id}.finish`, name: m.finish.name, kind: "strike", cost: 1, move: "finish", progressRoll: true, finish: true, bonus: 0,
    melee: true, reach: 5, range: null, damage: [harm(1)], critDamage: [harm(1)], traits: []
  });
  out.push(...advantageMoves({ id, stats, moves: m }).map(a => (a.targets === "self" ? { ...a, special: !!assets } : a)));
  out.push(healMove({ id, stats, healer }));
  return out;
}

/**
 * Heal (the game's own move; in a fight, for one in control): +wits, for a friend or itself (the books have it roll
 * the lower of wits and iron for its own wounds: here, wits either way). A hit gives +2 health (a weak hit costs a point
 * of momentum); a miss pays the price. Anyone can make it, so it's no specialty (and makes no one a healer), unless its
 * assets make healing its thing (`healer`).
 */
export function healMove({ id, stats, healer = false }) {
  return {
    id: `${id}.heal`, name: moveName("Heal"), kind: "heal", cost: 1, move: "heal", reach: 5, traits: [], special: !!healer,
    heal: [{ dice: [], flat: 2, type: "healing", persistent: false, category: null }], healCheck: { mod: Number(stats?.wits) || 1, dc: 10, label: moveName("Heal") }
  };
}

/**
 * How a Lore-Collector sizes a foe up: Secure an Advantage, assessing it (+wits). A hit makes its next attack, or its
 * next words (Compel: persuading, threatening, deceiving), likelier to succeed (`boost`: the world's setting, 2.35×
 * unless it says otherwise: see lore.js), at whoever it's aimed; a miss pays the price.
 */
export function loreSizeUp(stats, boost = LORE_BOOST.default) {
  return { mod: Number(stats?.wits) || 1, dc: 10, label: moveName("SecureanAdvantage"), boost, uses: 1, anyFoe: true, missOutcome: { price: true, label: moveName("PaythePrice") } };
}

/**
 * Securing an advantage in a fight (in control): Secure an Advantage (Starforged: Gain Ground) for itself, and Aid
 * Your Ally for a friend, each with its best approach (the stat it would envision it with). What a hit gives, by the
 * ruleset: +1 on the next move (spent by that move), momentum; a strong hit aiding a friend puts both in control. A
 * miss pays the price.
 */
export function advantageMoves({ id, stats, moves }) {
  const m = moves ?? movesFor("classic");
  if ( !m.advantage ) return [];
  const best = Math.max(...["edge", "heart", "iron", "shadow", "wits"].map(k => Number(stats?.[k]) || 1));
  const gives = r => {
    const o = { rounds: 1 };
    const said = [];
    if ( r.next ) {
      o.mods = { attack: r.next, checks: r.next };
      o.uses = 1;
      said.push(t("Gives.Next", { n: `+${r.next}` }));
    }
    if ( r.momentum ) {
      o.resources = { momentum: r.momentum };
      said.push(t("Gives.Momentum", { n: `+${r.momentum}` }));
    }
    o.label = listItems(said);
    return o;
  };
  const price = { price: true, failed: true, rounds: 1, label: m.price.name };
  const check = { mod: best, dc: 10, label: m.advantage.name };
  return [
    // (Gaining leverage on a foe, finding its weak point: what a spoiler and a Puzzle-Maniac go for; one in a hurry
    // doesn't stop for it.)
    { id: `${id}.advantage`, name: m.advantage.name, kind: "buff", targets: "self", cost: 1, move: "advantage", check, traits: [], setup: true, leans: ["hinders", "exploitWeakness"],
      onDegree: [price, price, gives(m.advantage.weak), gives(m.advantage.strong)] },
    { id: `${id}.aid`, name: m.aid?.name ?? moveName("AidYourAlly"), kind: "buff", includeSelf: false, cost: 1, move: "advantage", traits: [],
      range: { increment: 120, max: 120, noPenalty: true }, check: { ...check, label: m.aid?.name ?? moveName("AidYourAlly") },
      onDegree: [price, price, gives(m.advantage.weak), { ...gives(m.advantage.strong), takeControl: true }] }
  ];
}

/**
 * A foe's numbers: its track (ticks left are its hit points), how much a mark fills at its rank, the harm it does,
 * and a plain attack for anyone who isn't a character (a companion, a hired hand).
 * @param {object} d
 * @param {string} d.id
 * @param {number} d.rank     1 troublesome ... 5 epic
 * @param {number} [d.current]  ticks already marked
 */
export function foeNumbers({ id, rank, current = 0 }) {
  const r = Math.max(1, Math.min(5, Number(rank) || 2));
  const marked = Math.max(0, Math.min(TRACK, Number(current) || 0));
  return {
    rank: r,
    level: r,
    hp: { value: TRACK - marked, max: TRACK, temp: 0 },
    iwr: { immune: [], weak: {}, resist: {}, ticksPerHarm: TICKS[r] },
    actions: [{ id: `${id}.attack`, name: t("Attack"), kind: "strike", cost: 1, bonus: r + 2, melee: true, reach: 5, damage: [harm(r)], traits: [] }]
  };
}
