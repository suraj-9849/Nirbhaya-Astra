import axios from "axios";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await axios.get(`http://127.0.0.1:8000/get-admin-posts`);

    return NextResponse.json(res.data);
  } catch (error: any) {
    console.error("Error fetching posts:", error.message);

    // If backend is unreachable, return empty array instead of error
    // This prevents the UI from crashing
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      console.warn("Backend appears to be offline. Returning empty data.");
      return NextResponse.json([]);
    }

    return NextResponse.json(
      {
        error: "Failed to fetch posts",
        details: error.message,
        backendError: error.response?.data?.detail || "Unknown backend error",
      },
      { status: 500 },
    );
  }
}
