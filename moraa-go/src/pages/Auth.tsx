import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Field, Icon } from '../components/ui';
import { useApp, useTitle } from '../ctx';

export default function Auth() {
  const { user, setUser, toast } = useApp();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const next = sp.get('next')?.startsWith('/') && !sp.get('next')!.startsWith('//') ? sp.get('next')! : '/minha-conta';
  const [mode, setMode] = useState<'entrar' | 'criar'>(sp.get('modo') === 'criar' ? 'criar' : 'entrar');
  const [f, setF] = useState({ name: '', email: '', password: '', acceptTerms: false });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useTitle(mode === 'entrar' ? 'Entrar' : 'Criar conta');
  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (mode === 'criar' && f.name.trim().length < 2) v.name = 'Informe seu nome.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) v.email = 'Informe um e-mail válido.';
    if (mode === 'criar' ? f.password.length < 10 : !f.password) v.password = mode === 'criar' ? 'Use pelo menos 10 caracteres.' : 'Informe sua senha.';
    if (mode === 'criar' && !f.acceptTerms) v.acceptTerms = 'É preciso aceitar os termos para criar a conta.';
    setErrs(v); setErr('');
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const r = mode === 'entrar' ? await api.login(f.email.trim(), f.password) : await api.register({ ...f, name: f.name.trim(), email: f.email.trim() });
      setUser(r.user);
      toast(mode === 'entrar' ? `Olá, ${r.user.name.split(' ')[0]}!` : 'Conta criada. Bem-vindo(a) ao MORAA GO!');
      nav(next, { replace: true });
    } catch (e: any) { setErr(e.message); setErrs(e.fields ?? {}); } finally { setBusy(false); }
  };
  const on = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <main id="conteudo" className="auth">
      <div className="auth__art on-dark" aria-hidden="true">
        <img src="/img/hero-900.webp" alt="" />
        <p className="display">Entre.<br /><em>A casa<br />é sua.</em></p>
      </div>
      <div className="auth__panel">
        <div className="tabs" role="tablist" aria-label="Acesso">
          <button role="tab" aria-selected={mode === 'entrar'} onClick={() => { setMode('entrar'); setErrs({}); setErr(''); }}>Entrar</button>
          <button role="tab" aria-selected={mode === 'criar'} onClick={() => { setMode('criar'); setErrs({}); setErr(''); }}>Criar conta</button>
        </div>
        <h1 className="h1" style={{ fontSize: 'clamp(2rem,7vw,3rem)' }}>{mode === 'entrar' ? 'Acesse sua conta' : 'Anuncie em minutos'}</h1>
        <p className="soft">{mode === 'entrar' ? 'Gerencie seus anúncios e acompanhe as visualizações.' : 'A conta é gratuita e serve para publicar e gerenciar seus anúncios.'}</p>
        <form onSubmit={submit} noValidate className="form">
          {err && <p className="notice notice--error" role="alert">{err}</p>}
          {mode === 'criar' && (
            <Field id="a-name" label="Nome" error={errs.name}>
              <input id="a-name" className="input" value={f.name} onChange={on('name')} autoComplete="name" maxLength={80} aria-invalid={!!errs.name} />
            </Field>
          )}
          <Field id="a-email" label="E-mail" error={errs.email}>
            <input id="a-email" className="input" type="email" inputMode="email" value={f.email} onChange={on('email')} autoComplete="email" autoCapitalize="none" aria-invalid={!!errs.email} />
          </Field>
          <Field id="a-pass" label="Senha" error={errs.password} hint={mode === 'criar' ? 'Mínimo de 10 caracteres.' : undefined}>
            <input id="a-pass" className="input" type="password" value={f.password} onChange={on('password')} autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} aria-invalid={!!errs.password} />
          </Field>
          {mode === 'criar' && (
            <div>
              <label className="check">
                <input type="checkbox" checked={f.acceptTerms} onChange={on('acceptTerms')} aria-invalid={!!errs.acceptTerms} />
                <span>Li e aceito os <Link className="link" to="/termos" target="_blank">Termos de uso</Link> e a <Link className="link" to="/privacidade" target="_blank">Política de privacidade</Link>, e autorizo o tratamento dos meus dados para operar minha conta.</span>
              </label>
              {errs.acceptTerms && <span className="err" role="alert" style={{ font: '600 .82rem/1.3 var(--font)', color: 'var(--brasa-700)' }}>{errs.acceptTerms}</span>}
            </div>
          )}
          <button className="btn btn--block" disabled={busy}>{busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : 'Criar conta'} <Icon name="arrow" /></button>
        </form>
      </div>
    </main>
  );
}
