import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Free CBT — Practice & Exam Simulation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated at request time rather than a static asset — keeps the
// social preview image self-contained in the codebase (matches the
// brand's icon mark and colors from tailwind.config.ts) with nothing to
// design or upload separately. Next.js wires this up as both the
// og:image and twitter:image automatically via the file-convention name.
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1E4FDE"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 140,
            height: 140,
            borderRadius: 32,
            background: "rgba(255,255,255,0.14)",
            marginBottom: 40
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: 64,
              height: 74,
              border: "6px solid white",
              borderRadius: 8
            }}
          >
            <div style={{ display: "flex", width: 38, height: 5, background: "white", borderRadius: 3 }} />
            <div style={{ display: "flex", width: 38, height: 5, background: "white", borderRadius: 3 }} />
            <div style={{ display: "flex", width: 24, height: 5, background: "#5CE0C6", borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ display: "flex", color: "white", fontSize: 76, fontWeight: 700 }}>
          Free CBT
        </div>
        <div style={{ display: "flex", color: "#E8EDFF", fontSize: 32, marginTop: 14 }}>
          Practice & Exam Simulation
        </div>
      </div>
    ),
    { ...size }
  );
}
