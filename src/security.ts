import { createClient } from '@supabase/supabase-js';
import './security.css';

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
  const t=data.totals||{}, posture=data.posture||[], findings=data.findings||[], events=data.events||[];
  return `
    <div class="sc-header"><div><small>ORIXEO LAB</small><h2>Security Center</h2><p>Posture, accès, rôles, invitations et anomalies</p></div><button id="sc-close">×</button></div>
    <div class="sc-actions"><button id="sc-audit">Lancer l'audit sécurité</button></div>
    <div class="sc-kpis">
      <article><span>Score moyen</span><b>${esc(t.avg_score??100)}/100</b></article>
      <article><span>Tenants sains</span><b>${esc(t.healthy??0)}</b></article>
      <article><span>Alertes</span><b>${esc(t.warning??0)}</b></article>
      <article><span>Critiques</span><b>${esc(t.critical??0)}</b></article>
      <article><span>Tenants</span><b>${esc(t.tenants??0)}</b></article>
    </div>
    <section class="sc-card">
      <h3>Posture par tenant</h3>
      <div class="sc-posture">
        ${posture.map((p:any)=>`
          <article class="sc-tenant sc-${esc(p.security_status)}">
            <div class="sc-score">${esc(p.security_score)}</div>
            <div><b>${esc(p.name)}</b><span>${esc(p.security_status)}</span></div>
            <div class="sc-tags">
              <span>${esc(p.members)} utilisateur(s)</span>
              <span>${esc(p.privileged_members)} admin/owner</span>
              <span>${esc(p.expired_pending_invites)} invitation(s) expirée(s)</span>
              <span>${esc(p.warning_findings)} warning</span>
              <span>${esc(p.critical_findings)} critique(s)</span>
              <span>RLS manquant : ${esc(p.rls_missing)}</span>
            </div>
          </article>`).join('')||'<p class="sc-empty">Aucun tenant.</p>'}
      </div>
    </section>
    <section class="sc-card">
      <h3>Findings de sécurité</h3>
      <div class="sc-findings">
        ${findings.map((f:any)=>`
          <article class="sc-finding sc-${esc(f.severity)} ${f.status!=='open'?'closed':''}">
            <div>
              <b>${esc(f.title)}</b>
              <span>${esc(f.organization_name||'Plateforme')} · ${esc(f.category)} · ${esc(f.status)}</span>
              <p>${esc(f.description||'')}</p>
              <small>Correction : ${esc(f.remediation||'—')}</small>
            </div>
            <div class="sc-finding-actions">
              ${f.status==='open'?'<button data-id="'+esc(f.id)+'" data-action="resolve">Résolu</button><button data-id="'+esc(f.id)+'" data-action="accept">Accepter le risque</button>':'<button data-id="'+esc(f.id)+'" data-action="reopen">Rouvrir</button>'}
            </div>
          </article>`).join('')||'<p class="sc-empty">Aucun finding.</p>'}
      </div>
    </section>
    <section class="sc-card">
      <h3>Journal sécurité</h3>
      <div class="sc-events">
        ${events.map((e:any)=>`
          <article>
            <div><b>${esc(e.title)}</b><span>${esc(e.organization_name||'Plateforme')} · ${esc(e.event_type)} · ${esc(e.severity)}</span></div>
            <p>${esc(e.description||'')}</p>
            <small>${new Date(e.created_at).toLocaleString('fr-FR')}</small>
          </article>`).join('')||'<p class="sc-empty">Aucun événement de sécurité.</p>'}
      </div>
    </section>`;
}

async function openSecurity(){
  let overlay=document.getElementById('orixeo-security-overlay') as HTMLElement|null;
  if(!overlay){overlay=document.createElement('div');overlay.id='orixeo-security-overlay';overlay.className='sc-overlay';overlay.innerHTML='<div class="sc-shell"></div>';document.body.appendChild(overlay);}
  overlay.classList.add('open');
  const shell=overlay.querySelector('.sc-shell') as HTMLElement;
  shell.innerHTML='<p class="sc-empty">Chargement…</p>';
  try{
    const data=await call('/security');
    shell.innerHTML=render(data);
    shell.querySelector('#sc-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
    shell.querySelector('#sc-audit')?.addEventListener('click',async()=>{
      await call('/security/audit',{method:'POST',body:'{}'});
      await openSecurity();
    });
    shell.querySelectorAll('.sc-finding-actions button').forEach(btn=>btn.addEventListener('click',async()=>{
      await call('/security/finding',{method:'POST',body:JSON.stringify({id:(btn as HTMLElement).dataset.id,action:(btn as HTMLElement).dataset.action})});
      await openSecurity();
    }));
  }catch(e:any){shell.innerHTML='<p class="sc-error">'+esc(e?.message||e)+'</p>';}
}
function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-security-link')) return false;
  const a=document.createElement('a');a.id='orixeo-security-link';a.innerHTML='◆ <span>Security Center</span>';
  a.addEventListener('click',()=>void openSecurity());nav.appendChild(a);return true;
}
if(!mount()){const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});}
