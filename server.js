const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const rooms = new Map();

function randomRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  do { id = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); } while (rooms.has(id));
  return id;
}

function initialBoard() {
  const b = Array.from({ length: 10 }, () => Array(9).fill(null));
  const back = ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'];
  back.forEach((type, x) => { b[0][x] = { type, side: 'black' }; b[9][x] = { type, side: 'red' }; });
  b[2][1] = b[2][7] = { type: 'c', side: 'black' };
  b[7][1] = b[7][7] = { type: 'c', side: 'red' };
  [0, 2, 4, 6, 8].forEach(x => { b[3][x] = { type: 'p', side: 'black' }; b[6][x] = { type: 'p', side: 'red' }; });
  return b;
}

function inside(y, x) { return y >= 0 && y < 10 && x >= 0 && x < 9; }
function palace(side, y, x) { return x >= 3 && x <= 5 && (side === 'red' ? y >= 7 && y <= 9 : y >= 0 && y <= 2); }
function crossed(side, y) { return side === 'red' ? y <= 4 : y >= 5; }
function opposite(side) { return side === 'red' ? 'black' : 'red'; }

function pseudoMoves(board, y, x) {
  const piece = board[y][x]; if (!piece) return [];
  const { side, type } = piece, out = [];
  const add = (ny, nx) => { if (inside(ny, nx) && (!board[ny][nx] || board[ny][nx].side !== side)) out.push([ny, nx]); };
  if (type === 'r' || type === 'c') {
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dy,dx]) => {
      let ny=y+dy,nx=x+dx, jumped=false;
      while (inside(ny,nx)) {
        const target=board[ny][nx];
        if (type === 'r') { if (!target) out.push([ny,nx]); else { if (target.side !== side) out.push([ny,nx]); break; } }
        else if (!jumped) { if (!target) out.push([ny,nx]); else jumped=true; }
        else if (target) { if (target.side !== side) out.push([ny,nx]); break; }
        ny+=dy; nx+=dx;
      }
    });
  } else if (type === 'n') {
    [[-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],[-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1]].forEach(([dy,dx,ly,lx]) => { if (!inside(y+ly,x+lx) || !board[y+ly][x+lx]) add(y+dy,x+dx); });
  } else if (type === 'b') {
    [[-2,-2],[-2,2],[2,-2],[2,2]].forEach(([dy,dx]) => { const ny=y+dy,nx=x+dx; if ((side === 'red' ? ny >= 5 : ny <= 4) && inside(ny,nx) && !board[y+dy/2][x+dx/2]) add(ny,nx); });
  } else if (type === 'a') {
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dy,dx]) => { const ny=y+dy,nx=x+dx; if (palace(side,ny,nx)) add(ny,nx); });
  } else if (type === 'k') {
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dy,dx]) => { const ny=y+dy,nx=x+dx; if (palace(side,ny,nx)) add(ny,nx); });
    const dir=side === 'red' ? -1 : 1; let ny=y+dir;
    while (inside(ny,x)) { if (board[ny][x]) { if (board[ny][x].type === 'k' && board[ny][x].side !== side) out.push([ny,x]); break; } ny+=dir; }
  } else if (type === 'p') {
    add(y + (side === 'red' ? -1 : 1), x);
    if (crossed(side,y)) { add(y,x-1); add(y,x+1); }
  }
  return out;
}

function clone(board) { return board.map(row => row.map(p => p ? { ...p } : null)); }
function applyMove(board, from, to) { const b=clone(board); b[to.y][to.x]=b[from.y][from.x]; b[from.y][from.x]=null; return b; }
function inCheck(board, side) {
  let king=null;
  for (let y=0;y<10;y++) for (let x=0;x<9;x++) if (board[y][x]?.type === 'k' && board[y][x].side === side) king={y,x};
  if (!king) return true;
  const foe=opposite(side);
  for (let y=0;y<10;y++) for (let x=0;x<9;x++) if (board[y][x]?.side === foe && pseudoMoves(board,y,x).some(([ny,nx])=>ny===king.y&&nx===king.x)) return true;
  return false;
}
function legalMoves(board,y,x) { const p=board[y][x]; if (!p) return []; return pseudoMoves(board,y,x).filter(([ny,nx]) => !inCheck(applyMove(board,{y,x},{y:ny,x:nx}),p.side)); }
function hasMove(board, side) { for(let y=0;y<10;y++) for(let x=0;x<9;x++) if(board[y][x]?.side===side && legalMoves(board,y,x).length) return true; return false; }
function send(ws, data) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data)); }
function roomState(room) { return { type:'state', roomId:room.id, board:room.board, turn:room.turn, players:room.players, status:room.status, winner:room.winner, lastMove:room.lastMove }; }
function broadcast(room, data=roomState(room)) { room.clients.forEach(ws => send(ws,data)); }

const server=http.createServer((req,res)=>{
  let file=req.url === '/' ? 'index.html' : req.url.replace(/^\//,'');
  file=path.normalize(file).replace(/^\.\.(\\|\/|$)/,'');
  const target=path.join(publicDir,file);
  fs.readFile(target,(err,data)=>{ if(err){res.writeHead(404);return res.end('Not found');} const ext=path.extname(target); res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml'})[ext]||'application/octet-stream'});res.end(data); });
});
const wss=new WebSocketServer({server});
wss.on('connection',ws=>{
  ws.roomId=null; ws.side=null;
  ws.on('message',raw=>{ let msg; try{msg=JSON.parse(raw);}catch{return;}
    if(msg.type==='create') { const id=randomRoomId(); const room={id,board:initialBoard(),turn:'red',players:{red:msg.name?.slice(0,18)||'紅方玩家',black:null},clients:new Set(),status:'waiting',winner:null,lastMove:null}; rooms.set(id,room); room.clients.add(ws);ws.roomId=id;ws.side='red';send(ws,roomState(room));return; }
    if(msg.type==='join') { const id=String(msg.roomId||'').toUpperCase(),room=rooms.get(id); if(!room){send(ws,{type:'error',message:'找不到這個房間'});return;} if(!room.players.black){room.players.black=msg.name?.slice(0,18)||'黑方玩家';room.status='playing';ws.side='black';} else {ws.side='viewer';} ws.roomId=id;room.clients.add(ws);broadcast(room);return; }
    const room=rooms.get(ws.roomId); if(!room) return;
    if(msg.type==='move' && room.status==='playing' && ws.side===room.turn) { const {from,to}=msg; if(!from||!to||![from.y,from.x,to.y,to.x].every(Number.isInteger)||!inside(from.y,from.x)||!inside(to.y,to.x))return; const p=room.board[from.y][from.x]; const legal=p?.side===ws.side && legalMoves(room.board,from.y,from.x); if(!legal?.some(([y,x])=>y===to.y&&x===to.x)){send(ws,{type:'error',message:'這步棋不合法'});return;} room.board=applyMove(room.board,from,to);room.lastMove={from,to};room.turn=opposite(room.turn); if(!hasMove(room.board,room.turn)){room.status='finished';room.winner=ws.side;} broadcast(room); }
    if(msg.type==='restart' && ws.side !== 'viewer'){room.board=initialBoard();room.turn='red';room.status=room.players.black?'playing':'waiting';room.winner=null;room.lastMove=null;broadcast(room);}
  });
  ws.on('close',()=>{const room=rooms.get(ws.roomId);if(!room)return;room.clients.delete(ws); if(ws.side==='black'){room.players.black=null;room.status='waiting';room.turn='red';room.board=initialBoard();room.lastMove=null;} broadcast(room); if(!room.clients.size) setTimeout(()=>{if(!room.clients.size)rooms.delete(room.id);},60*60*1000);});
});
server.listen(PORT,()=>console.log(`Xiangqi is running on http://localhost:${PORT}`));
