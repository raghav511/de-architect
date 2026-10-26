const {chromium}=require(process.env.PW||'playwright');const fs=require('fs');const AXE_PATH=process.env.AXE||'/tmp/axe.min.js';if(!fs.existsSync(AXE_PATH)){require('child_process').execSync('curl -s -o '+AXE_PATH+' https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js');}const AXE=fs.readFileSync(AXE_PATH,'utf8');const BASE=process.argv[2]||'http://localhost:8811/';let bad=0;
const R=['#/today','#/path/a01','#/learn/a01/chapter','#/quiz/a01','#/interview/a01','#/git/1','#/design/a01','#/projects','#/project/ai-1','#/news','#/progress','#/practice','#/dsa/d011','#/sql/q011','#/py/y011','#/path/p01','#/learn/p01/chapter','#/learn/p01/practice','#/quiz/p01','#/practice/py','#/practice/review','#/path/m01','#/learn/m01/chapter','#/sql/qm011','#/practice/model','#/design/m03','#/learn/j01/chapter','#/learn/r01/practice','#/spark/pj011','#/sql/qr011','#/learn/d01/chapter','#/py/yd012','#/mock','#/coach'];
(async()=>{const b=await chromium.launch(process.env.CHROME?{executablePath:process.env.CHROME}:{});
for (const scheme of ['light','dark']){const cx=await b.newContext({colorScheme:scheme});await cx.route('http://127.0.0.1:8765/**', r => r.abort()); /* never reach a real grader installed on this Mac */
const p=await cx.newPage();const agg={};
for(const r of R){await p.goto(BASE+r);await p.waitForTimeout(1000);await p.addScriptTag({content:AXE});
const res=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:['wcag2a','wcag2aa']});return r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,ex:v.nodes.slice(0,2).map(x=>x.target.join(' ')+' | '+(x.failureSummary||'').split('\n')[1])}))});
bad+=res.length;res.forEach(v=>{const k=v.id;agg[k]=agg[k]||{impact:v.impact,n:0,pages:[],ex:v.ex};agg[k].n+=v.n;agg[k].pages.push(r);});}
console.log('==',scheme);for(const[k,v] of Object.entries(agg))console.log(k,v.impact,v.n,v.pages.slice(0,5).join(','),'\n   ',v.ex.join('\n    '));}
await b.close();console.log(bad+' violations');process.exit(bad?1:0)})();
