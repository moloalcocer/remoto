// Temporary diagnostics round 3.
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36","Accept":"application/json, text/html;q=0.9,*/*;q=0.8"};
async function raw(url,opt={}){ const r=await fetch(url,{headers:{...UA,...(opt.headers||{})},method:opt.method||"GET",body:opt.body,signal:AbortSignal.timeout(15000)}); return {status:r.status,url:r.url,text:await r.text()}; }
const log=(l,m)=>console.log("PROBE",l,"::",m);
(async()=>{
  try{ const r=await raw("https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&start=0&num=50&location=remote");
    const j=JSON.parse(r.text); log("netflix-remote",`count=${j.positions.length} total=${j.count}`);
    log("netflix-keys",Object.keys(j.positions[0]).join(","));
    j.positions.slice(0,5).forEach(p=>log("netflix-pos",JSON.stringify({name:p.name,location:p.location,locations:p.locations,wlo:p.work_location_option,canon:p.canonicalPositionUrl,t:p.t_create,id:p.id,ats:p.ats_job_id})));
  }catch(e){log("netflix","ERR "+e.message)}
  try{ const r=await raw("https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&start=0&num=50");
    const j=JSON.parse(r.text); const locs={}; j.positions.forEach(p=>{const k=(p.work_location_option||"")+"|"+p.location; locs[k]=(locs[k]||0)+1}); log("netflix-locs",JSON.stringify(locs).slice(0,700));
  }catch(e){log("netflix2","ERR "+e.message)}
  try{ const r=await raw("https://explore.jobs.netflix.net/api/apply/v2/jobs/790298014263?domain=netflix.com");
    const j=JSON.parse(r.text); log("netflix-detail-keys",Object.keys(j).join(",")); log("netflix-desc",(j.job_description||"").slice(0,200));
  }catch(e){log("netflix3","ERR "+e.message)}
  try{ const r=await raw("https://api.rippling.com/platform/api/ats/v1/board/rippling/jobs"); const j=JSON.parse(r.text);
    const labels={}; j.forEach(x=>{const k=(x.workLocation&&x.workLocation.label)||"";labels[k]=(labels[k]||0)+1});
    log("rippling-loc-labels",JSON.stringify(Object.entries(labels).sort((a,b)=>b[1]-a[1]).slice(0,40)));
    log("rippling-keys",Object.keys(j[0]).join(","));
    const d=await raw("https://api.rippling.com/platform/api/ats/v1/board/rippling/jobs/"+j[0].uuid); log("rippling-detail",d.status+" "+d.text.slice(0,600));
  }catch(e){log("rippling","ERR "+e.message)}
  for(const u of ["https://api.gem.com/job_board/v0/retool/job_posts/","https://jobs.gem.com/retool","https://retool.com/careers"]){
    try{ const r=await raw(u); const hosts=[...new Set((r.text.match(/(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|gem\.com\/[a-z0-9_\-\/]{2,40}|smartrecruiters\.com|eightfold\.ai)/gi)||[]))].slice(0,10);
      log("retool "+u,`status=${r.status} final=${r.url} len=${r.text.length} hints=${hosts.join(" ")} head=${r.text.slice(0,250).replace(/\s+/g," ")}`);}catch(e){log("retool "+u,"ERR "+e.message)}
  }
  for(const u of ["https://unity.com/careers/positions","https://careers.unity.com/positions","https://www.deel.com/careers","https://www.deel.com/careers/open-positions","https://www.shopify.com/careers/search"]){
    try{ const r=await raw(u); const hosts=[...new Set((r.text.match(/(greenhouse\.io\/[a-z0-9_\-]+|lever\.co\/[a-z0-9_\-]+|ashbyhq\.com\/[a-z0-9_\-]+|[a-z0-9\-]+\.wd\d+\.myworkdayjobs\.com\/[a-z0-9_\-]+|smartrecruiters\.com\/[a-z0-9_\-]+|eightfold\.ai|gem\.com\/[a-z0-9_\-]+|ats\.rippling\.com\/[a-z0-9_\-]+|workable\.com\/[a-z0-9_\-]+|teamtailor\.com|pinpointhq\.com|icims\.com)/gi)||[]).map(x=>x.toLowerCase()))].slice(0,12);
      const api=[...new Set((r.text.match(/https?:\/\/[a-z0-9\.\-]+\/[a-z0-9_\-\/\.]*(?:jobs|positions|postings|careers)[a-z0-9_\-\/\.\?=&]*/gi)||[]))].filter(x=>!/\.(png|jpg|svg|css|js)$/.test(x)).slice(0,10);
      log(u,`status=${r.status} final=${r.url} len=${r.text.length} hints=${hosts.join(" ")} urls=${api.join(" ")}`);}catch(e){log(u,"ERR "+e.message)}
  }
  for(const s of ["unity","Unity","unitytech"]) for(const w of ["wd1","wd5","wd3","wd12"]) {
    try{ const r=await raw(`https://${s.toLowerCase()}.${w}.myworkdayjobs.com/wday/cxs/${s.toLowerCase()}/External/jobs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:1,offset:0,searchText:"",appliedFacets:{}})});
      if(r.status===200) log("unity-wd",`${s} ${w} ${r.text.slice(0,120)}`);}catch(e){}
  }
  log("done","");
})();
