import { createClient } from '@supabase/supabase-js';
import './billing.css';

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
function money(v:any,d=2){return Number(v||0).toFixed(d);}

function render(data:any){
  const t=data.totals||{},usage=data.usage||[],plans=data.plans||[],invoices=data.invoices||[];
  return `
    <div class="ob-header"><div><small>ORIXEO LAB</small><h2>Facturation SaaS</h2><p>Plans, dépassements et factures mensuelles</p></div><button id="ob-close">×</button></div>
    <div class="ob-kpis">
      <article><span>Brouillons</span><b>${esc(t.draft_invoices??0)}</b></article>
      <article><span>Émises</span><b>${esc(t.issued_invoices??0)}</b></article>
      <article><span>Payées</span><b>${esc(t.paid_invoices??0)}</b></article>
      <article><span>En retard</span><b>${esc(t.overdue_invoices??0)}</b></article>
      <article><span>Facturé</span><b>${money(t.invoiced_eur,2)} €</b></article>
      <article><span>Encaissé</span><b>${money(t.paid_eur,2)} €</b></article>
    </div>
    <div class="ob-grid">
      <section class="ob-card">
        <h3>Catalogue de plans</h3>
        <form id="ob-plan-form">
          <input name="plan_code" placeholder="starter" required>
          <input name="name" placeholder="Nom du plan" required>
          <input name="price" type="number" min="0" step="0.01" placeholder="Prix mensuel €">
          <input name="seats" type="number" min="1" value="1" placeholder="Sièges">
          <input name="conversations" type="number" min="0" placeholder="Conversations incluses">
          <input name="requests" type="number" min="0" placeholder="Requêtes IA incluses">
          <input name="conv_overage" type="number" min="0" step="0.001" placeholder="€ / conversation supp.">
          <input name="req_overage" type="number" min="0" step="0.001" placeholder="€ / requête IA supp.">
          <button>Enregistrer le plan</button>
        </form>
        <div class="ob-plan-list">
          ${plans.map((p:any)=>`<article><b>${esc(p.name)}</b><span>${esc(p.plan_code)}</span><strong>${money(p.monthly_price_eur)} € / mois</strong><small>${esc(p.included_seats)} siège(s) · ${p.included_conversations??'∞'} conv. · ${p.included_ai_requests??'∞'} req. IA</small></article>`).join('')||'<p class="ob-empty">Aucun plan commercial.</p>'}
        </div>
      </section>
      <section class="ob-card">
        <h3>Usage facturable du mois</h3>
        <div class="ob-usage-list">
          ${usage.map((u:any)=>`
            <article data-org="${esc(u.organization_id)}">
              <div><b>${esc(u.name)}</b><span>${esc(u.plan_code)} · ${esc(u.subscription_status)}</span></div>
              <div class="ob-usage-kpis">
                <span>Conv. ${esc(u.conversations_used)} / ${u.conversations_limit??'∞'}</span>
                <span>Req. IA ${esc(u.ai_requests_used)} / ${u.ai_requests_limit??'∞'}</span>
                <span>Dép. conv. ${esc(u.conversation_overage_qty)}</span>
                <span>Dép. IA ${esc(u.ai_request_overage_qty)}</span>
              </div>
              <div class="ob-invoice-create">
                <input class="ob-tax" type="number" min="0" max="100" step="0.1" value="0" placeholder="TVA %">
                <input class="ob-adjust" type="number" step="0.01" value="0" placeholder="Ajustement €">
                <button class="ob-generate">Créer facture brouillon</button>
              </div>
            </article>`).join('')||'<p class="ob-empty">Aucun usage facturable.</p>'}
        </div>
      </section>
    </div>
    <section class="ob-card">
      <h3>Historique des factures</h3>
      <div class="ob-invoice-table">
        <div class="ob-row ob-head"><span>N°</span><span>Client</span><span>Période</span><span>Statut</span><span>Sous-total</span><span>TVA</span><span>Total</span><span>Actions</span></div>
        ${invoices.map((i:any)=>`<div class="ob-row">
          <span>${esc(i.invoice_number)}</span><span>${esc(i.organization_name)}</span>
          <span>${new Date(i.period_start).toLocaleDateString('fr-FR')} → ${new Date(i.period_end).toLocaleDateString('fr-FR')}</span>
          <span>${esc(i.status)}</span><span>${money(i.subtotal_eur)} €</span><span>${money(i.tax_eur)} €</span><span><b>${money(i.total_eur)} €</b></span>
          <span class="ob-actions">
            ${i.status==='draft'?'<button data-id="'+esc(i.id)+'" data-action="issue">Émettre</button>':''}
            ${['issued','overdue'].includes(i.status)?'<button data-id="'+esc(i.id)+'" data-action="mark_paid">Marquer payée</button>':''}
            ${i.status!=='void'&&i.status!=='paid'?'<button data-id="'+esc(i.id)+'" data-action="void">Annuler</button>':''}
          </span>
        </div>`).join('')||'<p class="ob-empty">Aucune facture.</p>'}
      </div>
    </section>`;
}

async function openBilling(){
  let overlay=document.getElementById('orixeo-billing-overlay') as HTMLElement|null;
  if(!overlay){overlay=document.createElement('div');overlay.id='orixeo-billing-overlay';overlay.className='ob-overlay';overlay.innerHTML='<div class="ob-shell"></div>';document.body.appendChild(overlay);}
  overlay.classList.add('open');
  const shell=overlay.querySelector('.ob-shell') as HTMLElement;
  shell.innerHTML='<p class="ob-empty">Chargement…</p>';
  try{
    const data=await call('/billing');
    shell.innerHTML=render(data);
    shell.querySelector('#ob-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
    const form=shell.querySelector('#ob-plan-form') as HTMLFormElement;
    form.addEventListener('submit',async e=>{
      e.preventDefault();const fd=new FormData(form);
      await call('/billing/plan',{method:'POST',body:JSON.stringify({
        plan_code:String(fd.get('plan_code')||''),name:String(fd.get('name')||''),
        monthly_price_eur:Number(fd.get('price')||0),included_seats:Number(fd.get('seats')||1),
        included_conversations:fd.get('conversations')?Number(fd.get('conversations')):null,
        included_ai_requests:fd.get('requests')?Number(fd.get('requests')):null,
        overage_conversation_eur:Number(fd.get('conv_overage')||0),overage_ai_request_eur:Number(fd.get('req_overage')||0)
      })});
      await openBilling();
    });
    shell.querySelectorAll('.ob-usage-list article').forEach(card=>{
      card.querySelector('.ob-generate')?.addEventListener('click',async()=>{
        await call('/billing/invoice',{method:'POST',body:JSON.stringify({
          organization_id:(card as HTMLElement).dataset.org,
          period_start:new Date().toISOString().slice(0,7)+'-01',
          tax_rate_pct:Number((card.querySelector('.ob-tax') as HTMLInputElement).value||0),
          adjustments_eur:Number((card.querySelector('.ob-adjust') as HTMLInputElement).value||0)
        })});
        await openBilling();
      });
    });
    shell.querySelectorAll('.ob-actions button').forEach(btn=>btn.addEventListener('click',async()=>{
      await call('/billing/invoice/action',{method:'POST',body:JSON.stringify({id:(btn as HTMLElement).dataset.id,action:(btn as HTMLElement).dataset.action})});
      await openBilling();
    }));
  }catch(e:any){shell.innerHTML='<p class="ob-error">'+esc(e?.message||e)+'</p>';}
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-billing-link')) return false;
  const a=document.createElement('a');a.id='orixeo-billing-link';a.innerHTML='€ <span>Facturation SaaS</span>';
  a.addEventListener('click',()=>void openBilling());nav.appendChild(a);return true;
}
if(!mount()){const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});}
