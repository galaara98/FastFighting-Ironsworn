/**
 * Building the engine's actions and numbers for Ironsworn and Starforged characters and foes. Pure, unit-tested.
 */
import { movesFor, TICKS, TRACK } from "./moves.js";

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
 */
export function characterMoves({ id, stats, ruleset = "classic", ranged = false, extraHarm = 0, moves = null }) {
  const m = moves ?? movesFor(ruleset);
  const out = [];
  const forms = [{ key: "close", stat: "iron", melee: true }];
  if ( ranged ) forms.push({ key: "range", stat: "edge", melee: false });
  for ( const f of forms ) {
    const reach = f.melee ? { melee: true, reach: 5, range: null } : { melee: false, range: { increment: 60, max: 120, noPenalty: true } };
    const label = f.melee ? "" : " (at range)";
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
  return out;
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
    actions: [{ id: `${id}.attack`, name: "Attack", kind: "strike", cost: 1, bonus: r + 2, melee: true, reach: 5, damage: [harm(r)], traits: [] }]
  };
}
