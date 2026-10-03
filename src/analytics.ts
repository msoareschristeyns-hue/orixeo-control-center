import { createClient } from '@supabase/supabase-js';
import './analytics.css';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const apiBase = (import.meta.env.VITE_ORIXEO_API_URL || 'https://supabase-mcp.msdg-innovation.fr/api/orixeo/v1').replace(/\/$/, '');

function money(v:any, digits=3){ return Number(v||0).toFixed(digits); }
function esc(v:any){ return String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m] as string)); }

async function getToken(){
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function fetchMetrics(){
  const token = await getToken();
  if(!token) throw new Error('Session expirée');
  const r = await fetch(apiBase + '/dashboard', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if(!r.ok) throw new Error('Analytics indisponible ('+r.status+')');
  return await r.json();
}

function render(data:any){
  const k=data?.kpis?.[0]||{};
  const usage=data?.usage||[];
  const recent=data?.recent||[];
  const leads=data?.leads_by_status||[];
  const financial=data?.financial||{};
  const alerts=data?.budget_alerts||[];
  const leadRows = leads.length
    ? leads.map((x:any)=>`<div class="oa-lead-row"><span>${esc(x.status)}</span><b>${esc(x.count)}</b></div>`).join('')
    : '<p class="oa-empty">Pas encore de leads enregistrés.</p>';

  const usageRows = usage.slice(0,12).map((u:any)=>`
    <div class="oa-table-row oa-usage-row">
      <span>${esc(u.provider)}</span>
      <span>${esc(u.model)}</span>
      <span><em>${esc(u.ai_tier)}</em></span>
      <span>${esc(u.requests)}</span>
      <span>${Number(u.total_tokens||0).toLocaleString('fr-FR')}</span>
      <span>$${money(u.cost_usd,4)}</span>
    </div>`).join('');

  const recentRows = recent.map((r:any)=>`
    <div class="oa-table-row oa-recent-row">
      <span>${new Date(r.created_at).toLocaleString('fr-FR')}</span>
      <span>${esc(r.provider)}</span>
      <span>${esc(r.model)}</span>
      <span>${esc(r.lead_score??'—')}</span>
      <span>${esc(r.recommended_offer||'—')}</span>
      <span>${esc(r.latency_ms??0)} ms</span>
      <span>$${money(r.cost_usd,4)}</span>
    </div>`).join('');

  return `
    <div class="oa-header">
      <div><small>ORIXEO LAB</small><h2>Sales AI Analytics</h2><p>Coûts IA, activité et performance commerciale</p></div>
      <div class="oa-header-actions"><button id="oa-refresh">↻ Actualiser</button><button id="oa-close">×</button></div>
    </div>
    <div class="oa-kpis">
      <article><span>Conversations</span><b>${esc(k.conversations??0)}</b></article>
      <article><span>Leads</span><b>${esc(k.leads??0)}</b></article>
      <article><span>Prioritaires</span><b>${esc(k.priority_conversations??0)}</b></article>
      <article><span>Coût IA</span><b>$${money(k.total_cost_usd)}</b></article>
      <article><span>Coût / lead</span><b>$${money(k.cost_per_lead_usd)}</b></article>
      <article><span>Score moyen</span><b>${esc(k.avg_lead_score??'—')}</b></article>
    </div>
    <div class="oa-finance">
      <section class="oa-card">
        <div class="oa-card-title"><h3>Pilotage financier</h3><span>${esc(financial.plan_name||'Non configuré')}</span></div>
        <div class="oa-finance-grid">
          <div><span>Abonnement mensuel</span><b>${money(financial.monthly_subscription_amount,2)} ${esc(financial.currency||'EUR')}</b></div>
          <div><span>Budget IA inclus</span><b>${money(financial.included_ai_budget_usd,2)}</b></div>
          <div><span>Coût IA courant</span><b>${money(financial.ai_cost_usd,4)}</b></div>
          <div><span>Budget consommé</span><b>${financial.budget_consumption_pct==null?'—':money(financial.budget_consumption_pct,1)+' %'}</b></div>
          <div><span>Marge avant infra</span><b>${financial.gross_margin_before_infra==null?'—':money(financial.gross_margin_before_infra,2)+' '+esc(financial.currency||'EUR')}</b></div>
          <div><span>Taux de marge</span><b>${financial.gross_margin_pct==null?'—':money(financial.gross_margin_pct,1)+' %'}</b></div>
        </div>
        <div class="oa-budget-line"><div style="width:${Math.min(100,Math.max(0,Number(financial.budget_consumption_pct||0)))}%"></div></div>
        <small>Mode de contrôle : ${esc(financial.enforcement_mode||'observe')} · action : ${esc(financial.soft_action||'none')}</small>
      </section>
      <section class="oa-card">
        <div class="oa-card-title"><h3>Alertes budget</h3><span>${alerts.length} récente(s)</span></div>
        <div class="oa-alerts">${alerts.length?alerts.slice(0,6).map((a:any)=>`<div class="oa-alert oa-alert-${esc(a.alert_type)}"><span>${esc(a.alert_type)}</span><b>${money(a.current_cost_usd,3)}</b><small>${new Date(a.created_at).toLocaleDateString('fr-FR')}</small></div>`).join(''):'<p class="oa-empty">Aucune alerte budgétaire.</p>'}</div>
      </section>
    </div>
    <div class="oa-grid">
      <section class="oa-card oa-wide">
        <div class="oa-card-title"><h3>Coûts par modèle</h3><span>Historique mensuel</span></div>
        <div class="oa-table">
          <div class="oa-table-head oa-usage-row"><span>Provider</span><span>Modèle</span><span>Tier</span><span>Requêtes</span><span>Tokens</span><span>Coût</span></div>
          ${usageRows || '<p class="oa-empty">Pas encore de consommation IA.</p>'}
        </div>
      </section>
      <section class="oa-card">
        <div class="oa-card-title"><h3>Leads</h3><span>Par statut</span></div>
        <div class="oa-leads">${leadRows}</div>
      </section>
    </div>
    <section class="oa-card">
      <div class="oa-card-title"><h3>Activité récente</h3><span>50 derniers appels IA</span></div>
      <div class="oa-table oa-scroll">
        <div class="oa-table-head oa-recent-row"><span>Date</span><span>Provider</span><span>Modèle</span><span>Score</span><span>Offre</span><span>Latence</span><span>Coût</span></div>
        ${recentRows || '<p class="oa-empty">Aucun appel IA enregistré.</p>'}
      </div>
    </section>`;
}

async function openAnalytics(){
  let overlay=document.getElementById('orixeo-analytics-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='orixeo-analytics-overlay';
    overlay.className='oa-overlay';
    overlay.innerHTML='<div class="oa-shell"><div class="oa-loading">Chargement des Analytics…</div></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  const shell=overlay.querySelector('.oa-shell') as HTMLElement;
  shell.innerHTML='<div class="oa-loading">Chargement des Analytics…</div>';
  try{
    const data=await fetchMetrics();
    shell.innerHTML=render(data);
    shell.querySelector('#oa-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
    shell.querySelector('#oa-refresh')?.addEventListener('click',()=>void openAnalytics());
  }catch(e:any){
    shell.innerHTML=`<div class="oa-error"><h3>Analytics indisponible</h3><p>${esc(e?.message||e)}</p><button id="oa-close">Fermer</button></div>`;
    shell.querySelector('#oa-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
  }
}

function mountLink(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav || document.getElementById('orixeo-analytics-link')) return false;
  const link=document.createElement('a');
  link.id='orixeo-analytics-link';
  link.innerHTML='▥ <span>Sales AI Analytics</span>';
  link.addEventListener('click',()=>void openAnalytics());
  nav.appendChild(link);
  return true;
}

if(!mountLink()){
  const observer=new MutationObserver(()=>{ if(mountLink()) observer.disconnect(); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
