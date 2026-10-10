/**
 * The single source of truth for a Nest's world state.
 *
 * Only verified bills move the world: Home's hero scene, the sparrow pose and
 * the label all read this function, and nothing else may change the state.
 *
 * Bills are ordered newest-first (the shape the data API returns):
 *   bills[0] = latest bill, bills[1] = the previous bill.
 * Both figures are the household's own meter readings ("same units basis"),
 * so they are compared directly.
 *
 * Thresholds (from the brief):
 *   fewer than 2 bills                                   -> "dawn"
 *   units up by more than 5%                             -> "hazy"
 *   drop of 5% to under 15%                              -> "fresh"
 *   drop of 15% or more                                  -> "thriving"
 *   otherwise (within +/-5%)                             -> "dawn"
 */
import type { Bill } from "./api/data";

export type WorldState = "dawn" | "hazy" | "fresh" | "thriving";

export function worldState(bills: Bill[]): WorldState {
  if (bills.length < 2) return "dawn";
  const latest = bills[0];
  const previous = bills[1];
  if (!(previous.units > 0)) return "dawn";
  const dropPct = ((previous.units - latest.units) / previous.units) * 100;
  if (dropPct >= 15) return "thriving";
  if (dropPct >= 5) return "fresh";
  if (dropPct < -5) return "hazy";
  return "dawn";
}