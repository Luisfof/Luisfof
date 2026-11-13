import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Icon, Loading, Logo, Symbol } from './components/ui';
import { useApp } from './ctx';
import { api } from './api';
import { Home } from './pages/Home';
import { Results } from './pages/Results';
import { Detail } from './pages/Detail';

const Publish = lazy(() => import('./pages/Publish'));
const Account = lazy(() => import('./pages/Account'));
const Admin = lazy(() => import('./pages/Admin'));
const Plans = lazy(() => import('./pages/Plans'));
const Legal = lazy(() => import('./pages/Legal'));
const Auth = lazy(() => import('./pages/Auth'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Header() {
  const { user, setUser, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const loc = useLocation();
  const overHero = loc.pathname === '/';
  useEffect(() => setOpen(false), [loc]);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', esc); };
  }, [open]);

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    toast('Você saiu da sua conta.');
  };
  const links = (
    <>
      <NavLink to="/imoveis">Buscar imóveis</NavLink>
      <NavLink to="/planos">Planos</NavLink>
      <NavLink to="/sobre">Como funciona</NavLink>
      {user && <NavLink to="/minha-conta">Meus anúncios</NavLink>}
      {user?.role === 'admin' && <NavLink to="/admin">Moderação</NavLink>}
    </>
  );
  return (
    <header className={`hdr on-dark ${overHero && !solid && !open ? 'hdr--clear' : ''}`}>
      <div className="wrap hdr__in">
        <Link to="/" className="hdr__logo" aria-label="MORAA GO — página inicial">
          <Symbol size={34} />
          <Logo height={21} />
        </Link>
        <nav className="hdr__nav" aria-label="Principal">{links}</nav>
        <div className="hdr__act">
          {user ? (
            <button className="hdr__txt" onClick={logout}>Sair</button>
          ) : (
            <Link className="hdr__txt" to="/entrar">Entrar</Link>
          )}
          <Link className="btn btn--sm" to="/anunciar">Anunciar</Link>
          <button className="hdr__menu" aria-expanded={open} aria-controls="menu" aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'close' : 'menu'} size={24} />
          </button>
        </div>
      </div>
      <div id="menu" className="drawer" hidden={!open}>
        <nav className="drawer__nav" aria-label="Menu">
          {links}
          {user ? <button onClick={logout}>Sair ({user.name.split(' ')[0]})</button> : <NavLink to="/entrar">Entrar ou criar conta</NavLink>}
        </nav>
        <Link className="btn btn--block" to="/anunciar">Anunciar imóvel <Icon name="arrow" /></Link>
        <p className="small drawer__note">Senador Canedo · Goiânia · Região metropolitana</p>
      </div>
    </header>
  );
}

function InstallButton() {
  const [evt, setEvt] = useState<any>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (!evt) return null;
  return (
    <button className="btn btn--sm" onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null); }}>
      <Icon name="download" size={18} /> Instalar o app
    </button>
  );
}

function Footer() {
  return (
    <footer className="ftr on-dark">
      <div className="wrap ftr__grid">
        <div className="ftr__brand">
          <Logo height={30} />
          <p>Classificados de aluguel para Senador Canedo, Goiânia e região metropolitana. A plataforma divulga anúncios; a negociação é direta entre interessado e anunciante.</p>
          <InstallButton />
        </div>
        <nav aria-label="Plataforma">
          <h2 className="label">Plataforma</h2>
          <Link to="/imoveis">Buscar imóveis</Link>
          <Link to="/anunciar">Anunciar imóvel</Link>
          <Link to="/planos">Planos e destaques</Link>
          <Link to="/minha-conta">Área do anunciante</Link>
        </nav>
        <nav aria-label="Institucional">
          <h2 className="label">Institucional</h2>
          <Link to="/sobre">Como funciona</Link>
          <Link to="/termos">Termos de uso</Link>
          <Link to="/privacidade">Privacidade (LGPD)</Link>
          <Link to="/sobre#seguranca">Dicas de segurança</Link>
        </nav>
      </div>
      <div className="wrap ftr__base">
        <span>© {new Date().getFullYear()} MORAA GO · Versão de demonstração — sem cobranças e sem imóveis reais.</span>
        <span>Fotografias ilustrativas: Unsplash.</span>
      </div>
    </footer>
  );
}

function Consent() {
  const [ok, setOk] = useState(() => { try { return localStorage.getItem('moraa-consent') === '1'; } catch { return true; } });
  const { pathname } = useLocation();
  const [far, setFar] = useState(false);
  useEffect(() => {
    // Na home, o aviso só aparece depois da primeira dobra para não cobrir a busca.
    const on = () => setFar(window.scrollY > 320);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  if (ok || (pathname === '/' && !far)) return null;
  return (
    <aside className="consent on-dark" role="region" aria-label="Aviso de privacidade">
      <p>Usamos apenas um cookie essencial para manter sua sessão. Não há rastreadores nem publicidade de terceiros. <Link to="/privacidade">Política de privacidade</Link></p>
      <button className="btn btn--sm" onClick={() => { try { localStorage.setItem('moraa-consent', '1'); } catch { /* ignore */ } setOk(true); }}>Entendi</button>
    </aside>
  );
}

function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useApp();
  const loc = useLocation();
  if (!ready) return <main className="page wrap"><Loading /></main>;
  if (!user) return <Navigate to={`/entrar?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <main id="conteudo" className="page wrap nf">
      <p className="label">Erro 404</p>
      <h1 className="display">Porta<br />errada.</h1>
      <p className="soft">Esta página não existe ou o anúncio foi encerrado.</p>
      <div className="row"><Link className="btn" to="/imoveis">Buscar imóveis</Link><Link className="btn btn--ghost" to="/">Início</Link></div>
    </main>
  );
}

export function App() {
  return (
    <>
      <a className="skip" href="#conteudo">Pular para o conteúdo</a>
      <ScrollTop />
      <Header />
      <Suspense fallback={<main className="page wrap"><Loading /></main>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/imoveis" element={<Results />} />
          <Route path="/imovel/:slug" element={<Detail />} />
          <Route path="/entrar" element={<Auth />} />
          <Route path="/anunciar" element={<Protected><Publish /></Protected>} />
          <Route path="/minha-conta" element={<Protected><Account /></Protected>} />
          <Route path="/minha-conta/anuncio/:id" element={<Protected><Publish /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="/planos" element={<Plans />} />
          <Route path="/termos" element={<Legal doc="termos" />} />
          <Route path="/privacidade" element={<Legal doc="privacidade" />} />
          <Route path="/sobre" element={<Legal doc="sobre" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Footer />
      <Consent />
    </>
  );
}
