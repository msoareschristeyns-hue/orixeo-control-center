import { createClient } from '@supabase/supabase-js';
import './saas.css';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const apiBase=(import.meta.env.VITE_ORIXEO_API_URL||'https://supabase-mcp.msdg-innovation.fr/api/orixeo/v1').replace(/\/$/,'');
const modules=['sales_ai','crm','followups','daily_cockpit','reporting','roi','business_review','customer_portal'];

async function token(){const {data}=await supabase.auth.getSession();return data.session?.access_token||null;}
async function api(options:any={}){
  const t=await token(); if(!t) throw new Error('Session expirée');
  const r=await fetch(apiBase+'/saas',{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+t,...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error||('Erreur '+r.status));
  return data;
}
function esc(v:any){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m] as string));}
function money(v:any,d=2){return Number(v||0).toFixed(d);}

function render(data:any){
  const t=data.totals||{}, clients=data.clients||[];
  return `
    <div class="os-header"><div><small>ORIXEO LAB</small><h2>Administration SaaS</h2><p>Abonnements, quotas, modules et rentabilité globale</p></div><button id="os-close">×</button></div>
    <div class="os-kpis">
      <article><span>Clients actifs</span><b>${esc(t.active_clients??0)}</b></article>
      <article><span>Essais</span><b>${esc(t.trial_clients??0)}</b></article>
      <article><span>Suspendus</span><b>${esc(t.suspended_clients??0)}</b></article>
      <article><span>MRR</span><b>${money(t.mrr_eur,2)} €</b></article>
      <article><span>Coût IA mois</span><b>$${money(t.ai_cost_usd_month,4)}</b></article>
      <article><span>Requêtes IA</span><b>${esc(t.ai_requests_month??0)}</b></article>
      <article><span>Conversations</span><b>${esc(t.conversations_month??0)}</b></article>
      <article><span>Leads</span><b>${esc(t.leads_month??0)}</b></article>
    </div>
    <div class="os-list">
      ${clients.map((c:any)=>`
        <article class="os-client" data-org="${esc(c.organization_id)}">
          <div class="os-client-head">
            <div><b>${esc(c.name)}</b><span>${esc(c.slug)} · ${esc(c.subscription_status||'non configuré')}</span></div>
            <div class="os-status-actions">
              <button class="os-toggle" data-action="${c.subscription_status==='suspended'?'activate':'suspend'}">${c.subscription_status==='suspended'?'Réactiver':'Suspendre'}</button>
            </div>
          </div>
          <div class="os-grid">
            <label>Plan<input class="os-plan" value="${esc(c.plan_code||'starter')}"></label>
            <label>Prix mensuel €<input class="os-price" type="number" min="0" step="0.01" value="${esc(c.monthly_price_eur??0)}"></label>
            <label>Sièges<input class="os-seats" type="number" min="1" value="${esc(c.seats_limit??1)}"></label>
            <label>Quota conversations<input class="os-conv" type="number" min="0" value="${c.conversations_limit??''}" placeholder="Illimité"></label>
            <label>Quota requêtes IA<input class="os-req" type="number" min="0" value="${c.ai_requests_limit??''}" placeholder="Illimité"></label>
          </div>
          <div class="os-usage">
            <span>${esc(c.members??0)} utilisateur(s)</span>
            <span>${esc(c.conversations_month??0)} conversations</span>
            <span>${esc(c.ai_requests_month??0)} requêtes IA</span>
            <span>$${money(c.ai_cost_usd_month,4)} coût IA</span>
            <span>${esc(c.modules_enabled??0)} modules</span>
          </div>
          <div class="os-modules">
            ${modules.map(m=>`<label><input type="checkbox" class="os-module" data-module="${m}" ${c.modules?.[m]?'checked':''}> <span>${m.replaceAll('_',' ')}</span></label>`).join('')}
          </div>
          <div class="os-footer"><button class="os-save">Enregistrer</button></div>
        </article>`).join('')||'<p class="os-empty">Aucun tenant SaaS.</p>'}
    </div>`;
}

async function saveCard(card:HTMLElement){
  const org=card.dataset.org!;
  const moduleConfig:any={};
  card.querySelectorAll('.os-module').forEach((x:any)=>moduleConfig[x.dataset.module]=x.checked);
  await api({method:'POST',body:JSON.stringify({
    organization_id:org,
    plan_code:(card.querySelector('.os-plan') as HTMLInputElement).value,
    monthly_price_eur:Number((card.querySelector('.os-price') as HTMLInputElement).value||0),
    seats_limit:Number((card.querySelector('.os-seats') as HTMLInputElement).value||1),
    conversations_limit:(card.querySelector('.os-conv') as HTMLInputElement).value||null,
    ai_requests_limit:(card.querySelector('.os-req') as HTMLInputElement).value||null,
    status:'active',
    modules:moduleConfig
  })});
  await openSaas();
}

async function toggleCard(card:HTMLElement,action:string){
  await api({method:'POST',body:JSON.stringify({organization_id:card.dataset.org,action})});
  await openSaas();
}

async function openSaas(){
  let overlay=document.getElementById('orixeo-saas-overlay') as HTMLElement|null;
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='orixeo-saas-overlay';overlay.className='os-overlay';
    overlay.innerHTML='<div class="os-shell"></div>';document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  const shell=overlay.querySelector('.os-shell') as HTMLElement;
  shell.innerHTML='<p class="os-loading">Chargement…</p>';
  try{
    const data=await api();
    shell.innerHTML=render(data);
    shell.querySelector('#os-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
    shell.querySelectorAll('.os-client').forEach(card=>{
      card.querySelector('.os-save')?.addEventListener('click',()=>void saveCard(card as HTMLElement));
      const toggle=card.querySelector('.os-toggle') as HTMLElement|null;
      toggle?.addEventListener('click',()=>void toggleCard(card as HTMLElement,toggle.dataset.action!));
    });
  }catch(e:any){shell.innerHTML='<p class="os-error">'+esc(e?.message||e)+'</p>';}
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-saas-link')) return false;
  const a=document.createElement('a');a.id='orixeo-saas-link';a.innerHTML='◫ <span>Administration SaaS</span>';
  a.addEventListener('click',()=>void openSaas());nav.appendChild(a);return true;
}
if(!mount()){const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});}
