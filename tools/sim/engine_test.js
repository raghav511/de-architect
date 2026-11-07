/* Design simulator engine check: node tools/sim/engine_test.js. Every scenario must fail as given and pass once fixed the way its hint says. */
const fs=require('fs'),vm=require('vm');const src=fs.readFileSync(require('path').join(__dirname,'../../js/sim.js'),'utf8');
const ctx={console,S:{},Date,Math,JSON};vm.createContext(ctx);vm.runInContext(src+';this.SIM=SIM;this.SIM_SC=SIM_SC;this.simFromSc=simFromSc;this.simReview=simReview',ctx);
const {SIM,SIM_SC,simFromSc}=ctx;
const N=(d,k)=>d.nodes.find(n=>n.k===k);const add=(d,k,o)=>{const id='x'+d.nodes.length;d.nodes.push(Object.assign({id,k,x:0,y:0},o||{}));return id;};const wire=(d,a,b)=>d.edges.push({id:'w'+d.edges.length,a,b});
const fix={skeleton:d=>{N(d,'stream').n=2},partitions:d=>{N(d,'kafka').parts=12;N(d,'stream').n=12},hotkey:d=>{N(d,'kafka').parts=48;N(d,'stream').n=24},spark:d=>{N(d,'spark').n=5},
cdc:d=>{N(d,'cdc').n=2},serving:d=>{N(d,'svc').n=30;const pg=N(d,'pg'),sv=N(d,'svc');d.edges=d.edges.filter(e=>e.b!==pg.id);const c=add(d,'cache');wire(d,sv.id,c);wire(d,c,pg.id)},
stampede:d=>{N(d,'pg').n=6},failover:d=>{N(d,'pg').standby=true},zone:d=>{N(d,'svc').n=12;N(d,'cache').n=2;N(d,'pg').n=3},budget:d=>{N(d,'svc').n=13;N(d,'pg').n=1;N(d,'cache').n=1},
spike:d=>{N(d,'svc').auto=true;N(d,'svc').max=40;N(d,'gw').n=2},partner:d=>{const sv=N(d,'svc'),ex=N(d,'ext');d.edges=d.edges.filter(e=>e.b!==ex.id);const q=add(d,'queue'),f=add(d,'fn');wire(d,sv.id,q);wire(d,q,f);wire(d,f,ex.id)},
dlq:d=>{const q=add(d,'dlq');wire(d,N(d,'stream').id,q)},schema:d=>{const r=add(d,'registry');wire(d,N(d,'producer').id,r)},dashboards:d=>{const w=N(d,'wh'),b=N(d,'bi');d.edges=[];const o=add(d,'olap');wire(d,b.id,o)},
rag:d=>{const sv=N(d,'svc'),l=N(d,'llm');d.edges=d.edges.filter(e=>e.b!==l.id);const c=add(d,'cache',{hit:0.6});wire(d,sv.id,c);wire(d,c,l.id)}};
let bad=0;SIM_SC.forEach(sc=>{const d0=simFromSc(sc),g0=SIM.grade(d0,sc);const d1=simFromSc(sc);(fix[sc.id]||(()=>{}))(d1);const g1=SIM.grade(d1,sc);
const ok=!g0.pass&&g1.pass;if(!ok)bad++;console.log((ok?'ok  ':'BAD ')+sc.id.padEnd(11),'start:',g0.res.map(r=>r[1]+(r[3]?'✓':'✗')).join(' '),'| fixed:',g1.res.map(r=>r[1]+(r[3]?'✓':'✗')).join(' '));});
process.exit(bad?1:0);
