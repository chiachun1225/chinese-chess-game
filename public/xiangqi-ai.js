/* Local Xiangqi rules and a small, deterministic minimax opponent. No network calls. */
window.XiangqiAI = (() => {
  const values={k:100000,r:900,c:470,n:430,b:220,a:210,p:110};
  const inside=(y,x)=>y>=0&&y<10&&x>=0&&x<9, other=s=>s==='red'?'black':'red';
  const palace=(s,y,x)=>x>=3&&x<=5&&(s==='red'?y>=7&&y<=9:y<=2);
  const crossed=(s,y)=>s==='red'?y<=4:y>=5;
  function initialBoard(){const b=Array.from({length:10},()=>Array(9).fill(null)),back=['r','n','b','a','k','a','b','n','r'];back.forEach((t,x)=>{b[0][x]={type:t,side:'black'};b[9][x]={type:t,side:'red'}});b[2][1]=b[2][7]={type:'c',side:'black'};b[7][1]=b[7][7]={type:'c',side:'red'};[0,2,4,6,8].forEach(x=>{b[3][x]={type:'p',side:'black'};b[6][x]={type:'p',side:'red'}});return b}
  const clone=b=>b.map(row=>row.map(p=>p&&({...p})));
  const apply=(b,f,t)=>{const n=clone(b);n[t.y][t.x]=n[f.y][f.x];n[f.y][f.x]=null;return n};
  function pseudo(b,y,x){const p=b[y][x];if(!p)return[];const o=[],add=(ny,nx)=>{if(inside(ny,nx)&&(!b[ny][nx]||b[ny][nx].side!==p.side))o.push([ny,nx])};
    if(p.type==='r'||p.type==='c')[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dy,dx])=>{let ny=y+dy,nx=x+dx,j=false;while(inside(ny,nx)){const q=b[ny][nx];if(p.type==='r'){if(!q)o.push([ny,nx]);else{if(q.side!==p.side)o.push([ny,nx]);break}}else if(!j){if(!q)o.push([ny,nx]);else j=true}else if(q){if(q.side!==p.side)o.push([ny,nx]);break}ny+=dy;nx+=dx}});
    else if(p.type==='n')[[-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],[-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1]].forEach(([dy,dx,ly,lx])=>{if(!b[y+ly]?.[x+lx])add(y+dy,x+dx)});
    else if(p.type==='b')[[-2,-2],[-2,2],[2,-2],[2,2]].forEach(([dy,dx])=>{const ny=y+dy,nx=x+dx;if((p.side==='red'?ny>=5:ny<=4)&&inside(ny,nx)&&!b[y+dy/2][x+dx/2])add(ny,nx)});
    else if(p.type==='a')[[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dy,dx])=>palace(p.side,y+dy,x+dx)&&add(y+dy,x+dx));
    else if(p.type==='k'){[[-1,0],[1,0],[0,-1],[0,1]].forEach(([dy,dx])=>palace(p.side,y+dy,x+dx)&&add(y+dy,x+dx));let ny=y+(p.side==='red'?-1:1);while(inside(ny,x)){if(b[ny][x]){if(b[ny][x].type==='k'&&b[ny][x].side!==p.side)o.push([ny,x]);break}ny+=p.side==='red'?-1:1}}
    else {add(y+(p.side==='red'?-1:1),x);if(crossed(p.side,y)){add(y,x-1);add(y,x+1)}}return o}
  function check(b,s){let k;for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(b[y][x]?.type==='k'&&b[y][x].side===s)k={y,x};if(!k)return true;const foe=other(s);for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(b[y][x]?.side===foe&&pseudo(b,y,x).some(([ny,nx])=>ny===k.y&&nx===k.x))return true;return false}
  function moves(b,s){const out=[];for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(b[y][x]?.side===s)for(const [ny,nx]of pseudo(b,y,x)){const n=apply(b,{y,x},{y:ny,x:nx});if(!check(n,s))out.push({from:{y,x},to:{y:ny,x:nx},capture:b[ny][nx]})}return out}
  function evalBoard(b){let score=0;for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=b[y][x];if(!p)continue;let v=values[p.type];if(p.type==='p')v+=(p.side==='black'?y:9-y)*12+(crossed(p.side,y)?45:0);if(p.type==='n'||p.type==='c')v+=Math.max(0,36-(Math.abs(4-x)+Math.abs(4.5-y))*7);if(p.type==='k')v-=palace(p.side,y,x)?0:300;score+=p.side==='black'?v:-v}if(check(b,'red'))score+=55;if(check(b,'black'))score-=55;return score}
  function order(list){return list.sort((a,b)=>(b.capture?values[b.capture.type]:0)-(a.capture?values[a.capture.type]:0))}
  function search(b,side,depth,a,z){const list=order(moves(b,side));if(!list.length)return side==='black'?-999999-depth:999999+depth;if(!depth)return evalBoard(b);if(side==='black'){let best=-Infinity;for(const m of list){best=Math.max(best,search(apply(b,m.from,m.to),'red',depth-1,a,z));a=Math.max(a,best);if(a>=z)break}return best}let best=Infinity;for(const m of list){best=Math.min(best,search(apply(b,m.from,m.to),'black',depth-1,a,z));z=Math.min(z,best);if(a>=z)break}return best}
  function choose(b,difficulty){const depth={easy:1,normal:2,hard:3}[difficulty]||2,list=order(moves(b,'black'));let best=-Infinity,pick=list[0];for(const m of list){const score=search(apply(b,m.from,m.to),'red',depth-1,-Infinity,Infinity);if(score>best){best=score;pick=m}}return pick}
  return {initialBoard,apply,moves,check,choose};
})();
