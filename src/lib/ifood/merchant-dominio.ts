import { ErroIfood, objeto, texto, uuid } from "./dominio";
export { exibirHorarioMerchant } from "./merchant-horarios-interface";
export const diasMerchant = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
export type TurnoMerchant = { dayOfWeek: string; start: string; duration: number };
/** Interruptions usa relógio civil da loja; o fornecedor ignora o offset do payload.
 * Não aplicar esta regra a Order/Events, cujos instantes continuam estritos. */
export function horarioCivilMerchant(valor:unknown) {
  if(typeof valor!=="string")throw new ErroIfood("Horário local Merchant inválido.");
  const m=/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.exec(valor);
  if(!m)throw new ErroIfood("Horário local Merchant inválido.");
  const calendario=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
  if(calendario.getUTCFullYear()!==Number(m[1])||calendario.getUTCMonth()!==Number(m[2])-1||calendario.getUTCDate()!==Number(m[3]))throw new ErroIfood("Data local Merchant inválida.");
  return m[1]+"-"+m[2]+"-"+m[3]+"T"+m[4]+":"+m[5]+":"+m[6]+"."+(m[7]??"").padEnd(3,"0");
}
export function instanteParaMerchant(data:Date,fuso:string) {
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:fuso,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(data);
  const obter=(t:string)=>p.find(v=>v.type===t)!.value;
  return horarioCivilMerchant(obter("year")+"-"+obter("month")+"-"+obter("day")+"T"+obter("hour")+":"+obter("minute")+":"+obter("second")+"."+String(data.getUTCMilliseconds()).padStart(3,"0"));
}
export function validarTurnosMerchant(valor: unknown): TurnoMerchant[] {
  if (!Array.isArray(valor) || !valor.length || valor.length > 28) throw new ErroIfood("Informe de um a 28 turnos (limite operacional do HUB).");
  const turnos = valor.map(v => {
    const t = objeto(v), dia = String(t.dayOfWeek), start = String(t.start);
    if (!diasMerchant.includes(dia as typeof diasMerchant[number]) || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(start) || !Number.isSafeInteger(t.duration) || Number(t.duration) < 1 || Number(t.duration) > 1440) throw new ErroIfood("Turno inválido: dia, início HH:mm:ss e duração de 1 a 1440 minutos inteiros.");
    return { dayOfWeek: dia, start, duration: Number(t.duration) };
  }).sort((a,b)=>diasMerchant.indexOf(a.dayOfWeek as typeof diasMerchant[number])-diasMerchant.indexOf(b.dayOfWeek as typeof diasMerchant[number]) || a.start.localeCompare(b.start));
  const semana = 7 * 86400;
  const intervalos = turnos.flatMap(t => {
    const [h,m,s] = t.start.split(":").map(Number), inicio = diasMerchant.indexOf(t.dayOfWeek as typeof diasMerchant[number])*86400+h*3600+m*60+s, fim=inicio+t.duration*60;
    return fim > semana ? [{ inicio, fim:semana }, { inicio:0, fim:fim-semana }] : [{ inicio, fim }];
  }).sort((a,b)=>a.inicio-b.inicio);
  if (intervalos.some((x,n)=>n>0&&x.inicio<intervalos[n-1].fim)) throw new ErroIfood("Turnos se sobrepõem, inclusive na virada do dia ou da semana.");
  return turnos;
}
export function lerHorariosMerchant(valor: unknown, merchant: string) {
  const d=objeto(valor);
  if (uuid(d.storeId)!==merchant || !Array.isArray(d.shifts)) throw new ErroIfood("Horários fora da loja/contrato.");
  return { storeId:merchant, shifts:d.shifts.map(v=>{const t=objeto(v);return { dayOfWeek:texto(t.dayOfWeek,20), start:texto(t.start,8), duration:Number(t.duration), enabled:t.enabled !== false };}) };
}
export function lerPausasMerchant(valor: unknown) {
  if (!Array.isArray(valor)) throw new ErroIfood("Pausas fora do contrato.");
  return valor.map(v=>{const d=objeto(v);horarioCivilMerchant(d.start);horarioCivilMerchant(d.end);return { id:uuid(d.id), start:texto(d.start,50), end:texto(d.end,50), description:texto(d.description,300) };});
}
