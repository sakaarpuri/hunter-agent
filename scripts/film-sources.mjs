import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function filmSources(manifest) {
  const cache = join(tmpdir(), "hunteragent-film-sources");
  await mkdir(cache, { recursive: true });
  const paths = new Map();
  for (const clip of manifest.clips) {
    // Replacing a scene must invalidate both renderers' source cache.
    const key = createHash("sha256").update(clip.result_url).digest("hex");
    const path = join(cache, `${key}.mp4`);
    if (!(await stat(path).catch(() => null))?.size) {
      const response = await fetch(clip.result_url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw Error(`Could not retrieve scene ${clip.index}`);
      const temporary = `${path}.${randomUUID()}.download`;
      await writeFile(temporary, new Uint8Array(await response.arrayBuffer()));
      await rename(temporary, path);
    }
    paths.set(clip.index, path);
  }
  return paths;
}
