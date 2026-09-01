// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// On Vercel, pin the Nitro target so the build emits .vercel/output (Build Output API).
// Inside Lovable's own build LOVABLE_NITRO_PRESET pins Cloudflare and this is ignored.
const isVercel = !!process.env["VERCEL"];

// Keep the Vercel function self-contained. Nitro 3 builds through Vite/Rolldown, where
// `inlineDynamicImports` is translated to `output.codeSplitting = false`. Setting only the
// nested bundler output is too late/fragile because Nitro presets are resolved afterwards.
const vercelNitro = {
  preset: "vercel",
  inlineDynamicImports: true,
  hooks: {
    // This hook receives the final configuration that Rolldown/Rollup will execute.
    "rollup:before": (
      _nitro: unknown,
      config: { output?: { codeSplitting?: boolean } },
    ) => {
      config.output ??= {};
      config.output.codeSplitting = false;
    },
  },
} as unknown as { preset?: string };

export default defineConfig({
  ...(isVercel ? { nitro: vercelNitro } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
