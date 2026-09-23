/* ============================================================
   Remoto — shared list engine for SEO landing pages
   Each landing page sets window.NICHE before loading this file:
     window.NICHE = { lang:"en", cat:"cs", query:"", latamOnly:true }
   Reuses the same free feeds + jobs.json cache as the main board.
   ============================================================ */
(function(){
  const N = Object.assign({ lang:"en", cat:"all", query:"", latamOnly:false,
    minSalary:100000, pageSize:25, maxJobs:100 }, window.NICHE||{});
  let shown = N.pageSize, ALL=[];

  const CAT = {
    eng:["developer","engineer","software","backend","frontend","full stack","fullstack","devops","programador","react","python","node","java","golang","data engineer"],
    cs:["customer success","customer support","support","success","account manager","help desk","soporte","atención"],
    sales:["sales","account executive","business development","sdr","bdr","ventas","revenue"],
    design:["designer","design","ux","ui","product design","graphic","diseñador","brand"],
    mkt:["marketing","seo","content","growth","social media","copywriter","community"],
    ops:["virtual assistant","operations","project manager","admin","executive assistant","ops","coordinator","asistente"],
    data:["data","analyst","analytics","machine learning","scientist","datos"],
    creative:["game designer","game developer","game artist","game programmer","gameplay","gamedev","video game","gaming","unity","unreal","animator","animation","3d artist","3d modeler","3d generalist","vfx","motion designer","motion graphics","art director","concept artist","concept art","illustrator","storyboard","character artist","character designer","level designer","environment artist","video editor","video producer","cinematographer","colorist","compositor","creative director","creative producer","post-production","narrative designer","sound designer","technical artist","filmmaker"]
  };
  const LATAM=["worldwide","global","anywhere","americas","latin america","latam","south america","central america","mexico","méxico","argentina","brazil","brasil","colombia","chile","peru","spanish","bilingual","español","bilingüe","est","cst","utc-3","utc-4","utc-5","utc-6"];
  const EXCLUDE=["us only","usa only","united states only","us-only","eu only","europe only","uk only","canada only","authorized to work in the us"];
  const JUNK=["junior","jr ","jr.","intern","internship","entry level","entry-level","trainee","apprentice","graduate program","volunteer","unpaid","commission only","no experience required"];
  const SENIOR=["senior","sr ","sr.","lead","staff","principal","head of","director","architect","expert","manager","chief","tech lead"];

  const T = {
    en:{ apply:"Apply →", applyDirect:"Apply direct →", badge:"LatAm-friendly", direct:"Direct", results:n=>`${n} curated roles`, more:"Load more",
      loading:"Loading roles…", none:"No roles match right now — check back soon.",
      err:"Couldn’t reach the job feeds. If you’re viewing this file locally, host it and it’ll fill up.", updated:t=>`updated ${t}` },
    es:{ apply:"Postularme →", applyDirect:"Aplica directo →", badge:"Abierta a LatAm", direct:"Directo", results:n=>`${n} vacantes seleccionadas`, more:"Ver más",
      loading:"Cargando vacantes…", none:"Aún no hay vacantes que coincidan — vuelve pronto.",
      err:"No se pudo conectar con las fuentes. Si ves este archivo localmente, súbelo a un hosting y se llenará.", updated:t=>`actualizado ${t}` }
  }[N.lang] || {};

  const strip=h=>{const d=document.createElement("div");d.innerHTML=h||"";return(d.textContent||"").replace(/\s+/g," ").trim();};
  const esc=s=>(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const initials=s=>(s||"?").trim().slice(0,2).toUpperCase();
  function ago(d){const x=new Date(d);if(isNaN(x))return"";const days=Math.floor((Date.now()-x)/864e5);
    if(days<=0)return N.lang==="es"?"hoy":"today";if(days===1)return N.lang==="es"?"ayer":"1d ago";
    if(days<7)return N.lang==="es"?`hace ${days}d`:`${days}d ago`;const w=Math.floor(days/7);return N.lang==="es"?`hace ${w}sem`:`${w}w ago`;}

  async function feedCache(){try{const r=await fetch("./jobs.json",{cache:"no-store"});if(!r.ok)return[];const j=await r.json();return Array.isArray(j)?j:(j.jobs||[]);}catch(e){return[];}}
  async function feedArbeitnow(){const out=[];for(let p=1;p<=2;p++){try{const r=await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${p}`);const j=await r.json();(j.data||[]).forEach(x=>{if(!x.remote)return;out.push({id:"an-"+x.slug,title:x.title,company:x.company_name,url:x.url,location:x.location||"",tags:x.tags||[],description:x.description||"",created:x.created_at?new Date(x.created_at*1000).toISOString():new Date().toISOString(),salary:"",source:"Arbeitnow"});});}catch(e){}}return out;}
  async function feedRemotive(){try{const r=await fetch("https://remotive.com/api/remote-jobs");const j=await r.json();return(j.jobs||[]).map(x=>({id:"rm-"+x.id,title:x.title,company:x.company_name,url:x.url,location:x.candidate_required_location||"",tags:x.tags||[],description:x.description||"",created:x.publication_date||new Date().toISOString(),salary:x.salary||"",source:"Remotive"}));}catch(e){return[];}}
  async function feedJobicy(){try{const r=await fetch("https://jobicy.com/api/v2/remote-jobs?count=50");const j=await r.json();return(j.jobs||[]).map(x=>({id:"jb-"+x.id,title:x.jobTitle,company:x.companyName,url:x.url,location:x.jobGeo||"",tags:[].concat(x.jobIndustry||[],x.jobLevel||[]),description:x.jobExcerpt||x.jobDescription||"",created:x.pubDate||new Date().toISOString(),salary:(x.annualSalaryMin&&x.annualSalaryMax)?`$${(+x.annualSalaryMin/1000)|0}k–$${(+x.annualSalaryMax/1000)|0}k`:"",source:"Jobicy"}));}catch(e){return[];}}

  function dedupe(a){const s=new Set(),o=[];for(const j of a){if(!j.title||!j.company)continue;const k=(j.company+"|"+j.title).toLowerCase().replace(/\s+/g," ").trim();if(s.has(k))continue;s.add(k);o.push(j);}return o;}
  function salaryOf(j){let t=((j.salary||"")+" "+(j.title||"")+" "+strip(j.description)).toLowerCase();let b=0;
    t=t.replace(/\b(401|403|457)\s?\(?\s?[kb]\)?/g," ");
    (t.match(/\$?\s?(\d{2,3})\s?k\b/g)||[]).forEach(m=>{const n=parseInt(m.replace(/[^\d]/g,""),10);if(n>=30&&n<=900){const v=n*1000;if(v>b)b=v;}});
    (t.match(/\$\s?\d{2,3}(?:[,\.]\d{3})+/g)||[]).forEach(m=>{const n=parseInt(m.replace(/[^\d]/g,""),10);if(n>=30000&&n<=1000000&&n>b)b=n;});
    (t.match(/\$\s?(\d{2,3})(?:\.\d+)?\s?(?:\/\s?hr|\/\s?hour|per hour|hourly|\/h\b)/g)||[]).forEach(m=>{const n=parseInt(m.replace(/[^\d]/g,""),10)*2080;if(n>b)b=n;});
    return b;}
  const has=(j,l)=>{const h=(j.location+" "+j.title+" "+(j.tags||[]).join(" ")+" "+strip(j.description)).toLowerCase();return l.some(w=>h.includes(w));};
  const isJunk=j=>JUNK.some(w=>(j.title||"").toLowerCase().includes(w));
  const isSenior=j=>SENIOR.some(w=>(j.title||"").toLowerCase().includes(w));
  const latamScore=j=>{const h=(j.location+" "+j.title+" "+(j.tags||[]).join(" ")+" "+strip(j.description)).toLowerCase();if(EXCLUDE.some(s=>h.includes(s)))return -1;return LATAM.some(s=>h.includes(s))?1:0;};
  function wordHit(h,kw){let f=0,i;while((i=h.indexOf(kw,f))>=0){const b=i===0?" ":h[i-1],a=i+kw.length>=h.length?" ":h[i+kw.length];if(!/[a-z0-9]/.test(b)&&!/[a-z0-9]/.test(a))return true;f=i+1;}return false;}
  const CLASSIFY=[
    ["creative",["animator","animation","vfx","motion designer","motion graphics","3d artist","3d modeler","3d generalist","game designer","game artist","game design","art director","concept artist","concept art","illustrator","storyboard","character artist","character designer","level designer","environment artist","video editor","video producer","cinematographer","colorist","compositor","creative director","creative producer","narrative designer","sound designer","technical artist","filmmaker"]],
    ["data",["data scientist","data engineer","data analyst","analytics engineer","machine learning","ml engineer","ai engineer","data science","business intelligence","bi analyst","analytics"]],
    ["eng",["software engineer","engineer","developer","back end","backend","front end","frontend","full stack","fullstack","full-stack","devops","programmer","sre","site reliability","mobile engineer","ios","android","platform engineer","qa engineer","security engineer","game developer","game programmer","gameplay","architect","engineering manager"]],
    ["product",["product manager","product owner","head of product","product lead","product management","program manager","technical product manager","group product manager","director of product","vp product"]],
    ["design",["ux designer","ui designer","ux/ui","product designer","graphic designer","web designer","brand designer","visual designer","design lead","design director","design manager","ux researcher","user researcher","design system","designer"]],
    ["finance",["financial analyst","finance manager","finance","accounting","accountant","controller","fp&a","treasury","investment","tax","audit","auditor","banking","cfo","equity research","portfolio manager","underwriter","bookkeeper"]],
    ["sales",["account executive","business development","sales development","sdr","bdr","sales manager","sales director","head of sales","sales representative","enterprise sales","revenue","sales"]],
    ["cs",["customer success","customer support","customer experience","success manager","account manager","help desk","technical support","support specialist","customer care","customer service"]],
    ["mkt",["marketing","seo","content marketing","growth","social media","copywriter","community manager","brand manager","content strategist","demand generation","content writer","content manager"]],
    ["ops",["operations","project manager","executive assistant","virtual assistant","office manager","business operations","people operations","recruiter","talent acquisition","coordinator","chief of staff"]]
  ];
  function primaryCategory(title){const h=(title||"").toLowerCase();for(const [id,kws] of CLASSIFY){if(kws.some(k=>wordHit(h,k)))return id;}return "other";}
  function catMatch(j){if(N.cat==="all")return true;return primaryCategory(j.title)===N.cat;}
  function pass(j){if(isJunk(j))return false;if((j.title||"").length<3||(j.company||"").length<2)return false;const s=j._sal;if(s&&s<N.minSalary)return false;return true;}
  function score(j){const s=j._sal;let v=0;if(s>=N.minSalary)v+=60+Math.min(60,(s-N.minSalary)/4000);if(isSenior(j))v+=25;if(j._latam===1)v+=20;const dl=strip(j.description).length;if(dl>300)v+=8;if(dl>800)v+=6;if((j.tags||[]).length)v+=4;const days=(Date.now()-new Date(j.created))/864e5;if(days<=2)v+=10;else if(days<=7)v+=5;return v;}

  function render(){
    const box=document.getElementById("jobs"); if(!box) return;
    let jobs=ALL.slice();
    jobs.forEach(j=>{j._sal=salaryOf(j);j._latam=latamScore(j);j._score=score(j);});
    jobs=jobs.filter(j=>!j.relocate).filter(pass).filter(catMatch);
    if(N.latamOnly) jobs=jobs.filter(j=>j._latam===1);
    if(N.query){const q=N.query.toLowerCase();jobs=jobs.filter(j=>(j.title+" "+j.company+" "+(j.tags||[]).join(" ")).toLowerCase().includes(q));}
    const hasSal=j=>(j._sal>0?1:0);
    jobs.sort((a,b)=>((b.direct?1:0)-(a.direct?1:0))||(hasSal(b)-hasSal(a))||(b._score-a._score)||(new Date(b.created)-new Date(a.created)));
    const pool=jobs.slice(0,N.maxJobs), vis=pool.slice(0,shown);
    const rc=document.getElementById("result-count"); if(rc) rc.textContent=T.results(pool.length);
    const lm=document.getElementById("load-more");
    if(!pool.length){box.innerHTML=`<div class="state">${esc(T.none)}</div>`;if(lm)lm.style.display="none";ld([]);return;}
    box.innerHTML=vis.map(j=>{
      const salTxt=j.salary||(j._sal?`$${Math.round(j._sal/1000)}k`:"");
      const sal=salTxt?`<span class="tag salary">${esc(salTxt)}</span>`:"";
      const badge=j._latam===1?`<span class="tag latam">${esc(T.badge)}</span>`:"";
      const direct=j.direct?`<span class="tag direct">${esc(T.direct)}</span>`:"";
      const tags=(j.tags||[]).slice(0,3).map(x=>`<span class="tag">${esc(x)}</span>`).join("");
      return `<a class="job" href="${esc(j.url)}" target="_blank" rel="noopener"><div class="logo">${esc(initials(j.company))}${j.domain?`<img src="https://logo.clearbit.com/${esc(j.domain)}" alt="" loading="lazy" onerror="if(!this.dataset.f){this.dataset.f='1';this.src='https://www.google.com/s2/favicons?domain=${esc(j.domain)}&sz=64'}else{this.style.display='none'}">`:""}</div><div><h3>${esc(j.title)}</h3><div class="co">${esc(j.company)}${j.location?` · ${esc(j.location)}`:""}</div><div class="tags">${direct}${badge}${sal}${tags}</div></div><div class="side"><span class="apply">${esc(j.direct?T.applyDirect:T.apply)}</span><span>${esc(ago(j.created))}</span></div></a>`;
    }).join("");
    if(lm) lm.style.display=pool.length>vis.length?"inline-flex":"none";
    ld(vis);
  }
  function ld(jobs){const el=document.getElementById("jobs-ld");if(!el)return;
    el.textContent=JSON.stringify({"@context":"https://schema.org","@type":"ItemList","itemListElement":jobs.map((j,i)=>({"@type":"ListItem","position":i+1,"item":{"@type":"JobPosting","title":j.title,"description":strip(j.description).slice(0,4000)||j.title,"datePosted":j.created,"employmentType":"FULL_TIME","hiringOrganization":{"@type":"Organization","name":j.company},"jobLocationType":"TELECOMMUTE","applicantLocationRequirements":{"@type":"Country","name":"Latin America"},"url":j.url}}))});}

  async function load(){
    const box=document.getElementById("jobs"); if(box) box.innerHTML=`<div class="state">${esc(T.loading)}</div>`;
    const r=await Promise.all([feedCache(),feedArbeitnow(),feedRemotive(),feedJobicy()]);
    ALL=dedupe([].concat(...r));
    if(!ALL.length){if(box)box.innerHTML=`<div class="state">${esc(T.err)}</div>`;return;}
    const u=document.getElementById("updated");
    if(u)u.textContent=T.updated(new Date().toLocaleTimeString(N.lang==="es"?"es-MX":"en-US",{hour:"2-digit",minute:"2-digit"}));
    render();
  }
  const lm=document.getElementById("load-more"); if(lm) lm.addEventListener("click",()=>{shown+=N.pageSize;render();});
  load(); setInterval(load,30*60*1000);
})();
