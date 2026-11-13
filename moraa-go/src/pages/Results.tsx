import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CITIES, FEATURES, PROPERTY_TYPES, cityName, featureName, typeName, type SearchParams } from '../../shared/types';
import { api } from '../api';
import { CardSkeleton, DemoNote, ErrorBox, Icon, ListingCard, StateBox } from '../components/ui';
import { useApp, useLoad, useMedia, useTitle } from '../ctx';

const PRICE_OPTS = [800, 1000, 1500, 2000, 2500, 3000, 4000, 6000];

function parse(sp: URLSearchParams): SearchParams {
  const num = (k: string) => (sp.get(k) && !Number.isNaN(Number(sp.get(k))) ? Number(sp.get(k)) : undefined);
  return {
    q: sp.get('q') || undefined,
    city: (sp.get('city') as any) || undefined,
    neighborhood: sp.get('neighborhood') || undefined,
    type: (sp.get('type') as any) || undefined,
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    bedrooms: num('bedrooms'),
    features: (sp.get('features')?.split(',').filter(Boolean) as any) || undefined,
    sort: (sp.get('sort') as any) || undefined,
    page: num('page'),
  };
}

export function Results() {
  const [sp, setSp] = useSearchParams();
  const { meta } = useApp();
  const p = useMemo(() => parse(sp), [sp]);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState(p.q ?? '');
  const closeRef = useRef<HTMLButtonElement>(null);
  const wide = useMedia('(min-width: 1000px)');
  const res = useLoad(() => api.search(p), [sp.toString()]);
  useTitle(p.city ? `Imóveis para alugar em ${cityName(p.city)}` : 'Imóveis para alugar');

  const set = (patch: Record<string, string | number | undefined | string[]>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      const val = Array.isArray(v) ? v.join(',') : v;
      if (val === undefined || val === '') next.delete(k);
      else next.set(k, String(val));
    }
    if (!('page' in patch)) next.delete('page');
    if ('city' in patch) next.delete('neighborhood');
    setSp(next, { replace: true });
  };
  useEffect(() => setQ(p.q ?? ''), [p.q]);
  useEffect(() => {
    if (!sheet) return;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false);
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', esc); };
  }, [sheet]);

  const feats = p.features ?? [];
  const toggleFeat = (id: string) => set({ features: feats.includes(id as any) ? feats.filter((f) => f !== id) : [...feats, id] });
  const hoods = p.city ? meta?.neighborhoods[p.city] ?? [] : [];
  const active: { label: string; clear: () => void }[] = [
    p.q && { label: `“${p.q}”`, clear: () => set({ q: undefined }) },
    p.city && { label: cityName(p.city), clear: () => set({ city: undefined }) },
    p.neighborhood && { label: p.neighborhood, clear: () => set({ neighborhood: undefined }) },
    p.type && { label: typeName(p.type), clear: () => set({ type: undefined }) },
    p.minPrice && { label: `A partir de R$ ${p.minPrice.toLocaleString('pt-BR')}`, clear: () => set({ minPrice: undefined }) },
    p.maxPrice && { label: `Até R$ ${p.maxPrice.toLocaleString('pt-BR')}`, clear: () => set({ maxPrice: undefined }) },
    p.bedrooms && { label: `${p.bedrooms}+ quartos`, clear: () => set({ bedrooms: undefined }) },
    ...feats.map((f) => ({ label: featureName(f), clear: () => toggleFeat(f) })),
  ].filter(Boolean) as any;

  const total = res.data?.total ?? 0;
  const pages = res.data ? Math.max(1, Math.ceil(res.data.total / res.data.pageSize)) : 1;
  const page = res.data?.page ?? 1;

  const filters = (
    <div className="filters">
      <form className="field" onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || undefined }); }} role="search">
        <label htmlFor="f-q">Palavra-chave</label>
        <div className="inputgo">
          <input id="f-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: quintal, suíte, esquina" maxLength={60} enterKeyHint="search" />
          <button className="btn btn--noite btn--sm" aria-label="Buscar palavra-chave"><Icon name="search" size={18} /></button>
        </div>
      </form>
      <div className="field">
        <label htmlFor="f-city">Cidade</label>
        <select id="f-city" className="select" value={p.city ?? ''} onChange={(e) => set({ city: e.target.value })}>
          <option value="">Toda a região</option>
          {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}{meta ? ` (${meta.counts[c.id] ?? 0})` : ''}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-hood">Bairro</label>
        <select id="f-hood" className="select" value={p.neighborhood ?? ''} onChange={(e) => set({ neighborhood: e.target.value })} disabled={!p.city || !hoods.length}>
          <option value="">{p.city ? (hoods.length ? 'Todos os bairros' : 'Sem bairros com anúncios') : 'Escolha a cidade primeiro'}</option>
          {hoods.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      <fieldset className="field">
        <legend className="field__label">Tipo de imóvel</legend>
        <div className="chips">
          {PROPERTY_TYPES.map((t) => (
            <label key={t.id} className="chip">
              <input type="checkbox" checked={p.type === t.id} onChange={() => set({ type: p.type === t.id ? undefined : t.id })} />
              <span>{t.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="two">
        <div className="field">
          <label htmlFor="f-min">Aluguel mínimo</label>
          <select id="f-min" className="select" value={p.minPrice ?? ''} onChange={(e) => set({ minPrice: e.target.value })}>
            <option value="">Sem mínimo</option>
            {PRICE_OPTS.map((v) => <option key={v} value={v}>R$ {v.toLocaleString('pt-BR')}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-max">Aluguel máximo</label>
          <select id="f-max" className="select" value={p.maxPrice ?? ''} onChange={(e) => set({ maxPrice: e.target.value })}>
            <option value="">Sem máximo</option>
            {PRICE_OPTS.map((v) => <option key={v} value={v}>R$ {v.toLocaleString('pt-BR')}</option>)}
          </select>
        </div>
      </div>
      <fieldset className="field">
        <legend className="field__label">Quartos</legend>
        <div className="seg">
          {[0, 1, 2, 3, 4].map((n) => (
            <label key={n} className="chip">
              <input type="radio" name="bedrooms" checked={(p.bedrooms ?? 0) === n} onChange={() => set({ bedrooms: n || undefined })} />
              <span>{n === 0 ? 'Todos' : `${n}+`}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend className="field__label">Características</legend>
        <div className="chips">
          {FEATURES.map((f) => (
            <label key={f.id} className="chip">
              <input type="checkbox" checked={feats.includes(f.id)} onChange={() => toggleFeat(f.id)} />
              <span>{f.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );

  return (
    <main id="conteudo" className="page results">
      <div className="wrap">
        <header className="phead">
          <p className="label sec__kicker">Busca</p>
          <h1 className="h1">{p.city ? <>Alugar em<br /><em className="em-brasa">{cityName(p.city)}</em></> : <>Imóveis<br />para alugar</>}</h1>
        </header>

        <div className="results__layout">
          {wide && <aside className="results__side" aria-label="Filtros">{filters}</aside>}

          <section aria-label="Resultados" className="results__main">
            <div className="toolbar">
              <p className="toolbar__count" aria-live="polite">
                {res.loading ? 'Buscando…' : <><strong className="num">{total}</strong> {total === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}</>}
              </p>
              <button className="btn btn--noite btn--sm toolbar__filter" onClick={() => setSheet(true)}>
                <Icon name="filter" size={18} /> Filtros{active.length ? ` (${active.length})` : ''}
              </button>
              <div className="toolbar__sort">
                <label htmlFor="f-sort" className="sr-only">Ordenar por</label>
                <select id="f-sort" className="select" value={p.sort ?? 'recentes'} onChange={(e) => set({ sort: e.target.value === 'recentes' ? undefined : e.target.value })}>
                  <option value="recentes">Mais recentes</option>
                  <option value="menor-preco">Menor preço</option>
                  <option value="maior-preco">Maior preço</option>
                </select>
              </div>
            </div>

            {active.length > 0 && (
              <ul className="actives" aria-label="Filtros ativos">
                {active.map((a) => (
                  <li key={a.label}><button onClick={a.clear} aria-label={`Remover filtro ${a.label}`}>{a.label} <Icon name="close" size={14} /></button></li>
                ))}
                <li><button className="actives__clear" onClick={() => setSp({}, { replace: true })}>Limpar tudo</button></li>
              </ul>
            )}

            {meta?.demoMode !== false && <DemoNote />}

            {res.error ? (
              <ErrorBox message={res.error} retry={res.reload} />
            ) : res.loading && !res.data ? (
              <div className="grid grid--2">{[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
            ) : total === 0 ? (
              <StateBox title="Nada por aqui — ainda" action={<div className="row"><button className="btn btn--noite" onClick={() => setSp({}, { replace: true })}>Limpar filtros</button><Link className="btn btn--ghost" to="/anunciar">Anunciar um imóvel</Link></div>}>
                <p>Nenhum anúncio combina com esses filtros. Tente ampliar a faixa de preço, trocar o bairro ou remover características.</p>
              </StateBox>
            ) : (
              <>
                <div className={`grid grid--2 ${res.loading ? 'is-stale' : ''}`}>
                  {res.data!.items.map((l, i) => <ListingCard key={l.id} l={l} eager={i < 2} />)}
                </div>
                {pages > 1 && (
                  <nav className="pager" aria-label="Paginação">
                    <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => { set({ page: page - 1 }); window.scrollTo(0, 0); }}><Icon name="back" size={18} /> Anterior</button>
                    <span className="num">Página {page} de {pages}</span>
                    <button className="btn btn--ghost btn--sm" disabled={page >= pages} onClick={() => { set({ page: page + 1 }); window.scrollTo(0, 0); }}>Próxima <Icon name="arrow" size={18} /></button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {sheet && !wide && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="sheet__scrim" onClick={() => setSheet(false)} />
          <div className="sheet__panel">
            <header className="sheet__head">
              <h2 className="h2" style={{ fontSize: '1.6rem' }}>Filtros</h2>
              <button ref={closeRef} className="hdr__menu" style={{ color: 'inherit' }} onClick={() => setSheet(false)} aria-label="Fechar filtros"><Icon name="close" size={24} /></button>
            </header>
            <div className="sheet__body">{filters}</div>
            <footer className="sheet__foot">
              <button className="btn btn--ghost" onClick={() => setSp({}, { replace: true })}>Limpar</button>
              <button className="btn" style={{ flex: 1 }} onClick={() => setSheet(false)}>Ver {res.loading ? '…' : total} {total === 1 ? 'imóvel' : 'imóveis'}</button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
