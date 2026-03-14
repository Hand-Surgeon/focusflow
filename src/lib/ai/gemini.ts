import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

// gemini-1.5-flash has a more generous free tier than gemini-2.0-flash
const GEMINI_MODEL = "gemini-1.5-flash";

let _model: GenerativeModel | null = null;

export function getGeminiModel(): GenerativeModel {
  if (!_model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set. AI features will be unavailable.");
      const genAI = new GoogleGenerativeAI("placeholder");
      _model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      return _model;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    _model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  }
  return _model;
}

/**
 * Calls the Gemini model with automatic retry on 429 rate limit errors.
 * Retries up to 3 times with exponential backoff (2s, 4s, 8s).
 */
export async function generateWithRetry(
  model: GenerativeModel,
  prompt: Parameters<GenerativeModel["generateContent"]>[0],
  maxRetries = 3,
): ReturnType<GenerativeModel["generateContent"]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await model.generateContent(prompt);
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);

      // Retry only on quota/rate-limit errors
      if (message.includes("429") || message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
        const waitMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.warn(`Gemini rate limit hit (attempt ${attempt + 1}/${maxRetries}). Retrying in ${waitMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      // Non-retryable error — throw immediately
      throw err;
    }
  }

  throw lastError;
}
