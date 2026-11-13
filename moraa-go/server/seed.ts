// Dados DEMONSTRATIVOS: 10 anúncios fictícios, sempre isDemo=true, sem telefone.
import { randomBytes } from 'node:crypto';
import type { CityId, FeatureId, PropertyTypeId } from '../shared/types.ts';
import type { Db } from './db.ts';
import { nowIso } from './db.ts';
import { DEMO_USER_EMAIL } from './config.ts';
import { hashPasswordSync, newId } from './security.ts';
import { insertListing, slugify } from './listings.ts';

export const DEMO_USER_NAME = 'Demonstração MORAA GO';
const DISCLAIMER = 'Anúncio demonstrativo: este imóvel não está disponível para locação.';

interface DemoListing {
  title: string;
  type: PropertyTypeId;
  city: CityId;
  neighborhood: string;
  price: number;
  condo: number | null;
  rooms: [number, number, number];
  area: number;
  features: FeatureId[];
  images: [string, string][]; // [chave, ambiente]
  featured: boolean;
  description: string;
}

export const DEMO_LISTINGS: DemoListing[] = [
  {
    title: 'Casa térrea com quintal e garagem coberta', type: 'casa', city: 'senador-canedo', neighborhood: 'Jardim das Oliveiras',
    price: 1850, condo: null, rooms: [3, 2, 2], area: 140, featured: true,
    features: ['garagem', 'quintal', 'aceita-pet', 'churrasqueira', 'area-de-servico'],
    images: [['casa-oliveiras-a', 'fachada'], ['casa-oliveiras-b', 'sala'], ['casa-oliveiras-c', 'quintal']],
    description: 'Casa térrea de três quartos, sendo uma suíte, com sala ampla e cozinha integrada à área de serviço. O quintal nos fundos tem churrasqueira e espaço para os pets, e a garagem coberta comporta dois carros.',
  },
  {
    title: 'Apartamento claro com varanda e portaria', type: 'apartamento', city: 'goiania', neighborhood: 'Setor Bueno',
    price: 2400, condo: 480, rooms: [2, 2, 1], area: 68, featured: true,
    features: ['varanda', 'portaria', 'elevador', 'ar-condicionado'],
    images: [['apto-bueno-a', 'sala'], ['apto-bueno-b', 'varanda'], ['apto-bueno-c', 'quarto']],
    description: 'Apartamento de dois quartos com boa iluminação natural e varanda voltada para o nascente. O prédio tem portaria, elevador e uma vaga de garagem, em região com comércio e serviços por perto.',
  },
  {
    title: 'Studio mobiliado perto da universidade', type: 'kitnet', city: 'goiania', neighborhood: 'Setor Leste Universitário',
    price: 950, condo: 120, rooms: [1, 1, 0], area: 28, featured: false,
    features: ['mobiliado', 'portaria'],
    images: [['studio-univ-a', 'ambiente integrado'], ['studio-univ-b', 'cozinha']],
    description: 'Studio compacto e funcional, entregue com cama, armário, mesa de estudo e cozinha equipada. Fica a poucos minutos a pé do campus, em prédio com portaria.',
  },
  {
    title: 'Sobrado contemporâneo com três suítes', type: 'sobrado', city: 'senador-canedo', neighborhood: 'Residencial Paraíso',
    price: 2600, condo: null, rooms: [3, 3, 2], area: 180, featured: true,
    features: ['garagem', 'quintal', 'varanda', 'energia-solar', 'churrasqueira'],
    images: [['sobrado-paraiso-a', 'fachada'], ['sobrado-paraiso-b', 'sala'], ['sobrado-paraiso-c', 'suíte']],
    description: 'Sobrado de linhas contemporâneas com três suítes no piso superior, uma delas com varanda. No térreo, sala em dois ambientes, quintal com churrasqueira e garagem para dois carros. Conta com placas de energia solar, o que ajuda a reduzir a conta de luz.',
  },
  {
    title: 'Apartamento com vista e lazer completo', type: 'apartamento', city: 'goiania', neighborhood: 'Jardim Goiás',
    price: 2900, condo: 620, rooms: [2, 2, 2], area: 74, featured: false,
    features: ['varanda', 'portaria', 'elevador', 'piscina', 'ar-condicionado'],
    images: [['apto-jdgoias-a', 'sala'], ['apto-jdgoias-b', 'vista da varanda'], ['apto-jdgoias-c', 'área de lazer']],
    description: 'Apartamento em andar alto com vista livre, dois quartos climatizados e duas vagas de garagem. O condomínio oferece piscina, portaria e elevadores, próximo a parque e centros de compras.',
  },
  {
    title: 'Casa de dois quartos em rua tranquila', type: 'casa', city: 'senador-canedo', neighborhood: 'Vila Galvão',
    price: 1200, condo: null, rooms: [2, 1, 1], area: 85, featured: false,
    features: ['garagem', 'quintal', 'aceita-pet', 'area-de-servico'],
    images: [['casa-galvao-a', 'fachada'], ['casa-galvao-b', 'cozinha'], ['casa-galvao-c', 'quintal']],
    description: 'Casa simples e bem cuidada, com dois quartos, sala, cozinha e área de serviço coberta. Tem quintal murado, vaga de garagem e fica em rua residencial de pouco movimento.',
  },
  {
    title: 'Apartamento de um quarto no Setor Oeste', type: 'apartamento', city: 'goiania', neighborhood: 'Setor Oeste',
    price: 1600, condo: 390, rooms: [1, 1, 1], area: 46, featured: false,
    features: ['portaria', 'elevador', 'area-de-servico'],
    images: [['apto-oeste-a', 'sala'], ['apto-oeste-b', 'quarto'], ['apto-oeste-c', 'cozinha']],
    description: 'Apartamento de um quarto com sala arejada, cozinha separada e área de serviço. O prédio tem portaria e elevador, em rua arborizada e próxima a praças, restaurantes e transporte público.',
  },
  {
    title: 'Sobrado amplo com piscina e área gourmet', type: 'sobrado', city: 'aparecida-de-goiania', neighborhood: 'Jardim Luz',
    price: 3800, condo: null, rooms: [4, 4, 3], area: 260, featured: true,
    features: ['garagem', 'piscina', 'churrasqueira', 'varanda', 'ar-condicionado', 'energia-solar'],
    images: [['sobrado-luz-a', 'fachada'], ['sobrado-luz-b', 'piscina'], ['sobrado-luz-c', 'área gourmet']],
    description: 'Sobrado espaçoso com quatro suítes climatizadas e varanda no piso superior. A área externa reúne piscina e espaço gourmet com churrasqueira, além de garagem para três carros. O sistema de energia solar atende boa parte do consumo da casa.',
  },
  {
    title: 'Casa nova com jardim e varanda', type: 'casa', city: 'senador-canedo', neighborhood: 'Jardim Todos os Santos',
    price: 1650, condo: null, rooms: [3, 2, 2], area: 120, featured: false,
    features: ['garagem', 'quintal', 'varanda', 'aceita-pet'],
    images: [['casa-santos-a', 'fachada'], ['casa-santos-b', 'varanda']],
    description: 'Casa de construção recente com três quartos, sendo uma suíte, e acabamento em porcelanato. O jardim na frente e a varanda coberta deixam a entrada agradável, e há quintal e duas vagas de garagem.',
  },
  {
    title: 'Sala comercial de esquina no Centro', type: 'comercial', city: 'senador-canedo', neighborhood: 'Centro',
    price: 1400, condo: null, rooms: [0, 1, 1], area: 55, featured: false,
    features: ['ar-condicionado', 'garagem'],
    images: [['sala-centro-a', 'fachada'], ['sala-centro-b', 'interior']],
    description: 'Sala comercial de esquina com boa visibilidade e fachada envidraçada. O espaço é climatizado, tem banheiro e uma vaga, e serve bem a escritório, consultório ou pequeno comércio.',
  },
];

/** Idempotente: só semeia quando a tabela de anúncios está vazia. Retorna quantos anúncios criou. */
export function seedDemo(db: Db): number {
  const { n } = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM listings')!;
  if (n > 0) return 0;

  return db.tx(() => {
    let owner = db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', DEMO_USER_EMAIL);
    if (!owner) {
      owner = { id: newId() };
      // Senha aleatória descartada: ninguém consegue entrar nesta conta.
      db.run(
        "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,'anunciante',?)",
        owner.id, DEMO_USER_NAME, DEMO_USER_EMAIL, hashPasswordSync(randomBytes(32).toString('hex')), nowIso(),
      );
    }

    const base = Date.now() - 60 * 60 * 1000;
    DEMO_LISTINGS.forEach((d, i) => {
      const createdAt = new Date(base - i * 5 * 60 * 60 * 1000).toISOString();
      const id = insertListing(
        db,
        {
          title: d.title, description: `${d.description} ${DISCLAIMER}`, type: d.type, city: d.city, neighborhood: d.neighborhood,
          price: d.price, condoFee: d.condo, iptu: null, bedrooms: d.rooms[0], bathrooms: d.rooms[1], parking: d.rooms[2],
          areaM2: d.area, features: d.features, whatsapp: null, whatsappAuthorized: false, ownershipDeclared: true,
        },
        { ownerId: owner.id, slug: `${slugify(d.title)}-demo${String(i + 1).padStart(2, '0')}`, status: 'ativo', isDemo: true, featured: d.featured, createdAt },
      );
      d.images.forEach(([key, place], pos) => {
        db.run(
          'INSERT INTO images (id, listing_id, url, thumb_url, alt, position, created_at) VALUES (?,?,?,?,?,?,?)',
          newId(), id, `/img/demo/${key}-1280.webp`, `/img/demo/${key}-640.webp`, `Imagem demonstrativa — ${place}`, pos, createdAt,
        );
      });
    });
    return DEMO_LISTINGS.length;
  });
}
