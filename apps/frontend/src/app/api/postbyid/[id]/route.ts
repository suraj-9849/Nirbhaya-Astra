import { NextRequest, NextResponse } from "next/server";
type Params = Promise<{ id: string }>;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  try {
    // Replace with your backend server URL
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/get-post/${id}`,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch post" },
        { status: response.status },
      );
    }

    const post = await response.json();
    return NextResponse.json(post);
  } catch {
    return NextResponse.json(
      { error: "An error occurred while fetching the post" },
      { status: 500 },
    );
  }
}
