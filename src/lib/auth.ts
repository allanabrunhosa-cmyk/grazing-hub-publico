// Ponto de entrada de conveniência para código que roda no servidor completo
// (Server Actions, Server Components). O middleware NUNCA deve importar
// daqui — ele roda num ambiente restrito que não suporta bcryptjs.
// Middleware usa @/lib/session-token diretamente.
export * from "@/lib/session-token";
export * from "@/lib/password";
