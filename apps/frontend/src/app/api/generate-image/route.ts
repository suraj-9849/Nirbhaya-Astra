import { NextResponse } from "next/server";
import axios from "axios";

interface GenerateImageRequestData {
  generatedText: string;
  prompt: string; // Changed from imagePrompt to prompt to match updated frontend
}

export async function POST(req: Request) {
  try {
    const data: GenerateImageRequestData = await req.json();
    console.log("Received data:", data);

    // Call our updated backend endpoint that now uses Unsplash
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/generate-image`,
      { prompt: data.prompt }, // Changed to match the updated frontend field name
    );

    console.log("Image Generation API response:", res.data);

    // The response format from the backend includes image_urls
    const imageUrls = res.data.images;

    // Return the response in the format the frontend expects
    return NextResponse.json({ images: imageUrls }, { status: 200 });
  } catch (error) {
    console.error("Image generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate images" },
      { status: 500 },
    );
  }
}
