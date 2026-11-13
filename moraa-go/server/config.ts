// Configuração do servidor a partir de variáveis de ambiente.
import path from 'node:path';

export const TERMS_VERSION = '2026-11';
export const DEMO_USER_EMAIL = 'demo@moraago.local';
export const DEV_ADMIN_EMAIL = 'admin@moraago.local';
export const DEV_ADMIN_PASSWORD = 'moraa-admin-demo';

export type RateLimitName = 'global' | 'login' | 'register' | 'contact' | 'report' | 'upload' | 'planInterest' | 'write';

export interface AppOptions {
  /** Diretório de dados (banco SQLite + uploads). */
  dataDir: string;
  /** Caminho do banco; use ':memory:' para um banco em memória. Padrão: DATA_DIR/moraa.sqlite */
  dbPath?: string;
  nodeEnv?: string;
  adminEmail?: string;
  adminPassword?: string;
  seedDemo?: boolean;
  publicUrl?: string;
  trustProxy?: boolean;
  /** false desliga todos os limitadores (testes). Padrão: true. */
  rateLimits?: boolean;
  /** Sobrescreve o máximo de requisições de limitadores específicos. */
  rateLimitMax?: Partial<Record<RateLimitName, number>>;
  /** Pasta do build do frontend. Padrão: ./dist (servida apenas se existir). */
  distDir?: string;
  /** Usa a conta admin de demonstração quando não há senha configurada. */
  usingDemoAdmin?: boolean;
}

export class ConfigError extends Error {}

/** Lê e valida o ambiente. Em produção, recusa iniciar sem ADMIN_PASSWORD forte. */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): AppOptions & { port: number } {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const port = Number.parseInt(env.PORT || '8787', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError('PORT inválida.');

  let adminEmail = (env.ADMIN_EMAIL || '').trim().toLowerCase();
  let adminPassword = env.ADMIN_PASSWORD || '';
  let usingDemoAdmin = false;

  if (isProd) {
    if (adminPassword.length < 12) {
      throw new ConfigError('Em produção, defina ADMIN_PASSWORD com pelo menos 12 caracteres. O servidor não será iniciado.');
    }
    if (adminPassword === DEV_ADMIN_PASSWORD || adminPassword === 'troque-esta-senha-longa') {
      throw new ConfigError('Em produção, ADMIN_PASSWORD não pode ser a senha de exemplo/demonstração.');
    }
    if (!adminEmail) throw new ConfigError('Em produção, defina ADMIN_EMAIL.');
  } else if (!adminPassword) {
    adminEmail = adminEmail || DEV_ADMIN_EMAIL;
    adminPassword = DEV_ADMIN_PASSWORD;
    usingDemoAdmin = true;
  }
  if (!adminEmail) adminEmail = DEV_ADMIN_EMAIL;

  return {
    port,
    nodeEnv,
    dataDir: path.resolve(env.DATA_DIR || './data'),
    adminEmail,
    adminPassword,
    usingDemoAdmin,
    seedDemo: env.SEED_DEMO !== 'false',
    publicUrl: (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
    trustProxy: env.TRUST_PROXY === 'true',
    rateLimits: true,
    distDir: path.resolve('dist'),
  };
}
