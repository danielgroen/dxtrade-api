import fs from "fs";
import path from "path";

const typesDir = path.resolve("src/types");

function collectTypeFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeFiles(full));
    } else if (entry.name.endsWith(".ts") && entry.name !== "index.ts") {
      files.push(full);
    }
  }
  return files;
}

let output = "// Auto-generated — run `npm run gen:globals` to regenerate.\n\n";

for (const file of collectTypeFiles(typesDir)) {
  const modulePath = "./" + path.relative("src", file).replace(/\.ts$/, "");
  const content = fs.readFileSync(file, "utf-8");

  // Handle namespaces: export namespace Foo { export interface Bar ... }
  const nsMatches = [...content.matchAll(/export\s+namespace\s+(\w+)\s*\{([\s\S]*?)\n\}/g)];
  for (const ns of nsMatches) {
    const nsName = ns[1];
    const nsBody = ns[2];
    const members = [...nsBody.matchAll(/export\s+(?:interface|type)\s+(\w+)/g)].map((m) => m[1]);
    if (members.length) {
      output += `declare namespace ${nsName} {\n`;
      for (const member of members) {
        output += `  type ${member} = import("${modulePath}").${nsName}.${member};\n`;
      }
      output += `}\n`;
    }
  }

  // Handle top-level exports: export interface Foo / export type Foo
  const topLevel = [...content.matchAll(/^export\s+(?:interface|type)\s+(\w+)/gm)].map((m) => m[1]);
  for (const name of topLevel) {
    output += `type ${name} = import("${modulePath}").${name};\n`;
  }
}

fs.writeFileSync("src/global.d.ts", output);
console.log("Generated src/global.d.ts");
