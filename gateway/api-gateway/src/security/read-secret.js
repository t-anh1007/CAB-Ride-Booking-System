import fs from "node:fs";

export function readSecret(env, name, fallback = "") {
  const filePath = String(env?.[`${name}_FILE`] || "").trim();
  if (filePath) {
    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch (error) {
      throw new Error(`Failed to read secret file for ${name}: ${error.message}`);
    }
  }

  return String(env?.[name] ?? fallback);
}
