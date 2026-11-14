// What the buttons do outside Deck: capture the phone's screen (adb) or a snip of this one into the
// message box, and tidy the draft with Claude (claude -p).
import { dataDir, exec, fsCreateDir, fsDelete, fsList, isWindows } from "deck-plugin-sdk/bridge";
import { getBox, insertInBox, setBox } from "deck-plugin-sdk/chat";
import { notify } from "deck-plugin-sdk/ui";
import { captureLabel, captureName, encodePs, quote } from "./format";
import { SNIP_PS } from "./snip";
import { patch, stateOf } from "./store";
import { getSettings } from "./settings";

const source = "Claude tools";
const notice = (title: string) => void notify({ kind: "activity", source, title, transient: true });
const failure = (title: string, body?: string) => void notify({ kind: "error", source, title, body });

// ---- captures -----------------------------------------------------------------------------------

/** Captures are kept in the plugin's own folder (never the user's Screenshots), for as many days as its setting says. */
const keepMs = () => Number(getSettings().keep) * 24 * 60 * 60 * 1000;
const capturesDir = async () => `${await dataDir()}\\captures`;

const powershell = (script: string) =>
  exec("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", encodePs(`$ProgressPreference = "SilentlyContinue"\n${script}`)]);
const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** One capture at a time, per chat: a second press while one runs does nothing. */
async function capturing(pane: string, run: () => Promise<string | null>) {
  if (stateOf(pane).busy) return;
  patch(pane, { busy: "capture" });
  try {
    const path = await run();
    if (path) insertInBox(pane, quote(path));
    // Clears out the ones older than a day as it lists them.
    void captures().catch(() => {});
  } catch (e) {
    console.warn("[claude-tools] capture failed", e);
    failure("The capture failed", String(e));
  } finally {
    patch(pane, { busy: null });
  }
}

/** The connected phone's screen: screencap on the device, pulled here, removed there. */
export const snapPhone = (pane: string) => capturing(pane, async () => {
  const devices = (await exec("adb", ["devices"]).catch(() => null))?.stdout;
  if (devices == null) { failure("adb was not found", "Install Android's platform tools, or put adb on PATH."); return null; }
  const serial = devices.split("\n").map((l) => l.trim().split(/\s+/)).find(([s, state]) => s && state === "device")?.[0];
  if (!serial) { notice("No phone is connected"); return null; }
  const dir = await capturesDir(), out = `${dir}\\${captureName("phone", Date.now())}`, remote = "/sdcard/deck-snap.png";
  await fsCreateDir(await dataDir(), "captures").catch(() => {}); // there already
  const shot = await exec("adb", ["-s", serial, "shell", "screencap", "-p", remote]);
  if (shot.code !== 0) { failure("The phone's screen could not be captured", shot.stderr.trim()); return null; }
  const pull = await exec("adb", ["-s", serial, "pull", remote, out]);
  void exec("adb", ["-s", serial, "shell", "rm", remote]).catch(() => {});
  if (pull.code !== 0) { failure("The capture could not be copied from the phone", pull.stderr.trim()); return null; }
  return out;
});

/** A snip of this screen, through Windows' own overlay. */
export const snip = (pane: string) => capturing(pane, async () => {
  const out = `${await capturesDir()}\\${captureName("snip", Date.now())}`;
  const ran = await powershell(`$out = ${psQuote(out)}\n${SNIP_PS}`);
  if (ran.code === 0) return ran.stdout.trim() || out;
  if (ran.code === 1) notice("No snip within 30 seconds");
  return null;
});

export interface Capture { path: string; label: string }
/** The latest captures, newest first; ones older than the setting keeps are deleted on the way. */
export async function captures(): Promise<Capture[]> {
  const files = await fsList(await capturesDir()).catch(() => []);
  const now = Date.now(), KEEP_MS = keepMs();
  for (const f of files) {
    if (!f.dir && captureLabel(f.name) && now - f.mtimeMs > KEEP_MS) void fsDelete(f.path).catch((e) => console.warn("[claude-tools] removing an old capture failed", e));
  }
  return files.filter((f) => !f.dir && captureLabel(f.name) && now - f.mtimeMs <= KEEP_MS)
    .sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 9)
    .map((f) => ({ path: f.path, label: captureLabel(f.name)! }));
}

// ---- tidy -----------------------------------------------------------------------------------------

const TIDY_SYSTEM = `You rewrite a developer's draft prompt for an AI coding assistant into a clear, well-structured request.
Keep every requirement, detail, file name, path, error text, constraint and preference, and keep the developer's intent and first-person voice.
Do not add new requirements, do not answer the request, and do not ask questions.
Remove filler and false starts ("uh", "okay so", repeated phrases) and fix obvious speech-to-text mistakes.
If the draft asks several things, put them in a short numbered list; otherwise keep it as one or two short paragraphs.
Write in the same language as the draft. Output only the rewritten prompt.`;

/** Rewrites the draft in the message box with Claude (the model its setting names), in place; nothing is sent. */
export async function tidy(pane: string, cwd: string) {
  const draft = getBox(pane).text;
  if (!draft.trim() || stateOf(pane).busy) return;
  patch(pane, { busy: "tidy" });
  try {
    // claude.exe by its file name, so the draft goes to it as one argument and never through
    // cmd.exe, after "--" so a draft starting with "-" is not read as an option. --safe-mode leaves
    // out the user's CLAUDE.md, hooks and plugins, which would add to its instructions; no tools,
    // and no session left behind in /resume. Given up on after 90 s, so a hung run frees the chips.
    const r = await Promise.race([
      exec(isWindows() ? "claude.exe" : "claude", ["-p", "--safe-mode", "--model", getSettings().tidyModel, "--system-prompt", TIDY_SYSTEM,
        "--tools", "", "--no-session-persistence", "--", draft], cwd),
      new Promise<never>((_, no) => setTimeout(() => no(new Error("no answer in 90 seconds")), 90_000)),
    ]);
    const tidied = r.stdout.trim();
    if (r.code !== 0 || !tidied) { failure("The draft could not be tidied", (r.stderr || r.stdout).trim().slice(0, 400)); return; }
    // Written over only if the draft is still what was sent: typing meanwhile wins.
    if (getBox(pane).text !== draft) return;
    setBox(pane, { text: tidied });
    patch(pane, { tidy: { original: draft, tidied } });
  } catch (e) {
    console.warn("[claude-tools] tidy failed", e);
    failure("The draft could not be tidied", String(e));
  } finally {
    patch(pane, { busy: null });
  }
}

/** Puts the draft from before the tidy back. */
export function untidy(pane: string) {
  const t = stateOf(pane).tidy;
  if (t) setBox(pane, { text: t.original });
  patch(pane, { tidy: null });
}


