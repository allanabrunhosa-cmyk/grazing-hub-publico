import { ConteudoGestaoPedidos } from "../../gestao/conteudo";

export default function GestaoInterceptada(props: Parameters<typeof ConteudoGestaoPedidos>[0]) {
  return <ConteudoGestaoPedidos {...props} />;
}
