import { createClient, type Session } from '@supabase/supabase-js';
import './portal.css';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const apiBase=(import.meta.env.VITE_ORIXEO_API_URL||'https://supabase-mcp.msdg-innovation.fr/api/orixeo/v1').replace(/\/$/,'');
const root=document.getElementById('portal-root')!;

type PortalData=any;
let session:Session|null=null;
let selectedOrg:string|null=null;

function esc(v:any){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m] as string));}
function money(v:any,d=2){return Number(v||0).toFixed(d);}
async function api(path:string,options:any={}){
  if(!session?.access_token) throw new Error('Session expirée');
  const r=await fetch(apiBase+path,{
    ...options,
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,...(options.headers||{})}
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error||('Erreur '+r.status));
  return data;
}

function loginView(){
  root.innerHTML=`
    <main class="op-login">
      <section>
        <img src="/orixeo-logo.svg" alt="Orixeo Lab"/>
        <h1>Espace client</h1>
        <p>Accédez à vos leads, conversations et statistiques Sales AI.</p>
        <form id="op-login-form">
          <input type="email" name="email" placeholder="Email" required/>
          <input type="password" name="password" placeholder="Mot de passe" required/>
          <button>Se connecter</button>
        </form>
        <div id="op-login-error"></div>
      </section>
    </main>`;
  const form=root.querySelector('#op-login-form') as HTMLFormElement;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(form);
    const {error}=await supabase.auth.signInWithPassword({
      email:String(fd.get('email')||''),
      password:String(fd.get('password')||'')
    });
    const out=root.querySelector('#op-login-error')!;
    if(error) out.innerHTML='<p class="op-error">'+esc(error.message)+'</p>';
  });
}

async function acceptInviteIfPresent(){
  const params=new URLSearchParams(location.search);
  const invite=params.get('invite');
  if(!invite||!session) return;
  try{
    await api('/portal/accept',{method:'POST',body:JSON.stringify({invite_token:invite})});
    const clean=new URL(location.href);
    clean.searchParams.delete('invite');
    history.replaceState({},'',clean.pathname+clean.search);
  }catch(e:any){
    console.error('Invitation',e);
  }
}

function renderShell(data:PortalData){
  const org=data.organization;
  const stats=data.stats||{};
  const fin=data.financial||{};
  const leads=data.recent_leads||[];
  const convs=data.recent_conversations||[];
  const usage=data.usage||[];
  root.innerHTML=`
    <div class="op-shell">
      <aside class="op-side">
        <img src="/orixeo-logo.svg" alt="Orixeo Lab"/>
        <div class="op-org"><b>${esc(org.name)}</b><span>${esc(org.role)}</span></div>
        <nav>
          <a class="active">Vue d'ensemble</a>
          <a id="op-leads-link">Leads</a>
          <a id="op-convs-link">Conversations</a>
          <a id="op-usage-link">Usage IA</a>
        </nav>
        <button id="op-logout">Déconnexion</button>
      </aside>
      <main class="op-main">
        <header><div><small>ORIXEO SALES AI</small><h1>Espace client</h1><p>Suivi de votre activité commerciale assistée par IA</p></div></header>
        <section class="op-kpis">
          <article><span>Conversations</span><b>${esc(stats.conversations??0)}</b></article>
          <article><span>Leads</span><b>${esc(stats.leads??0)}</b></article>
          <article><span>Qualifiés</span><b>${esc(stats.qualified_leads??0)}</b></article>
          <article><span>Appels IA ce mois</span><b>${esc(stats.ai_calls_month??0)}</b></article>
          <article><span>Coût IA</span><b>$${money(fin.ai_cost_usd,3)}</b></article>
          <article><span>Budget consommé</span><b>${fin.budget_consumption_pct==null?'—':money(fin.budget_consumption_pct,1)+' %'}</b></article>
        </section>
        <section class="op-card" id="op-leads">
          <div class="op-title"><h2>Leads récents</h2><span>25 derniers</span></div>
          <div class="op-table">
            <div class="op-row op-head"><span>Contact</span><span>Entreprise</span><span>Besoin</span><span>Score</span><span>Statut</span></div>
            ${leads.map((l:any)=>`<div class="op-row"><span>${esc([l.first_name,l.last_name].filter(Boolean).join(' ')||l.email||'—')}</span><span>${esc(l.company||'—')}</span><span>${esc(l.need||'—')}</span><span>${esc(l.metadata?.lead_score??'—')}</span><span>${esc(l.status)}</span></div>`).join('')||'<p class="op-empty">Aucun lead.</p>'}
          </div>
        </section>
        <section class="op-grid">
          <div class="op-card" id="op-convs">
            <div class="op-title"><h2>Conversations</h2><span>Récentes</span></div>
            <div class="op-list">
              ${convs.map((c:any)=>`<button class="op-conv" data-id="${esc(c.id)}"><span>${new Date(c.started_at).toLocaleString('fr-FR')}</span><b>${esc(c.metadata?.recommended_offer||'Conversation')}</b><small>${esc(c.status)}</small></button>`).join('')||'<p class="op-empty">Aucune conversation.</p>'}
            </div>
          </div>
          <div class="op-card" id="op-usage">
            <div class="op-title"><h2>Usage IA</h2><span>Mois courant</span></div>
            <div class="op-list">
              ${usage.map((u:any)=>`<div class="op-usage-row"><div><b>${esc(u.model)}</b><small>${esc(u.provider)} · ${esc(u.ai_tier)}</small></div><span>${esc(u.requests)} appels</span><strong>$${money(u.cost_usd,4)}</strong></div>`).join('')||'<p class="op-empty">Aucune consommation.</p>'}
            </div>
          </div>
        </section>
        <section class="op-card op-finance">
          <div class="op-title"><h2>Budget IA</h2><span>${esc(fin.plan_name||'Plan client')}</span></div>
          <div class="op-fin-grid">
            <div><span>Budget inclus</span><b>$${money(fin.included_ai_budget_usd,2)}</b></div>
            <div><span>Coût actuel</span><b>$${money(fin.ai_cost_usd,4)}</b></div>
            <div><span>Restant</span><b>${fin.included_budget_remaining_usd==null?'—':'$'+money(fin.included_budget_remaining_usd,2)}</b></div>
            <div><span>Mode</span><b>${esc(fin.enforcement_mode||'observe')}</b></div>
          </div>
          <div class="op-progress"><div style="width:${Math.min(100,Math.max(0,Number(fin.budget_consumption_pct||0)))}%"></div></div>
        </section>
      </main>
      <div class="op-modal" id="op-modal"><div class="op-modal-card"><button id="op-modal-close">×</button><div id="op-modal-content"></div></div></div>
    </div>`;

  root.querySelector('#op-logout')?.addEventListener('click',()=>supabase.auth.signOut());
  root.querySelector('#op-leads-link')?.addEventListener('click',()=>document.querySelector('#op-leads')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-convs-link')?.addEventListener('click',()=>document.querySelector('#op-convs')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-usage-link')?.addEventListener('click',()=>document.querySelector('#op-usage')?.scrollIntoView({behavior:'smooth'}));
  root.querySelectorAll('.op-conv').forEach(btn=>btn.addEventListener('click',()=>void openConversation((btn as HTMLElement).dataset.id!)));
  root.querySelector('#op-modal-close')?.addEventListener('click',()=>root.querySelector('#op-modal')?.classList.remove('open'));
}

async function openConversation(id:string){
  if(!selectedOrg) return;
  try{
    const data=await api('/portal/conversation?organization_id='+encodeURIComponent(selectedOrg)+'&conversation_id='+encodeURIComponent(id));
    const content=root.querySelector('#op-modal-content')!;
    content.innerHTML=`
      <h2>Conversation</h2>
      <p class="op-muted">${new Date(data.conversation.started_at).toLocaleString('fr-FR')}</p>
      <div class="op-messages">${(data.messages||[]).map((m:any)=>`<div class="op-msg ${esc(m.role)}"><b>${esc(m.role)}</b><p>${esc(m.content||'')}</p><small>${new Date(m.created_at).toLocaleString('fr-FR')}</small></div>`).join('')}</div>`;
    root.querySelector('#op-modal')?.classList.add('open');
  }catch(e:any){alert(e?.message||e);}
}

async function loadPortal(){
  if(!session) return loginView();
  await acceptInviteIfPresent();
  try{
    const landing=await api('/portal/summary');
    const orgs=landing.organizations||[];
    if(!orgs.length){
      root.innerHTML=`<main class="op-login"><section><img src="/orixeo-logo.svg"/><h1>Aucun espace client</h1><p>Votre compte n'est encore rattaché à aucune organisation Orixeo.</p><button id="op-logout">Déconnexion</button></section></main>`;
      root.querySelector('#op-logout')?.addEventListener('click',()=>supabase.auth.signOut());
      return;
    }
    selectedOrg=orgs[0].organization_id;
    const data=await api('/portal/summary?organization_id='+encodeURIComponent(selectedOrg));
    renderShell(data);
  }catch(e:any){
    root.innerHTML='<main class="op-login"><section><h1>Erreur</h1><p class="op-error">'+esc(e?.message||e)+'</p></section></main>';
  }
}

supabase.auth.getSession().then(({data})=>{session=data.session;void loadPortal();});
supabase.auth.onAuthStateChange((_event,s)=>{session=s;void loadPortal();});
