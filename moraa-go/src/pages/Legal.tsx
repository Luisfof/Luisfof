import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../components/ui';
import { useTitle } from '../ctx';

const VERSION = 'Versão 1.0 — documento-modelo da demonstração';

function Termos() {
  return (
    <>
      <h2>1. O que é o MORAA GO</h2>
      <p>O MORAA GO é uma plataforma de classificados que divulga anúncios de imóveis para aluguel em Senador Canedo, Goiânia e região metropolitana. A plataforma <strong>não é imobiliária</strong>, não presta corretagem, não intermedeia contratos, não recebe aluguéis e não cobra comissão sobre locações.</p>
      <h2>2. Ambiente de demonstração</h2>
      <p>Esta versão é demonstrativa. Anúncios marcados como “Demonstrativo” usam imagens ilustrativas e não correspondem a imóveis disponíveis. Planos pagos estão em simulação: nenhuma cobrança é realizada.</p>
      <h2>3. Conta e responsabilidades do anunciante</h2>
      <ul>
        <li>Só pode anunciar quem é proprietário do imóvel ou tem autorização para anunciá-lo.</li>
        <li>As informações e fotos devem ser verdadeiras, atuais e de uso autorizado.</li>
        <li>Não é permitido publicar endereço completo, dados de terceiros, conteúdo discriminatório ou enganoso.</li>
        <li>O anunciante deve pausar ou excluir o anúncio quando o imóvel deixar de estar disponível.</li>
      </ul>
      <h2>4. Moderação</h2>
      <p>Todo anúncio passa por moderação antes de ser publicado e pode ser pausado ou removido se violar estes termos. A moderação verifica o conteúdo do anúncio; <strong>não é uma verificação documental do imóvel</strong> nem garantia sobre o anunciante.</p>
      <h2>5. Contato entre as partes</h2>
      <p>O contato por WhatsApp só é oferecido quando o anunciante autoriza expressamente. A negociação, a visita e o contrato são de responsabilidade exclusiva das partes.</p>
      <h2>6. Segurança</h2>
      <p>Nunca faça pagamentos antecipados sem visitar o imóvel e conferir o contrato. Use o botão “Denunciar este anúncio” ao notar algo suspeito.</p>
      <h2>7. Alterações</h2>
      <p>Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas na plataforma. Antes da operação pública, este documento deve passar por revisão jurídica especializada.</p>
    </>
  );
}

function Privacidade() {
  return (
    <>
      <h2>1. Quais dados tratamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome, e-mail e senha (armazenada apenas como hash criptográfico).</li>
        <li><strong>Anúncios:</strong> textos, fotos e, se você autorizar, o número de WhatsApp para contato.</li>
        <li><strong>Uso:</strong> contadores agregados de visualizações e cliques em contato por anúncio. Não criamos perfis de visitantes.</li>
      </ul>
      <h2>2. O que não fazemos</h2>
      <ul>
        <li>Não usamos cookies de publicidade nem rastreadores de terceiros.</li>
        <li>Não coletamos endereço completo de imóveis; o mapa mostra só a região aproximada.</li>
        <li>Não exibimos telefone ou e-mail em páginas públicas; o WhatsApp só é aberto após um clique e com a autorização do anunciante.</li>
        <li>Removemos metadados (EXIF/GPS) das fotos enviadas.</li>
      </ul>
      <h2>3. Cookies</h2>
      <p>Usamos um único cookie essencial (<code>moraa_sid</code>) para manter sua sessão após o login. Ele é HttpOnly e expira em 14 dias. A preferência do aviso de privacidade fica salva no próprio navegador.</p>
      <h2>4. Bases legais (LGPD)</h2>
      <p>Tratamos dados para executar o serviço solicitado por você (art. 7º, V) e, no caso do WhatsApp, com o seu consentimento específico (art. 7º, I), que pode ser revogado a qualquer momento editando o anúncio.</p>
      <h2>5. Seus direitos</h2>
      <p>Você pode acessar, corrigir e excluir seus dados. A exclusão da conta, disponível em <Link className="link" to="/minha-conta">Área do anunciante</Link>, remove definitivamente cadastro, anúncios e fotos.</p>
      <h2>6. Retenção e segurança</h2>
      <p>Mantemos os dados enquanto a conta existir. Aplicamos controle de acesso, sessões protegidas, validação de entradas e limitação de tentativas. Nenhum sistema é infalível; incidentes relevantes serão comunicados conforme a lei.</p>
      <h2>7. Contato do encarregado</h2>
      <p>O canal do encarregado de dados (DPO) será definido antes da abertura pública. Nesta demonstração não há operação comercial.</p>
    </>
  );
}

function Sobre() {
  return (
    <>
      <h2>Para quem procura</h2>
      <p>Busque por cidade, bairro, faixa de aluguel, quartos e características. Você vê fotos, valores e a região aproximada antes de falar com alguém. Não há taxa para quem procura imóvel.</p>
      <h2>Para quem anuncia</h2>
      <p>Crie uma conta, descreva o imóvel, envie até 8 fotos e escolha se o seu WhatsApp pode ser exibido. O anúncio entra no ar depois da moderação. Na <Link className="link" to="/minha-conta">área do anunciante</Link> você edita, pausa, reativa e acompanha visualizações.</p>
      <h2>O que o MORAA GO não faz</h2>
      <p>Não intermedeia a locação, não redige contratos, não faz vistoria e não recebe pagamentos. Somos um espaço de divulgação.</p>
      <h2 id="seguranca">Dicas de segurança</h2>
      <ul>
        <li>Visite o imóvel pessoalmente antes de qualquer pagamento.</li>
        <li>Peça documento do imóvel e de quem assina o contrato.</li>
        <li>Desconfie de preços muito abaixo da região e de pedidos de “sinal” por Pix.</li>
        <li>Prefira contrato escrito, com vistoria e recibos.</li>
        <li>Viu algo estranho? Use “Denunciar este anúncio” na página do imóvel.</li>
      </ul>
      <h2>Instalar no celular</h2>
      <p>No Android (Chrome ou Samsung Internet), abra o menu do navegador e toque em “Instalar app” ou “Adicionar à tela inicial”. No iPhone (Safari), toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p>
    </>
  );
}

const DOCS = {
  termos: { kicker: 'Institucional', title: <>Termos<br />de uso</>, t: 'Termos de uso', body: <Termos /> },
  privacidade: { kicker: 'LGPD', title: <>Política de<br />privacidade</>, t: 'Política de privacidade', body: <Privacidade /> },
  sobre: { kicker: 'Como funciona', title: <>Simples,<br /><em className="em-brasa">direto e seguro</em></>, t: 'Como funciona', body: <Sobre /> },
};

export default function Legal({ doc }: { doc: keyof typeof DOCS }) {
  const d = DOCS[doc];
  const { hash } = useLocation();
  useTitle(d.t);
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView(); }, [hash, doc]);
  return (
    <main id="conteudo" className="page wrap legal">
      <header className="phead">
        <p className="label sec__kicker">{d.kicker}</p>
        <h1 className="h1">{d.title}</h1>
        {doc !== 'sobre' && <p className="small soft">{VERSION}</p>}
      </header>
      <div className="legal__grid">
        <article className="prose">{d.body}</article>
        <aside className="legal__nav" aria-label="Documentos">
          <Link to="/sobre"><Icon name="door" size={18} /> Como funciona</Link>
          <Link to="/termos"><Icon name="check" size={18} /> Termos de uso</Link>
          <Link to="/privacidade"><Icon name="shield" size={18} /> Privacidade</Link>
        </aside>
      </div>
    </main>
  );
}
