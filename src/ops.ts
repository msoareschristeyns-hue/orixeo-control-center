import { createClient } from '@supabase/supabase-js';
import './ops.css';

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
  const t=data.totals||{},services=data.services||[],clients=data.clients||[],events=data.events||[];
  return `
    <div class="oo-header"><div><small>ORIXEO LAB</small><h2>Supervision</h2><p>Services, incidents, latence et santé des clients</p></div><button id="oo-close">×</button></div>
    <div class="oo-kpis">
      <article><span>Clients critiques</span><b>${esc(t.critical_clients??0)}</b></article>
      <article><span>Clients en alerte</span><b>${esc(t.warning_clients??0)}</b></article>
      <article><span>Clients sains</span><b>${esc(t.healthy_clients??0)}</b></article>
      <article><span>Latence moyenne</span><b>${esc(t.avg_latency_ms??0)} ms</b></article>
      <article><span>Échec IA moyen</span><b>${esc(t.avg_ai_failure_rate_pct??0)} %</b></article>
    </div>
    <div class="oo-grid">
      <section class="oo-card">
        <h3>Services</h3>
        <div class="oo-services">
          ${services.map((s:any)=>`
            <article class="oo-service oo-${esc(s.status)}">
              <div><b>${esc(s.service_name)}</b><span>${esc(s.service_key)}</span></div>
              <strong>${esc(s.status)}</strong>
              <small>Dernier signal : ${new Date(s.last_seen_at).toLocaleString('fr-FR')}${s.version?' · v'+esc(s.version):''}</small>
            </article>`).join('')||'<p class="oo-empty">Aucun heartbeat reçu pour le moment.</p>'}
        </div>
      </section>
      <section class="oo-card">
        <h3>Santé clients</h3>
        <div class="oo-client-list">
          ${clients.map((c:any)=>`
            <article class="oo-client oo-${esc(c.health_status)}">
              <div><b>${esc(c.name)}</b><span>${esc(c.subscription_status)} · ${esc(c.deployment_status)}</span></div>
              <div class="oo-client-metrics">
                <span>Échecs IA ${esc(c.ai_failure_rate_pct)} %</span>
                <span>p95 ${esc(c.p95_latency_ms_24h)} ms</span>
                <span>Alertes ${esc(Number(c.open_critical_events||0)+Number(c.open_warning_events||0))}</span>
                <span>Budget ${c.budget_consumption_pct==null?'—':esc(c.budget_consumption_pct)+' %'}</span>
              </div>
              <strong>${esc(c.health_status)}</strong>
            </article>`).join('')||'<p class="oo-empty">Aucun tenant.</p>'}
        </div>
      </section>
    </div>
    <section class="oo-card">
      <h3>Incidents et alertes</h3>
      <div class="oo-events">
        ${events.map((e:any)=>`
          <article class="oo-event oo-${esc(e.severity)} ${e.resolved?'resolved':''}">
            <div>
              <b>${esc(e.title)}</b>
              <span>${esc(e.organization_name||'Plateforme')} · ${esc(e.event_type)} · ${esc(e.service_key||'')}</span>
              <p>${esc(e.message||'')}</p>
              <small>${new Date(e.created_at).toLocaleString('fr-FR')}${e.error_code?' · '+esc(e.error_code):''}${e.status_code?' · HTTP '+esc(e.status_code):''}</small>
            </div>
            <button data-id="${esc(e.id)}" data-action="${e.resolved?'reopen':'resolve'}">${e.resolved?'Rouvrir':'Résoudre'}</button>
          </article>`).join('')||'<p class="oo-empty">Aucun incident enregistré.</p>'}
      </div>
    </section>`;
}

async function openOps(){
  let overlay=document.getElementById('orixeo-ops-overlay') as HTMLElement|null;
  if(!overlay){overlay=document.createElement('div');overlay.id='orixeo-ops-overlay';overlay.className='oo-overlay';overlay.innerHTML='<div class="oo-shell"></div>';document.body.appendChild(overlay);}
  overlay.classList.add('open');
  const shell=overlay.querySelector('.oo-shell') as HTMLElement;
  shell.innerHTML='<p class="oo-empty">Chargement…</p>';
  try{
    const data=await call('/ops');
    shell.innerHTML=render(data);
    shell.querySelector('#oo-close')?.addEventListener('click',()=>overlay?.classList.remove('open'));
    shell.querySelectorAll('.oo-event button').forEach(btn=>btn.addEventListener('click',async()=>{
      await call('/ops/event',{method:'POST',body:JSON.stringify({id:(btn as HTMLElement).dataset.id,action:(btn as HTMLElement).dataset.action})});
      await openOps();
    }));
  }catch(e:any){shell.innerHTML='<p class="oo-error">'+esc(e?.message||e)+'</p>';}
}

function mount(){
  const nav=document.querySelector('.sidebar nav');
  if(!nav||document.getElementById('orixeo-ops-link')) return false;
  const a=document.createElement('a');a.id='orixeo-ops-link';a.innerHTML='◉ <span>Supervision</span>';
  a.addEventListener('click',()=>void openOps());nav.appendChild(a);return true;
}
if(!mount()){const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});}
