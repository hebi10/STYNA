import fs from "fs";
import path from "path";

export type NextRuntimeConfig = Record<string, unknown> & {
  distDir: string;
};

type RequiredServerFilesManifest = {
  config?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadNextRuntimeConfig(appDir: string): NextRuntimeConfig {
  const manifestPath = path.join(appDir, ".next", "required-server-files.json");
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as RequiredServerFilesManifest;

  if (!isRecord(manifest.config)) {
    throw new Error(`Next.js runtime config is missing: ${manifestPath}`);
  }

  return {
    ...manifest.config,
    distDir: ".next",
  };
}
