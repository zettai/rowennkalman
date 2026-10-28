import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  return NextResponse.json(
    {
      message: "Health check endpoint supports GET requests only",
    },
    { status: 405 },
  );
}
