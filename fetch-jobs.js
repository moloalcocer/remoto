/* ============================================================
   Remoto — daily job fetcher
   Run automatically by GitHub Actions (see update-jobs.yml).
   Pulls every free feed, dedupes, and writes jobs.json to the repo.
   No dependencies, no API keys. Needs Node 18+ (has global fetch).
   ============================================================ */
const fs = require("fs");

async function arbeitnow(){
  const out=[];
  for(let p=1;p<=3;p++){
    try{
      const r=await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${p}`);
      const j=await r.json();
      (j.data||[]).forEach(x=>{ if(!x.remote) return;
        out.push({ id:"an-"+x.slug, title:x.title, company:x.company_name, url:x.url, remote:true,
          location:x.location||"", tags:x.tags||[], description:x.description||"",
          created:x.created_at?new Date(x.created_at*1000).toISOString():new Date().toISOString(),
          salary:"", source:"Arbeitnow" });
      });
    }catch(e){ console.error("arbeitnow page "+p, e.message); }
  }
  return out;
}
async function remotive(){
  try{
    const r=await fetch("https://remotive.com/api/remote-jobs");
    const j=await r.json();
    return (j.jobs||[]).map(x=>({ id:"rm-"+x.id, title:x.title, company:x.company_name, url:x.url, remote:true,
      location:x.candidate_required_location||"", tags:x.tags||[], description:x.description||"",
      created:x.publication_date||new Date().toISOString(), salary:x.salary||"", source:"Remotive" }));
  }catch(e){ console.error("remotive", e.message); return []; }
}
async function jobicy(){
  try{
    const r=await fetch("https://jobicy.com/api/v2/remote-jobs?count=50");
    const j=await r.json();
    return (j.jobs||[]).map(x=>({ id:"jb-"+x.id, title:x.jobTitle, company:x.companyName, url:x.url, remote:true,
      location:x.jobGeo||"", tags:[].concat(x.jobIndustry||[], x.jobLevel||[]),
      description:x.jobExcerpt||x.jobDescription||"", created:x.pubDate||new Date().toISOString(),
      salary:(x.annualSalaryMin&&x.annualSalaryMax)?`$${(+x.annualSalaryMin/1000)|0}k–$${(+x.annualSalaryMax/1000)|0}k`:"",
      source:"Jobicy" }));
  }catch(e){ console.error("jobicy", e.message); return []; }
}

/* ---------- curation (mirrors the site defaults) ---------- */
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

(async()=>{
  const all=[].concat(...await Promise.all([arbeitnow(), remotive(), jobicy()]));
  const seen=new Set(); let out=[];
  for(const j of all){
    if(!keep(j)) continue;
    const k=(j.company+"|"+j.title).toLowerCase().replace(/\s+/g," ").trim();
    if(seen.has(k)) continue; seen.add(k); out.push(j);
  }
  out.sort((a,b)=> scoreOf(b)-scoreOf(a) || new Date(b.created)-new Date(a.created));
  out = out.slice(0,120);   // curated pool; the site shows its top 40
  fs.writeFileSync("jobs.json", JSON.stringify(out));
  console.log(`Wrote ${out.length} curated jobs to jobs.json`);
})();
