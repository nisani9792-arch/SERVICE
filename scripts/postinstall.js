/* eslint-disable */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const isHostedBuild =
  process.env.RENDER === "true" ||
  Boolean(process.env.RENDER_SERVICE_ID) ||
  process.env.VERCEL === "1" ||
  process.env.NETLIFY === "true" ||
  process.env.CI === "true";

if (!isHostedBuild) {
  process.exit(0);
}

const buildDir = path.join(process.cwd(), ".next");
if (fs.existsSync(buildDir) && fs.existsSync(path.join(buildDir, "BUILD_ID"))) {
  console.log("[postinstall] .next build already exists, skipping rebuild.");
  process.exit(0);
}

console.log("[postinstall] hosted build detected — running 'next build'...");
try {
  execSync("npx --no-install next build", { stdio: "inherit" });
} catch (error) {
  console.error("[postinstall] next build failed:", error.message);
  process.exit(1);
}
