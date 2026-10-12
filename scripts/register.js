// Adds you to the class board so the instructor can fund you and classmates can find your API.
// Usage: npm run register -- [board-url]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { account, publicUrl } from "../config.js";

const board = (process.argv[2] || process.env.BOARD_URL || "").replace(/\/$/, "");
if (!board) {
  console.error("Pass the board URL: npm run register -- https://...  (or set BOARD_URL in .env)");
  process.exit(1);
}
const entry = {
  name: process.env.NAME || process.env.GITHUB_USER || "anonymous",
  address: account().address,
  url: process.env.PUBLIC_URL || publicUrl(),
};
if (entry.url.includes("localhost")) console.warn("Warning: your API URL is localhost, so classmates cannot reach it. Set PUBLIC_URL in .env.");

const res = await fetch(`${board}/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(entry),
});
if (!res.ok) {
  console.error(`Failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}
console.log(`Registered: ${JSON.stringify(entry, null, 2)}`);

// Remember the board, and use the class facilitator if the instructor runs one.
const { facilitator } = await res.json();
setEnv("BOARD_URL", board);
if (facilitator) setEnv("FACILITATOR_URL", facilitator);
console.log(`Saved BOARD_URL${facilitator ? " and FACILITATOR_URL" : ""} to .env. A running server restarts by itself.`);

function setEnv(key, value) {
  let env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  env = env.replace(new RegExp(`^${key}=.*\n?`, "m"), "");
  writeFileSync(".env", `${env}${env && !env.endsWith("\n") ? "\n" : ""}${key}=${value}\n`);
}
