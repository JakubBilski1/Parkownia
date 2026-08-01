import { ImageResponse } from "next/og";

/**
 * The card that renders wherever the link is pasted — mail, WhatsApp, LinkedIn.
 * There was none, so parkownia.com shared as a bare row of text, which is a poor
 * first impression for a link whose whole job is acquisition.
 *
 * Drawn rather than shipped as a file so it cannot drift from the palette. No
 * webfont is loaded on purpose: that would put a network fetch in the build, and
 * this build has to pass with no environment at all.
 */
export const alt = "Parkownia — parking na mecz i targi w Poznaniu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1a1918",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: "#c93a3a" }} />
          <div style={{ fontSize: 34, color: "#f1ede7", fontWeight: 700, letterSpacing: -0.5 }}>
            Parkownia
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 82,
              lineHeight: 1.04,
              color: "#f1ede7",
              fontWeight: 800,
              letterSpacing: -2,
              maxWidth: 940,
              display: "flex",
            }}
          >
            Parking na mecz i targi w Poznaniu
          </div>
          <div style={{ fontSize: 32, color: "#9e978d", maxWidth: 880, display: "flex" }}>
            Enea Stadion i MTP. Płacisz z góry, wjeżdżasz na kod.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ height: 3, width: 56, background: "#c93a3a" }} />
          <div style={{ fontSize: 26, color: "#9e978d" }}>parkownia.com</div>
        </div>
      </div>
    ),
    size,
  );
}
