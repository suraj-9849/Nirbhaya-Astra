import { register } from "lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, password, name, isGovtOfficial } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 },
      );
    }

    const result = await register(email, password, name, isGovtOfficial);

    const response = NextResponse.json(result);
    response.cookies.set("token", result.token, {
      httpOnly: false, 
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: 'lax'
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Registration failed" },
      { status: 400 },
    );
  }
}