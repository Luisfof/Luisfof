import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cityName, formatBRL, type OwnedListing } from '../../shared/types';
import { api } from '../api';
import { ErrorBox, Icon, Loading, StateBox } from '../components/ui';
import { useApp, useLoad, useTitle } from '../ctx';

const STATUS_TXT: Record<string, string> = {
  pendente: 'Em moderação', ativo: 'No ar', pausado: 'Pausado', rejeitado: 'Precisa de ajustes',
};

export function OwnedRow({ l, children }: { l: OwnedListing; children: React.ReactNode }) {
  return (
    <li className="orow">
      <div className="orow__img">{l.images[0] ? <img src={l.images[0].thumbUrl} alt="" loading="lazy" /> : <Icon name="camera" size={24} />}</div>
      <div className="orow__body">
        <div className="row">
          <span className={`tag tag--${l.status}`}>{STATUS_TXT[l.status]}</span>
          {l.featured && <span className="tag tag--destaque">Destaque</span>}
          {l.isDemo && <span className="tag tag--demo">Demo</span>}
        </div>
        <h3 className="orow__t">{l.title}</h3>
        <p className="small soft">{l.neighborhood}, {cityName(l.city)} · <strong className="num">{formatBRL(l.price)}</strong>/mês{l.ownerEmail ? ` · ${l.ownerEmail}` : ''}</p>
        {l.moderationNote && <p className="notice notice--error small"><span><strong>Moderação:</strong> {l.moderationNote}</span></p>}
        <p className="orow__stats small num"><span><Icon name="eye" size={16} /> {l.views} visualizações</span><span><Icon name="chat" size={16} /> {l.contactClicks} cliques em contato</span></p>
      </div>
      <div className="orow__act">{children}</div>
    </li>
  );
}

export default function Account() {
  useTitle('Meus anúncios');
  const { user, setUser, toast } = useApp();
  const nav = useNavigate();
  const { data, error, loading, reload, setData } = useLoad(() => api.myListings(), []);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [delAcc, setDelAcc] = useState(false);

  const status = async (l: OwnedListing, s: 'pausado' | 'ativo') => {
    try {
      const u = await api.setStatus(l.id, s);
      setData((d) => d!.map((x) => (x.id === l.id ? u : x)));
      toast(u.status === 'pausado' ? 'Anúncio pausado — saiu da busca.' : u.status === 'ativo' ? 'Anúncio reativado.' : 'Anúncio reenviado para moderação.');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const remove = async (id: string) => {
    try { await api.deleteListing(id); setData((d) => d!.filter((x) => x.id !== id)); toast('Anúncio excluído.'); } catch (e: any) { toast(e.message, 'error'); }
    setConfirmDel(null);
  };
  const deleteAccount = async () => {
    try { await api.deleteAccount(); setUser(null); toast('Conta e anúncios excluídos.'); nav('/'); } catch (e: any) { toast(e.message, 'error'); }
  };
  const totals = (data ?? []).reduce((a, l) => ({ v: a.v + l.views, c: a.c + l.contactClicks, on: a.on + (l.status === 'ativo' ? 1 : 0) }), { v: 0, c: 0, on: 0 });

  return (
    <main id="conteudo" className="page wrap account">
      <header className="phead phead--row">
        <div>
          <p className="label sec__kicker">Área do anunciante</p>
          <h1 className="h1">Olá, {user!.name.split(' ')[0]}</h1>
        </div>
        <Link className="btn" to="/anunciar">Novo anúncio <Icon name="arrow" /></Link>
      </header>

      <ul className="kpis">
        <li><strong className="num">{data?.length ?? '–'}</strong><span>anúncios</span></li>
        <li><strong className="num">{data ? totals.on : '–'}</strong><span>no ar</span></li>
        <li><strong className="num">{data ? totals.v : '–'}</strong><span>visualizações</span></li>
        <li><strong className="num">{data ? totals.c : '–'}</strong><span>cliques em contato</span></li>
      </ul>

      {loading ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : data!.length === 0 ? (
        <StateBox title="Você ainda não tem anúncios" action={<Link className="btn" to="/anunciar">Criar meu primeiro anúncio</Link>}>
          <p>Publique gratuitamente. Depois da moderação, seu imóvel aparece na busca para toda a região.</p>
        </StateBox>
      ) : (
        <ul className="olist">
          {data!.map((l) => (
            <OwnedRow key={l.id} l={l}>
              <Link className="btn btn--ghost btn--sm" to={`/imovel/${l.slug}`}><Icon name="eye" size={18} /> Ver</Link>
              <Link className="btn btn--ghost btn--sm" to={`/minha-conta/anuncio/${l.id}`}><Icon name="edit" size={18} /> Editar</Link>
              {l.status === 'ativo' && <button className="btn btn--ghost btn--sm" onClick={() => status(l, 'pausado')}><Icon name="pause" size={18} /> Pausar</button>}
              {l.status === 'pausado' && <button className="btn btn--noite btn--sm" onClick={() => status(l, 'ativo')}><Icon name="play" size={18} /> Reativar</button>}
              {confirmDel === l.id ? (
                <span className="row" role="alertdialog" aria-label="Confirmar exclusão">
                  <button className="btn btn--brasa btn--sm" onClick={() => remove(l.id)}>Confirmar exclusão</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDel(null)}>Cancelar</button>
                </span>
              ) : (
                <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDel(l.id)}><Icon name="trash" size={18} /> Excluir</button>
              )}
            </OwnedRow>
          ))}
        </ul>
      )}

      <section className="block danger" aria-labelledby="acc-data">
        <h2 id="acc-data" className="h3">Seus dados</h2>
        <p className="small soft">Conta: {user!.email}. Você pode excluir sua conta a qualquer momento — isso remove definitivamente seus anúncios, fotos e dados de cadastro (LGPD, art. 18).</p>
        {user!.role === 'admin' ? <p className="small soft">Contas administrativas não podem ser excluídas por aqui.</p> : delAcc ? (
          <div className="row" role="alertdialog" aria-label="Confirmar exclusão da conta">
            <button className="btn btn--brasa btn--sm" onClick={deleteAccount}>Sim, excluir tudo</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setDelAcc(false)}>Cancelar</button>
          </div>
        ) : <button className="reportbtn" onClick={() => setDelAcc(true)}><Icon name="trash" size={18} /> Excluir minha conta e meus dados</button>}
      </section>
    </main>
  );
}
