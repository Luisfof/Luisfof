// Validação (zod) e saneamento de todas as entradas.
import { z } from 'zod';
import { CITIES, FEATURES, PLANS, PROPERTY_TYPES, REPORT_REASONS } from '../shared/types.ts';
import type { CityId, FeatureId, PlanId, PropertyTypeId, ReportReasonId } from '../shared/types.ts';
import { HttpError } from './security.ts';

const ids = <T extends string>(list: readonly { id: T }[]) => list.map((x) => x.id) as [T, ...T[]];
export const CITY_IDS = ids<CityId>(CITIES);
export const TYPE_IDS = ids<PropertyTypeId>(PROPERTY_TYPES);
export const FEATURE_IDS = ids<FeatureId>(FEATURES);
export const PLAN_IDS = ids<PlanId>(PLANS);
export const REASON_IDS = ids<ReportReasonId>(REPORT_REASONS);
export const STATUS_IDS = ['pendente', 'ativo', 'pausado', 'rejeitado'] as const;

// Controles C0/C1, zero-width e marcas de direção (usadas para falsificar texto).
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Texto de uma linha: sem controles, espaços colapsados. */
export const cleanLine = (s: string) => s.normalize('NFC').replace(/[\r\n\t]/g, ' ').replace(CTRL, '').replace(/\s+/g, ' ').trim();
/** Texto longo: preserva quebras de linha (no máximo uma linha em branco seguida). */
export const cleanText = (s: string) =>
  s.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(CTRL, '').replace(/[ \u00A0]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const hasAngle = (s: string) => /[<>]/.test(s);
const hasTag = (s: string) => /<\s*\/?\s*[a-zA-Z!?][^>]*>?/.test(s);

/** Minúsculas sem acentos — usado em busca e comparação de bairros. */
export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const line = (label: string, min: number, max: number) =>
  z
    .string({ error: `Informe ${label}.` })
    .max(max * 4 + 200, `Use no máximo ${max} caracteres.`)
    .transform(cleanLine)
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `Informe ${label}.` : `Use pelo menos ${min} caracteres.`)
        .max(max, `Use no máximo ${max} caracteres.`)
        .refine((s) => !hasAngle(s), 'Não use os caracteres < ou > (HTML não é permitido).'),
    );

const int = (min: number, max: number, msg: string) => z.number({ error: msg }).int(msg).min(min, msg).max(max, msg);
const money = (max: number, msg: string) =>
  int(0, max, msg).nullable().optional().transform((v) => v ?? null);

const email = z
  .string({ error: 'Informe seu e-mail.' })
  .max(400, 'E-mail inválido.')
  .transform((s) => cleanLine(s).toLowerCase())
  .pipe(z.string().max(254, 'E-mail inválido.').regex(/^[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]{2,}$/, 'Informe um e-mail válido.'));

export const registerSchema = z.object({
  name: line('seu nome', 2, 80),
  email,
  password: z
    .string({ error: 'Crie uma senha.' })
    .min(10, 'A senha precisa ter pelo menos 10 caracteres.')
    .max(200, 'A senha pode ter no máximo 200 caracteres.')
    .refine((p) => new Set(p).size >= 4, 'Escolha uma senha menos previsível.'),
  acceptTerms: z.literal(true, { error: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.' }),
});

export const loginSchema = z.object({
  email: z.string({ error: 'Informe seu e-mail.' }).max(400, 'E-mail inválido.').transform((s) => cleanLine(s).toLowerCase()),
  password: z.string({ error: 'Informe sua senha.' }).min(1, 'Informe sua senha.').max(200, 'Senha inválida.'),
});

export const listingSchema = z
  .object({
    title: line('um título', 8, 90),
    description: z
      .string({ error: 'Descreva o imóvel.' })
      .max(20000, 'Use no máximo 3000 caracteres.')
      .transform(cleanText)
      .pipe(
        z
          .string()
          .min(30, 'Descreva o imóvel com pelo menos 30 caracteres.')
          .max(3000, 'Use no máximo 3000 caracteres.')
          .refine((s) => !hasTag(s), 'Não use HTML na descrição.'),
      ),
    type: z.enum(TYPE_IDS, { error: 'Escolha o tipo de imóvel.' }),
    city: z.enum(CITY_IDS, { error: 'Escolha uma cidade atendida.' }),
    neighborhood: line('o bairro', 2, 60),
    price: int(100, 100000, 'Informe o aluguel mensal entre R$ 100 e R$ 100.000 (valor inteiro).'),
    condoFee: money(50000, 'Informe um valor de condomínio entre R$ 0 e R$ 50.000.'),
    iptu: money(50000, 'Informe um valor de IPTU entre R$ 0 e R$ 50.000.'),
    bedrooms: int(0, 10, 'Informe de 0 a 10 quartos.'),
    bathrooms: int(0, 10, 'Informe de 0 a 10 banheiros.'),
    parking: int(0, 10, 'Informe de 0 a 10 vagas.'),
    areaM2: z
      .number({ error: 'Informe a área entre 8 e 5.000 m².' })
      .min(8, 'Informe a área entre 8 e 5.000 m².')
      .max(5000, 'Informe a área entre 8 e 5.000 m².')
      .nullable()
      .optional()
      .transform((v) => (v == null ? null : Math.round(v * 10) / 10)),
    features: z
      .array(z.enum(FEATURE_IDS, { error: 'Característica desconhecida.' }), { error: 'Lista de características inválida.' })
      .max(FEATURE_IDS.length * 2, 'Lista de características inválida.')
      .transform((arr) => FEATURE_IDS.filter((f) => arr.includes(f))),
    whatsapp: z
      .string({ error: 'Informe o WhatsApp com DDD.' })
      .max(40, 'Informe o WhatsApp com DDD (10 ou 11 dígitos).')
      .nullable()
      .optional()
      .transform((v) => (v == null ? null : v.replace(/[\s().-]/g, '') || null))
      .refine((v) => v === null || /^\d{10,11}$/.test(v), 'Informe o WhatsApp com DDD, somente números (10 ou 11 dígitos).'),
    whatsappAuthorized: z.boolean({ error: 'Indique se autoriza o contato por WhatsApp.' }),
    ownershipDeclared: z.literal(true, { error: 'Confirme que você tem autorização para anunciar este imóvel.' }),
  })
  .superRefine((v, ctx) => {
    if (v.whatsappAuthorized && !v.whatsapp) {
      ctx.addIssue({ code: 'custom', path: ['whatsapp'], message: 'Informe o WhatsApp com DDD para autorizar o contato.' });
    }
  });
export type ListingData = z.infer<typeof listingSchema>;

export const ownerStatusSchema = z.object({ status: z.enum(['pausado', 'ativo'], { error: 'Status inválido.' }) });

export const reportSchema = z.object({
  reason: z.enum(REASON_IDS, { error: 'Escolha o motivo da denúncia.' }),
  details: z
    .string({ error: 'Detalhes inválidos.' })
    .max(5000, 'Use no máximo 1000 caracteres.')
    .transform(cleanText)
    .pipe(z.string().max(1000, 'Use no máximo 1000 caracteres.'))
    .optional()
    .transform((v) => v ?? ''),
});

export const planSchema = z.object({ plan: z.enum(PLAN_IDS, { error: 'Plano desconhecido.' }) });

const note = z
  .string({ error: 'Observação inválida.' })
  .max(5000, 'Use no máximo 1000 caracteres.')
  .transform(cleanText)
  .pipe(z.string().max(1000, 'Use no máximo 1000 caracteres.'));

export const moderateSchema = z
  .object({
    action: z.enum(['aprovar', 'rejeitar', 'pausar', 'destacar', 'remover-destaque'], { error: 'Ação de moderação inválida.' }),
    note: note.nullable().optional().transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (v.action === 'rejeitar' && !v.note) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Explique o motivo da rejeição para o anunciante.' });
    }
  });

export const resolveSchema = z.object({
  resolution: note.pipe(z.string().min(3, 'Descreva a resolução (mínimo de 3 caracteres).')),
});

// ---------- Busca ----------
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const blank = (v: unknown) => {
  const x = first(v);
  return typeof x === 'string' && x.trim() === '' ? undefined : x;
};
const num = (label: string) =>
  z.preprocess(
    blank,
    z
      .string()
      .trim()
      .regex(/^-?\d{1,12}([.,]\d+)?$/, `${label}: informe um número válido.`)
      .transform((s) => Number(s.replace(',', '.')))
      .optional(),
  );
const lenient = <T extends string>(values: readonly [T, ...T[]]) => z.preprocess(blank, z.enum(values).optional().catch(undefined));
const text = (max: number) =>
  z.preprocess(blank, z.string().transform((s) => cleanLine(s).slice(0, max)).optional().catch(undefined));

export const searchSchema = z.object({
  q: text(80),
  city: lenient(CITY_IDS),
  neighborhood: text(60),
  type: lenient(TYPE_IDS),
  minPrice: num('Preço mínimo'),
  maxPrice: num('Preço máximo'),
  bedrooms: num('Quartos'),
  features: z.preprocess(
    (v) => (Array.isArray(v) ? v.join(',') : v),
    z
      .string()
      .transform((s) => FEATURE_IDS.filter((f) => s.split(',').map((x) => x.trim()).includes(f)))
      .optional()
      .catch(undefined),
  ),
  sort: lenient(['recentes', 'menor-preco', 'maior-preco']),
  page: num('Página'),
});
export type SearchQuery = z.infer<typeof searchSchema>;

// ---------- Utilitários ----------
export function toFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

/** Valida o corpo; lança HttpError 400 com o mapa de campos em pt-BR. */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown, message = 'Revise os campos destacados.'): z.infer<S> {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const result = schema.safeParse(input);
  if (!result.success) throw new HttpError(400, message, toFields(result.error));
  return result.data;
}
