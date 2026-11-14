// Claude tools: buttons in a Claude chat's message box row that put things in the message: the
// connected phone's screen, a snip of this one, a recent capture again; and a tidy of the draft by
// Claude, with its undo. The band over the box lists recent captures.
import { useEffect, useState } from "react";
import { Images, Loader2, Scissors, Smartphone, Undo2, WandSparkles, X } from "lucide-react";
import { isWindows, openFile } from "deck-plugin-sdk/bridge";
import { insertInBox, useBox, useChat } from "deck-plugin-sdk/chat";
import { ChatChip, ChatIconButton } from "deck-plugin-sdk/ui";
import { captures, snapPhone, snip, tidy, untidy, type Capture } from "./actions";
import { quote } from "./format";
import { patch, usePaneState } from "./store";
import { useSettings } from "./settings";

// Its settings, drawn by Deck on its page of Settings; dispose stops their listener before a reload.
export { dispose, settings } from "./settings";

/** The row's two ends (Deck's ChatChips and ChatChipsEnd): the buttons sit at the one their setting names. */
export const ChatChips = ({ pane }: { pane: string }) => <Buttons pane={pane} end={false} />;
export const ChatChipsEnd = ({ pane }: { pane: string }) => <Buttons pane={pane} end />;

function Buttons({ pane, end }: { pane: string; end: boolean }) {
  const chat = useChat(pane), s = usePaneState(pane), box = useBox(pane), cfg = useSettings();
  if ((cfg.at === "end") !== end) return null;
  const capturing = cfg.phone || (cfg.snip && isWindows());
  return (
    <>
      {cfg.phone && <ChatIconButton onClick={() => void snapPhone(pane)} disabled={s.busy === "capture"} aria-label="Capture the phone's screen" title="Capture the connected phone's screen into the message"><Smartphone size={13} /></ChatIconButton>}
      {cfg.snip && isWindows() && <ChatIconButton onClick={() => void snip(pane)} disabled={s.busy === "capture"} aria-label="Snip the screen" title="Snip part of the screen into the message"><Scissors size={13} /></ChatIconButton>}
      {capturing && <ChatIconButton onClick={() => patch(pane, { open: !s.open })} aria-label="Recent captures" aria-pressed={s.open} title="Recent captures, to add one again"><Images size={13} /></ChatIconButton>}
      {cfg.tidy && (s.busy === "tidy"
        ? <ChatIconButton disabled aria-label="Tidying" title="Tidying the draft…"><Loader2 size={13} className="animate-spin" /></ChatIconButton>
        : <ChatIconButton onClick={() => void tidy(pane, chat.cwd)} disabled={!box.text.trim()} aria-label="Tidy the draft" title="Tidy the draft with Claude: clearer, nothing added, not sent"><WandSparkles size={13} /></ChatIconButton>)}
      {cfg.tidy && s.tidy && box.text === s.tidy.tidied && <ChatIconButton onClick={() => untidy(pane)} aria-label="Undo the tidy" title="Put the draft from before the tidy back"><Undo2 size={13} /></ChatIconButton>}
    </>
  );
}

function Captures({ pane }: { pane: string }) {
  const [list, setList] = useState<Capture[] | null>(null);
  useEffect(() => { void captures().then(setList).catch((e) => { console.warn("[claude-tools] listing captures failed", e); setList([]); }); }, []);
  if (!list) return <span className="text-text-muted">Loading…</span>;
  if (!list.length) return <span className="text-text-muted">No recent captures. Capture the phone's screen or snip this one with the buttons below.</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((c) => (
        <span key={c.path} className="flex items-center">
          <ChatChip onClick={() => { insertInBox(pane, quote(c.path)); patch(pane, { open: false }); }} title={`Add to the message: ${c.path}`}>{c.label}</ChatChip>
          <button onClick={() => void openFile(c.path).catch((e) => console.warn("[claude-tools] opening a capture failed", e))} className="px-1.5 text-[11px] text-text-muted hover:text-text-primary" title="Open it">view</button>
        </span>
      ))}
    </div>
  );
}

export function ChatBand({ pane }: { pane: string }) {
  const s = usePaneState(pane);
  if (!s.open) return null;
  return (
    <div className="flex w-full flex-col gap-2 rounded-[12px] bg-card px-3 py-2.5 text-[12px] shadow-[inset_0_0_0_1px_var(--border-strong)]">
      <div className="flex items-center gap-2">
        <span className="font-medium text-text-primary">Recent captures</span>
        <span className="flex-1" />
        <button onClick={() => patch(pane, { open: false })} aria-label="Close" title="Close" className="grid size-5 place-items-center rounded text-text-muted hover:bg-white/10 hover:text-text-primary"><X size={12} /></button>
      </div>
      <Captures pane={pane} />
    </div>
  );
}
