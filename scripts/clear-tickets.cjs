require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = neon(url);
  await sql`DELETE FROM tickets`;
  console.log("All tickets deleted.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
