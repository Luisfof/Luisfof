import { CITIES, cityName } from '../../shared/types';

/* Mapa esquemático da região metropolitana — desenhado, sem tiles de terceiros
   (nenhum dado do visitante sai do site). Mostra só uma área APROXIMADA. */
const BOX = { minLat: -16.95, maxLat: -16.42, minLng: -49.58, maxLng: -48.98 };
const W = 600, H = 420;
const px = (lng: number) => ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * W;
const py = (lat: number) => ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * H;

export function RegionMap({ lat, lng, city, neighborhood }: { lat: number; lng: number; city: string; neighborhood: string }) {
  const x = Math.min(W - 40, Math.max(40, px(lng)));
  const y = Math.min(H - 40, Math.max(40, py(lat)));
  const osm = `https://www.openstreetmap.org/?mlat=${lat.toFixed(2)}&mlon=${lng.toFixed(2)}#map=13/${lat.toFixed(2)}/${lng.toFixed(2)}`;
  return (
    <figure className="rmap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mapa esquemático: área aproximada em ${neighborhood}, ${cityName(city)}`}>
        <defs>
          <pattern id="quadras" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <path d="M0 0H22M0 0V22" stroke="rgba(246,241,231,.07)" strokeWidth="1" />
          </pattern>
          <radialGradient id="halo"><stop offset="0" stopColor="#ffc21a" stopOpacity=".55" /><stop offset="1" stopColor="#ffc21a" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width={W} height={H} fill="#0b1220" />
        <rect width={W} height={H} fill="url(#quadras)" />
        {/* Rio Meia Ponte (traçado estilizado) */}
        <path d="M250 0 C270 80 330 120 350 190 S 420 300 470 420" fill="none" stroke="#2b3a5c" strokeWidth="9" strokeLinecap="round" />
        {/* Eixos rodoviários estilizados: BR-153 (N–S), GO-060 (O), GO-403 (L) */}
        <path d={`M${px(-49.2)} 0 L${px(-49.23)} ${H}`} stroke="rgba(246,241,231,.28)" strokeWidth="3" strokeDasharray="2 7" />
        <path d={`M0 ${py(-16.65)} L${px(-49.264)} ${py(-16.686)} L${W} ${py(-16.72)}`} fill="none" stroke="rgba(246,241,231,.28)" strokeWidth="3" strokeDasharray="2 7" />
        {CITIES.map((c) => {
          const cx = px(c.lng), cy = py(c.lat), on = c.id === city;
          return (
            <g key={c.id}>
              <circle cx={cx} cy={cy} r={c.id === 'goiania' ? 46 : 26} fill={on ? 'rgba(242,84,45,.2)' : 'rgba(246,241,231,.06)'} stroke={on ? '#f2542d' : 'rgba(246,241,231,.25)'} strokeWidth="1.5" />
              <text x={cx} y={cy - (c.id === 'goiania' ? 54 : 34)} textAnchor="middle" fill={on ? '#f6f1e7' : '#aab0c0'} fontSize="13" fontWeight="700" style={{ letterSpacing: '.12em', textTransform: 'uppercase' }}>{c.name}</text>
            </g>
          );
        })}
        <circle cx={x} cy={y} r="58" fill="url(#halo)" />
        <circle cx={x} cy={y} r="30" fill="rgba(255,194,26,.18)" stroke="#ffc21a" strokeWidth="2" strokeDasharray="5 5" />
        <circle cx={x} cy={y} r="5" fill="#ffc21a" />
      </svg>
      <figcaption>
        <span><strong>Área aproximada</strong> — {neighborhood}, {cityName(city)}. O endereço exato é combinado direto com o anunciante.</span>
        <a className="link" href={osm} target="_blank" rel="noopener noreferrer">Ver região no OpenStreetMap</a>
      </figcaption>
    </figure>
  );
}
