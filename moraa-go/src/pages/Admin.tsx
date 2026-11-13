import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CITIES, PLANS, REPORT_REASONS, type OwnedListing, type Report } from '../../shared/types';
import { api } from '../api';
import { ErrorBox, Icon, Loading, StateBox } from '../components/ui';
import { useApp, useLoad, useTitle } from '../ctx';
import { OwnedRow } from './Account';

type Tab = 'pendente' | 'ativo' | 'pausado' | 'rejeitado' | 'denuncias';
const TABS: { id: Tab; label: string }[] = [
  { id: 'pendente', label: 'Fila de moderação' }, { id: 'ativo', label: 'No ar' }, { id: 'pausado', label: 'Pausados' },
  { id: 'rejeitado', label: 'Rejeitados' }, { id: 'denuncias', label: 'Denúncias' },
];

function Bars({ data, labels }: { data: Record<string, number>; labels: { id: string; name: string }[] }) {
  const max = Math.max(1, ...labels.map((l) => data[l.id] ?? 0));
  return (
    <dl className="bars">
      {labels.map((l) => (
        <div key={l.id}>
          <dt>{l.name}</dt>
          <dd><span className="bars__bar" style={{ width: `${((data[l.id] ?? 0) / max) * 100}%` }} /><span className="num">{data[l.id] ?? 0}</span></dd>
        </div>
      ))}
    </dl>
  );
}

export default function Admin() {
  useTitle('Moderação');
  const { toast } = useApp();
  const [tab, setTab] = useState<Tab>('pendente');
  const metrics = useLoad(() => api.admin.metrics(), []);
  const listings = useLoad<OwnedListing[]>(() => (tab === 'denuncias' ? Promise.resolve([]) : api.admin.listings(tab)), [tab]);
  const reports = useLoad<Report[]>(() => (tab === 'denuncias' ? api.admin.reports() : Promise.resolve([])), [tab]);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);

  const act = async (l: OwnedListing, action: string, n?: string) => {
    try {
      await api.admin.moderate(l.id, action, n);
      toast({ aprovar: 'Anúncio aprovado e publicado.', rejeitar: 'Anúncio rejeitado; o anunciante verá o motivo.', pausar: 'Anúncio pausado.', destacar: 'Destaque ativado.', 'remover-destaque': 'Destaque removido.' }[action] ?? 'Feito.');
      setRejecting(null); setNote('');
      listings.reload(); metrics.reload();
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const resolve = async (r: Report) => {
    if (note.trim().length < 3) return toast('Descreva a resolução.', 'error');
    try { await api.admin.resolve(r.id, note.trim()); toast('Denúncia resolvida.'); setResolving(null); setNote(''); reports.reload(); metrics.reload(); } catch (e: any) { toast(e.message, 'error'); }
  };
  const m = metrics.data;

  return (
    <main id="conteudo" className="page wrap admin">
      <header className="phead">
        <p className="label sec__kicker">Painel administrativo</p>
        <h1 className="h1">Moderação</h1>
      </header>

      {metrics.error ? <ErrorBox message={metrics.error} retry={metrics.reload} /> : (
        <>
          <ul className="kpis kpis--admin">
            <li className="kpis__hot"><strong className="num">{m?.listings.pendente ?? '–'}</strong><span>aguardando moderação</span></li>
            <li><strong className="num">{m?.listings.ativo ?? '–'}</strong><span>no ar{m ? ` (${m.demoListings} demo)` : ''}</span></li>
            <li><strong className="num">{m?.openReports ?? '–'}</strong><span>denúncias abertas</span></li>
            <li><strong className="num">{m?.users ?? '–'}</strong><span>contas</span></li>
            <li><strong className="num">{m?.totalViews ?? '–'}</strong><span>visualizações</span></li>
            <li><strong className="num">{m?.totalContactClicks ?? '–'}</strong><span>cliques em contato</span></li>
          </ul>
          {m && (
            <div className="admin__charts">
              <section aria-labelledby="ch-city"><h2 id="ch-city" className="label">Anúncios ativos por cidade</h2><Bars data={m.byCity} labels={CITIES as any} /></section>
              <section aria-labelledby="ch-plan"><h2 id="ch-plan" className="label">Interesse em planos (simulação)</h2><Bars data={m.planInterest} labels={PLANS.filter((p) => p.price > 0) as any} /></section>
            </div>
          )}
        </>
      )}

      <div className="tabs tabs--scroll" role="tablist" aria-label="Seções">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setRejecting(null); setResolving(null); setNote(''); }}>
            {t.label}{m && t.id !== 'denuncias' ? ` (${m.listings[t.id]})` : m ? ` (${m.openReports})` : ''}
          </button>
        ))}
      </div>

      {tab !== 'denuncias' ? (
        listings.loading ? <Loading /> : listings.error ? <ErrorBox message={listings.error} retry={listings.reload} /> : listings.data!.length === 0 ? (
          <StateBox icon="check" title={tab === 'pendente' ? 'Fila zerada' : 'Nenhum anúncio aqui'}><p>{tab === 'pendente' ? 'Não há anúncios aguardando moderação.' : 'Nada nesta situação no momento.'}</p></StateBox>
        ) : (
          <ul className="olist">
            {listings.data!.map((l) => (
              <OwnedRow key={l.id} l={l}>
                <Link className="btn btn--ghost btn--sm" to={`/imovel/${l.slug}`}><Icon name="eye" size={18} /> Ver</Link>
                {(l.status === 'pendente' || l.status === 'rejeitado' || l.status === 'pausado') && <button className="btn btn--sm" onClick={() => act(l, 'aprovar')}><Icon name="check" size={18} /> Aprovar</button>}
                {l.status === 'ativo' && <button className="btn btn--ghost btn--sm" onClick={() => act(l, l.featured ? 'remover-destaque' : 'destacar')}><Icon name="star" size={18} /> {l.featured ? 'Tirar destaque' : 'Destacar'}</button>}
                {l.status === 'ativo' && <button className="btn btn--ghost btn--sm" onClick={() => act(l, 'pausar')}><Icon name="pause" size={18} /> Pausar</button>}
                {l.status !== 'rejeitado' && (rejecting === l.id ? (
                  <form className="inline-form" onSubmit={(e) => { e.preventDefault(); act(l, 'rejeitar', note.trim()); }}>
                    <label htmlFor={`rj-${l.id}`} className="sr-only">Motivo da rejeição</label>
                    <input id={`rj-${l.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo (visível ao anunciante)" maxLength={300} required minLength={3} autoFocus />
                    <button className="btn btn--brasa btn--sm">Rejeitar</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRejecting(null)}>Cancelar</button>
                  </form>
                ) : <button className="btn btn--ghost btn--sm" onClick={() => { setRejecting(l.id); setNote(''); }}><Icon name="close" size={18} /> Rejeitar</button>)}
              </OwnedRow>
            ))}
          </ul>
        )
      ) : reports.loading ? <Loading /> : reports.error ? <ErrorBox message={reports.error} retry={reports.reload} /> : reports.data!.length === 0 ? (
        <StateBox icon="shield" title="Sem denúncias"><p>Nenhuma denúncia registrada até agora.</p></StateBox>
      ) : (
        <ul className="olist">
          {reports.data!.map((r) => (
            <li key={r.id} className="orow orow--report">
              <div className="orow__body">
                <div className="row"><span className={`tag tag--${r.status}`}>{r.status}</span><span className="tag">{REPORT_REASONS.find((x) => x.id === r.reason)?.name ?? r.reason}</span></div>
                <h3 className="orow__t"><Link className="link" to={`/imovel/${r.listingSlug}`}>{r.listingTitle}</Link></h3>
                <p className="small">{r.details || <em className="soft">Sem detalhes.</em>}</p>
                <p className="small soft num">Recebida em {new Date(r.createdAt).toLocaleString('pt-BR')}</p>
                {r.resolution && <p className="notice notice--ok small"><span><strong>Resolução:</strong> {r.resolution}</span></p>}
              </div>
              {r.status === 'aberta' && (
                <div className="orow__act">
                  {resolving === r.id ? (
                    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); resolve(r); }}>
                      <label htmlFor={`rs-${r.id}`} className="sr-only">Resolução</label>
                      <input id={`rs-${r.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que foi feito?" maxLength={500} autoFocus />
                      <button className="btn btn--sm">Resolver</button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setResolving(null)}>Cancelar</button>
                    </form>
                  ) : <button className="btn btn--noite btn--sm" onClick={() => { setResolving(r.id); setNote(''); }}>Resolver</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
