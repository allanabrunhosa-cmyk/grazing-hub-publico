FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
RUN node -e "require('node:fs').writeFileSync('.next-deployment-id', require('node:crypto').randomUUID())"
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/Dockerfile ./Dockerfile
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts ./prisma7.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/.next-deployment-id ./.next-deployment-id
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/scripts/buscar-notas.ts ./scripts/buscar-notas.ts
COPY --from=builder /app/scripts/processar-fiscal-saida.ts ./scripts/processar-fiscal-saida.ts
COPY --from=builder /app/scripts/estrutura-fiscal-catalogo.ts ./scripts/estrutura-fiscal-catalogo.ts
COPY --from=builder /app/scripts/estrutura-fiscal-implantacao.ts ./scripts/estrutura-fiscal-implantacao.ts
COPY --from=builder /app/scripts/estrutura-fiscal-classificacao-catalogo.ts ./scripts/estrutura-fiscal-classificacao-catalogo.ts
COPY --from=builder /app/scripts/estrutura-fiscal-parametros.ts ./scripts/estrutura-fiscal-parametros.ts
COPY --from=builder /app/scripts/estrutura-fiscal-nuts-comercial.ts ./scripts/estrutura-fiscal-nuts-comercial.ts
COPY --from=builder /app/scripts/processar-ifood.ts ./scripts/processar-ifood.ts
COPY --from=builder /app/scripts/historico-importar.ts ./scripts/historico-importar.ts
COPY --from=builder /app/scripts/clientes-historicos-corrigir.ts ./scripts/clientes-historicos-corrigir.ts
COPY --from=builder /app/scripts/clientes-historicos-arquivos.ts ./scripts/clientes-historicos-arquivos.ts
COPY --from=builder /app/scripts/entregas-historicas-enriquecer.ts ./scripts/entregas-historicas-enriquecer.ts
COPY --from=builder /app/scripts/entregas-historicas-arquivos.ts ./scripts/entregas-historicas-arquivos.ts
COPY --from=builder /app/scripts/configurar-email.ts ./scripts/configurar-email.ts
COPY --from=builder /app/scripts/corrigir-lancamentos-notas-legadas.ts ./scripts/corrigir-lancamentos-notas-legadas.ts
COPY --from=builder /app/scripts/corrigir-prestadores-nfse.ts ./scripts/corrigir-prestadores-nfse.ts
COPY --from=builder /app/scripts/atividades-diagnostico.mjs ./scripts/atividades-diagnostico.mjs
COPY --from=builder /app/scripts/atividades-recuperar.mjs ./scripts/atividades-recuperar.mjs
COPY --from=builder /app/scripts/migrations-publicacao-fiscal.mjs ./scripts/migrations-publicacao-fiscal.mjs
COPY --from=builder /app/scripts/lib/plano-migrations-fiscais.mjs ./scripts/lib/plano-migrations-fiscais.mjs
COPY --from=builder /app/scripts/lib/reconciliacao-migrations-fiscais.mjs ./scripts/lib/reconciliacao-migrations-fiscais.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

CMD ["sh", "-c", "node scripts/migrations-publicacao-fiscal.mjs --bootstrap && npx prisma migrate deploy && npm run start"]
