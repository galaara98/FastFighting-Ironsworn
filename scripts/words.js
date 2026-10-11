/**
 * Words for the table, in its language: this module's (FFIRONSWORN in languages/), English without Foundry (the
 * tests). The moves are named as the rulebooks name them in English, and in the reader's language here.
 */
import { localize } from "./core.js";

/** This module's words. */
export const t = (key, english, data = null) => localize(`FFIRONSWORN.${key}`, english, data);

/** A move's name ("Strike", "Endure Harm"), in the reader's language. */
export const moveName = english => t(`Move.${String(english).replace(/[^A-Za-z]/g, "")}`, english);

/** A stat's name ("heart"). */
export const statName = stat => t(`Stat.${stat}`, stat);
