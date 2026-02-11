import { defineConfig } from "tsup";
import path from "path";
import fs from "fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  esbuildPlugins: [
    {
      name: "alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => {
          const relative = args.path.slice(2);
          const abs = path.resolve(__dirname, "src", relative);

          if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
            return { path: path.resolve(abs, "index.ts") };
          }

          const withTs = abs + ".ts";
          if (fs.existsSync(withTs)) {
            return { path: withTs };
          }

          return { path: abs };
        });
      },
    },
  ],
});
