import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Squad verify endpoint — server-side so the secret key is never exposed
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const transactionRef = searchParams.get("ref");

  if (!transactionRef) {
    return NextResponse.json({ error: "Missing transaction ref" }, { status: 400 });
  }

  const secretKey = process.env.SQUAD_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Use sandbox URL for test keys, production URL for live keys
  const baseUrl = secretKey.startsWith("test_sk") || secretKey.startsWith("sandbox_sk")
    ? "https://sandbox-api-d.squadco.com"
    : "https://api-d.squadco.com";

  try {
    const url = `${baseUrl}/transaction/verify/${transactionRef}`;
    console.log("Squad verify →", url);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const text = await res.text();
    console.log("Squad verify response", res.status, text);

    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("Squad verification error:", err);
    return NextResponse.json({ error: "Verification request failed" }, { status: 502 });
  }
}
