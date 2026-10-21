import { metadadosAutorizacao } from "@/lib/mcp/metadados";
export const dynamic = "force-dynamic";
export function GET() { return Response.json(metadadosAutorizacao(), { headers: { "Cache-Control": "no-store" } }); }
