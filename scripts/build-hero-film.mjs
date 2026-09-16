import { readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { filmSources } from "./film-sources.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public/films");
const manifest = JSON.parse(await readFile(join(root, "media/what-if/manifest.json"), "utf8"));
const story = JSON.parse(await readFile(join(root, "media/what-if/story.json"), "utf8"));
const timing = JSON.parse(await readFile(join(root, "media/what-if/timing.json"), "utf8"));
const clips = await filmSources(manifest);
const scenes = story.filter((scene) => scene.clipIndex);
const inputs = scenes.flatMap((scene) => ["-ss", "0.4", "-i", clips.get(scene.clipIndex)]);
for (const [name, width, height] of [["what-if-hero.mp4", 1280, 720], ["what-if-hero-portrait.mp4", 540, 960]]) {
  const filters = scenes.map((scene, i) => {
    // Bake the wide board table into portrait frames: no mid-film CSS reframing.
    const sizing = width < height && scene.clipIndex === 4
      ? `scale=${width}:-2,pad=${width}:${height}:0:(oh-ih)/2:color=0x14252b`
      : `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    const end = i === 0 ? 'split=2[s0][opening]' : `null[s${i}]`;
    return `[${i}:v]${sizing},fps=${timing.fps},setsar=1,settb=AVTB,format=yuv420p,trim=duration=${scene.duration + timing.transitionSeconds},setpts=PTS-STARTPTS,${end}`;
  });
  const endingStart = story.find((scene) => scene.ending).start;
  filters.push(`color=c=0xf5f3ec:s=${width}x${height}:r=${timing.fps}:d=${timing.durationSeconds-endingStart},setsar=1,settb=AVTB,format=yuv420p[end]`);
  let previous = "s0";
  for (let i = 1; i <= scenes.length; i++) {
    const incoming = i === scenes.length ? "end" : `s${i}`;
    filters.push(`[${previous}][${incoming}]xfade=transition=fade:duration=${timing.transitionSeconds}:offset=${story[i].start}[x${i}]`);
    previous = `x${i}`;
  }
  // Settle on the exact opening image before the muted preview loops.
  filters.push(`[opening]trim=end_frame=1,tpad=stop_mode=clone:stop_duration=${timing.transitionSeconds},setpts=PTS-STARTPTS[loop]`);
  filters.push(`[${previous}][loop]xfade=transition=fade:duration=${timing.transitionSeconds}:offset=${timing.durationSeconds-timing.transitionSeconds}[v]`);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...inputs,
    "-filter_complex", filters.join(";"), "-map", "[v]", "-t", String(timing.durationSeconds), "-an", "-c:v", "libx264",
    "-preset", "slow", "-crf", "25", "-maxrate", "600k", "-bufsize", "1200k",
    "-pix_fmt", "yuv420p", "-g", "48", "-movflags", "+faststart", join(output, name)], { stdio: "inherit" });
}
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", "0.6", "-i", join(output, "what-if-hero.mp4"),
  "-frames:v", "1", "-q:v", "3", join(output, "what-if-hero-poster.jpg")], { stdio: "inherit" });
for (const name of ["what-if-hero.mp4", "what-if-hero-portrait.mp4", "what-if-hero-poster.jpg"]) {
  console.log(`${name}: ${(await stat(join(output, name))).size} bytes`);
}
