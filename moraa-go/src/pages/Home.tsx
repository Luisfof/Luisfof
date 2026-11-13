import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CITIES, PROPERTY_TYPES } from '../../shared/types';
import { api, toQuery } from '../api';
import { CardSkeleton, DemoNote, Icon, ListingCard } from '../components/ui';
import { useApp, useLoad, useTitle } from '../ctx';

const PRICES = [1000, 1500, 2000, 2500, 3000, 4000];

function Hero() {
  const nav = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Paralaxe discreta: as camadas se deslocam em velocidades diferentes ao rolar.
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => el.style.setProperty('--s', String(Math.min(1, window.scrollY / 700))));
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(`/imoveis?${toQuery({ city: city as any, type: type as any, maxPrice: maxPrice ? Number(maxPrice) : undefined })}`);
  };

  return (
    <section className="hero on-dark" ref={ref} aria-labelledby="hero-t">
      <div className="hero__scene" aria-hidden="true">
        <img className="hero__photo" src="/img/hero-900.webp" srcSet="/img/hero-900.webp 900w, /img/hero-1600.webp 1600w, /img/hero-2400.webp 2400w" sizes="100vw" alt="" fetchPriority="high" decoding="async" />
        <div className="hero__grade" />
        <div className="hero__glow" />
        <img className="hero__leaf hero__leaf--a" src="/img/folha-c.webp" alt="" />
        <img className="hero__leaf hero__leaf--b" src="/img/folha-a.webp" alt="" />
        <div className="hero__grain" />
      </div>

      <div className="wrap hero__in">
        <div className="hero__copy">
          <p className="plaque"><span className="plaque__n">Nº 62</span><span>Aluguel em Goiás</span></p>
          <h1 id="hero-t" className="display hero__title">
            Abra a <br />porta <em>certa.</em>
          </h1>
          <p className="hero__sub">Casas e apartamentos para alugar em Senador Canedo, Goiânia e região — direto com quem anuncia.</p>
        </div>

        <form className="quest" onSubmit={submit} role="search" aria-label="Buscar imóveis">
          <div className="quest__f quest__f--city">
            <label htmlFor="q-city">Onde</label>
            <select id="q-city" className="select" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Toda a região</option>
              {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="quest__f">
            <label htmlFor="q-type">Tipo</label>
            <select id="q-type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Todos</option>
              {PROPERTY_TYPES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="quest__f">
            <label htmlFor="q-price">Até</label>
            <select id="q-price" className="select" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
              <option value="">Qualquer valor</option>
              {PRICES.map((p) => <option key={p} value={p}>R$ {p.toLocaleString('pt-BR')}</option>)}
            </select>
          </div>
          <button className="btn quest__go" type="submit"><Icon name="search" size={20} /> Buscar imóveis</button>
        </form>
      </div>
      <p className="hero__credit">Fotografia ilustrativa · não é um imóvel anunciado</p>
    </section>
  );
}

export function Home() {
  useTitle('');
  const { meta } = useApp();
  const feat = useLoad(() => api.featured(), []);
  const total = meta ? Object.values(meta.counts).reduce((a, b) => a + b, 0) : null;

  return (
    <main id="conteudo">
      <Hero />

      <section className="band band--ticker on-dark" aria-hidden="true">
        <div className="ticker">
          {[0, 1].map((k) => (
            <span key={k}>Senador Canedo <i /> Goiânia <i /> Aparecida de Goiânia <i /> Trindade <i /> Goianira <i /> Direto com o anunciante <i /> Sem taxa para quem procura <i /> </span>
          ))}
        </div>
      </section>

      <section className="sec wrap" aria-labelledby="dest-t">
        <header className="sec__head">
          <div>
            <p className="label sec__kicker">Vitrine</p>
            <h2 id="dest-t" className="h1">Em destaque<br />esta semana</h2>
          </div>
          <Link className="btn btn--noite" to="/imoveis">Ver todos{total !== null ? ` (${total})` : ''} <Icon name="arrow" /></Link>
        </header>
        {meta?.demoMode !== false && <DemoNote />}
        <div className="grid">
          {feat.loading && [0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          {feat.data?.slice(0, feat.data.length >= 6 ? 6 : 3).map((l, i) => <ListingCard key={l.id} l={l} eager={i < 2} />)}
        </div>
        {feat.error && <p className="notice notice--error" role="alert">{feat.error} <button className="link" style={{ background: 'none', border: 0, padding: 0 }} onClick={feat.reload}>Tentar de novo</button></p>}
        {feat.data && feat.data.length === 0 && <p className="notice">Ainda não há anúncios publicados. <Link className="link" to="/anunciar">Seja o primeiro a anunciar.</Link></p>}
      </section>

      <section className="how" aria-labelledby="how-t">
        <div className="how__media" aria-hidden="true">
          <img src="/img/vidro-ambar.webp" alt="" loading="lazy" decoding="async" />
        </div>
        <div className="how__body">
          <p className="label sec__kicker">Como funciona</p>
          <h2 id="how-t" className="h1">Do anúncio<br />à chave,<br /><em>sem atravessador.</em></h2>
          <ol className="steps">
            <li><span className="steps__n num">01</span><div><h3 className="h3">Busque do seu jeito</h3><p>Filtre por cidade, bairro, valor, quartos e o que não pode faltar — garagem, quintal, aceita pet.</p></div></li>
            <li><span className="steps__n num">02</span><div><h3 className="h3">Veja antes de sair de casa</h3><p>Fotos, valores de aluguel, condomínio e IPTU, e a região aproximada no mapa. Sem endereço exposto.</p></div></li>
            <li><span className="steps__n num">03</span><div><h3 className="h3">Fale com quem anuncia</h3><p>O contato por WhatsApp só aparece quando o anunciante autorizou. Todo anúncio passa por moderação.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="sec wrap" aria-labelledby="reg-t">
        <header className="sec__head">
          <div>
            <p className="label sec__kicker">Regiões</p>
            <h2 id="reg-t" className="h1">Escolha<br />seu chão</h2>
          </div>
        </header>
        <ul className="regions">
          {CITIES.map((c, i) => (
            <li key={c.id}>
              <Link to={`/imoveis?city=${c.id}`}>
                <span className="regions__i num">{String(i + 1).padStart(2, '0')}</span>
                <span className="regions__n">{c.name}</span>
                <span className="regions__c num">{meta ? `${meta.counts[c.id] ?? 0} ${(meta.counts[c.id] ?? 0) === 1 ? 'anúncio' : 'anúncios'}` : '—'}</span>
                <Icon name="arrow" size={26} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="cta on-dark" aria-labelledby="cta-t">
        <img className="cta__bg" src="/img/torres.webp" alt="" loading="lazy" decoding="async" aria-hidden="true" />
        <div className="wrap cta__in">
          <p className="label">Para proprietários e imobiliárias</p>
          <h2 id="cta-t" className="display">Tem imóvel<br />parado?<br /><em>Anuncie.</em></h2>
          <p className="cta__sub">Publicação gratuita no plano Básico, com moderação antes de ir ao ar. Você decide se o seu WhatsApp aparece.</p>
          <div className="row">
            <Link className="btn" to="/anunciar">Anunciar imóvel <Icon name="arrow" /></Link>
            <Link className="btn btn--ghost" to="/planos">Ver planos</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
