import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const outputRoot = ".vercel/output/functions";

if (!existsSync(outputRoot)) {
  if (!process.env.VERCEL) {
    console.log("Skipping Vercel bundle verification outside a Vercel build.");
    process.exit(0);
  }
  throw new Error(`Vercel function output was not generated at ${outputRoot}`);
}

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const files = filesUnder(outputRoot);
const serverModules = files.filter((file) => /\.(?:mjs|js)$/.test(file));
const splitChunks = serverModules.filter((file) =>
  /(?:^|[/\\])_(?:ssr|libs|chunks)(?:[/\\])|(?:^|[/\\])_runtime\.mjs$/.test(file),
);

if (splitChunks.length > 0) {
  throw new Error(
    `Vercel server output is split into chunks:\n${splitChunks
      .map((file) => `- ${relative(outputRoot, file)}`)
      .join("\n")}`,
  );
}

const oversizedEntryModules = serverModules.filter(
  (file) => statSync(file).size > 0 && /(?:^|[/\\])index\.mjs$/.test(file),
);

if (oversizedEntryModules.length === 0) {
  throw new Error("No Vercel server entry bundle was generated.");
}

for (const file of serverModules) {
  const source = readFileSync(file, "utf8");
  if (!source.includes("__exportAll")) continue;

  const hasDeclaration =
    /(?:function|const|let|var)\s+__exportAll\b/.test(source) ||
    /\b__exportAll\s*=/.test(source) ||
    /\bas\s+__exportAll\b/.test(source);

  if (!hasDeclaration) {
    throw new Error(`__exportAll is referenced but not declared in ${relative(outputRoot, file)}`);
  }
}

console.log(
  `Verified Vercel server output: ${oversizedEntryModules.length} self-contained function bundle(s), no split SSR/runtime chunks.`,
);