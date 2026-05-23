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
        {/* Magnifying glass body */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Glass circle (ring) */}
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: "2px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: "2.5px solid #3b82f6",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: "1px",
              padding: "3px 3px 4px 3px",
              overflow: "hidden",
            }}
          >
            {/* Bar chart bars inside the glass */}
            <div
              style={{
                width: "3px",
                height: "5px",
                background: "#3b82f6",
                borderRadius: "0.5px",
                display: "flex",
              }}
            />
            <div
              style={{
                width: "3px",
                height: "9px",
                background: "#60a5fa",
                borderRadius: "0.5px",
                display: "flex",
              }}
            />
            <div
              style={{
                width: "3px",
                height: "7px",
                background: "#3b82f6",
                borderRadius: "0.5px",
                display: "flex",
              }}
            />
          </div>

          {/* Handle */}
          <div
            style={{
              position: "absolute",
              bottom: "2px",
              right: "2px",
              width: "10px",
              height: "3px",
              background: "#3b82f6",
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
