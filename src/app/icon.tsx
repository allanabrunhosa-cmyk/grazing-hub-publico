import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { contextoDoHost } from "@/lib/hosts";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const identidade = contextoDoHost(await headers())?.identidade ?? "hub";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: identidade === "pedidos" ? "#173c29" : "#0B1D37",
          borderRadius: 8,
          color: "#FFFFFF",
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        {identidade === "pedidos" ? "GP" : identidade === "etiquetas" ? "GV" : "GH"}
      </div>
    ),
    { ...size }
  );
}
