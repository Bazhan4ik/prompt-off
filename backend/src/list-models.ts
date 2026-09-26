import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function main() {
  const pager = await ai.models.list();
  for await (const model of pager) {
    if (model.name?.toLowerCase().includes('image')) {
      console.log(model.name);
    }
  }
}

main();
