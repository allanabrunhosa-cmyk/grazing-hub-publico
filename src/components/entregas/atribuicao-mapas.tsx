import Image from "next/image";
import cinza from "./google-maps-cinza.png";
import branco from "./google-maps-branco.png";

/** Arquivos oficiais, sem alterações, conforme políticas Routes/Geocoding. */
export function AtribuicaoMapas() {
  return <div className="px-3 pt-3 pb-2" translate="no">
    <Image src={cinza} alt="Google Maps" className="h-4 w-auto dark:hidden" unoptimized />
    <Image src={branco} alt="Google Maps" className="hidden h-4 w-auto dark:block" unoptimized />
  </div>;
}
