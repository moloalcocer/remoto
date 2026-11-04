// Temporary: tries candidate career-board slugs across ATS providers and prints job counts.
const C={
 "DoorDash":["doordash","doordashusa"],"Rippling":["rippling"],"Plaid":["plaid"],"Deel":["deel","deelhq"],
 "Perplexity":["perplexity","perplexityai","perplexity-ai"],"Shopify":["shopify"],"Confluent":["confluent","confluentinc"],
 "Mercury":["mercury","mercurytechnologies"],"Retool":["retool"],"Reddit":["reddit"],"Clay":["clay","claylabs","clay-labs"],
 "Ironclad":["ironclad","ironcladhq","ironcladinc"],"Unity":["unity","unity3d","unitytechnologies"],"ClickHouse":["clickhouse","clickhouseinc"],
 "Larian":["larian","larianstudios","larian-studios"],"Team17":["team17","team17digital","team17-digital","team-17"],
 "SquareEnix":["squareenix","square-enix","squareenixltd","SquareEnix"],"Behaviour":["behaviour","behaviourinteractive","BehaviourInteractive","bhvr"],
 "Canva":["canva"],"Keywords":["keywordsstudios","KeywordsStudios","keywords-studios"],"Ubisoft":["Ubisoft","Ubisoft2","ubisoft"],
 "Netflix":["netflix"]
};
const to=(u)=>fetch(u,{signal:AbortSignal.timeout(8000)});
const A={
 greenhouse:async s=>{const r=await to(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs`);if(!r.ok)return null;return (await r.json()).jobs?.length},
 ashby:async s=>{const r=await to(`https://api.ashbyhq.com/posting-api/job-board/${s}`);if(!r.ok)return null;return (await r.json()).jobs?.length},
 lever:async s=>{const r=await to(`https://api.lever.co/v0/postings/${s}?mode=json`);if(!r.ok)return null;const j=await r.json();return Array.isArray(j)?j.length:null},
 smartrecruiters:async s=>{const r=await to(`https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=100`);if(!r.ok)return null;return (await r.json()).totalFound},
 workable:async s=>{const r=await to(`https://apply.workable.com/api/v1/widget/accounts/${s}`);if(!r.ok)return null;return (await r.json()).jobs?.length},
 recruitee:async s=>{const r=await to(`https://${s}.recruitee.com/api/offers/`);if(!r.ok)return null;return (await r.json()).offers?.length}
};
(async()=>{for(const [n,slugs] of Object.entries(C)){const hits=[];
 await Promise.all(slugs.flatMap(s=>Object.entries(A).map(async([a,f])=>{try{const c=await f(s);if(c)hits.push(`${a}:${s}=${c}`)}catch(e){}})));
 console.log("PROBE",n,"=>",hits.join("  ")||"none");}})();
