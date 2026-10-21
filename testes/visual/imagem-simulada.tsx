import type { ImgHTMLAttributes } from "react";
/** Somente a fronteira Next/Image na prévia Vite, sem otimização de servidor. */
export default function ImagemSimulada(props: ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt ?? ""} />;
}
