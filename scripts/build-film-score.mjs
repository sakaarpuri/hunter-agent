import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../media/what-if");
const timing = JSON.parse(await readFile(join(root, "timing.json"), "utf8"));
const music = JSON.parse(await readFile(join(root, "music.json"), "utf8"));
const cache = join(tmpdir(), "hunteragent-film-music");
await mkdir(cache, {recursive: true});
const track = join(cache, `${music.sha256}.mp3`);
let bytes = await readFile(track).catch(() => null);
if (!bytes) {
  const response = await fetch(music.sourceUrl, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw Error(`Music download failed: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (createHash("sha256").update(bytes).digest("hex") !== music.sha256) throw Error("Music source changed; verify its identity and license before rebuilding.");
await writeFile(track, bytes);
const tempo = timing.bpm / music.sourceBpm;
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(music.sourceStartSeconds), "-i", track,
  "-af", `atempo=${tempo},atrim=duration=${timing.durationSeconds},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=8,afade=t=in:d=0.012,afade=t=out:st=${timing.durationSeconds-music.fadeOutSeconds}:d=${music.fadeOutSeconds}`,
  "-ar", "48000", "-ac", "2", join(root, "sound.wav")], {stdio: "inherit"});
console.log(`Licensed soundtrack edited for ${timing.durationSeconds}s at ${timing.bpm} BPM: ${music.title}.`);
