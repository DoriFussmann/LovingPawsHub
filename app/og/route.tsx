import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const site = searchParams.get("site") || "";
  const tagline = searchParams.get("tagline") || "";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f0f0f",
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* subtle top border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: "rgba(255,255,255,0.08)",
            display: "flex",
          }}
        />

        {/* site name */}
        <div
          style={{
            color: "#ffffff",
            fontSize: 88,
            fontWeight: 300,
            letterSpacing: "-5px",
            lineHeight: 1,
            marginBottom: tagline ? 24 : 0,
            display: "flex",
          }}
        >
          {site.toLowerCase()}.
        </div>

        {/* tagline */}
        {tagline && (
          <div
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 26,
              fontWeight: 300,
              letterSpacing: "-0.5px",
              display: "flex",
            }}
          >
            {tagline.toLowerCase()}
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
