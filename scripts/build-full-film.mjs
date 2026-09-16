import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { filmSources } from "./film-sources.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "media/what-if");
const cache = join(tmpdir(), "hunteragent-full-film-source");
const python = process.env.FILM_PYTHON ?? "python3";
execFileSync(python, ["-c", "import PIL"]);
await mkdir(cache, { recursive: true });
const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
const timing = JSON.parse(await readFile(join(source, "timing.json"), "utf8"));
const clips = await filmSources(manifest);
for (const clip of manifest.clips) {
  const destination = join(cache, `clip${clip.index - 1}.mp4`);
  await copyFile(clips.get(clip.index), destination);
}
for (const name of ["SpaceGrotesk.ttf"]) {
  await writeFile(join(cache, name), execFileSync("unzip", ["-p", join(source, "render-source.zip"), name], { maxBuffer: 10_000_000 }));
}
execFileSync(process.execPath, [join(root, "scripts/build-film-score.mjs")], {stdio: "inherit"});
await copyFile(join(source, "sound.wav"), join(cache, "sound.wav"));
const sourceFiles = ["render_concept.py", "story.json", "timing.json", "music.json", "MUSIC-LICENSE.md", "manifest.json", "OFL.txt"];
for (const name of sourceFiles) await copyFile(join(source, name), join(cache, name));
// Render from the editable source, not the older copy inside the archive.
execFileSync(python, ["-c", "import render_concept as film; film.render(False); film.render(True)"], { cwd: cache, stdio: "inherit" });
for (const format of ["landscape", "portrait"]) {
  const file = join(cache, `${format}.mp4`);
  const metadata = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_format", "-of", "json", file], { encoding: "utf8" }));
  if (Math.abs(Number(metadata.format.duration) - timing.durationSeconds) > .1) throw Error(`Unexpected ${format} duration`);
}
for (const format of ["landscape", "portrait"]) {
  await copyFile(join(cache, `${format}.mp4`), join(root, "public/films", `what-if-${format}.mp4`));
}
// Start a new archive so earlier embedded audio is not redistributed standalone.
const archive = join(cache, `render-source-${Date.now()}.zip`);
execFileSync("zip", ["-q", archive, ...sourceFiles, "SpaceGrotesk.ttf"], { cwd: cache });
await copyFile(archive, join(source, "render-source.zip"));
console.log(`Both ${timing.durationSeconds}-second full films and their source archive updated.`);
