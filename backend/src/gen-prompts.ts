import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function main() {
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [{
      role: 'user',
      parts: [{
        text: `You are designing prompts for a competitive AI image-guessing game. Players see a generated image and must guess the exact prompt that made it. Your goal is to make that as hard as possible while staying fair — every key element must actually be visible.

Pick ONE trick category per prompt and craft a prompt using it:

MISLEADING SCALE — make something huge look tiny or vice versa, or set an outdoor scene indoors.
ABSTRACT CONCEPT RENDERED LITERALLY — depict a feeling, idea, or phrase as a physical scene.
REVERSAL OR SWAP — flip the normal relationship between two things.
STYLE DISGUISED AS SUBJECT — the medium or art style is the trick, not the content.
EASY-TO-MISS DETAIL — the whole point is one or two small things most players overlook.
IDIOM OR WORDPLAY RENDERED LITERALLY — take a phrase or idiom and depict it word-for-word.

Additional rules:
- Use specific, niche, or technical vocabulary where possible
- Every trick element must be clearly visible in the image
- 8 to 18 words each
- Do not reuse the examples above

Generate exactly 10 prompts. Respond with valid JSON only (no markdown):
[
  {"prompt": "...", "trickType": "misleading scale"},
  ...
]`,
      }],
    }],
    config: { responseMimeType: 'application/json' },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const prompts: { prompt: string; trickType: string }[] = JSON.parse(text);

  prompts.forEach((p, i) => {
    console.log(`${i + 1}. [${p.trickType}] ${p.prompt}`);
  });
}

main().catch(console.error);
