import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CITIES, FEATURES, PROPERTY_TYPES, type FeatureId, type ListingImage, type ListingInput } from '../../shared/types';
import { api, ApiFail } from '../api';
import { Field, Icon, Loading } from '../components/ui';
import { useApp, useTitle } from '../ctx';

const MAX_IMG = 8;
const MAX_MB = 6;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface FormState {
  title: string; description: string; type: string; city: string; neighborhood: string;
  price: string; condoFee: string; iptu: string; bedrooms: number; bathrooms: number; parking: number; areaM2: string;
  features: FeatureId[]; whatsapp: string; whatsappAuthorized: boolean; ownershipDeclared: boolean;
}
const empty: FormState = {
  title: '', description: '', type: '', city: '', neighborhood: '', price: '', condoFee: '', iptu: '',
  bedrooms: 2, bathrooms: 1, parking: 1, areaM2: '', features: [], whatsapp: '', whatsappAuthorized: false, ownershipDeclared: false,
};
const digits = (s: string) => s.replace(/\D/g, '');
const maskPhone = (s: string) => {
  const d = digits(s).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  const t = f.title.trim(), d = f.description.trim();
  if (!f.type) e.type = 'Escolha o tipo de imóvel.';
  if (t.length < 8 || t.length > 90) e.title = 'O título precisa ter entre 8 e 90 caracteres.';
  if (d.length < 30) e.description = `Descreva com pelo menos 30 caracteres (faltam ${30 - d.length}).`;
  if (!f.city) e.city = 'Escolha a cidade.';
  if (f.neighborhood.trim().length < 2) e.neighborhood = 'Informe o bairro.';
  const price = Number(f.price);
  if (!f.price || price < 100 || price > 100000) e.price = 'Informe um aluguel entre R$ 100 e R$ 100.000.';
  if (f.areaM2 && (Number(f.areaM2) < 8 || Number(f.areaM2) > 5000)) e.areaM2 = 'Área entre 8 e 5.000 m².';
  if (f.whatsappAuthorized && ![10, 11].includes(digits(f.whatsapp).length)) e.whatsapp = 'Informe o WhatsApp com DDD (10 ou 11 dígitos).';
  if (!f.ownershipDeclared) e.ownershipDeclared = 'Confirme que você tem autorização para anunciar.';
  return e;
}

function Stepper({ label, value, onChange, id }: { label: string; value: number; onChange: (n: number) => void; id: string }) {
  return (
    <div className="stepper">
      <span id={id} className="field__label">{label}</span>
      <div role="group" aria-labelledby={id}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Diminuir ${label}`} disabled={value <= 0}>−</button>
        <output className="num" aria-live="polite">{value}</output>
        <button type="button" onClick={() => onChange(Math.min(10, value + 1))} aria-label={`Aumentar ${label}`} disabled={value >= 10}>+</button>
      </div>
    </div>
  );
}

export default function Publish() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useApp();
  const [f, setF] = useState<FormState>(empty);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [existing, setExisting] = useState<ListingImage[]>([]);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [fileErr, setFileErr] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  useTitle(id ? 'Editar anúncio' : 'Anunciar imóvel');

  useEffect(() => {
    if (!id) { setF(empty); setExisting([]); return; }
    api.myListing(id).then((l) => {
      setF({
        title: l.title, description: l.description, type: l.type, city: l.city, neighborhood: l.neighborhood,
        price: String(l.price), condoFee: l.condoFee ? String(l.condoFee) : '', iptu: l.iptu ? String(l.iptu) : '',
        bedrooms: l.bedrooms, bathrooms: l.bathrooms, parking: l.parking, areaM2: l.areaM2 ? String(l.areaM2) : '',
        features: l.features, whatsapp: maskPhone(l.whatsapp ?? ''), whatsappAuthorized: l.whatsappAuthorized, ownershipDeclared: true,
      });
      setExisting(l.images);
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => () => files.forEach((x) => URL.revokeObjectURL(x.url)), []); // eslint-disable-line

  const up = (patch: Partial<FormState>) => setF((s) => ({ ...s, ...patch }));
  const txt = (k: keyof FormState) => (e: any) => up({ [k]: e.target.value } as any);
  const money = (k: keyof FormState) => (e: any) => up({ [k]: digits(e.target.value).slice(0, 6) } as any);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFileErr('');
    const room = MAX_IMG - existing.length - files.length;
    const add: { file: File; url: string }[] = [];
    for (const file of Array.from(list)) {
      if (!OK_TYPES.includes(file.type)) { setFileErr('Use apenas fotos JPG, PNG ou WebP.'); continue; }
      if (file.size > MAX_MB * 1024 * 1024) { setFileErr(`Cada foto pode ter no máximo ${MAX_MB} MB.`); continue; }
      if (add.length >= room) { setFileErr(`Limite de ${MAX_IMG} fotos por anúncio.`); break; }
      add.push({ file, url: URL.createObjectURL(file) });
    }
    setFiles((s) => [...s, ...add]);
  };
  const removeExisting = async (img: ListingImage) => {
    if (!id) return;
    try { await api.deleteImage(id, img.id); setExisting((s) => s.filter((x) => x.id !== img.id)); } catch (e: any) { toast(e.message, 'error'); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate(f);
    setErrs(v); setErr('');
    if (Object.keys(v).length) {
      setErr('Revise os campos destacados.');
      requestAnimationFrame(() => (formRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus());
      return;
    }
    const input: ListingInput = {
      title: f.title.trim(), description: f.description.trim(), type: f.type as any, city: f.city as any, neighborhood: f.neighborhood.trim(),
      price: Number(f.price), condoFee: f.condoFee ? Number(f.condoFee) : null, iptu: f.iptu ? Number(f.iptu) : null,
      bedrooms: f.bedrooms, bathrooms: f.bathrooms, parking: f.parking, areaM2: f.areaM2 ? Number(f.areaM2) : null,
      features: f.features, whatsapp: f.whatsappAuthorized ? digits(f.whatsapp) : null, whatsappAuthorized: f.whatsappAuthorized, ownershipDeclared: f.ownershipDeclared,
    };
    setBusy(true);
    try {
      const saved = id ? await api.updateListing(id, input) : await api.createListing(input);
      if (files.length) {
        try { await api.uploadImages(saved.id, files.map((x) => x.file)); }
        catch (e: any) { toast(`Anúncio salvo, mas as fotos falharam: ${e.message}`, 'error'); nav(`/minha-conta/anuncio/${saved.id}`, { replace: true }); return; }
      }
      toast(id ? 'Anúncio atualizado e enviado para nova moderação.' : 'Anúncio enviado! Ele entra no ar após a moderação.');
      nav('/minha-conta');
    } catch (e: any) {
      setErr(e.message);
      if (e instanceof ApiFail && e.fields) setErrs(e.fields);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally { setBusy(false); }
  };

  if (loading) return <main id="conteudo" className="page wrap"><Loading /></main>;
  const inv = (k: string) => ({ 'aria-invalid': !!errs[k] || undefined, 'aria-describedby': errs[k] ? `p-${k}-err` : undefined });
  const count = existing.length + files.length;

  return (
    <main id="conteudo" className="page wrap publish">
      <header className="phead">
        <p className="label sec__kicker">{id ? 'Editar anúncio' : 'Novo anúncio'}</p>
        <h1 className="h1">{id ? <>Ajuste<br />seu anúncio</> : <>Conte sobre<br /><em className="em-brasa">o seu imóvel</em></>}</h1>
        <p className="soft phead__lead">Leva uns 5 minutos. Todo anúncio passa por moderação antes de aparecer na busca. Não pedimos endereço completo.</p>
      </header>

      <div className="publish__grid">
      <form ref={formRef} className="pform" onSubmit={submit} noValidate>
        {err && <p className="notice notice--error" role="alert">{err}</p>}

        <fieldset className="pstep">
          <legend><span className="num">01</span> O imóvel</legend>
          <div className="field">
            <span className="field__label" id="p-type-l">Tipo</span>
            <div className="chips" role="radiogroup" aria-labelledby="p-type-l">
              {PROPERTY_TYPES.map((t) => (
                <label key={t.id} className="chip"><input type="radio" name="type" checked={f.type === t.id} onChange={() => up({ type: t.id })} {...inv('type')} /><span>{t.name}</span></label>
              ))}
            </div>
            {errs.type && <span className="err" id="p-type-err" role="alert">{errs.type}</span>}
          </div>
          <Field id="p-title" label="Título do anúncio" error={errs.title} hint={`${f.title.length}/90 — ex.: “Casa de 3 quartos com quintal”`}>
            <input id="p-title" className="input" value={f.title} onChange={txt('title')} maxLength={90} {...inv('title')} />
          </Field>
          <Field id="p-description" label="Descrição" error={errs.description} hint="Fale dos cômodos, do estado do imóvel e do que há por perto. Não inclua telefone nem endereço.">
            <textarea id="p-description" className="textarea" value={f.description} onChange={txt('description')} maxLength={3000} {...inv('description')} />
          </Field>
        </fieldset>

        <fieldset className="pstep">
          <legend><span className="num">02</span> Localização</legend>
          <div className="two">
            <Field id="p-city" label="Cidade" error={errs.city}>
              <select id="p-city" className="select" value={f.city} onChange={txt('city')} {...inv('city')}>
                <option value="">Selecione…</option>
                {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field id="p-neighborhood" label="Bairro" error={errs.neighborhood}>
              <input id="p-neighborhood" className="input" value={f.neighborhood} onChange={txt('neighborhood')} maxLength={60} autoComplete="off" {...inv('neighborhood')} />
            </Field>
          </div>
          <p className="notice"><Icon name="shield" size={20} style={{ flex: 'none' }} /><span>Mostramos apenas a região aproximada do bairro no mapa. O endereço você combina direto com o interessado.</span></p>
        </fieldset>

        <fieldset className="pstep">
          <legend><span className="num">03</span> Valores mensais</legend>
          <div className="three">
            <Field id="p-price" label="Aluguel (R$)" error={errs.price}>
              <input id="p-price" className="input num" inputMode="numeric" value={f.price} onChange={money('price')} placeholder="1500" {...inv('price')} />
            </Field>
            <Field id="p-condo" label="Condomínio (R$)" hint="Opcional">
              <input id="p-condo" className="input num" inputMode="numeric" value={f.condoFee} onChange={money('condoFee')} />
            </Field>
            <Field id="p-iptu" label="IPTU mensal (R$)" hint="Opcional">
              <input id="p-iptu" className="input num" inputMode="numeric" value={f.iptu} onChange={money('iptu')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="pstep">
          <legend><span className="num">04</span> Características</legend>
          <div className="steppers">
            <Stepper id="p-bed" label="Quartos" value={f.bedrooms} onChange={(n) => up({ bedrooms: n })} />
            <Stepper id="p-bath" label="Banheiros" value={f.bathrooms} onChange={(n) => up({ bathrooms: n })} />
            <Stepper id="p-park" label="Vagas" value={f.parking} onChange={(n) => up({ parking: n })} />
          </div>
          <Field id="p-areaM2" label="Área aproximada (m²)" error={errs.areaM2} hint="Opcional">
            <input id="p-areaM2" className="input num" style={{ maxWidth: 200 }} inputMode="numeric" value={f.areaM2} onChange={(e) => up({ areaM2: digits(e.target.value).slice(0, 4) })} {...inv('areaM2')} />
          </Field>
          <fieldset className="field">
            <legend className="field__label">O imóvel tem</legend>
            <div className="chips">
              {FEATURES.map((x) => (
                <label key={x.id} className="chip">
                  <input type="checkbox" checked={f.features.includes(x.id)} onChange={() => up({ features: f.features.includes(x.id) ? f.features.filter((y) => y !== x.id) : [...f.features, x.id] })} />
                  <span>{x.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>

        <fieldset className="pstep">
          <legend><span className="num">05</span> Fotos <small className="num">({count}/{MAX_IMG})</small></legend>
          <p className="small soft">A primeira foto é a capa. JPG, PNG ou WebP, até {MAX_MB} MB cada. Removemos os dados de localização (EXIF) automaticamente. Use apenas fotos suas ou com autorização.</p>
          <ul className="thumbs">
            {existing.map((im) => (
              <li key={im.id}><img src={im.thumbUrl} alt={im.alt || 'Foto do anúncio'} /><button type="button" onClick={() => removeExisting(im)} aria-label="Remover foto"><Icon name="close" size={16} /></button></li>
            ))}
            {files.map((x, i) => (
              <li key={x.url}><img src={x.url} alt={`Nova foto ${i + 1}`} /><button type="button" onClick={() => { URL.revokeObjectURL(x.url); setFiles((s) => s.filter((y) => y !== x)); }} aria-label={`Remover nova foto ${i + 1}`}><Icon name="close" size={16} /></button></li>
            ))}
            {count < MAX_IMG && (
              <li className="thumbs__add">
                <label>
                  <Icon name="camera" size={28} />
                  <span>Adicionar fotos</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                </label>
              </li>
            )}
          </ul>
          {fileErr && <span className="err" role="alert" style={{ font: '600 .85rem/1.3 var(--font)', color: 'var(--brasa-700)' }}>{fileErr}</span>}
        </fieldset>

        <fieldset className="pstep">
          <legend><span className="num">06</span> Contato e autorização</legend>
          <label className="check">
            <input type="checkbox" checked={f.whatsappAuthorized} onChange={(e) => up({ whatsappAuthorized: e.target.checked })} />
            <span><strong>Autorizo exibir meu WhatsApp</strong> para quem clicar em “Falar no WhatsApp” neste anúncio. Sem essa autorização, o anúncio fica sem botão de contato.</span>
          </label>
          {f.whatsappAuthorized && (
            <Field id="p-whatsapp" label="WhatsApp com DDD" error={errs.whatsapp} hint="O número nunca aparece escrito na página; só abre a conversa após o clique.">
              <input id="p-whatsapp" className="input num" style={{ maxWidth: 260 }} type="tel" inputMode="tel" autoComplete="tel-national" value={f.whatsapp} onChange={(e) => up({ whatsapp: maskPhone(e.target.value) })} placeholder="(62) 90000-0000" {...inv('whatsapp')} />
            </Field>
          )}
          <div>
            <label className="check">
              <input type="checkbox" checked={f.ownershipDeclared} onChange={(e) => up({ ownershipDeclared: e.target.checked })} {...inv('ownershipDeclared')} />
              <span>Declaro que sou proprietário(a) ou tenho autorização para anunciar este imóvel, que as informações são verdadeiras e que aceito os <Link className="link" to="/termos" target="_blank">Termos de uso</Link>.</span>
            </label>
            {errs.ownershipDeclared && <span className="err" id="p-ownershipDeclared-err" role="alert" style={{ font: '600 .82rem/1.3 var(--font)', color: 'var(--brasa-700)' }}>{errs.ownershipDeclared}</span>}
          </div>
        </fieldset>

        <div className="pform__end">
          <button className="btn" disabled={busy}>{busy ? 'Enviando…' : id ? 'Salvar e reenviar para moderação' : 'Enviar para moderação'} <Icon name="arrow" /></button>
          <Link className="btn btn--ghost" to="/minha-conta">Cancelar</Link>
        </div>
      </form>
      <aside className="tips" aria-label="Dicas para um bom anúncio">
        <p className="label">Dicas</p>
        <h2>Anúncio bom aluga mais rápido</h2>
        <ol>
          <li><span className="num">01</span><div><strong>Fotos claras, de dia</strong>Abra as janelas e fotografe cada cômodo na horizontal. A fachada vai de capa.</div></li>
          <li><span className="num">02</span><div><strong>Valores completos</strong>Informe condomínio e IPTU. Quem procura filtra pelo total do mês.</div></li>
          <li><span className="num">03</span><div><strong>Seja específico</strong>“Quintal com churrasqueira e vaga coberta” diz mais que “ótima casa”.</div></li>
          <li><span className="num">04</span><div><strong>Mantenha atualizado</strong>Alugou? Pause o anúncio na sua área para não receber contatos à toa.</div></li>
        </ol>
      </aside>
      </div>
    </main>
  );
}
