// Names and labels for captures, and the bits of quoting the actions need. Pure, so format.check.mjs
// calls it directly.

/** A capture's file name: phone-20261114-170512.png / snip-…, from its kind and time. */
export function captureName(kind: "phone" | "snip", ms: number): string {
  const d = new Date(ms), p = (n: number) => String(n).padStart(2, "0");
  return `${kind}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}

/** A capture's label in the band, from its file name: "☏ 17:05" or "⎚ 17:05"; null for another file. */
export function captureLabel(name: string): string | null {
  const m = /^(phone|snip)-\d{8}-(\d\d)(\d\d)\d\d\.png$/.exec(name);
  return m ? `${m[1] === "phone" ? "☏" : "⎚"} ${m[2]}:${m[3]}` : null;
}

/** PowerShell's -EncodedCommand: base64 of the script in UTF-16LE. */
export function encodePs(script: string): string {
  let bin = "";
  for (let i = 0; i < script.length; i++) { const c = script.charCodeAt(i); bin += String.fromCharCode(c & 0xff, c >> 8); }
  return btoa(bin);
}

/** A path as one word in the message box: quoted when it has a space. */
export const quote = (p: string) => (/\s/.test(p) ? `"${p}"` : p);
