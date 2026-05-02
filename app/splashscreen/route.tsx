import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const width = Number(searchParams.get("w") ?? 1170);
  const height = Number(searchParams.get("h") ?? 2532);

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          background: "#059669",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 120,
            height: 120,
            background: "rgba(255,255,255,0.15)",
            borderRadius: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="68"
            height="68"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22V12h6v10" />
            <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01" />
          </svg>
        </div>
        {/* App name */}
        <div
          style={{
            color: "white",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          Heritage Cooperative
        </div>
      </div>
    ),
    { width, height }
  );
}
