import { createClient } from '@supabase/supabase-js';
import './executive-portfolio.css';

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
function money(v:any){return Number(v||0).toFixed(2);}

function render(data:any){
  const s=data.summary||{}, clients=data.clients||[], priorities=data.priorities||[];
  return `
    <div class="ep-header">
      <div><small>ORIXEO LAB</small><h2>Executive Portfolio Center</h2><p>Vue dirigeant du portefeuille clients</p></div>
      <button id="ep-close">×</button>
    </div>

    <div class="ep-kpis">
      <article><span>Clients</span><b>${esc(s.clients??0)}</b></article>
      <article><span>MRR contractuel</span><b>${money(s.mrr_eur)} €</b></article>
      <article><span>Coût IA 30j</span><b>${Number(s.ai_cost_30d_usd||0).toFixed(4)} $</b></article>
      <article><span>Pipeline extension</span><b>${money(s.pipeline_eur)} €</b></article>
      <article><span>Clients à risque</span><b>${esc(s.at_risk??0)}</b></article>
      <article><span>Onboarding en cours</span><b>${esc(s.onboarding??0)}</b></article>
      <article><span>Portefeuille sain</span><b>${esc(s.healthy??0)}</b></article>
    </div>

    <section class="ep-card">
      <h3>Priorités dirigeant</h3>
      <div class="ep-priorities">
        ${priorities.map((p:any)=>`
          <article class="ep-priority ep-${esc(p.focus)}" data-org="${esc(p.organization_id)}">
            <div><b>${esc(p.name)}</b><span>${esc(p.focus)}</span></div>
            <div class="ep-tags">
              <span>Santé ${esc(p.executive_health_score)}/100</span>
              <span>Adoption ${esc(p.adoption_health_score??'—')}</span>
              <span>Sécurité ${esc(p.security_score??'—')}</span>
              <span>Gouvernance ${esc(p.governance_score??'—')}</span>
              <span>Incidents ${esc(p.open_incidents??0)}</span>
              <span>Opp. prioritaires ${esc(p.high_priority_opportunities??0)}</span>
            </div>
            <details>
              <summary>Créer une action portefeuille</summary>
              <form class="ep-note-form">
                <input name="title" value="Priorité portefeuille - ${esc(p.name)}">
                <textarea name="note" placeholder="Analyse / décision / point à traiter" required></textarea>
                <input name="next_action" placeholder="Prochaine action">
                <button>Créer l'action</button>
              </form>
            </details>
          </article>`).join('')||'<p class="ep-empty">Aucune priorité particulière.</p>'}
      </div>
    </section>

    <section class="ep-card">
      <h3>Portefeuille clients</h3>
      <div class="ep-table">
        <div class="ep-row ep-head"><span>Client</span><span>Plan</span><span>MRR</span><span>Santé</span><span>Focus</span><span>Adoption</span><span>Sécurité</span><span>Gouv.</span><span>Onboarding</span><span>Déploiement</span><span>Pipeline</span><span>Coût IA/MRR</span></div>
        ${clients.map((c:any)=>`<div class="ep-row">
          <span><b>${esc(c.name)}</b><small>${esc(c.slug)}</small></span>
          <span>${esc(c.plan_code||'—')}</span>
          <span>${money(c.mrr_eur)} €</span>
          <span><b>${esc(c.executive_health_score)}/100</b></span>
          <span>${esc(c.priority_focus)}</span>
          <span>${esc(c.adoption_health_score??'—')}</span>
          <span>${esc(c.security_score??'—')}</span>
          <span>${esc(c.governance_score??'—')}</span>
          <span>${esc(c.onboarding_status||'—')}</span>
          <span>${esc(c.deployment_status||'—')}</span>
          <span>${money(c.opportunity_pipeline_eur)} €</span>
          <span>${c.ai_cost_to_mrr_pct==null?'—':esc(c.ai_cost_to_mrr_pct)+' %'}</span>
        </div>`).join('')||'<p class="ep-empty">Aucun client.</p>'}
      </div>
      <p class="ep-note">Le ratio coût IA / MRR est un indicateur technique. Il ne correspond pas à une marge nette : hébergement, support et temps humain ne sont pas encore intégrés.</p>
    </section>`;
}

async function openExecutivePortfolio(){
  let overlay=document.getElementById('orixeo-executive-overlay') as HTMLElement|null;
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='orixeo-executive-overlay';
    overlay.className='ep-overlay';
    overlay.innerHTML='<div class="ep-shell"></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  const shell=overlay.querySelector('.ep-shell') as HTMLElement;
  shell.innerHTML='<p class="ep-empty">Chargement…</p>';
  try{
    const data=await call('/executive-portfolio');
    shell.innerHTML=render(data);
    shell.querySelector('#ep-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));

    shell.querySelectorAll('.ep-priority').forEach(card=>{
      const form=card.querySelector('.ep-note-form') as HTMLFormElement|null;
      form?.addEventListener('submit',async e=>{
        e.preventDefault();
        const fd=new FormData(form);
        await call('/executive-portfolio/note',{method:'POST',body:JSON.stringify({
          organization_id:(card as HTMLElement).dataset.org,
          title:String(fd.get('title')||'Priorité portefeuille'),
          note:String(fd.get('note')||''),
          next_action:String(fd.get('next_action')||'')
        })});
        await openExecutivePortfolio();
      });
    });
  }catch(e:any){
    shell.innerHTML='<p class="ep-error">'+esc(e?.message||e)+'</p>';
  }
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-executive-link')) return false;
  const a=document.createElement('a');
  a.id='orixeo-executive-link';
  a.innerHTML='◈ <span>Executive Portfolio</span>';
  a.addEventListener('click',()=>void openExecutivePortfolio());
  nav.appendChild(a);
  return true;
}
if(!mount()){
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
