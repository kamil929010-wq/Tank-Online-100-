const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const MAX = 25, PORT = process.env.PORT || 3000;

const srv = http.createServer((q, r) => {
  if (q.url === '/status') {
    r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return r.end(JSON.stringify({ online: wss.clients.size, max: MAX }));
  }
  if (q.url === '/' || q.url.startsWith('/?') || q.url === '/index.html') {
    r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return r.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }
  r.writeHead(404); r.end();
});

const wss = new WebSocketServer({ server: srv, maxPayload: 4096 });
let nid = 1;

function send(from, d) {
  const m = JSON.stringify(d);
  for (const c of wss.clients) if (c !== from && c.readyState === 1) c.send(m);
}

wss.on('connection', ws => {
  if (wss.clients.size > MAX) { ws.send('{"t":"full"}'); return ws.close(); }
  ws.id = nid++; ws.alive = true;
  ws.on('pong', () => ws.alive = true);
  ws.send(JSON.stringify({ t: 'hello', id: ws.id }));
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    if (d.t === 'st' || d.t === 'sh' || d.t === 'dead') { d.id = ws.id; send(ws, d); }
    else if (d.t === 'hit') {
      const c = [...wss.clients].find(c => c.id === d.to);
      if (c && c.readyState === 1)
        c.send(JSON.stringify({ t: 'hit', id: ws.id, d: Math.min(150, Math.max(0, +d.d || 0)) }));
    }
  });
  ws.on('close', () => send(ws, { t: 'bye', id: ws.id }));
});

setInterval(() => {
  for (const c of wss.clients) {
    if (!c.alive) { c.terminate(); continue; }
    c.alive = false; c.ping();
  }
}, 15000);

srv.listen(PORT, () => console.log('Танки онлайн: http://localhost:' + PORT));
