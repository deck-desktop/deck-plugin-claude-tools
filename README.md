# Claude tools

Buttons in a Claude chat's message box in Deck, for putting things in the message:

- **Capture the phone's screen** (over adb) into the message.
- **Snip part of this screen** into the message (Windows).
- **Recent captures**, a click away for a day (or a week), then deleted. They are kept in the plugin's
  own folder, never in your Screenshots.
- **Tidy the draft**: Claude rewrites what you have typed into a clear request, keeping every detail and
  adding nothing; it is not sent. Undo puts your draft back.

Settings choose which buttons show, which end of the row they sit at, the model a tidy uses (Sonnet
by default), and how long captures are kept.

## Developing

```sh
npm run dev   # rebuild as you edit; each save shows in your test Deck
npm test      # capture names and the quoting
```

Needs a Deck with chat plugins (after 1.17.4). Permissions: `chat`, `processes` (adb, PowerShell,
claude) and `files` (its captures).
