import { metadadosRecurso } from "@/lib/mcp/metadados";
export const dynamic = "force-dynamic";
export function GET() { return Response.json(metadadosRecurso(), { headers: { "Cache-Control": "no-store" } }); }
