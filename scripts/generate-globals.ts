import fs from "fs";
import path from "path";

const typesDir = path.resolve("src/types");
const files = fs
  .readdirSync(typesDir)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts");

let output = "// Auto-generated — run `npm run gen:globals` to regenerate.\n\n";

for (const file of files) {
  const modulePath = `./types/${file.replace(".ts", "")}`;
  const content = fs.readFileSync(path.join(typesDir, file), "utf-8");
  const exports = [
    ...content.matchAll(/export\s+(?:interface|type)\s+(\w+)/g),
  ].map((m) => m[1]);

  if (exports.length) {
    for (const name of exports) {
      output += `type ${name} = import("${modulePath}").${name};\n`;
    }
  }
}

fs.writeFileSync("src/global.d.ts", output);
console.log("Generated src/global.d.ts");
