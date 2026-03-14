import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

let _model: GenerativeModel | null = null;

export function getGeminiModel(): GenerativeModel {
  if (!_model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set. AI features will be unavailable.");
      const genAI = new GoogleGenerativeAI("placeholder");
      _model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      return _model;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    _model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }
  return _model;
}
