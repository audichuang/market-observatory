import type { Budget } from "../lib/sources/http.ts";
import { SOURCE_REGISTRY } from "../lib/sources/registry.ts";
import { type Db, getSetting, nowIso, putSetting } from "./repo.ts";

export const SOURCE_SWITCHES_KEY = "source_switches";
export type SourceSwitches = Record<string, { disabled: true; at: string; reason?: string }>;

export function loadSourceSwitches(db: Db): Promise<SourceSwitches> {
  return getSetting<SourceSwitches>(db, SOURCE_SWITCHES_KEY, {});
}

export async function setSourceSwitch(db: Db, id: string, disabled: boolean, reason?: string): Promise<SourceSwitches> {
  const switches = await loadSourceSwitches(db);
  if (disabled) switches[id] = { disabled: true, at: nowIso(), ...(reason !== undefined ? { reason } : {}) };
  else delete switches[id];
  await putSetting(db, SOURCE_SWITCHES_KEY, switches);
  return switches;
}

export async function applySourceSwitches(db: Db, budget: Budget): Promise<void> {
  const switches = await loadSourceSwitches(db);
  budget.block(SOURCE_REGISTRY
    .filter((source) => source.runtime === "worker" && switches[source.id]?.disabled)
    .map((source) => ({ id: source.id, label: source.name, patterns: source.patterns })));
}
