// Cria (ou atualiza a senha de) um usuário da redação.
// Uso: npm run admin:create -- --email voce@exemplo.com --name "Seu Nome" --role admin
// A senha vem de ADMIN_PASSWORD (env) ou é gerada e exibida UMA vez.
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

try {
  process.loadEnvFile(".env");
} catch {}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name") ?? "Editor";
  const role = arg("role") === "admin" ? "admin" : "editor";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Informe --email válido.");
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(18).toString("base64url");
  const db = new PrismaClient();
  const passwordHash = hashPassword(password);
  const user = await db.adminUser.upsert({
    where: { email },
    update: { passwordHash, role, name, active: true },
    create: { email, name, role, passwordHash },
  });
  await db.auditLog.create({ data: { actor: "system:cli", action: "admin_user.upsert", entity: "admin_user", entityId: user.id, details: JSON.stringify({ email, role }) } });
  await db.$disconnect();
  console.log(`Usuário ${email} (${role}) pronto.`);
  if (generated) console.log(`Senha gerada (guarde agora, não será exibida novamente): ${password}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
