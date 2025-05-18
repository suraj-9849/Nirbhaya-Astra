"use server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { readFile } from "fs/promises";
import sharp from "sharp";
import path from "path";

const API_KEYS = [
  process.env.GOOGLE_API_KEY_1,
  process.env.GOOGLE_API_KEY_2,
  process.env.GOOGLE_API_KEY_3,
  process.env.GOOGLE_API_KEY_4,
  process.env.GOOGLE_API_KEY_5,
  process.env.GOOGLE_API_KEY_6,
  process.env.GOOGLE_API_KEY_7,
  process.env.GOOGLE_API_KEY_9,
  process.env.GOOGLE_API_KEY_10,
].filter(Boolean) as string[];

let currentKeyIndex = 0;
function getNextApiKey() {
  if (!API_KEYS.length) throw new Error("No valid API keys available");
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

export interface VideoEvent {
  description: string;
  isDangerous: boolean;
  timestamp: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function estimateImageTokens(imageSizeInBytes: number): number {
  const base64Size = imageSizeInBytes * 1.33;
  return Math.ceil(base64Size / 4);
}

async function compressAndResizeImage(
  imageBlob: Blob,
  quality = 25,
  maxWidth = 512,
): Promise<Buffer> {
  const inputBuffer = Buffer.from(await imageBlob.arrayBuffer());
  return await sharp(inputBuffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
}

export async function detectEvents(imageBlob: Blob): Promise<{
  events: VideoEvent[];
  rawResponse: string;
  tokenUsage: TokenUsage;
}> {
  console.log("detectEvents called");
  if (!imageBlob) throw new Error("No image data provided");

  const API_KEY = getNextApiKey();
  console.log("Selected API key index:", currentKeyIndex);
  const prompt = `Analyze this frame and determine if any of these specific dangerous situations are occurring:
1. Medical Emergencies:
- Person unconscious or lying motionless
- Person clutching chest/showing signs of heart problems
- Seizures or convulsions
- Difficulty breathing or choking
2. Falls and Injuries:
- Person falling or about to fall
- Person on the ground after a fall
- Signs of injury or bleeding
- Limping or showing signs of physical trauma
3. Distress Signals:
- Person calling for help or showing distress
- Panic attacks or severe anxiety symptoms
- Signs of fainting or dizziness
- Headache or unease
- Signs of unconsciousness
4. Violence or Threats:
- Physical altercations
- Threatening behavior
- Weapons visible
5. Suspicious Activities:
- Shoplifting
- Vandalism
- Trespassing
Return a JSON object in this exact format:
{
    "events": [
        {
            "timestamp": "mm:ss",
            "description": "Brief description of what's happening in this frame",
            "isDangerous": true/false
        }
    ]
}`;

  const promptTokens = estimateTextTokens(prompt);
  console.log("🟦 Prompt token count:", promptTokens);

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      topK: 16,
      maxOutputTokens: 300,
    },
  });

  const compressedBuffer = await compressAndResizeImage(imageBlob);
  console.log("Image compressed and resized.");
  const imageSize = compressedBuffer.length;
  console.log("Compressed image size (bytes):", imageSize);
  const imageTokens = estimateImageTokens(imageSize);
  console.log("🟩 Image token count:", imageTokens);
  const totalInputTokens = promptTokens + imageTokens;
  console.log("🧮 Total input tokens (prompt + image):", totalInputTokens);

  const imagePart = {
    inlineData: {
      data: compressedBuffer.toString("base64"),
      mimeType: "image/jpeg",
    },
  };

  console.log("Calling Gemini API...");
  const result = await model.generateContent([prompt, imagePart]);
  console.log("Received response from Gemini API");
  const response = await result.response;
  const text = await response.text();

  let jsonStr = text;
  const codeMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
  if (codeMatch) {
    jsonStr = codeMatch[1];
  } else {
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];
  }

  let events: VideoEvent[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    events = (parsed.events ?? []).map((e: any) => ({
      description: e.description,
      isDangerous: e.isDangerous,
      timestamp: e.timestamp || "",
    }));
  } catch {
    events = [];
  }

  const outputTokens = estimateTextTokens(text);
  console.log("🟥 Output token count:", outputTokens);
  const totalTokens = totalInputTokens + outputTokens;
  console.log("🔢 Total tokens used (input + output):", totalTokens);
  console.log("----------------------------------------");

  const tokenUsage: TokenUsage = {
    inputTokens: totalInputTokens,
    outputTokens,
    totalTokens,
  };

  return { events, rawResponse: text, tokenUsage };
}
