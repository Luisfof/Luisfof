import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { REPORT_REASONS, cityName, featureName, formatBRL, typeName, type Listing } from '../../shared/types';
import { api } from '../api';
import { RegionMap } from '../components/RegionMap';
import { ErrorBox, Icon, Loading, StateBox } from '../components/ui';
import { useApp, useLoad, useTitle } from '../ctx';

function Gallery({ l }: { l: Listing }) {
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const n = l.images.length;
  const go = (k: number) => {
    const el = track.current;
    if (!el) return;
    const t = Math.max(0, Math.min(n - 1, k));
    el.scrollTo({ left: el.clientWidth * t, behavior: 'smooth' });
  };
  if (!n) return <div className="gal gal--empty"><Icon name="camera" size={36} /><p>Este anúncio ainda não tem fotos.</p></div>;
  return (
    <div className="gal" role="group" aria-roledescription="galeria" aria-label={`Fotos do imóvel (${n})`}>
      <div className="gal__track" ref={track} tabIndex={0} onScroll={(e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / el.clientWidth)); }}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); }}>
        {l.images.map((im, k) => (
          <figure key={im.id} className="gal__slide">
            <img src={im.url} srcSet={`${im.thumbUrl} 640w, ${im.url} 1280w`} sizes="(min-width: 1000px) 62vw, 100vw" alt={im.alt || `Foto ${k + 1} de ${n}`} loading={k ? 'lazy' : 'eager'} decoding="async" width={1280} height={960} />
          </figure>
        ))}
      </div>
      {l.isDemo && <span className="tag tag--demo gal__demo">Imagem demonstrativa</span>}
      {n > 1 && (
        <>
          <button className="gal__nav gal__nav--p" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Foto anterior"><Icon name="back" /></button>
          <button className="gal__nav gal__nav--n" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label="Próxima foto"><Icon name="arrow" /></button>
          <span className="gal__count num" aria-live="polite">{i + 1} / {n}</span>
        </>
      )}
    </div>
  );
}

function ReportForm({ l, onDone }: { l: Listing; onDone: () => void }) {
  const { toast } = useApp();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return setErr('Escolha um motivo.');
    setBusy(true);
    try {
      await api.report(l.id, reason, details.trim());
      toast('Denúncia enviada. Nossa moderação vai analisar.');
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <form className="report" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="r-reason">Motivo da denúncia</label>
        <select id="r-reason" className="select" value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} aria-invalid={!!err}>
          <option value="">Selecione…</option>
          {REPORT_REASONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {err && <span className="err" role="alert">{err}</span>}
      </div>
      <div className="field">
        <label htmlFor="r-details">Detalhes (opcional)</label>
        <textarea id="r-details" className="textarea" style={{ minHeight: 90 }} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        <span className="hint">Não inclua dados pessoais seus ou de terceiros.</span>
      </div>
      <div className="row"><button className="btn btn--noite btn--sm" disabled={busy}>{busy ? 'Enviando…' : 'Enviar denúncia'}</button><button type="button" className="btn btn--ghost btn--sm" onClick={onDone}>Cancelar</button></div>
    </form>
  );
}

export function Detail() {
  const { slug = '' } = useParams();
  const { toast } = useApp();
  const { data: l, error, loading, reload } = useLoad(() => api.listing(slug), [slug]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  useTitle(l ? `${l.title} — ${l.neighborhood}, ${cityName(l.city)}` : 'Imóvel');
  useEffect(() => { setMsg(null); setReporting(false); }, [slug]);

  if (loading) return <main id="conteudo" className="page wrap"><Loading label="Abrindo o anúncio…" /></main>;
  if (error || !l) {
    return (
      <main id="conteudo" className="page wrap">
        {error?.includes('encontr') || !l ? (
          <StateBox title="Anúncio não encontrado" action={<Link className="btn" to="/imoveis">Buscar outros imóveis</Link>}><p>Ele pode ter sido pausado, alugado ou removido pela moderação.</p></StateBox>
        ) : <ErrorBox message={error!} retry={reload} />}
      </main>
    );
  }

  const contact = async () => {
    setBusy(true);
    try {
      const r = await api.contact(l.id);
      if (r.kind === 'whatsapp' && r.whatsappUrl) window.open(r.whatsappUrl, '_blank', 'noopener');
      setMsg(r.message);
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const share = async () => {
    const data = { title: `${l.title} — MORAA GO`, text: `${l.title} · ${formatBRL(l.price)}/mês em ${l.neighborhood}`, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); toast('Link copiado.'); }
    } catch { /* cancelado */ }
  };
  const total = l.price + (l.condoFee ?? 0) + (l.iptu ?? 0);
  const canContact = l.isDemo || l.whatsappAuthorized;

  return (
    <main id="conteudo" className="page detail">
      <div className="wrap">
        <nav className="crumbs small" aria-label="Você está em">
          <Link to="/imoveis"><Icon name="back" size={16} /> Busca</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/imoveis?city=${l.city}`}>{cityName(l.city)}</Link>
          <span aria-hidden="true">/</span>
          <span>{l.neighborhood}</span>
        </nav>

        {l.status !== 'ativo' && <p className="notice notice--warn" style={{ marginBottom: 16 }}><Icon name="eye" size={20} /> <span>Pré-visualização: este anúncio está <strong>{l.status}</strong> e só é visível para você e para a moderação.</span></p>}

        <div className="detail__grid">
          <div className="detail__main">
            <Gallery l={l} />
            <header className="detail__head">
              <div className="row">
                <span className="tag">{typeName(l.type)}</span>
                {l.featured && <span className="tag tag--destaque">Destaque</span>}
                {l.isDemo && <span className="tag tag--demo">Demonstrativo</span>}
              </div>
              <h1 className="h1 detail__title">{l.title}</h1>
              <p className="detail__place"><Icon name="pin" size={20} /> {l.neighborhood}, {cityName(l.city)} — GO</p>
            </header>

            <ul className="facts" aria-label="Resumo">
              {l.bedrooms > 0 && <li><Icon name="bed" size={26} /><strong className="num">{l.bedrooms}</strong><span>{l.bedrooms === 1 ? 'quarto' : 'quartos'}</span></li>}
              <li><Icon name="bath" size={26} /><strong className="num">{l.bathrooms}</strong><span>{l.bathrooms === 1 ? 'banheiro' : 'banheiros'}</span></li>
              <li><Icon name="car" size={26} /><strong className="num">{l.parking}</strong><span>{l.parking === 1 ? 'vaga' : 'vagas'}</span></li>
              {l.areaM2 && <li><Icon name="area" size={26} /><strong className="num">{l.areaM2}</strong><span>m² aprox.</span></li>}
            </ul>

            <section className="block" aria-labelledby="d-desc">
              <h2 id="d-desc" className="h2 block__t">Sobre o imóvel</h2>
              <p className="detail__desc">{l.description}</p>
            </section>

            {l.features.length > 0 && (
              <section className="block" aria-labelledby="d-feat">
                <h2 id="d-feat" className="h2 block__t">O que tem</h2>
                <ul className="featlist">
                  {l.features.map((f) => <li key={f}><Icon name="check" size={18} /> {featureName(f)}</li>)}
                </ul>
              </section>
            )}

            <section className="block" aria-labelledby="d-map">
              <h2 id="d-map" className="h2 block__t">Onde fica</h2>
              <RegionMap lat={l.approxLat} lng={l.approxLng} city={l.city} neighborhood={l.neighborhood} />
            </section>

            <section className="block safety" aria-labelledby="d-safe">
              <h2 id="d-safe" className="h3"><Icon name="shield" size={20} /> Negocie com segurança</h2>
              <ul>
                <li>Visite o imóvel antes de fechar qualquer acordo.</li>
                <li>Nunca faça depósito, Pix ou “reserva” antes de ver o imóvel e o contrato.</li>
                <li>Desconfie de valores muito abaixo do mercado e de pressa para pagar.</li>
              </ul>
              {reporting ? <ReportForm l={l} onDone={() => setReporting(false)} /> : (
                <button className="reportbtn" onClick={() => setReporting(true)}><Icon name="flag" size={18} /> Denunciar este anúncio</button>
              )}
            </section>
          </div>

          <aside className="buy" aria-label="Valores e contato">
            <div className="buy__box">
              <p className="label buy__k">Aluguel</p>
              <p className="buy__price num"><strong>{formatBRL(l.price)}</strong><span>/mês</span></p>
              <dl className="buy__lines num">
                <div><dt>Condomínio</dt><dd>{l.condoFee ? formatBRL(l.condoFee) : 'Não informado'}</dd></div>
                <div><dt>IPTU (mensal)</dt><dd>{l.iptu ? formatBRL(l.iptu) : 'Não informado'}</dd></div>
                {total !== l.price && <div className="buy__total"><dt>Total estimado</dt><dd>{formatBRL(total)}</dd></div>}
              </dl>
              {l.isDemo && <p className="notice notice--warn"><Icon name="info" size={20} style={{ flex: 'none' }} /><span><strong>Anúncio demonstrativo.</strong> Este imóvel não existe para locação; fotos e valores são ilustrativos.</span></p>}
              <button className="btn btn--block" onClick={contact} disabled={busy || !canContact}>
                <Icon name="chat" /> {busy ? 'Aguarde…' : l.isDemo ? 'Simular contato' : 'Falar no WhatsApp'}
              </button>
              {!canContact && <p className="small soft">O anunciante não autorizou a exibição de contato. </p>}
              {msg && <p className="notice notice--ok" role="status">{msg}</p>}
              <button className="btn btn--ghost btn--block btn--sm" onClick={share}><Icon name="share" size={18} /> Compartilhar</button>
              <p className="small soft buy__by">Anunciado por <strong>{l.advertiserName}</strong> · atualizado em {new Date(l.updatedAt).toLocaleDateString('pt-BR')}</p>
            </div>
          </aside>
        </div>
      </div>

      <div className="stickybar on-dark">
        <p className="num"><strong>{formatBRL(l.price)}</strong><span>/mês</span></p>
        <button className="btn" onClick={contact} disabled={busy || !canContact}><Icon name="chat" /> {l.isDemo ? 'Simular contato' : 'WhatsApp'}</button>
      </div>
    </main>
  );
}
