import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          borderRadius: "6px",
        }}
      >
        {/* Blank page silhouette */}
        <div
          style={{
            position: "absolute",
            top: "3px",
            left: "5px",
            width: "16px",
            height: "22px",
            background: "#1e293b",
            border: "1.5px solid #475569",
            borderRadius: "2px",
            display: "flex",
            flexDirection: "column",
            padding: "3px",
            gap: "2px",
          }}
        >
          {/* Text lines on the page */}
          <div
            style={{
              width: "10px",
              height: "1.5px",
              background: "#475569",
              borderRadius: "1px",
              display: "flex",
            }}
          />
          <div
            style={{
              width: "7px",
              height: "1.5px",
              background: "#475569",
              borderRadius: "1px",
              display: "flex",
            }}
          />
          <div
            style={{
              width: "9px",
              height: "1.5px",
              background: "#475569",
              borderRadius: "1px",
              display: "flex",
            }}
          />
        </div>

        {/* Red magnifying glass overlay (bottom-right) */}
        <div
          style={{
            position: "absolute",
            bottom: "2px",
            right: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Glass circle */}
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              border: "2.5px solid #ef4444",
              display: "flex",
            }}
          />
          {/* Handle */}
          <div
            style={{
              position: "absolute",
              bottom: "-1px",
              right: "-1px",
              width: "7px",
              height: "2.5px",
              background: "#ef4444",
              borderRadius: "1.5px",
              transform: "rotate(45deg)",
              transformOrigin: "left center",
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
