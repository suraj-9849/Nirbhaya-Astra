import { login, register } from "../../../../../lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 },
      );
    }

    const result = await login(email, password);

    // Set the token as a cookie
    const response = NextResponse.json(result);
    response.cookies.set("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Login failed" },
      { status: 400 },
    );
  }
}
