// Ponto de entrada: lê o ambiente, cria o app e escuta a porta.
import fs from 'node:fs';
import { ConfigError, DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, configFromEnv } from './config.ts';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

async function main(): Promise<void> {
  let config;
  try {
    config = configFromEnv(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[moraa] Configuração inválida: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  // Importado depois da validação: nada é aberto/criado se a configuração for recusada.
  const { createApp, getCtx } = await import('./app.ts');
  const { port, ...opts } = config;
  const app = createApp(opts);

  if (config.usingDemoAdmin) {
    console.warn(
      `[moraa] AVISO: ADMIN_PASSWORD não definido. Usando a conta administrativa de DEMONSTRAÇÃO (${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}).\n` +
        '[moraa] Isto serve apenas para desenvolvimento local. Nunca exponha este servidor à internet assim; defina ADMIN_EMAIL e ADMIN_PASSWORD.',
    );
  }

  const server = app.listen(port, () => {
    console.log(`[moraa] API em http://localhost:${port} (${config.nodeEnv}) — dados em ${config.dataDir}`);
  });
  server.on('error', (err) => {
    console.error(`[moraa] Não foi possível iniciar o servidor: ${err.message}`);
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => {
      try {
        getCtx(app).db.close();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
