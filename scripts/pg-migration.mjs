// Gera uma migration PostgreSQL a partir da diferença entre o schema da última versão commitada
// e o schema atual — sem precisar de banco ligado.
// Uso: npm run db:pg:migration -- nome_da_mudanca
// Fluxo: edite prisma/schema.prisma → npx prisma migrate dev (local, SQLite) → npm run db:pg:migration -- nome
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const name = (process.argv[2] ?? "").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
if (!name) {
  console.error("Informe um nome: npm run db:pg:migration -- adiciona_campo_x");
  process.exit(1);
}
execFileSync(process.execPath, ["scripts/sync-postgres-schema.mjs"], { stdio: "inherit" });

const tmp = mkdtempSync(path.join(tmpdir(), "pgmig-"));
const previous = path.join(tmp, "previous.prisma");
let prev;
try {
  // PG_PREVIOUS_SCHEMA: caminho alternativo do schema anterior (testes / casos especiais).
  prev = process.env.PG_PREVIOUS_SCHEMA
    ? readFileSync(process.env.PG_PREVIOUS_SCHEMA, "utf8")
    : execFileSync("git", ["show", "HEAD:prisma/postgres/schema.prisma"], { encoding: "utf8" });
} catch {
  console.error("Não há versão commitada de prisma/postgres/schema.prisma para comparar.");
  process.exit(1);
}
writeFileSync(previous, prev);
// Chama a CLI do Prisma pelo Node, sem shell (argumentos nunca são interpretados por um terminal).
const prismaCli = path.join("node_modules", "prisma", "build", "index.js");
const sql = execFileSync(
  process.execPath,
  [prismaCli, "migrate", "diff", "--from-schema-datamodel", previous, "--to-schema-datamodel", "prisma/postgres/schema.prisma", "--script"],
  { encoding: "utf8" },
);
rmSync(tmp, { recursive: true, force: true });

if (!sql.trim() || /This is an empty migration/.test(sql)) {
  console.log("Nenhuma diferença no schema: nada a gerar.");
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const dir = path.join("prisma/postgres/migrations", `${stamp}_${name}`);
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "migration.sql"), sql);
console.log(`Migration criada: ${dir}/migration.sql — revise o SQL antes de commitar.`);
if (/DROP (TABLE|COLUMN)/i.test(sql)) console.log("ATENÇÃO: a migration remove tabela/coluna (destrutivo). Confirme que é intencional.");
console.log(`Migrations existentes: ${readdirSync("prisma/postgres/migrations").filter((d) => d !== "migration_lock.toml").length}`);
