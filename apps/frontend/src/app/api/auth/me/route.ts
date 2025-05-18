import { NextResponse } from "next/server";
import { verifyToken } from "../../../../../lib/auth";

export async function GET(request: Request) {
  const token = request.headers
    .get("Cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("token="))
    ?.split("=")[1];

  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const user = verifyToken(token);

  if (!user) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  return NextResponse.json({ user });
}
