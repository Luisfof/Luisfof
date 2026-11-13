import type { ReactNode, SVGProps } from 'react';
import { Link } from 'react-router-dom';
import { cityName, formatBRL, typeName, type Listing } from '../../shared/types';

/* ── Marca ─────────────────────────────────────────────────────────────
   Símbolo "Duplo Vão": os dois A de MORAA sem travessa viram dois vãos/
   soleiras; juntos desenham um M. O segundo vão sobe um degrau — é o GO. */
export function Symbol({ size = 36, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light' | 'ipe' }) {
  const bg = tone === 'dark' ? '#0b1220' : tone === 'ipe' ? '#ffc21a' : '#f6f1e7';
  const a = tone === 'ipe' ? '#0b1220' : '#ffc21a';
  const b = tone === 'ipe' ? '#0b1220' : '#f2542d';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="8" fill={bg} />
      <path d="M9 50 L21.5 21 L34 50" fill="none" stroke={a} strokeWidth="8.5" strokeLinejoin="miter" strokeMiterlimit="6" />
      <path d="M30 43 L42.5 14 L55 43" fill="none" stroke={b} strokeWidth="8.5" strokeLinejoin="miter" strokeMiterlimit="6" />
    </svg>
  );
}

export function Logo({ tone = 'light', height = 26 }: { tone?: 'light' | 'dark'; height?: number }) {
  const ink = tone === 'light' ? '#f6f1e7' : '#0b1220';
  const s = { fill: 'none', stroke: ink, strokeWidth: 8.5, strokeLinejoin: 'miter' as const, strokeMiterlimit: 6 };
  return (
    <svg height={height} viewBox="0 0 352 56" role="img" aria-label="MORAA GO" style={{ display: 'block', overflow: 'visible' }}>
      <g transform="translate(5 4)">
        <path d="M0 48 V2 L20 34 L40 2 V48" {...s} />
        <ellipse cx="80" cy="24" rx="20" ry="20" {...s} />
        <path d="M120 48 V4 H138 a11.5 11.5 0 0 1 0 23 H120 M138 27 L151 48" {...s} />
        <path d="M166 48 L185 2 L204 48" {...s} />
        <path d="M216 48 L235 2 L254 48" {...s} stroke="#ffc21a" />
        <rect x="272" y="-1" width="72" height="50" rx="4" fill="#f2542d" />
        <text x="308" y="36" textAnchor="middle" fontFamily="'Archivo Variable', Archivo, Arial, sans-serif" fontWeight="900" fontSize="33" fill="#0b1220" style={{ fontVariationSettings: "'wdth' 112" }}>GO</text>
      </g>
    </svg>
  );
}

/* ── Ícones próprios (traço 1.75, 24px) ─────────────────────────────── */
const paths: Record<string, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></>,
  bed: <><path d="M3 18v-7h13a5 5 0 0 1 5 5v2M3 11V5M3 15h18M3 18v2M21 18v2" /><circle cx="7.5" cy="8" r="1.8" /></>,
  bath: <><path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2ZM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2" /></>,
  car: <><path d="M4 16V11l2-5h12l2 5v5M4 16h16M4 16v3h3v-3M17 16v3h3v-3M4 11h16" /><path d="M7.5 13.5h.01M16.5 13.5h.01" /></>,
  area: <><path d="M4 4h16v16H4zM4 9h3M4 14h3M9 20v-3M14 20v-3" /></>,
  pin: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.4" /></>,
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  back: <path d="M20 12H5M11 6l-6 6 6 6" />,
  menu: <path d="M3 7h18M3 12h18M3 17h18" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  filter: <><path d="M3 6h18M6 12h12M10 18h4" /></>,
  flag: <path d="M5 21V4h11l-1.5 4L16 12H5" />,
  share: <><path d="M12 15V3M8 7l4-4 4 4M5 12v8h14v-8" /></>,
  chat: <path d="M4 5h16v11H9l-5 4V5Z" />,
  door: <><path d="M6 21V3h9l3 2v16M3 21h18" /><path d="M14 12h.01" /></>,
  camera: <><path d="M3 7h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13" r="3.5" /></>,
  check: <path d="M4 12.5 9.5 18 20 6" />,
  shield: <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  edit: <path d="M4 20h4L20 8l-4-4L4 16v4ZM14 6l4 4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />,
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="M7 4v16l13-8L7 4Z" />,
  star: <path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7L12 3Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6" /></>,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
};
export function Icon({ name, size = 20, ...rest }: { name: keyof typeof paths | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" focusable="false" {...rest}>
      {paths[name]}
    </svg>
  );
}

/* ── Card de imóvel ─────────────────────────────────────────────────── */
export function ListingCard({ l, eager = false }: { l: Listing; eager?: boolean }) {
  const img = l.images[0];
  return (
    <article className="card">
      <Link to={`/imovel/${l.slug}`} className="card__link" aria-label={`${l.title}, ${formatBRL(l.price)} por mês, ${l.neighborhood}, ${cityName(l.city)}`}>
        <div className="card__media">
          {img ? (
            <img src={img.thumbUrl} srcSet={`${img.thumbUrl} 640w, ${img.url} 1280w`} sizes="(min-width: 1100px) 380px, (min-width: 700px) 46vw, 92vw" alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" width={640} height={480} />
          ) : (
            <div className="card__noimg"><Icon name="camera" size={28} /><span>Sem fotos ainda</span></div>
          )}
          <div className="card__tags">
            {l.isDemo && <span className="tag tag--demo">Demonstrativo</span>}
            {l.featured && <span className="tag tag--destaque">Destaque</span>}
          </div>
          <div className="card__price num">
            <strong>{formatBRL(l.price)}</strong>
            <span>/mês</span>
          </div>
        </div>
        <div className="card__body">
          <p className="label card__kicker">{typeName(l.type)} · {cityName(l.city)}</p>
          <h3 className="card__title">{l.title}</h3>
          <p className="card__place"><Icon name="pin" size={16} /> {l.neighborhood}</p>
          <ul className="specs" aria-label="Características">
            {l.bedrooms > 0 && <li><Icon name="bed" size={18} /><span className="num">{l.bedrooms}</span><span className="sr-only"> quartos</span></li>}
            <li><Icon name="bath" size={18} /><span className="num">{l.bathrooms}</span><span className="sr-only"> banheiros</span></li>
            {l.parking > 0 && <li><Icon name="car" size={18} /><span className="num">{l.parking}</span><span className="sr-only"> vagas</span></li>}
            {l.areaM2 && <li><Icon name="area" size={18} /><span className="num">{l.areaM2} m²</span></li>}
          </ul>
        </div>
      </Link>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="card" aria-hidden="true">
      <div className="skeleton" style={{ aspectRatio: '4/3' }} />
      <div className="card__body">
        <div className="skeleton" style={{ height: 12, width: '40%' }} />
        <div className="skeleton" style={{ height: 22, width: '90%', marginTop: 10 }} />
        <div className="skeleton" style={{ height: 14, width: '55%', marginTop: 10 }} />
      </div>
    </div>
  );
}

/* ── Estados ────────────────────────────────────────────────────────── */
export function StateBox({ icon = 'door', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <Icon name={icon} size={56} className="state__mark" strokeWidth={1.4} />
      <h2 className="h2" style={{ fontSize: 'clamp(1.5rem,5vw,2.2rem)' }}>{title}</h2>
      {children && <div className="soft" style={{ maxWidth: 520 }}>{children}</div>}
      {action}
    </div>
  );
}
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <StateBox icon="info" title="Não deu para carregar" action={retry && <button className="btn btn--noite" onClick={retry}>Tentar de novo</button>}>
      <p role="alert">{message}</p>
    </StateBox>
  );
}
export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="loading__bar" />
      <span className="label">{label}</span>
    </div>
  );
}

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="err" id={`${id}-err`} role="alert">{error}</span>}
    </div>
  );
}

export function DemoNote({ children }: { children?: ReactNode }) {
  return (
    <p className="notice notice--warn">
      <Icon name="info" size={20} style={{ flex: 'none', marginTop: 1 }} />
      <span>{children ?? <><strong>Ambiente de demonstração.</strong> Os anúncios marcados como “Demonstrativo” usam imagens ilustrativas e não representam imóveis disponíveis.</>}</span>
    </p>
  );
}
