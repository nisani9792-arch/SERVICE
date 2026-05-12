const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateAiText(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment variables.");
  }

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("Prompt must be a non-empty string.");
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(prompt.trim());
    const response = await result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      throw new Error("Gemini returned an empty response.");
    }

    return text;
  } catch (error) {
    throw new Error(
      `Gemini request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

module.exports = {
  generateAiText,
};
