// What a user can change: which buttons show and where, the model a tidy uses, and how long captures
// are kept. Deck draws these rows on the plugin's page of Settings and keeps the values in its
// `settings` config; this reads them, and again whenever it changes.
import { useSyncExternalStore } from "react";
import { configRead } from "deck-plugin-sdk/bridge";
import { listen } from "deck-plugin-sdk/event";

/** On the plugin's own page of Settings (no Deck group is named "chat"). */
const IN = "chat";
export const settings = [
  { in: IN, key: "at", title: "Where the buttons sit", desc: "In the message box's row: left after the model, or right before send.",
    choices: [["start", "Left"], ["end", "Right"]], default: "start" },
  { in: IN, key: "phone", title: "Capture the phone's screen", desc: "A button that puts the connected phone's screen in the message (adb).", default: true },
  { in: IN, key: "snip", title: "Snip the screen", desc: "A button that puts a snip of this screen in the message (Windows).", default: true },
  { in: IN, key: "tidy", title: "Tidy the draft", desc: "A button that has Claude rewrite your draft into a clear request, without sending it.", default: true },
  { in: IN, key: "tidyModel", title: "Model for tidying",
    choices: [["sonnet", "Sonnet"], ["haiku", "Haiku (faster)"], ["opus", "Opus"]], default: "sonnet" },
  { in: IN, key: "keep", title: "Keep captures for",
    choices: [["1", "A day"], ["7", "A week"]], default: "1" },
] as const;

type Row = (typeof settings)[number];
export type Settings = { [R in Row as R["key"]]: R extends { choices: readonly (readonly [infer V, string])[] } ? V : boolean };

const defaults = Object.fromEntries(settings.map((r) => [r.key, r.default])) as Settings;
let values: Settings = defaults;
const subs = new Set<() => void>();

const read = () => configRead("settings")
  .then((t) => { values = { ...defaults, ...(t.trim() ? JSON.parse(t) : {}) }; subs.forEach((f) => f()); })
  .catch((e) => console.warn("[claude-tools] settings load failed", e));
void read();
// config-changed names a plugin's own config "settings" (the shim drops its data/<id>/ folder).
const unlisten = listen<string[]>("config-changed", (e) => { if (e.payload.includes("settings")) void read(); });

/** Stops listening, before a reload imports the plugin again. */
export const dispose = () => void unlisten.then((f) => f());

export const getSettings = () => values;
export function useSettings(): Settings {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => values);
}
