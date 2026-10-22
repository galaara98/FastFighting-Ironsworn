/**
 * The planner's fights on background workers (the core's API 22): this helper opens its rules to them
 * (adapter.workerRules: rules.js's ironswornRules), and rules.js loads and plays with nothing of Foundry's, as a worker
 * has it. On real threads (node's worker_threads, tests/fixtures/batch-thread.js), a batch of Ironsworn fights split
 * among workers and put back in order is exactly what the main thread's runBatchSync gives.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { Worker as NodeWorker } from "node:worker_threads";
import { runBatchSync } from "../../FastFighting/scripts/engine/simulator.js";
import { openPool } from "../../FastFighting/scripts/engine/batch-pool.js";
import { ironswornRules } from "../scripts/rules.js";
import { characterMoves, foeNumbers } from "../scripts/build.js";
import { deriveIronswornTraits, speaks } from "../scripts/traits.js";
import { IronswornAdapter } from "../scripts/adapter.js";

const RULES = new IronswornAdapter().workerRules();
const SCRIPTS = fileURLToPath(new URL("../scripts/", import.meta.url));

const threads = [];
/** A worker thread running the core's batch-worker.js, shaped like a browser's Worker. */
function thread(workerData = null) {
  const t = new NodeWorker(new URL("./fixtures/batch-thread.js", import.meta.url), { workerData });
  threads.push(t);
  const w = { onmessage: null, onerror: null, onmessageerror: null };
  t.on("message", data => w.onmessage?.({ data }));
  t.on("error", err => w.onerror?.({ message: err.message }));
  w.postMessage = message => t.postMessage(message);
  w.terminate = () => { t.terminate(); };
  return w;
}
afterAll(async () => { await Promise.all(threads.map(t => t.terminate())); });

const at = (x, y = 0) => ({ x, y, size: 5 });
const traits = t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { base: v, fudge: 0 }]));
function hero(id, position, { stats = { edge: 2, heart: 2, iron: 3, shadow: 1, wits: 1 }, ruleset = "classic", ...over } = {}) {
  return {
    id, name: id, side: "friendly", kind: "pc", level: 1, mover: true, ruleset, stats, position,
    hp: { value: 5, max: 5, temp: 0 }, defenses: { ac: 10, fortitude: 2, reflex: 2, will: 2 }, initiative: { mod: stats.wits }, speeds: { walk: 30 },
    resources: { momentum: 2 }, momentumReset: 2, momentumMax: 10, spirit: { value: 5, max: 5 }, iwr: { immune: [], weak: {}, resist: {} },
    actions: characterMoves({ id, stats, ruleset }), traits: traits(deriveIronswornTraits({ pc: true, stats }).traits), flags: {}, diesAtZero: false,
    social: { pitches: { persuade: { skill: "heart", mod: stats.heart } }, resist: {}, languages: ["common"] }, ...over
  };
}
function foe(id, position, { rank = 2, nature = "people", ...over } = {}) {
  const n = foeNumbers({ id, rank });
  return {
    id, name: id, side: "hostile", kind: "npc", ...n, nature, position, defenses: { ac: 10, fortitude: rank, reflex: rank, will: rank }, initiative: { mod: rank - 2 },
    speeds: { walk: 30 }, resources: {}, traits: traits(deriveIronswornTraits({ pc: false, rank, nature }).traits), flags: {}, diesAtZero: true,
    social: speaks(nature) ? { pitches: {}, resist: {}, languages: ["common"] } : { pitches: {}, resist: {}, languages: [] }, ...over
  };
}
const battle = (combatants, options = {}) => ({
  combatants, sides: { friendly: { label: "Ironsworn", enemies: ["hostile"] }, hostile: { label: "Foes", enemies: ["friendly"] } },
  options: { positioning: true, maxRounds: 8, ...options }
});

/** Two Ironsworn heroes and a Starforged one against raiders, a wolf and a horror: harm, stress, the tables, the fray. */
function skirmish() {
  return battle([
    hero("kara", at(0)), hero("brand", at(0, 10), { stats: { edge: 3, heart: 1, iron: 2, shadow: 2, wits: 1 } }),
    hero("vex", at(0, 20), { ruleset: "starforged", stats: { edge: 1, heart: 3, iron: 2, shadow: 1, wits: 2 } }),
    foe("raider1", at(30)), foe("raider2", at(30, 10)), foe("wolf", at(35, 5), { nature: "animal" }), foe("haunt", at(40, 15), { rank: 3, nature: "horror" })
  ]);
}

describe("this helper's rules for the planner's workers", () => {
  test("workerRules: rules.js beside the adapter, its ironswornRules", async () => {
    expect(RULES).toEqual({ url: new URL("../scripts/rules.js", import.meta.url).href, exportName: "ironswornRules" });
    expect((await import(RULES.url))[RULES.exportName]).toBe(ironswornRules);
  });

  test("rules.js imports nothing of the Foundry side (no sheets, cards or chat)", () => {
    const seen = new Set();
    const walk = file => {
      if ( seen.has(file) ) return;
      seen.add(file);
      const src = fs.readFileSync(file, "utf8");
      for ( const m of src.matchAll(/(?:import|export)\s[^;]*?from\s+"(\.\/[^"]+)"/g) ) walk(path.join(path.dirname(file), m[1]));
    };
    walk(path.join(SCRIPTS, "rules.js"));
    const names = [...seen].map(f => path.basename(f)).sort();
    for ( const foundrySide of ["adapter.js", "commit.js", "read-turn.js", "main.js", "system-roll.js", "lore.js", "leadership.js"] ) {
      expect(names).not.toContain(foundrySide);
    }
  });

  test("loaded on a thread with nothing of Foundry's, it reads none of Foundry's globals", async () => {
    const w = thread({ trap: RULES.url });
    const said = await new Promise((resolve, reject) => { w.onmessage = e => resolve(e.data); w.onerror = reject; });
    expect(said).toEqual({ type: "touched", names: [] });
  }, 30000);
});

describe("Ironsworn fights on real threads: what runBatchSync gives", () => {
  test("heroes of both rulesets against raiders, a wolf and a horror", async () => {
    const warn = vi.spyOn(console, "warn");
    const spec = skirmish();
    const pool = openPool(RULES, { size: 4, makeWorker: () => thread() });
    const r = await pool.run(spec, ironswornRules, { runs: 60, seed: 17 });
    pool.close();
    expect(pool.used).toBe(4);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    expect(r).toEqual(runBatchSync(spec, ironswornRules, { runs: 60, seed: 17 }));
  }, 60000);
});
