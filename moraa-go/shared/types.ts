// Contrato compartilhado entre frontend e backend do MORAA GO.
// Qualquer mudança aqui afeta os dois lados.

export const CITIES = [
  { id: 'senador-canedo', name: 'Senador Canedo', lat: -16.708, lng: -49.092 },
  { id: 'goiania', name: 'Goiânia', lat: -16.686, lng: -49.264 },
  { id: 'aparecida-de-goiania', name: 'Aparecida de Goiânia', lat: -16.823, lng: -49.244 },
  { id: 'trindade', name: 'Trindade', lat: -16.649, lng: -49.489 },
  { id: 'goianira', name: 'Goianira', lat: -16.495, lng: -49.426 },
] as const;
export type CityId = (typeof CITIES)[number]['id'];

export const PROPERTY_TYPES = [
  { id: 'casa', name: 'Casa' },
  { id: 'apartamento', name: 'Apartamento' },
  { id: 'sobrado', name: 'Sobrado' },
  { id: 'kitnet', name: 'Kitnet / Studio' },
  { id: 'comercial', name: 'Ponto comercial' },
] as const;
export type PropertyTypeId = (typeof PROPERTY_TYPES)[number]['id'];

export const FEATURES = [
  { id: 'garagem', name: 'Garagem' },
  { id: 'quintal', name: 'Quintal' },
  { id: 'varanda', name: 'Varanda' },
  { id: 'aceita-pet', name: 'Aceita pet' },
  { id: 'mobiliado', name: 'Mobiliado' },
  { id: 'portaria', name: 'Portaria' },
  { id: 'elevador', name: 'Elevador' },
  { id: 'area-de-servico', name: 'Área de serviço' },
  { id: 'ar-condicionado', name: 'Ar-condicionado' },
  { id: 'piscina', name: 'Piscina' },
  { id: 'churrasqueira', name: 'Churrasqueira' },
  { id: 'energia-solar', name: 'Energia solar' },
] as const;
export type FeatureId = (typeof FEATURES)[number]['id'];

export type ListingStatus = 'pendente' | 'ativo' | 'pausado' | 'rejeitado';
export type UserRole = 'anunciante' | 'admin';

export interface ListingImage {
  id: string;
  url: string; // ~1280px
  thumbUrl: string; // ~640px
  alt: string;
}

/** Visão pública de um anúncio. Nunca contém telefone, e-mail ou endereço completo. */
export interface Listing {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: PropertyTypeId;
  city: CityId;
  neighborhood: string;
  /** Aluguel mensal em reais (inteiro). */
  price: number;
  condoFee: number | null;
  iptu: number | null;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  areaM2: number | null;
  features: FeatureId[];
  images: ListingImage[];
  /** true = conteúdo demonstrativo, não é um imóvel disponível. */
  isDemo: boolean;
  featured: boolean;
  status: ListingStatus;
  /** Coordenadas aproximadas (centro do bairro/cidade, 2 casas decimais). */
  approxLat: number;
  approxLng: number;
  advertiserName: string; // primeiro nome ou nome fantasia
  /** O anunciante autorizou expor o WhatsApp mediante clique? */
  whatsappAuthorized: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Visão do dono/admin: inclui métricas e moderação. */
export interface OwnedListing extends Listing {
  views: number;
  contactClicks: number;
  moderationNote: string | null;
  ownerId: string;
  ownerEmail?: string; // somente admin
}

export interface ListingInput {
  title: string; // 8–90
  description: string; // 30–3000
  type: PropertyTypeId;
  city: CityId;
  neighborhood: string; // 2–60
  price: number; // 100–100000
  condoFee?: number | null;
  iptu?: number | null;
  bedrooms: number; // 0–10
  bathrooms: number; // 0–10
  parking: number; // 0–10
  areaM2?: number | null; // 8–5000
  features: FeatureId[];
  /** WhatsApp só dígitos com DDD (10–11). Obrigatório se whatsappAuthorized. */
  whatsapp?: string | null;
  whatsappAuthorized: boolean;
  /** Declaração obrigatória: tenho autorização para anunciar este imóvel. */
  ownershipDeclared: boolean;
}

export interface SearchParams {
  q?: string;
  city?: CityId;
  neighborhood?: string;
  type?: PropertyTypeId;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number; // mínimo
  features?: FeatureId[]; // todas devem estar presentes (CSV na query)
  sort?: 'recentes' | 'menor-preco' | 'maior-preco';
  page?: number; // 1-based
}

export interface SearchResult {
  items: Listing[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Meta {
  /** Bairros com anúncios ativos, por cidade. */
  neighborhoods: Record<string, string[]>;
  /** Contagem de anúncios ativos por cidade. */
  counts: Record<string, number>;
  demoMode: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ContactResponse {
  /** 'demo' = anúncio demonstrativo, sem contato real. */
  kind: 'whatsapp' | 'demo' | 'indisponivel';
  whatsappUrl?: string;
  message: string;
}

export const REPORT_REASONS = [
  { id: 'golpe', name: 'Suspeita de golpe' },
  { id: 'indisponivel', name: 'Imóvel já alugado / indisponível' },
  { id: 'dados-incorretos', name: 'Informações incorretas' },
  { id: 'conteudo-improprio', name: 'Conteúdo impróprio' },
  { id: 'sem-autorizacao', name: 'Anúncio sem autorização do proprietário' },
  { id: 'outro', name: 'Outro motivo' },
] as const;
export type ReportReasonId = (typeof REPORT_REASONS)[number]['id'];

export interface Report {
  id: string;
  listingId: string;
  listingTitle: string;
  listingSlug: string;
  reason: ReportReasonId;
  details: string;
  status: 'aberta' | 'resolvida';
  resolution: string | null;
  createdAt: string;
}

export interface AdminMetrics {
  listings: Record<ListingStatus, number>;
  demoListings: number;
  users: number;
  openReports: number;
  totalViews: number;
  totalContactClicks: number;
  planInterest: Record<string, number>;
  byCity: Record<string, number>;
}

export const PLANS = [
  { id: 'basico', name: 'Básico', price: 0, period: '', tagline: 'Um imóvel, sem custo.', perks: ['1 anúncio ativo', 'Até 8 fotos', 'Moderação antes de publicar', 'Contato por WhatsApp com consentimento'] },
  { id: 'destaque-7', name: 'Destaque 7', price: 19.9, period: '7 dias', tagline: 'Topo da busca por uma semana.', perks: ['Tudo do Básico', 'Selo Destaque', 'Posição prioritária na busca', 'Presença na home'] },
  { id: 'destaque-30', name: 'Destaque 30', price: 49.9, period: '30 dias', tagline: 'Um mês inteiro em evidência.', perks: ['Tudo do Destaque 7', '30 dias de prioridade', 'Relatório de visualizações'] },
  { id: 'imobiliaria', name: 'Imobiliária', price: 149.9, period: 'mês', tagline: 'Até 20 anúncios para profissionais.', perks: ['Até 20 anúncios ativos', 'Vitrine do anunciante', '3 destaques simultâneos', 'Suporte prioritário'] },
] as const;
export type PlanId = (typeof PLANS)[number]['id'];

export interface ApiError {
  error: string; // mensagem em pt-BR para o usuário
  fields?: Record<string, string>; // erros por campo
}

export const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v % 1 ? 2 : 0 });
export const cityName = (id: string) => CITIES.find((c) => c.id === id)?.name ?? id;
export const typeName = (id: string) => PROPERTY_TYPES.find((c) => c.id === id)?.name ?? id;
export const featureName = (id: string) => FEATURES.find((c) => c.id === id)?.name ?? id;
