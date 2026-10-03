import { createClient } from '@supabase/supabase-js';
import './clients.css';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const apiBase=(import.meta.env.VITE_ORIXEO_API_URL||'https://supabase-mcp.msdg-innovation.fr/api/orixeo/v1').replace(/\/$/,'');

async function token(){
  const {data}=await supabase.auth.getSession();
  return data.session?.access_token||null;
}

async function api(path:string,options:any={}){
  const t=await token();
  if(!t) throw new Error('Session expirée');
  const r=await fetch(apiBase+path,{
    ...options,
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+t,...(options.headers||{})}
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error||('Erreur '+r.status));
  return data;
}

function esc(v:any){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m] as string));}
function money(v:any,d=2){return Number(v||0).toFixed(d);}

async function loadClients(root:HTMLElement){
  const list=root.querySelector('#oc-client-list') as HTMLElement;
  list.innerHTML='<p class="oc-muted">Chargement…</p>';
  try{
    const data=await api('/clients');
    const clients=data.clients||[];
    list.innerHTML=clients.map((c:any)=>`
      <article class="oc-client-card">
        <div><b>${esc(c.name)}</b><small>${esc(c.slug)}</small></div>
        <div><span>Abonnement</span><strong>${money(c.monthly_subscription_amount)} €</strong></div>
        <div><span>Budget IA</span><strong>$${money(c.included_ai_budget_usd)}</strong></div>
        <div><span>Coût IA</span><strong>$${money(c.ai_cost_usd,4)}</strong></div>
        <div><span>Mode</span><strong>${esc(c.enforcement_mode||'—')}</strong></div>
        <div><span>Widget</span><code>${esc(c.widget_key||'non créé')}</code></div>
      </article>`).join('')||'<p class="oc-muted">Aucun client pour le moment.</p>';
  }catch(e:any){
    list.innerHTML='<p class="oc-error">'+esc(e?.message||e)+'</p>';
  }
}

async function createClient(root:HTMLElement,form:HTMLFormElement){
  const fd=new FormData(form);
  const origin=String(fd.get('origin')||'').trim();
  const payload={
    name:String(fd.get('name')||'').trim(),
    slug:String(fd.get('slug')||'').trim(),
    allowed_origins:origin?[origin]:[],
    monthly_subscription_amount:Number(fd.get('subscription')||0),
    included_ai_budget_usd:Number(fd.get('budget')||0),
    hard_cap_usd:fd.get('hardcap')?Number(fd.get('hardcap')):null,
    enforcement_mode:String(fd.get('mode')||'observe')
  };
  const out=root.querySelector('#oc-client-result') as HTMLElement;
  out.innerHTML='<p class="oc-muted">Création du client…</p>';
  try{
    const data=await api('/clients',{method:'POST',body:JSON.stringify(payload)});
    const d=data.deployment;
    out.innerHTML=`
      <div class="oc-success">
        <b>Client créé</b>
        <p>${esc(data.organization?.name)}</p>
        <label>Widget key</label>
        <code>${esc(d?.widget_key)}</code>
        <label>API</label>
        <code>${esc(data.embed?.api_url)}</code>
      </div>`;
    form.reset();
    await loadClients(root);
  }catch(e:any){
    out.innerHTML='<p class="oc-error">'+esc(e?.message||e)+'</p>';
  }
}

function markup(){
  return `
    <div class="oc-header">
      <div><small>ORIXEO LAB</small><h2>Gestion des clients</h2><p>Créer et piloter les environnements Sales AI</p></div>
      <button id="oc-close" type="button">×</button>
    </div>
    <div class="oc-grid">
      <section class="oc-card">
        <h3>Nouveau client</h3>
        <form id="oc-client-form">
          <label>Entreprise<input name="name" required placeholder="Ex. Entreprise Dupont"></label>
          <label>Slug<input name="slug" placeholder="entreprise-dupont"></label>
          <label>Domaine autorisé<input name="origin" type="url" placeholder="https://www.entreprise.fr"></label>
          <div class="oc-two">
            <label>Abonnement mensuel €<input name="subscription" type="number" min="0" step="0.01" value="0"></label>
            <label>Budget IA inclus $<input name="budget" type="number" min="0" step="0.01" value="0"></label>
          </div>
          <div class="oc-two">
            <label>Plafond IA $<input name="hardcap" type="number" min="0" step="0.01"></label>
            <label>Mode<select name="mode"><option value="observe">Observe</option><option value="soft">Soft</option><option value="hard">Hard</option></select></label>
          </div>
          <button type="submit">Créer le client</button>
        </form>
        <div id="oc-client-result"></div>
      </section>
      <section class="oc-card oc-list-card">
        <div class="oc-title-row"><h3>Clients</h3><button id="oc-refresh" type="button">↻ Actualiser</button></div>
        <div id="oc-client-list"></div>
      </section>
    </div>`;
}

async function openManager(){
  let overlay=document.getElementById('orixeo-clients-overlay') as HTMLElement|null;
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='orixeo-clients-overlay';
    overlay.className='oc-overlay';
    overlay.innerHTML='<div class="oc-shell"></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  const shell=overlay.querySelector('.oc-shell') as HTMLElement;
  shell.innerHTML=markup();
  shell.querySelector('#oc-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
  shell.querySelector('#oc-refresh')?.addEventListener('click',()=>void loadClients(shell));
  const form=shell.querySelector('#oc-client-form') as HTMLFormElement;
  form.addEventListener('submit',(e)=>{e.preventDefault();void createClient(shell,form);});
  await loadClients(shell);
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-clients-link')) return false;
  const a=document.createElement('a');
  a.id='orixeo-clients-link';
  a.innerHTML='▦ <span>Clients Sales AI</span>';
  a.addEventListener('click',()=>void openManager());
  nav.appendChild(a);
  return true;
}

if(!mount()){
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
