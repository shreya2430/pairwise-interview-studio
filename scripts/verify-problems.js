// Runs every test against a reference solution, and confirms the starter code fails.
const PROBLEMS = require('../src/problems.js');
const REF = {
  'rate-limiter': `class RateLimiter{constructor(l,w){this.l=l;this.w=w;this.m=new Map()}
_q(id,t){let q=this.m.get(id);if(!q){q=[];this.m.set(id,q)}while(q.length&&q[0]<=t-this.w)q.shift();return q}
allow(id,t){const q=this._q(id,t);if(q.length<this.l){q.push(t);return true}return false}
retryAfter(id,t){const q=this._q(id,t);if(q.length<this.l)return 0;return q[0]+this.w-t}}`,
  'ttl-cache': `class TTLCache{constructor(c){this.c=c;this.m=new Map()}
get(k,now){const e=this.m.get(k);if(!e)return -1;if(now>=e.exp){this.m.delete(k);return -1}this.m.delete(k);this.m.set(k,e);return e.v}
put(k,v,ttl,now){if(this.m.has(k))this.m.delete(k);else if(this.m.size>=this.c){for(const [kk,e] of this.m)if(now>=e.exp)this.m.delete(kk);if(this.m.size>=this.c){this.m.delete(this.m.keys().next().value)}}this.m.set(k,{v,exp:now+ttl})}
size(now){let n=0;for(const e of this.m.values())if(now<e.exp)n++;return n}}`,
  'free-slots': `function findFreeSlots(cals, day, dur){const toM=s=>{const[h,m]=s.split(':').map(Number);return h*60+m};const toS=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const ds=toM(day[0]),de=toM(day[1]);const iv=cals.flat().map(([a,b])=>[Math.max(toM(a),ds),Math.min(toM(b),de)]).filter(([a,b])=>a<b).sort((x,y)=>x[0]-y[0]);
const out=[];let cur=ds;for(const[a,b] of iv){if(a-cur>=dur)out.push([toS(cur),toS(a)]);cur=Math.max(cur,b)}if(de-cur>=dur)out.push([toS(cur),toS(de)]);return out}`,
  'reconcile': `function reconcile(orders,payments){const tot=new Map();for(const p of payments){const k=p.orderId.toUpperCase();tot.set(k,(tot.get(k)||0)+Math.round(p.amount*100))}
const r={paid:[],unpaid:[],overpaid:[],unmatchedPayments:[]};const ids=new Set();
for(const o of orders){const k=o.id.toUpperCase();ids.add(k);const rec=tot.get(k)||0;const due=Math.round(o.total*100);if(rec===due)r.paid.push(o.id);else if(rec>due)r.overpaid.push(o.id);else r.unpaid.push(o.id)}
for(const k of tot.keys())if(!ids.has(k))r.unmatchedPayments.push(k);for(const a of Object.values(r))a.sort();return r}`,
  'install-order': `function installOrder(pk){const all=new Set(Object.keys(pk));for(const d of Object.values(pk))d.forEach(x=>all.add(x));const indeg=new Map(),rev=new Map();for(const n of all){indeg.set(n,0);rev.set(n,[])}
for(const [n,ds] of Object.entries(pk))for(const d of new Set(ds)){indeg.set(n,indeg.get(n)+1);rev.get(d).push(n)}
let ready=[...all].filter(n=>indeg.get(n)===0).sort();const out=[];while(ready.length){const n=ready.shift();out.push(n);for(const m of rev.get(n)){indeg.set(m,indeg.get(m)-1);if(indeg.get(m)===0){ready.push(m);ready.sort()}}}
if(out.length!==all.size)throw new Error("Cycle detected");return out}`,
  'slow-endpoints': `function slowestEndpoints(lines,k){const g=new Map();const re=/^\\S+\\s+([A-Z]+)\\s+(\\S+)\\s+(\\d{3})\\s+(\\d+)ms$/;
for(const l of lines){const m=re.exec(l.trim());if(!m)continue;const path=m[2].split('?')[0].split('/').map(s=>/^\\d+$/.test(s)?':id':s).join('/');const key=m[1]+' '+path;if(!g.has(key))g.set(key,[]);g.get(key).push(+m[4])}
const res=[];for(const[e,a]of g){a.sort((x,y)=>x-y);res.push({endpoint:e,p95:a[Math.ceil(0.95*a.length)-1],count:a.length})}
res.sort((x,y)=>y.p95-x.p95||(x.endpoint<y.endpoint?-1:x.endpoint>y.endpoint?1:0));return res.slice(0,k)}`,
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const run = (code, tests) => {
  const runner = new Function('__tests', code + '\n;return __tests.map(function(__t){ try { var r = eval("(function(){" + __t.src + "\\n})")(); return { name: __t.name, pass: JSON.stringify(r[0]) === JSON.stringify(r[1]), got: JSON.stringify(r[0]), exp: JSON.stringify(r[1]) }; } catch (e) { return { name: __t.name, pass: false, got: "ERR " + e.message }; } });');
  return runner(tests);
};
let bad = 0;
for (const p of PROBLEMS) {
  const t0 = Date.now();
  const ref = run(REF[p.id], [...p.tests, ...p.hidden]);
  const ms = Date.now() - t0;
  for (const r of ref) if (!r.pass) { bad++; console.log('REF FAIL', p.id, r.name, 'got', r.got, 'exp', r.exp); }
  let starterPass = 0;
  try { starterPass = run(p.starter, [...p.tests, ...p.hidden]).filter(r => r.pass).length; } catch (e) { starterPass = 'compile err ' + e.message; }
  console.log(p.id.padEnd(16), 'ref', ref.filter(r => r.pass).length + '/' + ref.length, ms + 'ms', '| starter passes', starterPass);
}
process.exit(bad ? 1 : 0);
