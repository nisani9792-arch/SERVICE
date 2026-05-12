require("dotenv").config();

const http = require("http");
const { URL } = require("url");
const { neon } = require("@neondatabase/serverless");
const { generateAiText } = require("./services/aiService");

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const handleAiTest = async (res) => {
  try {
    const aiAnswer = await generateAiText("Explain how AI works in a few words");
    sendJson(res, 200, { message: aiAnswer });
  } catch (error) {
    sendJson(res, 502, {
      error: "Failed to generate AI response",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

const handleDatabaseCheck = async (res) => {
  if (!sql) {
    sendJson(res, 500, { error: "DATABASE_URL is not configured" });
    return;
  }

  try {
    const result = await sql`SELECT version()`;
    const version = result?.[0]?.version;
    if (!version) {
      throw new Error("No version returned from database.");
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(version);
  } catch (error) {
    sendJson(res, 502, {
      error: "Database query failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

const requestHandler = async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/ai-test") {
      await handleAiTest(res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      await handleDatabaseCheck(res);
      return;
    }

    sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    sendJson(res, 500, {
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

http.createServer(requestHandler).listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
