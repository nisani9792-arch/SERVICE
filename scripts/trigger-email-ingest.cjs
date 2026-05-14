/**
 * Render Cron entrypoint for the protected email ingest API.
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

async function main() {
  const baseUrl = process.env.EMAIL_INGEST_URL || process.env.RENDER_EXTERNAL_URL;
  const secret = process.env.EMAIL_INGEST_SECRET;

  if (!baseUrl) {
    throw new Error("EMAIL_INGEST_URL is not configured");
  }
  if (!secret) {
    throw new Error("EMAIL_INGEST_SECRET is not configured");
  }

  const url = new URL("/api/email-ingest", baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-email-ingest-secret": secret
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Email ingest failed with ${response.status}: ${text}`);
  }

  console.log(text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
