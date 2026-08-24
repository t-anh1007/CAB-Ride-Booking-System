import fs from "node:fs";

export function readSecret(name, fallback = "") {
  const filePath = String(process.env[`${name}_FILE`] || "").trim();
  if (filePath) {
    return fs.readFileSync(filePath, "utf8").trim();
  }

  return String(process.env[name] ?? fallback);
}
