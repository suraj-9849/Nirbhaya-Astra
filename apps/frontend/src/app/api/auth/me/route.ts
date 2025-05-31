import { verifyToken } from "lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // First, try to get token from Authorization header (Bearer token)
    const authHeader = request.headers.get("Authorization");
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7); // Remove "Bearer " prefix
      console.log("Token found in Authorization header");
    } else {
      // Fallback: try to get token from cookies
      const cookieHeader = request.headers.get("Cookie");
      if (cookieHeader) {
        const tokenCookie = cookieHeader
          .split(";")
          .find((c) => c.trim().startsWith("token="));

        if (tokenCookie) {
          token = decodeURIComponent(tokenCookie.split("=")[1]);
          console.log("Token found in cookies");
        }
      }
    }

    console.log("Token extracted:", !!token);

    if (!token) {
      console.log("No token found in request");
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    // Verify the token
    const user = verifyToken(token);
    console.log("Token verification result:", !!user, user ? { id: user.id, email: user.email } : null);

    if (!user) {
      console.log("Token verification failed");
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    console.log("User authenticated successfully:", { id: user.id, email: user.email });
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
