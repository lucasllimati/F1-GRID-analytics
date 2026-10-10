// Verifica se a IA configurada no .env responde, com uma chamada mínima.
// Uso: npm run ai:check
try {
  process.loadEnvFile(".env");
} catch {}

async function main() {
  const { env } = await import("../src/lib/env");
  const { createEditorialAI } = await import("../src/lib/news/ai-factory");
  const sel = createEditorialAI(env());
  console.log(`Provedor: ${sel.provider}`);
  console.log(`Modelo:   ${sel.model}`);
  if (!sel.ai) {
    console.log(`\n❌ IA desativada: ${sel.reason}`);
    process.exitCode = 1;
    return;
  }
  const r = await sel.ai.ping();
  console.log(r.ok ? `\n✅ Conexão OK — ${r.detail}` : `\n❌ Falhou — ${r.detail}`);
  // exitCode em vez de process.exit(): evita falha do libuv no Windows com conexões abertas.
  process.exitCode = r.ok ? 0 : 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

export {};
