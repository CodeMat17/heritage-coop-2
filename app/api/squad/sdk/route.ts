import { NextResponse } from "next/server";

const SQUAD_SDK_URL = "https://checkout.squadco.com/widget/squad.min.js";

export async function GET() {
  const res = await fetch(SQUAD_SDK_URL);
  if (!res.ok) {
    return new NextResponse("Failed to fetch Squad SDK", { status: 502 });
  }
  const js = await res.text();
  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
