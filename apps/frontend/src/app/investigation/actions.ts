"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_API_KEY_2;
if (!API_KEY) {
  throw new Error("GOOGLE_API_KEY environment variable is not set");
}
const genAI = new GoogleGenerativeAI(API_KEY);

export interface VideoEvent {
  isDangerous: boolean;
  description: string;
}

export async function detectEvents(
  base64Image: string,
  investigationPrompt: string,
): Promise<{ events: VideoEvent[]; rawResponse: string }> {
  console.log("Starting frame analysis...");
  try {
    if (!base64Image) {
      throw new Error("No image data provided");
    }

    const base64Data = base64Image.split(",")[1];
    if (!base64Data) {
      throw new Error("Invalid image data format");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Initialized Gemini model");

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg",
      },
    };

    const prompt = `Carefully analyze this image frame based on the following investigation prompt: "${investigationPrompt}".

Evaluate the frame for:
- Direct evidence related to the prompt
- Potential suspicious or concerning activities
- Context and details that might be relevant to the investigation tto the prompt 
- not more than 10-15 words

Return a JSON object in this exact format:

{
    "events": [
        {
            "description": "Detailed description of what's observed",
            "isDangerous": true/false // Set to true if the observation is potentially serious or concerning
        }
    ]
}

If no relevant observations are found, return an empty events array.`;

    try {
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      console.log("Raw API Response:", text);

      // Try to extract JSON from the response
      let jsonStr = text;
      const codeBlockMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        const jsonMatch = text.match(/\{[^]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      try {
        const parsed = JSON.parse(jsonStr);
        return {
          events: parsed.events || [],
          rawResponse: text,
        };
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError);
        return { events: [], rawResponse: text };
      }
    } catch (error) {
      console.error("Error calling API:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in detectEvents:", error);
    throw error;
  }
}
