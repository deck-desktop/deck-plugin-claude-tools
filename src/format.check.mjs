// node src/format.check.mjs: capture names and labels, and the quoting, compiled from the real source.
import assert from "node:assert/strict";
import { build } from "esbuild";

const entry = new URL("./format.ts", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const out = await build({ entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node" });
const f = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));

// A capture's name and its label in the band; other files are not captures.
const name = f.captureName("phone", new Date(2026, 10, 14, 17, 5, 12).getTime());
assert.equal(name, "phone-20261114-170512.png");
assert.equal(f.captureLabel(name), "☏ 17:05");
assert.equal(f.captureLabel("snip-20261114-090000.png"), "⎚ 09:00");
assert.equal(f.captureLabel("notes.png"), null);

// PowerShell's -EncodedCommand is UTF-16LE.
assert.equal(Buffer.from(f.encodePs("hé"), "base64").toString("utf16le"), "hé");
assert.equal(f.quote("C:\\a b\\c.png"), "\"C:\\a b\\c.png\"");
assert.equal(f.quote("C:\\a\\c.png"), "C:\\a\\c.png");

console.log("claude-tools: all checks passed");
