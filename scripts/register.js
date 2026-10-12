// Adds you to the class board so the instructor can fund you and classmates can find your API.
// Usage: npm run register -- [board-url]
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
console.log(res.ok ? `Registered: ${JSON.stringify(entry, null, 2)}` : `Failed (${res.status}): ${await res.text()}`);
