/**
 * Words for the table, in its language: this module's (FFIRONSWORN in languages/). The words are in the language files,
 * never here. The moves are known by key (FFIRONSWORN.Move.EndureHarm) and named in the reader's language.
 */
import { localize, hasWords } from "./core.js";

/** This module's words. */
export const t = (key, data = null) => localize(`FFIRONSWORN.${key}`, data);

/** A move's name ("Strike", "Endure Harm"), in the reader's language, by its key ("EndureHarm"). */
export const moveName = key => t(`Move.${key}`);

/** A stat's name ("heart"): this module's word for it, else its identifier. */
export const statName = stat => (hasWords(`FFIRONSWORN.Stat.${stat}`) ? t(`Stat.${stat}`) : stat);
