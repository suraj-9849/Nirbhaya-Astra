// In /app/api/save/route.ts
import axios from "axios";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // First check if the backend is reachable
    const res = await axios.post(
      `http://127.0.0.1:8000/save-extracted-data`,
      data,
    );

    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error("Error in /api/save:", error.message);

    // Return a proper error response with more details
    return NextResponse.json(
      {
        error: "Failed to save data",
        details: error.message,
        // If there's a response from the backend, include its error message
        backendError: error.response?.data?.detail || "Unknown backend error",
      },
      { status: 500 },
    );
  }
}
