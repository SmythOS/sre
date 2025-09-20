import type { LLM } from "./cached-llm";

// OpenAI (optional) 
export class OpenAIAdapter implements LLM {
  private client: any;
  private model: string;
  constructor(model = process.env.OPENAI_MODEL ?? "gpt-4o-mini") {
    const { OpenAI } = require("openai");
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = model;
  }
  async generate(prompt: string): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });
    return res.choices?.[0]?.message?.content?.trim() ?? "";
  }
}

//  Google Gemini (optional) 
export class GoogleAIAdapter implements LLM {
  private gen: any;
  private model: string;
  constructor(model = process.env.GOOGLEAI_MODEL ?? "gemini-1.5-flash") {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const client = new GoogleGenerativeAI(process.env.GOOGLEAI_API_KEY);
    this.gen = client.getGenerativeModel({ model });
    this.model = model;
  }
  async generate(prompt: string): Promise<string> {
    const res = await this.gen.generateContent(prompt);
    const txt = res.response?.text?.() ?? "";
    return String(txt).trim();
  }
}

// Mock (always available) 
export class MockAdapter implements LLM {
  async generate(prompt: string): Promise<string> {
    // Deterministic, fast "fake LLM" so the demo always runs
    const summary = prompt
      .replace(/\s+/g, " ")
      .slice(0, 100)
      .trim();
    return `MOCK_SUMMARY: ${summary || "(empty prompt)"}`;
  }
}

// Helper to pick first available real provider, else mock.
export function pickAvailableAdapter(): LLM {
  try {
    if (process.env.OPENAI_API_KEY) {
      return new OpenAIAdapter();
    }
  } catch {}
  try {
    if (process.env.GOOGLEAI_API_KEY) {
      return new GoogleAIAdapter();
    }
  } catch {}
  return new MockAdapter();
}
