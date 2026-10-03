import { createClient } from '@supabase/supabase-js';
import './customer-success.css';

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

function render(data:any){
  const s=data.summary||{}, clients=data.clients||[], opps=data.opportunities||[];
  return `
    <div class="cs-header">
      <div><small>ORIXEO LAB</small><h2>Customer Success Center</h2><p>Adoption, satisfaction, blocages et développement client</p></div>
      <button id="cs-close">×</button>
    </div>
    <div class="cs-kpis">
      <article><span>Clients</span><b>${esc(s.clients??0)}</b></article>
      <article><span>Sains</span><b>${esc(s.healthy??0)}</b></article>
      <article><span>À surveiller</span><b>${esc(s.watch??0)}</b></article>
      <article><span>À risque</span><b>${esc(s.at_risk??0)}</b></article>
      <article><span>Succès humain moyen</span><b>${s.avg_human_success==null?'—':esc(s.avg_human_success)+'/5'}</b></article>
      <article><span>Opportunités ouvertes</span><b>${esc(s.open_opportunities??0)}</b></article>
    </div>
    <div class="cs-list">
      ${clients.map((c:any)=>`
        <article class="cs-client" data-org="${esc(c.organization_id)}">
          <div class="cs-client-head">
            <div><b>${esc(c.name)}</b><span>Score adoption ${esc(c.adoption_health_score)}/100</span></div>
            <strong class="${Number(c.adoption_health_score)<50?'risk':Number(c.adoption_health_score)<75?'watch':'healthy'}">${esc(c.adoption_health_score)}</strong>
          </div>
          <div class="cs-metrics">
            <span>${esc(c.enabled_modules)} modules</span>
            <span>${esc(c.conversations_30d)} conversations / 30j</span>
            <span>${esc(c.ai_requests_30d)} requêtes IA / 30j</span>
            <span>${esc(c.active_users_30d)} utilisateur(s) actif(s)</span>
            <span>${esc(c.workflow_success_30d)} workflows réussis</span>
            <span>${esc(c.open_incidents)} incident(s)</span>
            <span>Sécurité ${esc(c.security_score)}/100</span>
            <span>Gouvernance ${esc(c.governance_score)}/100</span>
          </div>
          <div class="cs-human">
            <div><span>Satisfaction</span><b>${c.satisfaction_score==null?'—':esc(c.satisfaction_score)+'/5'}</b></div>
            <div><span>Valeur perçue</span><b>${c.value_score==null?'—':esc(c.value_score)+'/5'}</b></div>
            <div><span>Adoption déclarée</span><b>${esc(c.adoption_sentiment||'—')}</b></div>
            <div><span>Opportunités</span><b>${esc(c.open_opportunities??0)}</b></div>
          </div>
          <div class="cs-texts">
            <p><b>Gains :</b> ${esc(c.gains_text||'Non renseigné')}</p>
            <p><b>Blocages :</b> ${esc(c.blockers_text||'Non renseigné')}</p>
            <p><b>Prochaines actions :</b> ${esc(c.next_actions||'Non renseigné')}</p>
          </div>
          <details>
            <summary>Enregistrer un pulse client</summary>
            <form class="cs-pulse-form">
              <div class="cs-form-grid">
                <label>Satisfaction<select name="satisfaction"><option value="">—</option>${[1,2,3,4,5].map(x=>`<option value="${x}">${x}/5</option>`).join('')}</select></label>
                <label>Valeur perçue<select name="value"><option value="">—</option>${[1,2,3,4,5].map(x=>`<option value="${x}">${x}/5</option>`).join('')}</select></label>
                <label>Adoption<select name="sentiment"><option value="">—</option><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Forte</option></select></label>
              </div>
              <textarea name="gains" placeholder="Gains constatés"></textarea>
              <textarea name="blockers" placeholder="Blocages / irritants"></textarea>
              <textarea name="next" placeholder="Prochaines actions"></textarea>
              <button>Enregistrer le pulse</button>
            </form>
          </details>
          <details>
            <summary>Créer une opportunité d'extension</summary>
            <form class="cs-opp-form">
              <input name="title" placeholder="Titre de l'opportunité" required>
              <div class="cs-form-grid">
                <label>Type<select name="type"><option value="module">Module</option><option value="training">Formation</option><option value="automation">Automatisation</option><option value="governance">Gouvernance</option><option value="consulting">Conseil</option><option value="support">Support</option><option value="other">Autre</option></select></label>
                <label>Priorité<select name="priority"><option value="low">Basse</option><option value="normal" selected>Normale</option><option value="high">Haute</option></select></label>
                <label>Valeur estimée €<input name="value" type="number" min="0" step="0.01"></label>
              </div>
              <textarea name="rationale" placeholder="Pourquoi cette opportunité ?"></textarea>
              <textarea name="next_action" placeholder="Prochaine action"></textarea>
              <button>Créer l'opportunité</button>
            </form>
          </details>
        </article>`).join('')||'<p class="cs-empty">Aucun client.</p>'}
    </div>
    <section class="cs-card">
      <h3>Opportunités d'extension</h3>
      <div class="cs-opps">
        ${opps.map((o:any)=>`
          <article>
            <div><b>${esc(o.organization_name)} · ${esc(o.title)}</b><span>${esc(o.opportunity_type)} · ${esc(o.status)} · ${esc(o.priority)}</span></div>
            <p>${esc(o.rationale||'')}</p>
            <small>${o.estimated_value_eur==null?'Valeur non estimée':Number(o.estimated_value_eur).toFixed(2)+' €'}${o.next_action?' · '+esc(o.next_action):''}</small>
          </article>`).join('')||'<p class="cs-empty">Aucune opportunité.</p>'}
      </div>
    </section>`;
}

async function openCustomerSuccess(){
  let overlay=document.getElementById('orixeo-customer-success-overlay') as HTMLElement|null;
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='orixeo-customer-success-overlay';
    overlay.className='cs-overlay';
    overlay.innerHTML='<div class="cs-shell"></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  const shell=overlay.querySelector('.cs-shell') as HTMLElement;
  shell.innerHTML='<p class="cs-empty">Chargement…</p>';
  try{
    const data=await call('/customer-success');
    shell.innerHTML=render(data);
    shell.querySelector('#cs-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));

    shell.querySelectorAll('.cs-client').forEach(card=>{
      const org=(card as HTMLElement).dataset.org!;
      const pulse=card.querySelector('.cs-pulse-form') as HTMLFormElement|null;
      pulse?.addEventListener('submit',async e=>{
        e.preventDefault(); const fd=new FormData(pulse);
        await call('/customer-success/pulse',{method:'POST',body:JSON.stringify({
          organization_id:org,
          satisfaction_score:fd.get('satisfaction')||null,
          value_score:fd.get('value')||null,
          adoption_sentiment:fd.get('sentiment')||null,
          gains_text:String(fd.get('gains')||''),
          blockers_text:String(fd.get('blockers')||''),
          next_actions:String(fd.get('next')||'')
        })});
        await openCustomerSuccess();
      });

      const opp=card.querySelector('.cs-opp-form') as HTMLFormElement|null;
      opp?.addEventListener('submit',async e=>{
        e.preventDefault(); const fd=new FormData(opp);
        await call('/customer-success/opportunity',{method:'POST',body:JSON.stringify({
          organization_id:org,
          title:String(fd.get('title')||''),
          opportunity_type:String(fd.get('type')||'other'),
          priority:String(fd.get('priority')||'normal'),
          estimated_value_eur:fd.get('value')||null,
          rationale:String(fd.get('rationale')||''),
          next_action:String(fd.get('next_action')||'')
        })});
        await openCustomerSuccess();
      });
    });
  }catch(e:any){
    shell.innerHTML='<p class="cs-error">'+esc(e?.message||e)+'</p>';
  }
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-customer-success-link')) return false;
  const a=document.createElement('a');
  a.id='orixeo-customer-success-link';
  a.innerHTML='◎ <span>Customer Success</span>';
  a.addEventListener('click',()=>void openCustomerSuccess());
  nav.appendChild(a);
  return true;
}
if(!mount()){
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
