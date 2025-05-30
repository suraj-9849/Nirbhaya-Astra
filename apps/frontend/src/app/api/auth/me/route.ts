import { verifyToken } from "lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];

    if (!token) {
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 }
      );
    }

    const userData = verifyToken(token);
    
    if (!userData) {
      return NextResponse.json(
        { message: "Invalid token" },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: userData });
  } catch (error: any) {
    return NextResponse.json(
      { message: "Authentication failed" },
      { status: 401 }
    );
  }
}