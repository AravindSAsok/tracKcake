#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
const base = (process.env.TRACKCAKE_URL || 'https://trackcake.vercel.app').replace(/\/$/, '');
const query = 'milk coffee';
const providers = ['groq', 'gemini', 'openrouter'];
const rows = [];
const started = new Date().toISOString();
const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
const summarize = (items) => !Array.isArray(items) || !items.length ? '—' : items.map(x => [x.name, x.amount, x.calories + ' kcal', 'P ' + x.protein_g + 'g / C ' + x.carbs_g + 'g / F ' + x.fat_g + 'g'].join('; ')).join('; ');
async function save() {
  const success = rows.filter(x => x.status === 'success').length;
  const table = rows.map(x => '| ' + esc(x.provider) + ' | ' + esc(x.model) + ' | ' + esc(x.status) + ' | ' + (x.ms ?? '—') + ' | ' + esc(x.result) + ' | ' + esc(x.error) + ' |').join('\n');
  const md = '# TrackCake AI Model Benchmark\n\n- Query: ' + query + '\n- Target: ' + base + '\n- Started: ' + started + '\n- Updated: ' + new Date().toISOString() + '\n- Progress: ' + rows.length + ' entries; ' + success + ' successful; ' + (rows.length-success) + ' failed/unavailable\n- Protocol: exactly one estimate request per discovered model; sequential; no retries.\n- Latency includes TrackCake nutrition lookup, not only model generation.\n- Accuracy is a manual comparison against a consistent nutrition reference; one prompt is not a general accuracy proof.\n\n## Results\n\n| Provider | Model ID | Status | Latency (ms) | Saved result | Error / notes |\n|---|---|---|---:|---|---|\n' + (table || '| — | — | pending | — | No requests run | Run scripts/benchmark-models.mjs |') + '\n\n## Ranking\n\nTo be assigned after results are reviewed. Prioritize plausible portions and nutrition values, then latency. Fastest does not automatically mean most accurate.\n';
  await writeFile('benchmark.md', md, 'utf8');
}
const statusResponse = await fetch(base + '/api/provider-status');
const status = await statusResponse.json();
if (!statusResponse.ok) throw new Error('Provider discovery failed: HTTP ' + statusResponse.status);
const models = [];
for (const provider of providers) {
  const p = status.providers?.find(x => x.provider === provider);
  if (!p?.configured || !p.ok) { rows.push({provider,model:'(catalogue)',status:'provider_unavailable',result:'—',error:p?.message || p?.status || 'Not configured'}); await save(); continue; }
  for (const m of p.models || []) models.push({provider,model:m.id});
}
await save();
console.log('Discovered ' + models.length + ' models. One request per model.');
for (let i=0;i<models.length;i++) {
  const {provider,model}=models[i]; const t=performance.now(); let row;
  try {
    const r=await fetch(base+'/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description:query,provider,model}),signal:AbortSignal.timeout(75000)});
    const data=await r.json().catch(()=>({})); const ms=Math.round(performance.now()-t);
    row=r.ok?{provider,model,status:'success',ms,result:summarize(data.items),error:''}:{provider,model,status:r.status===429?'rate_limited':'error',ms,result:'—',error:data.detail||data.error||('HTTP '+r.status)};
  } catch(e) { row={provider,model,status:'request_error',ms:Math.round(performance.now()-t),result:'—',error:e.message||String(e)}; }
  rows.push(row); await save(); console.log('['+(i+1)+'/'+models.length+'] '+provider+'/'+model+' '+row.status+' '+row.ms+'ms');
}
console.log('Complete. Results written to benchmark.md');
