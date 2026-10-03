import { createClient } from '@supabase/supabase-js';
import './finance-unit-economics.css';
import './product-adoption';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const apiBase=(import.meta.env.VITE_ORIXEO_API_URL||'https://supabase-mcp.msdg-innovation.fr/api/orixeo/v1').replace(/\/$/,'');

async function token(){const {data}=await supabase.auth.getSession();return data.session?.access_token||null;}
async function call(path:string,options:any={}){
  const t=await token(); if(!t) throw new Error('Session expirée');
  const r=await fetch(apiBase+path,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+t,...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error||('Erreur '+r.status));
  return data;
}
function esc(v:any){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m] as string));}
function money(v:any){return v==null?'—':Number(v).toFixed(2)+' €';}

function render(data:any){
  const s=data.summary||{}, clients=data.clients||[], costs=data.costs||[], assumptions=data.assumptions||[];
  return `
    <div class="fu-header">
      <div><small>ORIXEO LAB</small><h2>Finance & Unit Economics Center</h2><p>Coût complet, contribution, CAC, payback et LTV</p></div>
      <button id="fu-close">×</button>
    </div>

    <div class="fu-kpis">
      <article><span>Clients</span><b>${esc(s.clients??0)}</b></article>
      <article><span>MRR</span><b>${money(s.mrr_eur)}</b></article>
      <article><span>Coûts récurrents connus</span><b>${money(s.recurring_costs_eur)}</b></article>
      <article><span>Contribution connue</span><b>${money(s.known_contribution_eur)}</b></article>
      <article><span>Clients contribution calculable</span><b>${esc(s.known_contribution_clients??0)}</b></article>
    </div>

    <div class="fu-grid">
      <section class="fu-card">
        <h3>Saisir un coût</h3>
        <form id="fu-cost-form">
          <label>Client
            <select name="organization_id">
              <option value="">Coût mutualisé plateforme</option>
              ${clients.map((c:any)=>`<option value="${esc(c.organization_id)}">${esc(c.name)}</option>`).join('')}
            </select>
          </label>
          <div class="fu-form-grid">
            <label>Mois<input name="period_month" type="date" required></label>
            <label>Type<select name="cost_type"><option value="hosting">Hébergement</option><option value="support">Support</option><option value="human_time">Temps humain</option><option value="software">Logiciel</option><option value="sales">Commercial</option><option value="onboarding">Onboarding</option><option value="other">Autre</option></select></label>
            <label>Montant €<input name="amount_eur" type="number" min="0" step="0.01" required></label>
          </div>
          <div class="fu-form-grid">
            <label>Quantité<input name="quantity" type="number" min="0" step="0.01"></label>
            <label>Unité<input name="unit" placeholder="heures, mois, licences..."></label>
            <label>Taux horaire €<input name="hourly_rate_eur" type="number" min="0" step="0.01"></label>
          </div>
          <textarea name="description" placeholder="Description du coût"></textarea>
          <button>Enregistrer le coût</button>
        </form>
      </section>

      <section class="fu-card">
        <h3>Hypothèses Unit Economics</h3>
        <form id="fu-assumption-form">
          <label>Client
            <select name="organization_id" required>
              <option value="">Choisir un client</option>
              ${clients.map((c:any)=>`<option value="${esc(c.organization_id)}">${esc(c.name)}</option>`).join('')}
            </select>
          </label>
          <div class="fu-form-grid">
            <label>CAC €<input name="cac_eur" type="number" min="0" step="0.01"></label>
            <label>Durée de vie estimée (mois)<input name="expected_lifetime_months" type="number" min="0.1" step="0.1"></label>
            <label>Revenu setup €<input name="setup_revenue_eur" type="number" min="0" step="0.01"></label>
          </div>
          <div class="fu-form-grid">
            <label>Marge cible %<input name="gross_margin_target_pct" type="number" min="0" max="100" step="0.1"></label>
            <label>USD → EUR<input name="usd_to_eur_rate" type="number" min="0.000001" step="0.000001"></label>
          </div>
          <textarea name="notes" placeholder="Hypothèses / source / date"></textarea>
          <button>Enregistrer les hypothèses</button>
        </form>
      </section>
    </div>

    <section class="fu-card">
      <h3>Rentabilité par client</h3>
      <div class="fu-table">
        <div class="fu-row fu-head"><span>Client</span><span>MRR</span><span>Coûts récurrents</span><span>Coût IA €</span><span>Contribution</span><span>Marge contrib.</span><span>CAC</span><span>Payback</span><span>LTV revenu</span><span>LTV contrib.</span></div>
        ${clients.map((c:any)=>`<div class="fu-row">
          <span><b>${esc(c.name)}</b><small>${esc(c.plan_code||'—')}</small></span>
          <span>${money(c.mrr_eur)}</span>
          <span>${money(c.recurring_costs_eur)}</span>
          <span>${c.ai_cost_30d_eur==null?'—':money(c.ai_cost_30d_eur)}</span>
          <span>${c.contribution_after_ai_eur==null?'—':money(c.contribution_after_ai_eur)}</span>
          <span>${c.contribution_margin_pct==null?'—':esc(c.contribution_margin_pct)+' %'}</span>
          <span>${money(c.cac_eur)}</span>
          <span>${c.cac_payback_months==null?'—':esc(c.cac_payback_months)+' mois'}</span>
          <span>${money(c.revenue_ltv_eur)}</span>
          <span>${money(c.contribution_ltv_eur)}</span>
        </div>`).join('')||'<p class="fu-empty">Aucun client.</p>'}
      </div>
      <p class="fu-note">Les valeurs de contribution, payback et LTV restent vides tant que le taux USD/EUR et les hypothèses nécessaires ne sont pas renseignés. Les coûts mutualisés sont affectés à tous les clients dans cette première version.</p>
    </section>

    <div class="fu-grid">
      <section class="fu-card">
        <h3>Coûts enregistrés</h3>
        <div class="fu-list">
          ${costs.map((c:any)=>`<article><div><b>${esc(c.organization_name||'Plateforme')}</b><span>${esc(c.cost_type)} · ${esc(c.period_month)}</span></div><strong>${money(c.amount_eur)}</strong><p>${esc(c.description||'')}</p></article>`).join('')||'<p class="fu-empty">Aucun coût saisi.</p>'}
        </div>
      </section>
      <section class="fu-card">
        <h3>Hypothèses enregistrées</h3>
        <div class="fu-list">
          ${assumptions.map((a:any)=>`<article><div><b>${esc(a.organization_name)}</b><span>Mis à jour ${new Date(a.updated_at).toLocaleDateString('fr-FR')}</span></div><p>CAC ${money(a.cac_eur)} · Durée ${a.expected_lifetime_months??'—'} mois · FX ${a.usd_to_eur_rate??'—'}</p></article>`).join('')||'<p class="fu-empty">Aucune hypothèse.</p>'}
        </div>
      </section>
    </div>`;
}

async function openFinance(){
  let overlay=document.getElementById('orixeo-finance-overlay') as HTMLElement|null;
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='orixeo-finance-overlay';
    overlay.className='fu-overlay';
    overlay.innerHTML='<div class="fu-shell"></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  const shell=overlay.querySelector('.fu-shell') as HTMLElement;
  shell.innerHTML='<p class="fu-empty">Chargement…</p>';
  try{
    const data=await call('/finance');
    shell.innerHTML=render(data);
    shell.querySelector('#fu-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));

    const cf=shell.querySelector('#fu-cost-form') as HTMLFormElement;
    cf?.addEventListener('submit',async e=>{
      e.preventDefault(); const fd=new FormData(cf);
      await call('/finance/cost',{method:'POST',body:JSON.stringify({
        organization_id:String(fd.get('organization_id')||''),
        period_month:String(fd.get('period_month')||''),
        cost_type:String(fd.get('cost_type')||'other'),
        amount_eur:Number(fd.get('amount_eur')||0),
        quantity:fd.get('quantity')||null,
        unit:String(fd.get('unit')||''),
        hourly_rate_eur:fd.get('hourly_rate_eur')||null,
        description:String(fd.get('description')||'')
      })});
      await openFinance();
    });

    const af=shell.querySelector('#fu-assumption-form') as HTMLFormElement;
    af?.addEventListener('submit',async e=>{
      e.preventDefault(); const fd=new FormData(af);
      await call('/finance/assumption',{method:'POST',body:JSON.stringify({
        organization_id:String(fd.get('organization_id')||''),
        cac_eur:fd.get('cac_eur')||null,
        expected_lifetime_months:fd.get('expected_lifetime_months')||null,
        setup_revenue_eur:fd.get('setup_revenue_eur')||null,
        gross_margin_target_pct:fd.get('gross_margin_target_pct')||null,
        usd_to_eur_rate:fd.get('usd_to_eur_rate')||null,
        notes:String(fd.get('notes')||'')
      })});
      await openFinance();
    });
  }catch(e:any){
    shell.innerHTML='<p class="fu-error">'+esc(e?.message||e)+'</p>';
  }
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-finance-link')) return false;
  const a=document.createElement('a');
  a.id='orixeo-finance-link';
  a.innerHTML='€ <span>Finance & Unit Economics</span>';
  a.addEventListener('click',()=>void openFinance());
  nav.appendChild(a);
  return true;
}
if(!mount()){
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
