import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables");
    throw new Error("API Key missing");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateText = async (prompt: string, model: string = 'gemini-2.5-flash'): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`;
  }
};

export const explainCode = async (code: string): Promise<string> => {
  const prompt = `Explain the following code snippet briefly and clearly:\n\n${code}`;
  return generateText(prompt, 'gemini-2.5-flash');
};