import {getSession} from "@/lib/session";
import {permissaoEfetiva} from "@/lib/permissoes/catalogo";
import {prisma} from "@/lib/prisma";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const sessao=await getSession();if(!sessao)return new Response(null,{status:401});
  if(!sessao.admin&&!permissaoEfetiva(sessao.permissoes,sessao.excecoes,"financeiro.faturas","visualizar"))return new Response(null,{status:403});
  const {id}=await params,arquivo=await prisma.arquivoFaturaCartao.findUnique({where:{id},select:{nome:true,dados:true}});
  if(!arquivo)return new Response(null,{status:404});
  return new Response(new Uint8Array(arquivo.dados),{headers:{"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(arquivo.nome.replace(/[\r\n]/g,''))}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
