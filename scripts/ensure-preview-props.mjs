/**
 * Next.js 16.4.0 packaging bug workaround.
 *
 * `next start` loads `.next/server/preview-props.json` through `loadManifestFromRelativePath`
 * without `handleMissing`, so a missing file aborts the server on boot. The build only writes
 * that manifest on the branch taken when there is no `app/` directory, so an App Router project
 * with an SSR entry point ends up without it.
 *
 * An empty preview-props manifest is identical to "no partial pre-rendered routes", which is the
 * state this project is always in, so writing `{}` restores a correct boot without changing
 * rendering. Delete this script once the pinned Next.js version ships a fix.
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const target = join(process.cwd(), ".next", "server", "preview-props.json");

if (!existsSync(target)) {
  writeFileSync(target, "{}");
  console.log("ensure-preview-props: wrote .next/server/preview-props.json");
}