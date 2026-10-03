import { createClient } from '@supabase/supabase-js';
import './templates.css';

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
  const templates=data.templates||[], orgs=data.organizations||[], deps=data.deployments||[];
  return `
    <div class="td-header">
      <div><small>ORIXEO LAB</small><h2>Template & Deployment Center</h2><p>Déployer rapidement une configuration métier prête à l'emploi</p></div>
      <button id="td-close">×</button>
    </div>
    <div class="td-grid">
      <section class="td-card">
        <h3>Déployer un template</h3>
        <form id="td-form">
          <label>Client
            <select name="organization_id" required>
              <option value="">Choisir un tenant</option>
              ${orgs.map((o:any)=>`<option value="${esc(o.id)}">${esc(o.name)}${o.deployment_template?' · '+esc(o.deployment_template.name||o.deployment_template.key):''}</option>`).join('')}
            </select>
          </label>
          <label>Template métier
            <select name="template_key" id="td-template-select" required>
              <option value="">Choisir un template</option>
              ${templates.map((t:any)=>`<option value="${esc(t.template_key)}">${esc(t.name)}</option>`).join('')}
            </select>
          </label>
          <div id="td-preview" class="td-preview"><p>Sélectionne un template pour voir son contenu.</p></div>
          <button>Appliquer le template</button>
        </form>
      </section>
      <section class="td-card">
        <h3>Catalogue</h3>
        <div class="td-catalog">
          ${templates.map((t:any)=>`
            <article>
              <div><b>${esc(t.name)}</b><span>${esc(t.sector)} · v${esc(t.version)}</span></div>
              <p>${esc(t.description||'')}</p>
              <small>${esc(t.target_profile||'')}</small>
            </article>`).join('')||'<p class="td-empty">Aucun template.</p>'}
        </div>
      </section>
    </div>
    <section class="td-card">
      <h3>Historique des déploiements</h3>
      <div class="td-table">
        <div class="td-row td-head"><span>Date</span><span>Client</span><span>Template</span><span>Version</span><span>Statut</span><span>Briques appliquées</span><span>Déployé par</span></div>
        ${deps.map((d:any)=>`<div class="td-row">
          <span>${new Date(d.created_at).toLocaleString('fr-FR')}</span>
          <span>${esc(d.organization_name)}</span>
          <span>${esc(d.template_name)}</span>
          <span>${esc(d.template_version)}</span>
          <span>${esc(d.status)}</span>
          <span><code>${esc(JSON.stringify(d.applied_sections||{}))}</code></span>
          <span>${esc(d.deployed_by||'—')}</span>
        </div>`).join('')||'<p class="td-empty">Aucun déploiement de template.</p>'}
      </div>
    </section>`;
}

function preview(t:any){
  const modules=Object.entries(t?.module_config||{}).filter(([,v])=>v).map(([k])=>k);
  const workflows=Array.isArray(t?.workflow_config)?t.workflow_config:[];
  const docs=Array.isArray(t?.document_config)?t.document_config:[];
  return `
    <div class="td-preview-block"><span>Modules</span><b>${modules.length}</b><p>${modules.map(x=>esc(x)).join(', ')||'Aucun'}</p></div>
    <div class="td-preview-block"><span>Agent IA</span><b>${esc(t?.agent_config?.persona||'standard')}</b><p>${esc(t?.agent_config?.tone||'')}</p></div>
    <div class="td-preview-block"><span>Gouvernance</span><b>${esc(t?.governance_config?.baseline||'standard')}</b><p>Revue ${esc(t?.governance_config?.review_frequency_days||180)} jours</p></div>
    <div class="td-preview-block"><span>Workflows</span><b>${workflows.length}</b><p>${workflows.map((x:any)=>esc(x.name)).join(', ')||'Aucun'}</p></div>
    <div class="td-preview-block"><span>Documents</span><b>${docs.length}</b><p>${docs.map((x:any)=>esc(x.title)).join(', ')||'Aucun'}</p></div>
  `;
}

async function openTemplates(){
  let overlay=document.getElementById('orixeo-template-overlay') as HTMLElement|null;
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='orixeo-template-overlay';
    overlay.className='td-overlay';
    overlay.innerHTML='<div class="td-shell"></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  const shell=overlay.querySelector('.td-shell') as HTMLElement;
  shell.innerHTML='<p class="td-empty">Chargement…</p>';
  try{
    const data=await call('/templates');
    shell.innerHTML=render(data);
    shell.querySelector('#td-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));

    const select=shell.querySelector('#td-template-select') as HTMLSelectElement;
    const previewBox=shell.querySelector('#td-preview') as HTMLElement;
    select.addEventListener('change',()=>{
      const t=(data.templates||[]).find((x:any)=>x.template_key===select.value);
      previewBox.innerHTML=t?preview(t):'<p>Sélectionne un template pour voir son contenu.</p>';
    });

    const form=shell.querySelector('#td-form') as HTMLFormElement;
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const fd=new FormData(form);
      await call('/templates/apply',{
        method:'POST',
        body:JSON.stringify({
          organization_id:String(fd.get('organization_id')||''),
          template_key:String(fd.get('template_key')||'')
        })
      });
      await openTemplates();
    });
  }catch(e:any){
    shell.innerHTML='<p class="td-error">'+esc(e?.message||e)+'</p>';
  }
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-template-link')) return false;
  const a=document.createElement('a');
  a.id='orixeo-template-link';
  a.innerHTML='▦ <span>Template & Deployment</span>';
  a.addEventListener('click',()=>void openTemplates());
  nav.appendChild(a);
  return true;
}
if(!mount()){
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
