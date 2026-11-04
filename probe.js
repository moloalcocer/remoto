// Temporary diagnostics: find where 8 companies now publish jobs.
const UA={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36","Accept":"application/json, text/html;q=0.9,*/*;q=0.8"};
async function get(label,url,opt={}){
  try{
    const r=await fetch(url,{headers:{...UA,...(opt.headers||{})},method:opt.method||"GET",body:opt.body,redirect:"follow",signal:AbortSignal.timeout(15000)});
    const t=await r.text();
    let info=`status=${r.status} final=${r.url} len=${t.length}`;
    try{const j=JSON.parse(t);
      const arr=Array.isArray(j)?j:(j.jobs||j.positions||j.jobPostings||j.content||j.items||j.results||j.data||null);
      info+=` json keys=${Object.keys(j).slice(0,8).join(",")} count=${Array.isArray(arr)?arr.length:"?"} total=${j.total??j.count??j.totalFound??""}`;
      if(Array.isArray(arr)&&arr[0]) info+=` sample=${JSON.stringify(arr[0]).slice(0,400)}`;
    }catch(e){
      const hosts=[...new Set((t.match(/(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|eightfold\.ai|icims\.com|jobvite\.com|workable\.com|teamtailor\.com|personio\.(?:de|com)|ats\.rippling\.com|gem\.com|comeet\.(?:co|com)|successfactors|oraclecloud\.com|taleo\.net|avature\.net|pinpointhq\.com|recruitee\.com|bamboohr\.com|jazzhr|breezy\.hr|dover\.com)/gi)||[]).map(x=>x.toLowerCase()))];
      info+=` ats-hints=[${hosts.join(",")}] head=${t.slice(0,200).replace(/\s+/g," ")}`;
      const api=[...new Set((t.match(/["'](\/api\/[^"'\s]{3,80})["']/g)||[]))].slice(0,8); if(api.length) info+=` api-paths=${api.join(" ")}`;
    }
    console.log("PROBE",label,"::",info);
  }catch(e){ console.log("PROBE",label,":: ERROR",e.message); }
}
(async()=>{
  // Deel — Ashby slugs are case-sensitive
  await get("deel-ashby-Deel","https://api.ashbyhq.com/posting-api/job-board/Deel");
  // Retool — Greenhouse board
  await get("retool-gh","https://boards-api.greenhouse.io/v1/boards/retool/jobs");
  // Rippling — its own ATS
  await get("rippling-api-v1","https://api.rippling.com/platform/api/ats/v1/board/rippling/jobs");
  await get("rippling-board","https://ats.rippling.com/rippling/jobs");
  // Netflix — old Workday + new careers site
  await get("netflix-wd108","https://netflix.wd108.myworkdayjobs.com/wday/cxs/netflix/Netflix/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:20,offset:0,searchText:"",appliedFacets:{}})});
  await get("netflix-explore-api","https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&start=0&num=10");
  await get("netflix-jobs","https://jobs.netflix.com/");
  // Confluent
  await get("confluent-ashby","https://api.ashbyhq.com/posting-api/job-board/confluent");
  await get("confluent-ashby-C","https://api.ashbyhq.com/posting-api/job-board/Confluent");
  await get("confluent-careers","https://careers.confluent.io/jobs");
  // Unity, Shopify, Team17
  await get("unity-careers","https://careers.unity.com/");
  await get("unity-gh-unity3d","https://boards-api.greenhouse.io/v1/boards/unity3d/jobs");
  await get("shopify-careers","https://www.shopify.com/careers");
  await get("team17-careers","https://www.team17.com/careers");
})();
