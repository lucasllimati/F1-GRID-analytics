// Gera prisma/postgres/schema.prisma a partir de prisma/schema.prisma (fonte única da verdade).
// Desenvolvimento usa SQLite; produção usa PostgreSQL (Neon, Supabase…). Os modelos são idênticos.
// Uso: node scripts/sync-postgres-schema.mjs          (escreve)
//      node scripts/sync-postgres-schema.mjs --check  (CI: falha se estiver desatualizado)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = "prisma/schema.prisma";
const OUT = "prisma/postgres/schema.prisma";

const src = readFileSync(SRC, "utf8");
const datasource = /datasource db \{[\s\S]*?\n\}/;
if (!datasource.test(src) || !/provider\s*=\s*"sqlite"/.test(src)) {
  console.error(`${SRC}: bloco datasource com provider "sqlite" não encontrado`);
  process.exit(1);
}
const out =
  "// ARQUIVO GERADO por scripts/sync-postgres-schema.mjs — NÃO EDITE.\n" +
  "// Edite prisma/schema.prisma e rode: npm run db:pg:sync\n\n" +
  src.replace(
    datasource,
    `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  // Conexão direta (sem pooler) para migrations — exigida por Neon/Supabase com pooling.
  directUrl = env("DIRECT_URL")
}`,
  );

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== out) {
    console.error(`${OUT} está desatualizado em relação a ${SRC}. Rode: npm run db:pg:sync (e gere a migration PostgreSQL).`);
    process.exit(1);
  }
  console.log(`${OUT} em sincronia.`);
} else {
  writeFileSync(OUT, out);
  console.log(`${OUT} atualizado.`);
}
