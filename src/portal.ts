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
          <a class="active" id="op-today-link">Aujourd'hui</a>
          <a id="op-followups-link">Relances</a>
          <a id="op-crm-link">CRM</a>
          <a id="op-leads-link">Leads</a>
          <a id="op-convs-link">Conversations</a>
          <a id="op-access-link">Utilisateurs & accès</a>
          <a id="op-notifications-link">Notifications</a>
          <a id="op-workflow-link">Workflow Center</a>
          <a id="op-knowledge-link">Knowledge Center</a>
          <a id="op-governance-link">Gouvernance IA</a>
          <a id="op-review-link">Business Review</a>
          <a id="op-roi-link">ROI</a>
          <a id="op-reporting-link">Reporting</a>
          <a id="op-usage-link">Usage IA</a>
        </nav>
        <button id="op-logout">Déconnexion</button>
      </aside>
      <main class="op-main">
        <header><div><small>ORIXEO SALES AI</small><h1>Espace client</h1><p>Suivi de votre activité commerciale assistée par IA</p></div></header>
        <section class="op-card" id="op-today">
          <div class="op-title"><h2>Aujourd'hui</h2><span>Ordre recommandé</span></div>
          <div id="op-today-content"><p class="op-empty">Chargement des priorités…</p></div>
        </section>
        <section class="op-kpis">
          <article><span>Conversations</span><b>${esc(stats.conversations??0)}</b></article>
          <article><span>Leads</span><b>${esc(stats.leads??0)}</b></article>
          <article><span>Qualifiés</span><b>${esc(stats.qualified_leads??0)}</b></article>
          <article><span>Appels IA ce mois</span><b>${esc(stats.ai_calls_month??0)}</b></article>
          <article><span>Coût IA</span><b>$${money(fin.ai_cost_usd,3)}</b></article>
          <article><span>Budget consommé</span><b>${fin.budget_consumption_pct==null?'—':money(fin.budget_consumption_pct,1)+' %'}</b></article>
        </section>
        <section class="op-card" id="op-access">
          <div class="op-title"><h2>User & Access Center</h2><span>Utilisateurs, rôles & permissions</span></div>
          <div id="op-access-content"><p class="op-empty">Chargement des accès…</p></div>
        </section>
        <section class="op-card" id="op-notifications">
          <div class="op-title"><h2>Notification Center</h2><span>Alertes & acquittements</span></div>
          <div id="op-notifications-content"><p class="op-empty">Chargement des notifications…</p></div>
        </section>
        <section class="op-card" id="op-workflow">
          <div class="op-title"><h2>Workflow & Automation Center</h2><span>Règles, actions & historique</span></div>
          <div id="op-workflow-content"><p class="op-empty">Chargement des workflows…</p></div>
        </section>
        <section class="op-card" id="op-knowledge">
          <div class="op-title"><h2>Knowledge & Document Center</h2><span>Documents, versions & RAG</span></div>
          <div id="op-knowledge-content"><p class="op-empty">Chargement des documents…</p></div>
        </section>
        <section class="op-card" id="op-governance">
          <div class="op-title"><h2>Gouvernance IA</h2><span>Usages, outils, données & revues</span></div>
          <div id="op-governance-content"><p class="op-empty">Chargement de la gouvernance…</p></div>
        </section>
        <section class="op-card" id="op-review">
          <div class="op-title"><h2>Business Review mensuelle</h2><span>Synthèse & recommandations</span></div>
          <div id="op-review-content"><p class="op-empty">Chargement des Business Reviews…</p></div>
        </section>
        <section class="op-card" id="op-roi">
          <div class="op-title"><h2>ROI client</h2><span>Gains mesurés & hypothèses</span></div>
          <div id="op-roi-content"><p class="op-empty">Chargement du ROI…</p></div>
        </section>
        <section class="op-card" id="op-reporting">
          <div class="op-title"><h2>Reporting commercial</h2><span>Conversion & performance</span></div>
          <div id="op-reporting-content"><p class="op-empty">Chargement du reporting…</p></div>
        </section>
        <section class="op-card" id="op-followups">
          <div class="op-title"><h2>Relances prioritaires</h2><span>Détection intelligente</span></div>
          <div class="op-followup-toolbar"><button id="op-refresh-followups">Actualiser la détection</button></div>
          <div id="op-followup-list"><p class="op-empty">Chargement des relances…</p></div>
        </section>
        <section class="op-card" id="op-crm">
          <div class="op-title"><h2>Pipeline commercial</h2><span>Sales AI CRM</span></div>
          <div id="op-crm-board"><p class="op-empty">Chargement du pipeline…</p></div>
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
  root.querySelector('#op-today-link')?.addEventListener('click',()=>document.querySelector('#op-today')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-followups-link')?.addEventListener('click',()=>document.querySelector('#op-followups')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-crm-link')?.addEventListener('click',()=>document.querySelector('#op-crm')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-leads-link')?.addEventListener('click',()=>document.querySelector('#op-leads')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-convs-link')?.addEventListener('click',()=>document.querySelector('#op-convs')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-access-link')?.addEventListener('click',()=>document.querySelector('#op-access')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-notifications-link')?.addEventListener('click',()=>document.querySelector('#op-notifications')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-workflow-link')?.addEventListener('click',()=>document.querySelector('#op-workflow')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-knowledge-link')?.addEventListener('click',()=>document.querySelector('#op-knowledge')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-governance-link')?.addEventListener('click',()=>document.querySelector('#op-governance')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-review-link')?.addEventListener('click',()=>document.querySelector('#op-review')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-roi-link')?.addEventListener('click',()=>document.querySelector('#op-roi')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-reporting-link')?.addEventListener('click',()=>document.querySelector('#op-reporting')?.scrollIntoView({behavior:'smooth'}));
  root.querySelector('#op-usage-link')?.addEventListener('click',()=>document.querySelector('#op-usage')?.scrollIntoView({behavior:'smooth'}));
  root.querySelectorAll('.op-conv').forEach(btn=>btn.addEventListener('click',()=>void openConversation((btn as HTMLElement).dataset.id!)));
  void loadToday();
  void loadAccessCenter();
  void loadNotifications();
  void loadWorkflow();
  void loadKnowledge();
  void loadGovernance();
  void loadBusinessReviews();
  void loadRoi();
  void loadReporting();
  void loadFollowups();
  void loadCrmBoard();
  root.querySelector('#op-modal-close')?.addEventListener('click',()=>root.querySelector('#op-modal')?.classList.remove('open'));
  root.querySelector('#op-refresh-followups')?.addEventListener('click',()=>void refreshFollowups());
}












async function loadAccessCenter(){
  if(!selectedOrg) return;
  const box=root.querySelector('#op-access-content') as HTMLElement|null;
  if(!box) return;
  try{
    const data=await api('/portal/access?organization_id='+encodeURIComponent(selectedOrg));
    const members=data.members||[], invites=data.invites||[], modules=(data.modules||[]).filter((m:any)=>m.enabled);
    const canAdmin=['owner','admin'].includes(data.organization?.role);

    box.innerHTML=`
      <section class="op-report-card">
        <h3>Membres</h3>
        <div class="op-access-list">
          ${members.map((m:any)=>`
            <article class="op-access-member ${m.active?'':'disabled'}" data-user="${esc(m.user_id)}">
              <div class="op-access-head">
                <div><b>${esc(m.email||m.user_id)}</b><span>${esc(m.role)} · ${m.active?'actif':'désactivé'}</span></div>
                <small>Dernière connexion : ${m.last_sign_in_at?new Date(m.last_sign_in_at).toLocaleString('fr-FR'):'—'}</small>
              </div>
              <div class="op-access-controls">
                <label>Rôle
                  <select class="op-access-role" ${canAdmin?'':'disabled'}>
                    ${['owner','admin','builder','operator','viewer','member'].map(r=>`<option value="${r}" ${m.role===r?'selected':''}>${r}</option>`).join('')}
                  </select>
                </label>
                <div class="op-access-modules">
                  ${modules.map((mod:any)=>{
                    const current=m.module_permissions?.[mod.module_key];
                    return `<label><input type="checkbox" class="op-access-module" data-module="${esc(mod.module_key)}" ${current===false?'':'checked'} ${canAdmin?'':'disabled'}> ${esc(mod.module_key.replaceAll('_',' '))}</label>`;
                  }).join('')}
                </div>
              </div>
              <div class="op-access-actions">
                <button class="op-access-save" ${canAdmin?'':'disabled'}>Enregistrer</button>
                <button class="op-access-toggle" data-action="${m.active?'deactivate':'activate'}" ${canAdmin?'':'disabled'}>${m.active?'Désactiver':'Réactiver'}</button>
              </div>
              ${m.disabled_reason?'<p class="op-access-reason">'+esc(m.disabled_reason)+'</p>':''}
            </article>`).join('')||'<p class="op-empty">Aucun membre.</p>'}
        </div>
      </section>

      <section class="op-report-card">
        <h3>Invitations</h3>
        <div class="op-access-invites">
          ${invites.map((i:any)=>`
            <article>
              <div><b>${esc(i.email)}</b><span>${esc(i.role)} · ${esc(i.status)}</span></div>
              <small>Expire le ${new Date(i.expires_at).toLocaleString('fr-FR')}</small>
              ${i.status==='pending'&&canAdmin?'<button class="op-invite-revoke" data-id="'+esc(i.id)+'">Révoquer</button>':''}
            </article>`).join('')||'<p class="op-empty">Aucune invitation.</p>'}
        </div>
      </section>`;

    box.querySelectorAll('.op-access-member').forEach(card=>{
      card.querySelector('.op-access-save')?.addEventListener('click',async()=>{
        const perms:any={};
        card.querySelectorAll('.op-access-module').forEach((x:any)=>perms[x.dataset.module]=x.checked);
        await api('/portal/access/update?organization_id='+encodeURIComponent(selectedOrg!),{
          method:'POST',
          body:JSON.stringify({
            user_id:(card as HTMLElement).dataset.user,
            action:'update',
            role:(card.querySelector('.op-access-role') as HTMLSelectElement).value,
            module_permissions:perms
          })
        });
        await loadAccessCenter();
      });
      const toggle=card.querySelector('.op-access-toggle') as HTMLElement|null;
      toggle?.addEventListener('click',async()=>{
        await api('/portal/access/update?organization_id='+encodeURIComponent(selectedOrg!),{
          method:'POST',
          body:JSON.stringify({user_id:(card as HTMLElement).dataset.user,action:toggle.dataset.action})
        });
        await loadAccessCenter();
      });
    });

    box.querySelectorAll('.op-invite-revoke').forEach(btn=>btn.addEventListener('click',async()=>{
      await api('/portal/access/invite/revoke?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({invite_id:(btn as HTMLElement).dataset.id})
      });
      await loadAccessCenter();
    }));
  }catch(e:any){
    box.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function loadNotifications(){
  if(!selectedOrg) return;
  const box=root.querySelector('#op-notifications-content') as HTMLElement|null;
  if(!box) return;
  try{
    const data=await api('/portal/notifications?organization_id='+encodeURIComponent(selectedOrg));
    const s=data.summary||{}, notifications=data.notifications||[];

    box.innerHTML=`
      <div class="op-notif-kpis">
        <div><span>Total</span><b>${esc(s.total??0)}</b></div>
        <div><span>Non lues</span><b>${esc(s.unread??0)}</b></div>
        <div><span>Critiques</span><b>${esc(s.critical??0)}</b></div>
      </div>
      <div class="op-notif-toolbar">
        <select id="op-notif-category">
          <option value="">Toutes les catégories</option>
          <option value="commercial">Commercial</option>
          <option value="security">Sécurité</option>
          <option value="budget">Budget</option>
          <option value="governance">Gouvernance</option>
          <option value="workflow">Workflow</option>
          <option value="operations">Supervision</option>
          <option value="system">Système</option>
        </select>
        <select id="op-notif-priority">
          <option value="">Toutes les priorités</option>
          <option value="critical">Critique</option>
          <option value="high">Haute</option>
          <option value="normal">Normale</option>
          <option value="low">Basse</option>
        </select>
      </div>
      <div id="op-notif-list" class="op-notif-list"></div>`;

    const list=box.querySelector('#op-notif-list') as HTMLElement;
    const renderList=()=>{
      const category=(box.querySelector('#op-notif-category') as HTMLSelectElement).value;
      const priority=(box.querySelector('#op-notif-priority') as HTMLSelectElement).value;
      const filtered=notifications.filter((n:any)=>(!category||n.category===category)&&(!priority||n.priority===priority));
      list.innerHTML=filtered.map((n:any)=>`
        <article class="op-notif-item op-priority-${esc(n.priority)} ${n.status!=='unread'?'is-read':''}">
          <div class="op-notif-main">
            <div><b>${esc(n.title)}</b><span>${esc(n.category)} · ${esc(n.priority)} · ${esc(n.status)}</span></div>
            <p>${esc(n.message||'')}</p>
            <small>${new Date(n.created_at).toLocaleString('fr-FR')}${n.source_type?' · '+esc(n.source_type):''}</small>
          </div>
          <div class="op-notif-actions">
            ${n.status==='unread'?'<button data-action="read" data-id="'+esc(n.id)+'">Lu</button>':''}
            ${n.status!=='acknowledged'?'<button data-action="acknowledge" data-id="'+esc(n.id)+'">Acquitter</button>':''}
            ${n.status!=='dismissed'?'<button data-action="dismiss" data-id="'+esc(n.id)+'">Ignorer</button>':''}
          </div>
        </article>`).join('')||'<p class="op-empty">Aucune notification.</p>';

      list.querySelectorAll('.op-notif-actions button').forEach(btn=>btn.addEventListener('click',async()=>{
        await api('/portal/notifications/action?organization_id='+encodeURIComponent(selectedOrg!),{
          method:'POST',
          body:JSON.stringify({id:(btn as HTMLElement).dataset.id,action:(btn as HTMLElement).dataset.action})
        });
        await loadNotifications();
      }));
    };
    renderList();
    box.querySelector('#op-notif-category')?.addEventListener('change',renderList);
    box.querySelector('#op-notif-priority')?.addEventListener('change',renderList);
  }catch(e:any){
    box.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function loadWorkflow(){
  if(!selectedOrg) return;
  const box=root.querySelector('#op-workflow-content') as HTMLElement|null;
  if(!box) return;
  try{
    const data=await api('/portal/workflows?organization_id='+encodeURIComponent(selectedOrg));
    const rules=data.rules||[], runs=data.runs||[];
    const canAdmin=['owner','admin','builder'].includes(data.organization?.role);
    const canRun=['owner','admin','builder','operator'].includes(data.organization?.role);

    box.innerHTML=`
      <div class="op-workflow-toolbar">
        <button id="op-workflow-seed" ${canAdmin?'':'disabled'}>Charger les modèles</button>
        <button id="op-workflow-run-all" ${canRun?'':'disabled'}>Exécuter maintenant</button>
      </div>

      <div class="op-workflow-grid">
        <section class="op-report-card">
          <h3>Créer une règle</h3>
          <form id="op-workflow-form" class="op-gov-form">
            <input name="name" placeholder="Nom de la règle" required ${canAdmin?'':'disabled'}>
            <textarea name="description" placeholder="Description" ${canAdmin?'':'disabled'}></textarea>
            <label>Déclencheur
              <select name="trigger" ${canAdmin?'':'disabled'}>
                <option value="lead_qualified">Lead qualifié</option>
                <option value="followup_due">Relance échue</option>
                <option value="budget_threshold">Budget IA</option>
                <option value="governance_review_due">Revue gouvernance échue</option>
                <option value="document_approved">Document approuvé</option>
                <option value="schedule">Planifié</option>
              </select>
            </label>
            <label>Action
              <select name="action" ${canAdmin?'':'disabled'}>
                <option value="create_task">Créer une tâche</option>
                <option value="create_followup">Créer une relance</option>
                <option value="create_alert">Créer une alerte</option>
                <option value="refresh_rag">Rafraîchir le RAG</option>
                <option value="create_security_event">Créer un événement sécurité</option>
                <option value="create_note">Créer une note</option>
              </select>
            </label>
            <input name="cooldown" type="number" min="0" value="60" placeholder="Cooldown en minutes" ${canAdmin?'':'disabled'}>
            <textarea name="condition" placeholder='Condition JSON, ex. {"threshold_pct":90}' ${canAdmin?'':'disabled'}></textarea>
            <textarea name="config" placeholder='Action JSON, ex. {"severity":"warning"}' ${canAdmin?'':'disabled'}></textarea>
            <label><input name="enabled" type="checkbox" checked ${canAdmin?'':'disabled'}> Active</label>
            <button ${canAdmin?'':'disabled'}>Créer la règle</button>
          </form>
        </section>

        <section class="op-report-card">
          <h3>Règles actives & modèles</h3>
          <div class="op-workflow-rules">
            ${rules.map((r:any)=>`
              <article class="op-workflow-rule ${r.enabled?'enabled':'disabled'}">
                <div><b>${esc(r.name)}</b><span>${r.metadata?.template?'modèle · ':''}${r.enabled?'active':'inactive'}</span></div>
                <p>${esc(r.description||'')}</p>
                <div class="op-workflow-tags">
                  <span>${esc(r.trigger_key)}</span>
                  <span>→</span>
                  <span>${esc(r.action_key)}</span>
                  <span>cooldown ${esc(r.cooldown_minutes)} min</span>
                </div>
                <div class="op-workflow-actions">
                  <button class="op-workflow-toggle" data-id="${esc(r.id)}" data-enabled="${r.enabled?'false':'true'}" ${canAdmin?'':'disabled'}>${r.enabled?'Désactiver':'Activer'}</button>
                  <button class="op-workflow-run" data-id="${esc(r.id)}" ${canRun?'':'disabled'}>Exécuter</button>
                </div>
              </article>`).join('')||'<p class="op-empty">Aucune règle. Charge les modèles ou crée la première règle.</p>'}
          </div>
        </section>
      </div>

      <section class="op-report-card">
        <h3>Historique d'exécution</h3>
        <div class="op-workflow-runs">
          ${runs.map((r:any)=>`
            <article class="op-workflow-run-row op-${esc(r.status)}">
              <div><b>${esc(r.rule_name)}</b><span>${esc(r.trigger_key)} · ${esc(r.status)}</span></div>
              <small>${new Date(r.started_at).toLocaleString('fr-FR')}${r.entity_type?' · '+esc(r.entity_type):''}</small>
              <p>${r.error_message?esc(r.error_message):esc(JSON.stringify(r.output||{}))}</p>
            </article>`).join('')||'<p class="op-empty">Aucune exécution enregistrée.</p>'}
        </div>
      </section>`;

    const form=box.querySelector('#op-workflow-form') as HTMLFormElement|null;
    form?.addEventListener('submit',async e=>{
      e.preventDefault();
      const fd=new FormData(form);
      let condition={}, config={};
      try{condition=JSON.parse(String(fd.get('condition')||'{}'));}catch{}
      try{config=JSON.parse(String(fd.get('config')||'{}'));}catch{}
      await api('/portal/workflows/rule?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({
          name:String(fd.get('name')||''),
          description:String(fd.get('description')||''),
          trigger_key:String(fd.get('trigger')||'schedule'),
          action_key:String(fd.get('action')||'create_alert'),
          cooldown_minutes:Number(fd.get('cooldown')||60),
          condition_json:condition,
          action_config:config,
          enabled:fd.get('enabled')==='on'
        })
      });
      await loadWorkflow();
    });

    box.querySelector('#op-workflow-seed')?.addEventListener('click',async()=>{
      await api('/portal/workflows/seed?organization_id='+encodeURIComponent(selectedOrg!),{method:'POST',body:'{}'});
      await loadWorkflow();
    });

    box.querySelector('#op-workflow-run-all')?.addEventListener('click',async()=>{
      await api('/portal/workflows/run?organization_id='+encodeURIComponent(selectedOrg!),{method:'POST',body:'{}'});
      await loadWorkflow();
    });

    box.querySelectorAll('.op-workflow-run').forEach(btn=>btn.addEventListener('click',async()=>{
      await api('/portal/workflows/run?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({rule_id:(btn as HTMLElement).dataset.id})
      });
      await loadWorkflow();
    }));

    box.querySelectorAll('.op-workflow-toggle').forEach(btn=>btn.addEventListener('click',async()=>{
      const id=(btn as HTMLElement).dataset.id!;
      const current=rules.find((r:any)=>r.id===id);
      if(!current) return;
      await api('/portal/workflows/rule?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({...current,enabled:(btn as HTMLElement).dataset.enabled==='true'})
      });
      await loadWorkflow();
    }));
  }catch(e:any){
    box.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function loadKnowledge(){
  if(!selectedOrg) return;
  const box=root.querySelector('#op-knowledge-content') as HTMLElement|null;
  if(!box) return;
  try{
    const [data,gov]=await Promise.all([
      api('/portal/knowledge?organization_id='+encodeURIComponent(selectedOrg)),
      api('/portal/governance?organization_id='+encodeURIComponent(selectedOrg))
    ]);
    const docs=data.documents||[], links=data.links||[], useCases=gov.use_cases||[];
    const canWrite=['owner','admin','builder','operator'].includes(data.organization?.role);
    const canApprove=['owner','admin','builder'].includes(data.organization?.role);

    box.innerHTML=`
      <div class="op-knowledge-grid">
        <section class="op-report-card">
          <h3>Nouveau document / nouvelle version</h3>
          <form id="op-knowledge-form" class="op-gov-form">
            <input name="title" placeholder="Titre du document" required ${canWrite?'':'disabled'}>
            <textarea name="content" placeholder="Contenu texte à intégrer au Knowledge Center" ${canWrite?'':'disabled'}></textarea>
            <input name="storage_path" placeholder="Chemin fichier serveur / Storage (optionnel)" ${canWrite?'':'disabled'}>
            <input name="mime_type" value="text/plain" placeholder="MIME type" ${canWrite?'':'disabled'}>
            <select name="document_id" ${canWrite?'':'disabled'}>
              <option value="">Créer un nouveau document</option>
              ${docs.map((d:any)=>`<option value="${esc(d.id)}">Nouvelle version de ${esc(d.title)}</option>`).join('')}
            </select>
            <button ${canWrite?'':'disabled'}>Créer la version</button>
          </form>
        </section>

        <section class="op-report-card">
          <h3>Rattacher un document</h3>
          <form id="op-knowledge-link-form" class="op-gov-form">
            <select name="document_id" required ${canWrite?'':'disabled'}>
              <option value="">Choisir un document</option>
              ${docs.map((d:any)=>`<option value="${esc(d.id)}">${esc(d.title)}</option>`).join('')}
            </select>
            <select name="use_case_id" ${canWrite?'':'disabled'}>
              <option value="">Aucun cas d'usage</option>
              ${useCases.map((u:any)=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}
            </select>
            <select name="link_type" ${canWrite?'':'disabled'}>
              <option value="reference">Référence</option>
              <option value="evidence">Preuve</option>
              <option value="procedure">Procédure</option>
              <option value="charter">Charte</option>
              <option value="meeting_note">Compte rendu</option>
              <option value="training">Formation</option>
              <option value="other">Autre</option>
            </select>
            <button ${canWrite?'':'disabled'}>Créer le rattachement</button>
          </form>
        </section>
      </div>

      <section class="op-report-card">
        <h3>Documents et versions courantes</h3>
        <div class="op-knowledge-list">
          ${docs.map((d:any)=>{
            const docLinks=links.filter((l:any)=>l.document_id===d.id);
            return `
            <article class="op-knowledge-doc">
              <div class="op-knowledge-head">
                <div><b>${esc(d.title)}</b><span>${esc(d.source_type)} · ${esc(d.status)}</span></div>
                <div><strong>v${esc(d.version_number??'—')}</strong><span>${esc(d.version_status||'sans version')}</span></div>
              </div>
              <div class="op-knowledge-meta">
                <span>RAG ${d.rag_enabled?'activé':'désactivé'}</span>
                <span>${esc(d.mime_type||'—')}</span>
                <span>${d.file_size_bytes?esc(d.file_size_bytes)+' octets':'texte / taille inconnue'}</span>
                <span>Maj ${new Date(d.updated_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <div class="op-knowledge-links">
                ${docLinks.map((l:any)=>`<span>${esc(l.link_type)}${l.governance_use_case_name?' · '+esc(l.governance_use_case_name):''}</span>`).join('')||'<span>Aucun rattachement métier</span>'}
              </div>
              ${canApprove && d.version_id && d.version_status!=='approved'?`
                <div class="op-knowledge-actions">
                  <button class="op-knowledge-approve" data-version="${esc(d.version_id)}" data-rag="false">Approuver</button>
                  <button class="op-knowledge-approve op-rag" data-version="${esc(d.version_id)}" data-rag="true">Approuver + RAG</button>
                </div>`:''}
            </article>`}).join('')||'<p class="op-empty">Aucun document.</p>'}
        </div>
      </section>`;

    const form=box.querySelector('#op-knowledge-form') as HTMLFormElement|null;
    form?.addEventListener('submit',async e=>{
      e.preventDefault();
      const fd=new FormData(form);
      const content=String(fd.get('content')||'');
      await api('/portal/knowledge/document?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({
          document_id:String(fd.get('document_id')||''),
          title:String(fd.get('title')||''),
          content_text:content,
          storage_path:String(fd.get('storage_path')||''),
          mime_type:String(fd.get('mime_type')||'text/plain'),
          file_size_bytes:content?new Blob([content]).size:null
        })
      });
      await loadKnowledge();
    });

    const linkForm=box.querySelector('#op-knowledge-link-form') as HTMLFormElement|null;
    linkForm?.addEventListener('submit',async e=>{
      e.preventDefault();
      const fd=new FormData(linkForm);
      await api('/portal/knowledge/link?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({
          document_id:String(fd.get('document_id')||''),
          governance_use_case_id:String(fd.get('use_case_id')||''),
          link_type:String(fd.get('link_type')||'reference')
        })
      });
      await loadKnowledge();
    });

    box.querySelectorAll('.op-knowledge-approve').forEach(btn=>btn.addEventListener('click',async()=>{
      await api('/portal/knowledge/approve?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({
          version_id:(btn as HTMLElement).dataset.version,
          rag_enabled:(btn as HTMLElement).dataset.rag==='true'
        })
      });
      await loadKnowledge();
    }));
  }catch(e:any){
    box.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function loadGovernance(){
  if(!selectedOrg) return;
  const box=root.querySelector('#op-governance-content') as HTMLElement|null;
  if(!box) return;
  try{
    const data=await api('/portal/governance?organization_id='+encodeURIComponent(selectedOrg));
    const o=data.overview||{}, useCases=data.use_cases||[], tools=data.tools||[], reviews=data.reviews||[];
    const canWrite=['owner','admin','builder','operator'].includes(data.organization?.role);
    const canReview=['owner','admin','builder'].includes(data.organization?.role);
    box.innerHTML=`
      <div class="op-gov-kpis">
        <div><span>Score gouvernance</span><b>${esc(o.governance_score??100)}/100</b></div>
        <div><span>Cas d'usage</span><b>${esc(o.total_use_cases??0)}</b></div>
        <div><span>Approuvés</span><b>${esc(o.approved_use_cases??0)}</b></div>
        <div><span>Risque élevé</span><b>${esc(o.high_risk_use_cases??0)}</b></div>
        <div><span>Revues échues</span><b>${esc(o.overdue_reviews??0)}</b></div>
        <div><span>Outils suivis</span><b>${esc(o.total_tools??0)}</b></div>
      </div>

      <div class="op-gov-grid">
        <section class="op-report-card">
          <h3>Ajouter un cas d'usage IA</h3>
          <form id="op-gov-usecase-form" class="op-gov-form">
            <input name="name" placeholder="Nom du cas d'usage" required ${canWrite?'':'disabled'}>
            <input name="process" placeholder="Processus métier" ${canWrite?'':'disabled'}>
            <input name="purpose" placeholder="Finalité" ${canWrite?'':'disabled'}>
            <input name="system" placeholder="Outil / système IA" ${canWrite?'':'disabled'}>
            <div class="op-gov-fields">
              <label>Risque<select name="risk" ${canWrite?'':'disabled'}><option>low</option><option>medium</option><option>high</option><option>prohibited</option></select></label>
              <label>Données<select name="sensitivity" ${canWrite?'':'disabled'}><option>public</option><option selected>internal</option><option>confidential</option><option>personal</option><option>sensitive</option></select></label>
              <label>Fréquence revue (jours)<input name="frequency" type="number" min="1" value="180" ${canWrite?'':'disabled'}></label>
            </div>
            <textarea name="oversight" placeholder="Contrôle humain / validation" ${canWrite?'':'disabled'}></textarea>
            <button ${canWrite?'':'disabled'}>Ajouter au registre</button>
          </form>
        </section>

        <section class="op-report-card">
          <h3>Politique outils × données</h3>
          <form id="op-gov-tool-form" class="op-gov-form">
            <input name="tool" placeholder="Ex. ChatGPT Enterprise" required ${canWrite?'':'disabled'}>
            <input name="provider" placeholder="Fournisseur" ${canWrite?'':'disabled'}>
            <label>Décision<select name="decision" ${canWrite?'':'disabled'}><option value="allow">Autorisé</option><option value="review" selected>À valider</option><option value="restrict">Restreint</option><option value="deny">Interdit</option></select></label>
            <input name="levels" value="public,internal" placeholder="Niveaux autorisés, séparés par des virgules" ${canWrite?'':'disabled'}>
            <textarea name="conditions" placeholder="Conditions d'utilisation" ${canWrite?'':'disabled'}></textarea>
            <button ${canWrite?'':'disabled'}>Enregistrer la politique</button>
          </form>
        </section>
      </div>

      <section class="op-report-card">
        <h3>Registre des usages IA</h3>
        <div class="op-gov-list">
          ${useCases.map((u:any)=>`
            <article class="op-gov-usecase">
              <div>
                <b>${esc(u.name)}</b>
                <span>${esc(u.business_process||'—')} · ${esc(u.status)}</span>
              </div>
              <div class="op-gov-tags">
                <span>Risque ${esc(u.risk_level)}</span>
                <span>Données ${esc(u.data_sensitivity)}</span>
                <span>Outil ${esc(u.ai_system||'—')}</span>
                <span>Prochaine revue ${u.next_review_at?new Date(u.next_review_at).toLocaleDateString('fr-FR'):'—'}</span>
              </div>
              <p>${esc(u.purpose||u.description||'')}</p>
              ${canReview && !['retired','rejected'].includes(u.status)?`
                <div class="op-gov-review">
                  <select data-review-decision>
                    <option value="approve">Approuver</option>
                    <option value="approve_with_conditions">Approuver avec conditions</option>
                    <option value="restrict">Restreindre</option>
                    <option value="reject">Rejeter</option>
                    <option value="retire">Retirer</option>
                  </select>
                  <input data-review-notes placeholder="Note de revue">
                  <button class="op-gov-review-btn" data-id="${esc(u.id)}">Valider la revue</button>
                </div>`:''}
            </article>`).join('')||'<p class="op-empty">Aucun cas d’usage IA enregistré.</p>'}
        </div>
      </section>

      <div class="op-gov-grid">
        <section class="op-report-card">
          <h3>Outils autorisés / interdits</h3>
          <div class="op-gov-tools">
            ${tools.map((t:any)=>`<article class="op-gov-tool op-gov-${esc(t.decision)}"><div><b>${esc(t.tool_name)}</b><span>${esc(t.provider||'')}</span></div><strong>${esc(t.decision)}</strong><small>Données : ${esc((t.allowed_data_levels||[]).join(', '))}</small><p>${esc(t.conditions||'')}</p></article>`).join('')||'<p class="op-empty">Aucune politique outil.</p>'}
          </div>
        </section>
        <section class="op-report-card">
          <h3>Historique des revues</h3>
          <div class="op-timeline">
            ${reviews.map((r:any)=>`<article><b>${esc(r.use_case_name)}</b><p>${esc(r.decision)}${r.notes?' · '+esc(r.notes):''}</p><small>${new Date(r.reviewed_at).toLocaleString('fr-FR')}</small></article>`).join('')||'<p class="op-empty">Aucune revue.</p>'}
          </div>
        </section>
      </div>`;

    const ucForm=box.querySelector('#op-gov-usecase-form') as HTMLFormElement|null;
    ucForm?.addEventListener('submit',async e=>{
      e.preventDefault(); const fd=new FormData(ucForm);
      await api('/portal/governance/use-case?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({
          name:String(fd.get('name')||''),
          business_process:String(fd.get('process')||''),
          purpose:String(fd.get('purpose')||''),
          ai_system:String(fd.get('system')||''),
          risk_level:String(fd.get('risk')||'low'),
          data_sensitivity:String(fd.get('sensitivity')||'internal'),
          review_frequency_days:Number(fd.get('frequency')||180),
          human_oversight:String(fd.get('oversight')||''),
          status:'draft'
        })
      });
      await loadGovernance();
    });

    const toolForm=box.querySelector('#op-gov-tool-form') as HTMLFormElement|null;
    toolForm?.addEventListener('submit',async e=>{
      e.preventDefault(); const fd=new FormData(toolForm);
      const levels=String(fd.get('levels')||'').split(',').map(v=>v.trim()).filter(Boolean);
      await api('/portal/governance/tool?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({
          tool_name:String(fd.get('tool')||''),
          provider:String(fd.get('provider')||''),
          decision:String(fd.get('decision')||'review'),
          allowed_data_levels:levels,
          conditions:String(fd.get('conditions')||'')
        })
      });
      await loadGovernance();
    });

    box.querySelectorAll('.op-gov-review-btn').forEach(btn=>btn.addEventListener('click',async()=>{
      const article=btn.closest('.op-gov-usecase')!;
      const decision=(article.querySelector('[data-review-decision]') as HTMLSelectElement).value;
      const notes=(article.querySelector('[data-review-notes]') as HTMLInputElement).value;
      await api('/portal/governance/review?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({use_case_id:(btn as HTMLElement).dataset.id,decision,notes})
      });
      await loadGovernance();
    }));
  }catch(e:any){
    box.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function loadBusinessReviews(){
  if(!selectedOrg) return;
  const box=root.querySelector('#op-review-content') as HTMLElement|null;
  if(!box) return;
  try{
    const data=await api('/portal/business-reviews?organization_id='+encodeURIComponent(selectedOrg));
    const reviews=data.reviews||[];
    box.innerHTML=`
      <div class="op-review-toolbar">
        <input id="op-review-month" type="month" value="${new Date().toISOString().slice(0,7)}"/>
        <button id="op-generate-review">Générer la revue</button>
      </div>
      <div class="op-review-list">
        ${reviews.map((r:any)=>{
          const f=r.metrics?.funnel||{},fin=r.metrics?.financial||{},roi=r.metrics?.roi||{};
          return `
          <article class="op-review-card">
            <div class="op-review-head">
              <div><b>${new Date(r.period_month).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</b><span>${esc(r.status)}</span></div>
              <small>${new Date(r.generated_at).toLocaleString('fr-FR')}</small>
            </div>
            <div class="op-review-kpis">
              <span>Chats <b>${esc(f.conversations??0)}</b></span>
              <span>Leads <b>${esc(f.leads??0)}</b></span>
              <span>RDV <b>${esc(f.meetings??0)}</b></span>
              <span>Prop. <b>${esc(f.proposals??0)}</b></span>
              <span>Gagnés <b>${esc(f.won??0)}</b></span>
              <span>Coût IA <b>${money(fin.ai_cost_usd,3)}</b></span>
              <span>ROI <b>${roi.roi_pct==null?'—':money(roi.roi_pct,1)+' %'}</b></span>
            </div>
            <section><h3>Synthèse</h3><p>${esc(r.executive_summary||'Aucune synthèse.')}</p></section>
            <div class="op-review-columns">
              <section><h3>Points forts</h3><ul>${(r.highlights||[]).map((x:any)=>`<li>${esc(x)}</li>`).join('')||'<li>Aucun point fort renseigné.</li>'}</ul></section>
              <section><h3>Risques</h3><ul>${(r.risks||[]).map((x:any)=>`<li>${esc(x)}</li>`).join('')||'<li>Aucun risque renseigné.</li>'}</ul></section>
              <section><h3>Recommandations</h3><ul>${(r.recommendations||[]).map((x:any)=>`<li>${esc(x)}</li>`).join('')||'<li>Aucune recommandation.</li>'}</ul></section>
            </div>
            <div class="op-review-actions">
              ${r.status==='draft'?'<button class="op-review-approve" data-id="'+esc(r.id)+'">Approuver</button>':''}
            </div>
          </article>`;
        }).join('')||'<p class="op-empty">Aucune Business Review générée.</p>'}
      </div>`;

    box.querySelector('#op-generate-review')?.addEventListener('click',async()=>{
      const month=(box.querySelector('#op-review-month') as HTMLInputElement).value;
      await api('/portal/business-reviews/generate?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({period_month:month+'-01'})
      });
      await loadBusinessReviews();
    });
    box.querySelectorAll('.op-review-approve').forEach(btn=>btn.addEventListener('click',async()=>{
      await api('/portal/business-reviews/approve?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({id:(btn as HTMLElement).dataset.id})
      });
      await loadBusinessReviews();
    }));
  }catch(e:any){
    box.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function loadRoi(){
  if(!selectedOrg) return;
  const box=root.querySelector('#op-roi-content') as HTMLElement|null;
  if(!box) return;
  try{
    const data=await api('/portal/roi?organization_id='+encodeURIComponent(selectedOrg));
    const s=data.summary||{},cases=data.use_cases||[],calc=data.calculations||[];
    const calcById=new Map(calc.map((x:any)=>[x.use_case_id,x]));
    box.innerHTML=`
      <div class="op-roi-kpis">
        <div><span>Heures gagnées</span><b>${s.hours_saved==null?'—':money(s.hours_saved,1)+' h'}</b></div>
        <div><span>Valeur temps</span><b>${s.time_value_eur==null?'—':money(s.time_value_eur,0)+' €'}</b></div>
        <div><span>Revenus additionnels</span><b>${s.additional_revenue_eur==null?'—':money(s.additional_revenue_eur,0)+' €'}</b></div>
        <div><span>Coûts évités</span><b>${s.avoided_cost_eur==null?'—':money(s.avoided_cost_eur,0)+' €'}</b></div>
        <div><span>Coût total</span><b>${s.total_cost_eur==null?'—':money(s.total_cost_eur,0)+' €'}</b></div>
        <div><span>Valeur nette</span><b>${s.net_value_eur==null?'—':money(s.net_value_eur,0)+' €'}</b></div>
        <div><span>ROI</span><b>${s.roi_pct==null?'—':money(s.roi_pct,1)+' %'}</b></div>
      </div>
      <div class="op-roi-grid">
        <section class="op-report-card">
          <h3>Ajouter un cas d’usage</h3>
          <form id="op-roi-form" class="op-roi-form">
            <input name="name" placeholder="Nom du cas d’usage" required/>
            <input name="category" placeholder="Catégorie" value="automation"/>
            <textarea name="description" placeholder="Description"></textarea>
            <div class="op-roi-fields">
              <label>Avant (min)<input name="baseline" type="number" min="0" step="0.1"/></label>
              <label>Après (min)<input name="current" type="number" min="0" step="0.1"/></label>
              <label>Occurrences/mois<input name="occurrences" type="number" min="0" step="0.1"/></label>
              <label>Coût horaire €<input name="hourly" type="number" min="0" step="0.1"/></label>
              <label>Revenus + €<input name="revenue" type="number" min="0" step="0.1" value="0"/></label>
              <label>Coûts évités €<input name="avoided" type="number" min="0" step="0.1" value="0"/></label>
              <label>Confiance %<input name="confidence" type="number" min="0" max="100" step="1" value="100"/></label>
            </div>
            <button type="submit">Ajouter le cas d’usage</button>
          </form>
        </section>
        <section class="op-report-card">
          <h3>Cas d’usage suivis</h3>
          <div class="op-roi-list">
            ${cases.map((u:any)=>{const r:any=calcById.get(u.id)||{};return `
              <article>
                <div><b>${esc(u.name)}</b><span>${esc(u.category)}</span></div>
                <p>${esc(u.description||'')}</p>
                <div class="op-roi-case-kpis">
                  <span>${r.hours_saved==null?'—':money(r.hours_saved,1)+' h gagnées'}</span>
                  <span>${r.confidence_adjusted_value_eur==null?'—':money(r.confidence_adjusted_value_eur,0)+' € valeur'}</span>
                  <span>${esc(u.confidence_pct)} % confiance</span>
                </div>
              </article>`}).join('')||'<p class="op-empty">Aucun cas d’usage suivi.</p>'}
          </div>
        </section>
      </div>`;
    const form=box.querySelector('#op-roi-form') as HTMLFormElement|null;
    form?.addEventListener('submit',async e=>{
      e.preventDefault();
      const fd=new FormData(form);
      await api('/portal/roi?organization_id='+encodeURIComponent(selectedOrg!),{
        method:'POST',
        body:JSON.stringify({
          name:String(fd.get('name')||''),
          category:String(fd.get('category')||'other'),
          description:String(fd.get('description')||''),
          baseline_minutes_per_occurrence:Number(fd.get('baseline')||0),
          current_minutes_per_occurrence:Number(fd.get('current')||0),
          occurrences_per_month:Number(fd.get('occurrences')||0),
          hourly_cost_eur:Number(fd.get('hourly')||0),
          additional_revenue_eur:Number(fd.get('revenue')||0),
          avoided_cost_eur:Number(fd.get('avoided')||0),
          confidence_pct:Number(fd.get('confidence')||100),
          source:'customer_portal'
        })
      });
      form.reset();
      await loadRoi();
    });
  }catch(e:any){
    box.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function loadReporting(){
  if(!selectedOrg) return;
  const box=root.querySelector('#op-reporting-content') as HTMLElement|null;
  if(!box) return;
  try{
    const data=await api('/portal/reporting?organization_id='+encodeURIComponent(selectedOrg));
    const h=data.headline||{},v=data.velocity||{},funnel=data.funnel||[],pipeline=data.pipeline||[],ai=data.ai_performance||[];
    box.innerHTML=`
      <div class="op-report-kpis">
        <div><span>Conversations</span><b>${esc(h.conversations??0)}</b></div>
        <div><span>Leads</span><b>${esc(h.leads??0)}</b></div>
        <div><span>RDV</span><b>${esc(h.meetings??0)}</b></div>
        <div><span>Propositions</span><b>${esc(h.proposals??0)}</b></div>
        <div><span>Gagnés</span><b>${esc(h.won??0)}</b></div>
        <div><span>Pipeline</span><b>${money(h.pipeline_value,0)} €</b></div>
        <div><span>CA gagné</span><b>${money(v.won_value,0)} €</b></div>
        <div><span>Coût IA</span><b>${money(h.ai_cost_usd,3)}</b></div>
      </div>
      <div class="op-report-grid">
        <section class="op-report-card">
          <h3>Entonnoir de conversion</h3>
          <div class="op-funnel">
            <div><span>Chat → Lead</span><b>${h.conversation_to_lead_pct==null?'—':money(h.conversation_to_lead_pct,1)+' %'}</b></div>
            <div><span>Lead → RDV</span><b>${h.lead_to_meeting_pct==null?'—':money(h.lead_to_meeting_pct,1)+' %'}</b></div>
            <div><span>RDV → Proposition</span><b>${h.meeting_to_proposal_pct==null?'—':money(h.meeting_to_proposal_pct,1)+' %'}</b></div>
            <div><span>Proposition → Gagné</span><b>${h.proposal_to_won_pct==null?'—':money(h.proposal_to_won_pct,1)+' %'}</b></div>
          </div>
        </section>
        <section class="op-report-card">
          <h3>Vitesse commerciale</h3>
          <div class="op-funnel">
            <div><span>Leads gagnés</span><b>${esc(v.won_leads??0)}</b></div>
            <div><span>Délai moyen gagné</span><b>${v.avg_days_to_win==null?'—':money(v.avg_days_to_win,1)+' j'}</b></div>
            <div><span>Âge moyen des leads</span><b>${v.avg_lead_age_days==null?'—':money(v.avg_lead_age_days,1)+' j'}</b></div>
          </div>
        </section>
      </div>
      <section class="op-report-card">
        <h3>Pipeline par stade</h3>
        <div class="op-report-table">
          <div class="op-report-head"><span>Stade</span><span>Leads</span><span>Valeur</span><span>Score moyen</span><span>Prioritaires</span></div>
          ${pipeline.map((x:any)=>`<div class="op-report-row"><span>${esc(x.stage)}</span><span>${esc(x.leads)}</span><span>${money(x.pipeline_value,0)} €</span><span>${esc(x.avg_lead_score??'—')}</span><span>${esc(x.high_priority??0)}</span></div>`).join('')||'<p class="op-empty">Aucune donnée de pipeline.</p>'}
        </div>
      </section>
      <section class="op-report-card">
        <h3>Performance IA</h3>
        <div class="op-report-table">
          <div class="op-report-head"><span>Provider</span><span>Modèle</span><span>Tier</span><span>Conversations</span><span>Leads</span><span>Gagnés</span><span>Coût IA</span></div>
          ${ai.map((x:any)=>`<div class="op-report-row op-report-row-ai"><span>${esc(x.provider)}</span><span>${esc(x.model)}</span><span>${esc(x.ai_tier)}</span><span>${esc(x.conversations)}</span><span>${esc(x.leads)}</span><span>${esc(x.won_leads)}</span><span>${money(x.ai_cost_usd,4)}</span></div>`).join('')||'<p class="op-empty">Aucune donnée IA.</p>'}
        </div>
      </section>
      <section class="op-report-card">
        <h3>Historique mensuel</h3>
        <div class="op-report-table">
          <div class="op-report-head"><span>Mois</span><span>Chats</span><span>Leads</span><span>RDV</span><span>Propositions</span><span>Gagnés</span></div>
          ${funnel.map((x:any)=>`<div class="op-report-row op-report-row-month"><span>${new Date(x.month).toLocaleDateString('fr-FR',{month:'short',year:'numeric'})}</span><span>${esc(x.conversations)}</span><span>${esc(x.leads)}</span><span>${esc(x.meetings)}</span><span>${esc(x.proposals)}</span><span>${esc(x.won)}</span></div>`).join('')||'<p class="op-empty">Aucun historique.</p>'}
        </div>
      </section>`;
  }catch(e:any){
    box.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function loadToday(){
  if(!selectedOrg) return;
  const box=root.querySelector('#op-today-content') as HTMLElement|null;
  if(!box) return;
  try{
    const data=await api('/portal/today?organization_id='+encodeURIComponent(selectedOrg));
    const s=data.summary||{},items=data.items||[];
    box.innerHTML=`
      <div class="op-today-kpis">
        <div><span>À traiter</span><b>${esc(s.total??0)}</b></div>
        <div><span>Urgent</span><b>${esc(s.urgent??0)}</b></div>
        <div><span>Relances</span><b>${esc(s.followups??0)}</b></div>
        <div><span>Tâches</span><b>${esc(s.overdue_tasks??0)}</b></div>
        <div><span>RDV</span><b>${esc(s.appointments??0)}</b></div>
        <div><span>Nouveaux leads</span><b>${esc(s.new_leads??0)}</b></div>
        <div><span>Propositions</span><b>${esc(s.proposals??0)}</b></div>
      </div>
      <div class="op-today-list">
        ${items.map((x:any,i:number)=>`
          <article class="op-today-item">
            <div class="op-rank">${i+1}</div>
            <div class="op-today-score">${esc(x.score)}</div>
            <div class="op-today-main">
              <b>${esc(x.title)}</b>
              <span>${esc(x.contact||'—')}${x.company?' · '+esc(x.company):''}</span>
              <small>${esc(x.type)} · ${esc(x.reason)}${x.due_at?' · '+new Date(x.due_at).toLocaleString('fr-FR'):''}</small>
            </div>
            <div class="op-today-actions">
              ${x.lead_id?`<button class="op-today-open" data-lead="${esc(x.lead_id)}">Ouvrir</button>`:''}
            </div>
          </article>`).join('')||'<p class="op-empty">Rien de prioritaire aujourd’hui.</p>'}
      </div>`;
    box.querySelectorAll('.op-today-open').forEach(btn=>btn.addEventListener('click',()=>void openLead((btn as HTMLElement).dataset.lead!)));
  }catch(e:any){
    box.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function loadFollowups(){
  if(!selectedOrg) return;
  const list=root.querySelector('#op-followup-list') as HTMLElement|null;
  if(!list) return;
  try{
    const data=await api('/portal/crm/followups?organization_id='+encodeURIComponent(selectedOrg));
    const items=data.items||[];
    list.innerHTML=items.length?'<div class="op-followups">'+items.map((x:any)=>`
      <article class="op-followup-card">
        <div class="op-followup-score"><b>${esc(x.priority_score)}</b><span>/100</span></div>
        <div class="op-followup-main">
          <b>${esc([x.first_name,x.last_name].filter(Boolean).join(' ')||x.email||'Sans nom')}</b>
          <span>${esc(x.company||'—')} · ${esc(x.stage||'new')}</span>
          <p>${esc(x.suggested_action)}</p>
          <small>${esc(x.reason)}${x.due_at?' · '+new Date(x.due_at).toLocaleString('fr-FR'):''}</small>
        </div>
        <div class="op-followup-actions">
          <button class="op-followup-open" data-lead="${esc(x.lead_id)}">Ouvrir</button>
          <button class="op-followup-done" data-id="${esc(x.id)}">Traité</button>
          <button class="op-followup-snooze" data-id="${esc(x.id)}">+3 jours</button>
          <button class="op-followup-dismiss" data-id="${esc(x.id)}">Ignorer</button>
        </div>
      </article>`).join('')+'</div>':'<p class="op-empty">Aucune relance prioritaire actuellement.</p>';
    list.querySelectorAll('.op-followup-open').forEach(btn=>btn.addEventListener('click',()=>void openLead((btn as HTMLElement).dataset.lead!)));
    list.querySelectorAll('.op-followup-done').forEach(btn=>btn.addEventListener('click',()=>void followupAction((btn as HTMLElement).dataset.id!,'done')));
    list.querySelectorAll('.op-followup-snooze').forEach(btn=>btn.addEventListener('click',()=>void followupAction((btn as HTMLElement).dataset.id!,'snooze')));
    list.querySelectorAll('.op-followup-dismiss').forEach(btn=>btn.addEventListener('click',()=>void followupAction((btn as HTMLElement).dataset.id!,'dismiss')));
  }catch(e:any){
    list.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function followupAction(id:string,action:string){
  if(!selectedOrg) return;
  await api('/portal/crm/followups/action?organization_id='+encodeURIComponent(selectedOrg),{
    method:'POST',
    body:JSON.stringify({id,action})
  });
  await loadFollowups();
}

async function refreshFollowups(){
  if(!selectedOrg) return;
  await api('/portal/crm/followups/refresh?organization_id='+encodeURIComponent(selectedOrg),{
    method:'POST',
    body:'{}'
  });
  await loadFollowups();
}

async function loadCrmBoard(){
  if(!selectedOrg) return;
  const board=root.querySelector('#op-crm-board') as HTMLElement|null;
  if(!board) return;
  try{
    const data=await api('/portal/crm/pipeline?organization_id='+encodeURIComponent(selectedOrg));
    const stages=['new','qualified','contacted','meeting','proposal','won','lost','nurture'];
    const labels:any={new:'Nouveau',qualified:'Qualifié',contacted:'Contacté',meeting:'Rendez-vous',proposal:'Proposition',won:'Gagné',lost:'Perdu',nurture:'À nourrir'};
    board.innerHTML='<div class="op-pipeline">'+stages.map(stage=>{
      const leads=(data.leads||[]).filter((l:any)=>l.stage===stage);
      return `<section class="op-stage"><header><b>${labels[stage]}</b><span>${leads.length}</span></header><div>${leads.map((l:any)=>`
        <button class="op-lead-card" data-id="${esc(l.id)}">
          <b>${esc([l.first_name,l.last_name].filter(Boolean).join(' ')||l.email||'Sans nom')}</b>
          <span>${esc(l.company||'—')}</span>
          <small>${esc(l.need||'—')}</small>
          <em>${esc(l.metadata?.lead_score??'—')}/100</em>
        </button>`).join('')||'<p class="op-empty">Aucun lead</p>'}</div></section>`;
    }).join('')+'</div>';
    board.querySelectorAll('.op-lead-card').forEach(btn=>btn.addEventListener('click',()=>void openLead((btn as HTMLElement).dataset.id!)));
  }catch(e:any){
    board.innerHTML='<p class="op-error">'+esc(e?.message||e)+'</p>';
  }
}

async function openLead(id:string){
  if(!selectedOrg) return;
  try{
    const data=await api('/portal/crm/lead?organization_id='+encodeURIComponent(selectedOrg)+'&lead_id='+encodeURIComponent(id));
    const l=data.lead||{};
    const notes=data.notes||[],tasks=data.tasks||[],activities=data.activities||[],appointments=data.appointments||[],communications=data.communications||[];
    const canWrite=['owner','admin','builder','operator'].includes(data.role);
    const content=root.querySelector('#op-modal-content')!;
    content.innerHTML=`
      <div class="op-lead-head">
        <div><small>LEAD</small><h2>${esc([l.first_name,l.last_name].filter(Boolean).join(' ')||l.email||'Sans nom')}</h2><p>${esc(l.company||'')}</p></div>
        <div><span>Score</span><b>${esc(l.metadata?.lead_score??'—')}/100</b></div>
      </div>
      <div class="op-lead-actions">
        <select id="op-stage-select" ${canWrite?'':'disabled'}>
          ${['new','qualified','contacted','meeting','proposal','won','lost','nurture'].map(s=>`<option value="${s}" ${(l.stage||'new')===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <button id="op-save-stage" ${canWrite?'':'disabled'}>Mettre à jour</button>
      </div>
      <div class="op-detail-grid">
        <section><h3>Coordonnées</h3><p>${esc(l.email||'—')}</p><p>${esc(l.phone||'—')}</p><p>${esc(l.need||'—')}</p></section>
        <section><h3>Valeur / priorité</h3><p>Priorité : ${esc(l.priority||'normal')}</p><p>Valeur : ${l.value_estimate==null?'—':money(l.value_estimate,2)+' '+esc(l.currency||'EUR')}</p><p>Prochaine action : ${l.next_action_at?new Date(l.next_action_at).toLocaleString('fr-FR'):'—'}</p></section>
      </div>
      <section class="op-comm-panel">
        <div class="op-title"><h3>Communication commerciale</h3><span>Validation humaine obligatoire</span></div>
        <div class="op-comm-generate">
          <select id="op-comm-type" ${canWrite?'':'disabled'}>
            <option value="first_contact">Premier contact</option>
            <option value="follow_up" selected>Relance</option>
            <option value="meeting_confirmation">Confirmation de rendez-vous</option>
            <option value="meeting_summary">Compte rendu de rendez-vous</option>
            <option value="proposal">Proposition</option>
            <option value="reply">Réponse</option>
            <option value="thank_you">Remerciement</option>
          </select>
          <input id="op-comm-instruction" placeholder="Instruction optionnelle pour l'IA" ${canWrite?'':'disabled'}/>
          <button id="op-generate-comm" ${canWrite?'':'disabled'}>Générer un brouillon</button>
        </div>
        <div class="op-communications">
          ${communications.map((m:any)=>`
            <article class="op-communication" data-id="${esc(m.id)}">
              <div><b>${esc(m.subject||'(sans objet)')}</b><span>${esc(m.communication_type)} · ${esc(m.status)}</span></div>
              <textarea class="op-comm-body" ${['sent','cancelled'].includes(m.status)||!canWrite?'disabled':''}>${esc(m.body_text||'')}</textarea>
              <div class="op-comm-actions">
                <button class="op-save-comm" ${['sent','cancelled'].includes(m.status)||!canWrite?'disabled':''}>Enregistrer</button>
                <button class="op-approve-comm" ${m.status==='draft'&&canWrite?'':'disabled'}>Approuver</button>
              </div>
            </article>`).join('')||'<p class="op-empty">Aucun brouillon.</p>'}
        </div>
      </section>
      <div class="op-crm-actions">
        <section><h3>Ajouter une note</h3><textarea id="op-note-text" placeholder="Compte rendu, échange, information utile…" ${canWrite?'':'disabled'}></textarea><button id="op-add-note" ${canWrite?'':'disabled'}>Ajouter</button></section>
        <section><h3>Créer une relance</h3><input id="op-task-title" placeholder="Ex. Rappeler le client" ${canWrite?'':'disabled'}/><input id="op-task-date" type="datetime-local" ${canWrite?'':'disabled'}/><button id="op-add-task" ${canWrite?'':'disabled'}>Créer</button></section>
        <section><h3>Planifier un rendez-vous</h3><input id="op-meeting-start" type="datetime-local" ${canWrite?'':'disabled'}/><input id="op-meeting-end" type="datetime-local" ${canWrite?'':'disabled'}/><button id="op-add-meeting" ${canWrite?'':'disabled'}>Planifier</button></section>
      </div>
      <div class="op-detail-grid">
        <section><h3>Notes</h3><div class="op-timeline">${notes.map((n:any)=>`<article><b>${esc(n.note_type)}</b><p>${esc(n.note)}</p><small>${new Date(n.created_at).toLocaleString('fr-FR')}</small></article>`).join('')||'<p class="op-empty">Aucune note.</p>'}</div></section>
        <section><h3>Tâches</h3><div class="op-timeline">${tasks.map((t:any)=>`<article><b>${esc(t.title)}</b><p>${esc(t.task_type)} · ${esc(t.priority)}</p><small>${t.due_at?new Date(t.due_at).toLocaleString('fr-FR'):'Sans échéance'} · ${esc(t.status)}</small>${t.status!=='done'&&canWrite?`<button class="op-task-done" data-task="${esc(t.id)}">Terminer</button>`:''}</article>`).join('')||'<p class="op-empty">Aucune tâche.</p>'}</div></section>
      </div>
      <section><h3>Historique</h3><div class="op-timeline">${activities.map((a:any)=>`<article><b>${esc(a.title)}</b><p>${esc(a.description||'')}</p><small>${new Date(a.created_at).toLocaleString('fr-FR')}</small></article>`).join('')||'<p class="op-empty">Aucune activité.</p>'}</div></section>
      <section><h3>Rendez-vous</h3><div class="op-timeline">${appointments.map((a:any)=>`<article><b>${new Date(a.starts_at).toLocaleString('fr-FR')}</b><p>${esc(a.status)}</p></article>`).join('')||'<p class="op-empty">Aucun rendez-vous.</p>'}</div></section>`;

    const modal=root.querySelector('#op-modal')!;
    modal.classList.add('open');

    const action=async(payload:any)=>{
      await api('/portal/crm/action?organization_id='+encodeURIComponent(selectedOrg!),{method:'POST',body:JSON.stringify({lead_id:id,...payload})});
      await openLead(id);
      await loadCrmBoard();
    };

    const commAction=async(path:string,payload:any)=>{
      await api(path+'?organization_id='+encodeURIComponent(selectedOrg!),{method:'POST',body:JSON.stringify(payload)});
      await openLead(id);
    };
    content.querySelector('#op-generate-comm')?.addEventListener('click',()=>void commAction('/portal/crm/communication/generate',{
      lead_id:id,
      communication_type:(content.querySelector('#op-comm-type') as HTMLSelectElement).value,
      instruction:(content.querySelector('#op-comm-instruction') as HTMLInputElement).value
    }));
    content.querySelectorAll('.op-communication').forEach(card=>{
      const commId=(card as HTMLElement).dataset.id!;
      const bodyEl=card.querySelector('.op-comm-body') as HTMLTextAreaElement;
      card.querySelector('.op-save-comm')?.addEventListener('click',()=>void commAction('/portal/crm/communication/update',{
        communication_id:commId,action:'save',body_text:bodyEl.value,subject:(card.querySelector('b')?.textContent||'')
      }));
      card.querySelector('.op-approve-comm')?.addEventListener('click',()=>void commAction('/portal/crm/communication/update',{
        communication_id:commId,action:'approve',body_text:bodyEl.value,subject:(card.querySelector('b')?.textContent||'')
      }));
    });

    content.querySelector('#op-save-stage')?.addEventListener('click',()=>void action({action:'stage',stage:(content.querySelector('#op-stage-select') as HTMLSelectElement).value}));
    content.querySelector('#op-add-note')?.addEventListener('click',()=>void action({action:'note',note:(content.querySelector('#op-note-text') as HTMLTextAreaElement).value}));
    content.querySelector('#op-add-task')?.addEventListener('click',()=>void action({action:'task',title:(content.querySelector('#op-task-title') as HTMLInputElement).value,due_at:(content.querySelector('#op-task-date') as HTMLInputElement).value||null}));
    content.querySelector('#op-add-meeting')?.addEventListener('click',()=>void action({action:'appointment',starts_at:(content.querySelector('#op-meeting-start') as HTMLInputElement).value,ends_at:(content.querySelector('#op-meeting-end') as HTMLInputElement).value}));
    content.querySelectorAll('.op-task-done').forEach(btn=>btn.addEventListener('click',()=>void action({action:'task_done',task_id:(btn as HTMLElement).dataset.task})));
  }catch(e:any){
    alert(e?.message||e);
  }
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
