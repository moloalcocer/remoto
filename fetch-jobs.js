/* ============================================================
   Remoto — daily job fetcher
   Run automatically by GitHub Actions (see update-jobs.yml).
   Sources: free remote feeds + companies' own career boards (ATS APIs).
   Remote roles -> main board.  Onsite roles at roster companies -> "relocate" tab.
   No dependencies, no API keys. Needs Node 18+ (has global fetch).
   ============================================================ */
const fs = require("fs");

/* ============================================================
   COMPANY ROSTER — sources jobs straight from each company's career page.
   Add a company in 10 seconds: open its careers page and read the URL —
     boards.greenhouse.io/COMPANY   -> { name:"…", ats:"greenhouse", token:"COMPANY" }
     jobs.lever.co/COMPANY          -> { name:"…", ats:"lever",      token:"COMPANY" }
     jobs.ashbyhq.com/COMPANY       -> { name:"…", ats:"ashby",      token:"COMPANY" }
     jobs.smartrecruiters.com/COMPANY -> { name:"…", ats:"smartrecruiters", token:"COMPANY" }
   Amazon uses its own public search (tune the query to the roles you want).
   Tokens marked VERIFY are examples — confirm the slug loads before trusting it.
   ============================================================ */
const COMPANIES = [
  // ---- Amazon (its own public search) ----
  { name:"Amazon", ats:"amazon", query:"creative" },

  // ---- Greenhouse (token = the slug in boards.greenhouse.io/<token>) ----
  { name:"Anthropic",  ats:"greenhouse", token:"anthropic" },
  { name:"Stripe",     ats:"greenhouse", token:"stripe" },
  { name:"Figma",      ats:"greenhouse", token:"figma" },
  { name:"Airbnb",     ats:"greenhouse", token:"airbnb" },
  { name:"DoorDash",   ats:"greenhouse", token:"doordash" },
  { name:"Coinbase",   ats:"greenhouse", token:"coinbase" },
  { name:"Robinhood",  ats:"greenhouse", token:"robinhood" },
  { name:"Databricks", ats:"greenhouse", token:"databricks" },
  { name:"Duolingo",   ats:"greenhouse", token:"duolingo" },
  { name:"Cloudflare", ats:"greenhouse", token:"cloudflare" },
  { name:"GitLab",     ats:"greenhouse", token:"gitlab" },
  { name:"Brex",       ats:"greenhouse", token:"brex" },
  { name:"Plaid",      ats:"greenhouse", token:"plaid" },
  { name:"Rippling",   ats:"greenhouse", token:"rippling" },
  { name:"Perplexity", ats:"greenhouse", token:"perplexityai" },
  { name:"Discord",    ats:"greenhouse", token:"discord" },
  { name:"Instacart",  ats:"greenhouse", token:"instacart" },
  { name:"Gusto",      ats:"greenhouse", token:"gusto" },

  // ---- Ashby (token = the slug in jobs.ashbyhq.com/<token>; often publishes salary) ----
  { name:"OpenAI",     ats:"ashby", token:"openai" },
  { name:"Ramp",       ats:"ashby", token:"ramp" },
  { name:"Notion",     ats:"ashby", token:"notion" },
  { name:"Linear",     ats:"ashby", token:"linear" },
  { name:"Deel",       ats:"ashby", token:"deel" },
  { name:"Snowflake",  ats:"ashby", token:"snowflake" },
  { name:"Shopify",    ats:"ashby", token:"Shopify" },
  { name:"Cursor",     ats:"ashby", token:"cursor" },
  { name:"Vanta",      ats:"ashby", token:"vanta" },
  { name:"Retool",     ats:"ashby", token:"retool" },
  { name:"Zapier",     ats:"ashby", token:"zapier" },
  { name:"Mercury",    ats:"ashby", token:"mercury" },
  { name:"Cohere",     ats:"ashby", token:"cohere" },
  { name:"Confluent",  ats:"ashby", token:"confluent" },
  { name:"Replit",     ats:"ashby", token:"replit" },
  { name:"Gorgias",    ats:"ashby", token:"gorgias" },

  // ---- Lever (token = slug in jobs.lever.co/<token>) ----
  { name:"Palantir",   ats:"lever", token:"palantir" },

  // ---- Workday (paste the careers URL ending in myworkdayjobs.com/…) ----
  { name:"Netflix", ats:"workday", url:"https://netflix.wd108.myworkdayjobs.com/Netflix" },
  { name:"Disney",  ats:"workday", url:"https://disney.wd5.myworkdayjobs.com/disneycareer" },
  { name:"NVIDIA",  ats:"workday", url:"https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite" },
  { name:"Adobe",   ats:"workday", url:"https://adobe.wd5.myworkdayjobs.com/external_experienced" },

  // Tokens are researched but not individually test-run here. After your first daily run,
  // check the Actions log: any company showing 0 jobs just needs its slug corrected —
  // open that company's careers page, copy the token from the URL, and fix the line.
  // Add any company the same way. Bethesda/ZeniMax uses a custom site (needs its own adapter).
];

const isRemoteText = s => /(^|[^a-z])(remote|virtual|anywhere|work from home|wfh|distributed)([^a-z]|$)/i.test(s||"");

function norm(c,id,title,url,remote,location,tags,description,created,salary){
  let iso;
  if(typeof created==="number") iso=new Date(created).toISOString();
  else { const d=new Date(created); iso=isNaN(d)?new Date().toISOString():d.toISOString(); }
  return { id:c.ats+"-"+(c.token||c.name||"co").toString().toLowerCase().replace(/\W+/g,"")+"-"+id, title:title||"", company:c.name, url:url||"",
    remote:!!remote, relocate:!remote, direct:true, location:location||"", tags:tags||[],
    description:description||"", created:iso, salary:salary||"", source:c.name };
}

async function greenhouse(c){
  const r=await fetch(`https://boards-api.greenhouse.io/v1/boards/${c.token}/jobs?content=true`);
  const j=await r.json();
  return (j.jobs||[]).map(x=>{ const loc=(x.location&&x.location.name)||"";
    return norm(c,x.id,x.title,x.absolute_url,isRemoteText(loc)||isRemoteText(x.title),loc,[],x.content||"",x.updated_at); });
}
async function lever(c){
  const r=await fetch(`https://api.lever.co/v0/postings/${c.token}?mode=json`);
  const j=await r.json();
  return (Array.isArray(j)?j:[]).map(x=>{ const cat=x.categories||{}; const loc=cat.location||"";
    const remote=(x.workplaceType||"").toLowerCase()==="remote"||isRemoteText(loc);
    return norm(c,x.id,x.text,x.hostedUrl,remote,loc,cat.team?[cat.team]:[],x.descriptionPlain||x.description||"",x.createdAt); });
}
async function ashby(c){
  const r=await fetch(`https://api.ashbyhq.com/posting-api/job-board/${c.token}?includeCompensation=true`);
  const j=await r.json();
  return (j.jobs||[]).map(x=>norm(c,x.id,x.title,x.jobUrl,!!x.isRemote,x.location||"",x.departmentName?[x.departmentName]:[],x.descriptionPlain||"",x.publishedAt, x.compensationTierSummary||(x.compensation&&x.compensation.compensationTierSummary)||""));
}
async function smartrecruiters(c){
  const r=await fetch(`https://api.smartrecruiters.com/v1/companies/${c.token}/postings?limit=100`);
  const j=await r.json();
  return (j.content||[]).map(x=>{ const L=x.location||{}; const loc=[L.city,L.country].filter(Boolean).join(", ");
    return norm(c,x.id,x.name,`https://jobs.smartrecruiters.com/${c.token}/${x.id}`,(L.remote===true)||isRemoteText(loc),loc,[],"",x.releasedDate); });
}
async function amazonJobs(c){
  const r=await fetch(`https://amazon.jobs/en/search.json?base_query=${encodeURIComponent(c.query||"")}&result_limit=100&sort=recent`);
  const j=await r.json();
  return (j.jobs||[]).map(x=>{ const loc=x.normalized_location||x.location||x.city||"";
    return norm(c,x.id_icims||x.id,x.title,"https://www.amazon.jobs"+(x.job_path||""),isRemoteText(loc)||isRemoteText(x.title),loc,[],x.description_short||x.basic_qualifications||"",x.posted_date); });
}
async function workday(c){
  const m=(c.url||"").match(/https?:\/\/([\w-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^\/?#]+)/i);
  if(!m) return [];
  const tenant=m[1], wd=m[2], site=m[3], base=`https://${tenant}.${wd}.myworkdayjobs.com`;
  const cxs=`${base}/wday/cxs/${tenant}/${site}/jobs`;
  const out=[]; let total=null;
  for(let offset=0; offset<80; offset+=20){
    let d;
    try{
      const r=await fetch(cxs,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","User-Agent":"Mozilla/5.0 (compatible; RemotoBot/1.0)"},body:JSON.stringify({limit:20,offset,searchText:"",appliedFacets:{}})});
      if(!r.ok) break; d=await r.json();
    }catch(e){ break; }
    const posts=d.jobPostings||[]; if(total===null) total=d.total||0;
    if(!posts.length) break;
    posts.forEach(x=>{ const loc=x.locationsText||"";
      out.push(norm(c,(x.bulletFields&&x.bulletFields[0])||x.externalPath||x.title,x.title,
        base+"/"+site+(x.externalPath||""), isRemoteText(loc)||isRemoteText(x.title), loc, [], "", workdayDate(x.postedOn))); });
    if(total && offset+20>=total) break;
  }
  return out;
}
function workdayDate(s){
  const now=Date.now(); if(!s) return new Date().toISOString(); const t=String(s).toLowerCase();
  if(t.includes("today")) return new Date().toISOString();
  if(t.includes("yesterday")) return new Date(now-864e5).toISOString();
  let m; if((m=t.match(/(\d+)\+?\s*day/))) return new Date(now-parseInt(m[1],10)*864e5).toISOString();
  if((m=t.match(/(\d+)\+?\s*week/))) return new Date(now-parseInt(m[1],10)*7*864e5).toISOString();
  if((m=t.match(/(\d+)\+?\s*month/))) return new Date(now-parseInt(m[1],10)*30*864e5).toISOString();
  return new Date().toISOString();
}
async function fetchCompany(c){
  const fn={greenhouse,lever,ashby,smartrecruiters,amazon:amazonJobs,workday}[c.ats];
  if(!fn) return [];
  try{ return await fn(c); }catch(e){ console.error("company "+c.name, e.message); return []; }
}
async function sourceCompanies(){
  const r=await Promise.all(COMPANIES.map(fetchCompany));
  return [].concat(...r);
}

/* ---------- free remote feeds ---------- */
async function arbeitnow(){
  const out=[];
  for(let p=1;p<=3;p++){
    try{ const r=await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${p}`); const j=await r.json();
      (j.data||[]).forEach(x=>{ if(!x.remote) return;
        out.push({ id:"an-"+x.slug, title:x.title, company:x.company_name, url:x.url, remote:true, relocate:false, direct:false,
          location:x.location||"", tags:x.tags||[], description:x.description||"",
          created:x.created_at?new Date(x.created_at*1000).toISOString():new Date().toISOString(), salary:"", source:"Arbeitnow" }); });
    }catch(e){ console.error("arbeitnow page "+p, e.message); }
  }
  return out;
}
async function remotive(){
  try{ const r=await fetch("https://remotive.com/api/remote-jobs"); const j=await r.json();
    return (j.jobs||[]).map(x=>({ id:"rm-"+x.id, title:x.title, company:x.company_name, url:x.url, remote:true, relocate:false, direct:false,
      location:x.candidate_required_location||"", tags:x.tags||[], description:x.description||"",
      created:x.publication_date||new Date().toISOString(), salary:x.salary||"", source:"Remotive" }));
  }catch(e){ console.error("remotive", e.message); return []; }
}
async function jobicy(){
  try{ const r=await fetch("https://jobicy.com/api/v2/remote-jobs?count=50"); const j=await r.json();
    return (j.jobs||[]).map(x=>({ id:"jb-"+x.id, title:x.jobTitle, company:x.companyName, url:x.url, remote:true, relocate:false, direct:false,
      location:x.jobGeo||"", tags:[].concat(x.jobIndustry||[], x.jobLevel||[]),
      description:x.jobExcerpt||x.jobDescription||"", created:x.pubDate||new Date().toISOString(),
      salary:(x.annualSalaryMin&&x.annualSalaryMax)?`$${(+x.annualSalaryMin/1000)|0}k–$${(+x.annualSalaryMax/1000)|0}k`:"", source:"Jobicy" }));
  }catch(e){ console.error("jobicy", e.message); return []; }
}

/* ---------- curation ---------- */
const MIN_SALARY = 100000;
const JUNK = ["junior","jr ","jr.","intern","internship","entry level","entry-level","trainee","apprentice","graduate program","graduate scheme","volunteer","unpaid","commission only","commission-only","no experience required"];
const SENIOR = ["senior","sr ","sr.","lead","staff","principal","head of","director","architect","expert","manager","vp of","chief","tech lead"];
const strip = h => (h||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
function salaryOf(j){
  const t=((j.salary||"")+" "+(j.title||"")+" "+strip(j.description)).toLowerCase(); let best=0;
  (t.match(/\$?\s?(\d{2,3})\s?k\b/g)||[]).forEach(m=>{const n=parseInt(m.replace(/[^\d]/g,""),10)*1000; if(n>best)best=n;});
  (t.match(/\$\s?\d{2,3}(?:[,\.]\d{3})+/g)||[]).forEach(m=>{const n=parseInt(m.replace(/[^\d]/g,""),10); if(n>=30000&&n<=1000000&&n>best)best=n;});
  (t.match(/\$\s?(\d{2,3})(?:\.\d+)?\s?(?:\/\s?hr|\/\s?hour|per hour|hourly|\/h\b)/g)||[]).forEach(m=>{const n=parseInt(m.replace(/[^\d]/g,""),10)*2080; if(n>best)best=n;});
  return best;
}
const isJunk = j => JUNK.some(w=>(j.title||"").toLowerCase().includes(w));
const isSenior = j => SENIOR.some(w=>(j.title||"").toLowerCase().includes(w));
function scoreOf(j){ const sal=salaryOf(j); let s=0;
  if(sal>=MIN_SALARY) s+=60+Math.min(60,(sal-MIN_SALARY)/4000);
  if(isSenior(j)) s+=25; const dl=strip(j.description).length;
  if(dl>300)s+=8; if(dl>800)s+=6; if((j.tags||[]).length)s+=4;
  const days=(Date.now()-new Date(j.created))/864e5; if(days<=2)s+=10; else if(days<=7)s+=5;
  return s;
}
function keep(j){ if(!j.title||!j.company) return false; if(isJunk(j)) return false; const sal=salaryOf(j); if(sal && sal<MIN_SALARY) return false; return true; }
function dedupe(a){ const s=new Set(),o=[]; for(const j of a){ const k=(j.company+"|"+j.title).toLowerCase().replace(/\s+/g," ").trim(); if(s.has(k))continue; s.add(k); o.push(j);} return o; }

function diversify(list, perCompany, total){
  const seen={}, out=[];
  for(const j of list){ const k=j.source||j.company||"?"; seen[k]=(seen[k]||0)+1; if(seen[k]>perCompany) continue; out.push(j); if(out.length>=total) break; }
  return out;
}

(async()=>{
  const [aggArr, companyArr] = await Promise.all([
    Promise.all([arbeitnow(), remotive(), jobicy()]).then(r=>[].concat(...r)),
    sourceCompanies()
  ]);

  // Remote company roles enrich the main board; onsite roster roles feed the relocate tab.
  const remoteCompany = companyArr.filter(j=>j.remote);
  const onsite        = companyArr.filter(j=>!j.remote && isSenior(j)); // prestige onsite roles only

  let main = dedupe([].concat(aggArr, remoteCompany).filter(keep));
  main.forEach(j=>j.relocate=false);
  main.sort((a,b)=> ((b.direct?1:0)-(a.direct?1:0)) || scoreOf(b)-scoreOf(a) || new Date(b.created)-new Date(a.created));
  main = diversify(main, 5, 130);   // at most 5 per company → wide variety

  let relocate = dedupe(onsite.filter(j=>!isJunk(j)));
  relocate.forEach(j=>j.relocate=true);
  relocate.sort((a,b)=> scoreOf(b)-scoreOf(a) || new Date(b.created)-new Date(a.created));
  relocate = diversify(relocate, 8, 70);

  const outAll = main.concat(relocate);
  fs.writeFileSync("jobs.json", JSON.stringify(outAll));
  const cos = new Set(outAll.map(j=>j.company)).size;
  console.log(`Wrote ${main.length} remote + ${relocate.length} relocation roles from ${cos} companies to jobs.json`);
})();
