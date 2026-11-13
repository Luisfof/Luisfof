import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANS, formatBRL } from '../../shared/types';
import { api } from '../api';
import { DemoNote, Icon } from '../components/ui';
import { useApp, useTitle } from '../ctx';

export default function Plans() {
  useTitle('Planos e destaques');
  const { toast } = useApp();
  const [sent, setSent] = useState<string[]>([]);
  const interest = async (id: string) => {
    try {
      await api.planInterest(id);
      setSent((s) => [...s, id]);
      toast('Interesse registrado. Nenhuma cobrança foi feita.');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <main id="conteudo" className="page wrap plans">
      <header className="phead">
        <p className="label sec__kicker">Planos e destaques</p>
        <h1 className="h1">Anunciar é grátis.<br /><em className="em-brasa">Destacar é opcional.</em></h1>
        <p className="soft phead__lead">A plataforma vende apenas espaço de divulgação. Não cobramos comissão, não intermediamos contratos e não recebemos aluguel.</p>
      </header>
      <DemoNote><strong>Modo demonstrativo — sem cobrança.</strong> Os valores abaixo são hipóteses em validação. Não há checkout, Pix ou cartão: o botão apenas registra, de forma anônima, o interesse no plano.</DemoNote>
      <ul className="plans__grid">
        {PLANS.map((p, i) => (
          <li key={p.id} className={`plan ${i === 1 ? 'plan--hot' : ''}`}>
            <p className="label plan__n">{String(i + 1).padStart(2, '0')} — {p.name}</p>
            <p className="plan__price num">{p.price === 0 ? 'Grátis' : formatBRL(p.price)}{p.period && <span>/{p.period}</span>}</p>
            <p className="plan__tag">{p.tagline}</p>
            <ul className="plan__perks">{p.perks.map((k) => <li key={k}><Icon name="check" size={16} /> {k}</li>)}</ul>
            {p.price === 0 ? (
              <Link className="btn btn--noite btn--block" to="/anunciar">Anunciar grátis</Link>
            ) : sent.includes(p.id) ? (
              <p className="notice notice--ok" role="status">Interesse registrado.</p>
            ) : (
              <button className={`btn btn--block ${i === 1 ? '' : 'btn--ghost'}`} onClick={() => interest(p.id)}>Tenho interesse</button>
            )}
            {p.price > 0 && <p className="small plan__soon">Em breve · simulação</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
