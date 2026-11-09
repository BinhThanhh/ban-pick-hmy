const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let DraftEngine = require('./public/js/draft-engine.js');
const draftEnginePath = path.join(__dirname, 'public', 'js', 'draft-engine.js');
fs.watchFile(draftEnginePath, { interval: 1000 }, () => {
  try {
    delete require.cache[require.resolve('./public/js/draft-engine.js')];
    DraftEngine = require('./public/js/draft-engine.js');
  } catch (e) {}
});

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const DRAFT_STEPS = DraftEngine.DRAFT_STEPS;

const rooms = new Map();
rooms.set('MAIN', DraftEngine.createInitialRoomState('MAIN'));

function getRoom(roomId = 'MAIN') {
  const cleanId = String(roomId || 'MAIN').toUpperCase().trim() || 'MAIN';
  if (!rooms.has(cleanId)) {
    rooms.set(cleanId, DraftEngine.createInitialRoomState(cleanId));
  }
  return rooms.get(cleanId);
}

function getSerializedState(room) {
  return DraftEngine.getSerializedState(room);
}

const sseClients = new Set();
const wsClients = new Set();

function broadcastRoomState(room) {
  const payload = JSON.stringify({
    type: 'STATE_UPDATE',
    state: getSerializedState(room)
  });

  for (const client of sseClients) {
    if (client.roomId === room.roomId) {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
  }

  const wsFrame = encodeWsFrame(payload);
  for (const client of wsClients) {
    if (client.roomId === room.roomId && client.socket.writable) {
      try {
        client.socket.write(wsFrame);
      } catch (e) {
        wsClients.delete(client);
      }
    }
  }
}

setInterval(() => {
  for (const room of rooms.values()) {
    const changed = DraftEngine.tickRoomTimer(room);
    if (changed) {
      broadcastRoomState(room);
    }
  }
}, 1000);

function handleClientAction(room, body) {
  const res = DraftEngine.applyAction(room, body);
  if (res.ok) {
    broadcastRoomState(room);
  }
  return res;
}

function encodeWsFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeWsFrame(buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 0x0f;
  if (opcode === 0x08) return { type: 'CLOSE' };
  if (opcode === 0x09) return { type: 'PING' };
  const isMasked = (buffer[1] & 0x80) !== 0;
  let payloadLen = buffer[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let maskKey = null;
  if (isMasked) {
    if (buffer.length < offset + 4) return null;
    maskKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLen) return null;
  const data = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) {
    data[i] = isMasked ? buffer[offset + i] ^ maskKey[i % 4] : buffer[offset + i];
  }

  return { type: 'TEXT', text: data.toString('utf8') };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const roomId = (parsedUrl.searchParams.get('room') || 'MAIN').toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/rooms' && req.method === 'GET') {
    const list = Array.from(rooms.values()).map((r) => ({
      roomId: r.roomId,
      game: r.game,
      status: r.status,
      stepIndex: r.stepIndex,
      totalSteps: DRAFT_STEPS.length,
      teamAName: r.teams?.A?.name || 'ĐỘI A',
      teamBName: r.teams?.B?.name || 'ĐỘI B',
      banCountA: (r.teams?.A?.bans || []).filter(Boolean).length,
      banCountB: (r.teams?.B?.bans || []).filter(Boolean).length,
      pickCountA: (r.teams?.A?.picks || []).filter(Boolean).length,
      pickCountB: (r.teams?.B?.picks || []).filter(Boolean).length
    }));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, rooms: list }));
    return;
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    const room = getRoom(roomId);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, state: getSerializedState(room) }));
    return;
  }

  if (pathname === '/api/events' && req.method === 'GET') {
    const room = getRoom(roomId);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    const client = { roomId: room.roomId, res };
    sseClients.add(client);

    const initPayload = JSON.stringify({
      type: 'STATE_UPDATE',
      state: getSerializedState(room)
    });
    res.write(`data: ${initPayload}\n\n`);

    req.on('close', () => {
      sseClients.delete(client);
    });
    return;
  }

  if (pathname === '/api/action' && req.method === 'POST') {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(rawBody || '{}');
        const targetRoom = getRoom(body.roomId || roomId);
        const result = handleClientAction(targetRoom, body);
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ...result, state: getSerializedState(targetRoom) }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' }));
      }
    });
    return;
  }

  let safePath = path.normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const roomId = (parsedUrl.searchParams.get('room') || 'MAIN').toUpperCase();
  const room = getRoom(roomId);

  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n'
    ].join('\r\n')
  );

  const client = { roomId: room.roomId, socket };
  wsClients.add(client);

  socket.write(
    encodeWsFrame(
      JSON.stringify({
        type: 'STATE_UPDATE',
        state: getSerializedState(room)
      })
    )
  );

  socket.on('data', (buffer) => {
    try {
      const frame = decodeWsFrame(buffer);
      if (!frame) return;
      if (frame.type === 'CLOSE') {
        wsClients.delete(client);
        socket.end();
        return;
      }
      if (frame.type === 'TEXT') {
        const msg = JSON.parse(frame.text);
        const targetRoom = getRoom(msg.roomId || client.roomId);
        handleClientAction(targetRoom, msg);
      }
    } catch (e) {}
  });

  socket.on('close', () => wsClients.delete(client));
  socket.on('error', () => wsClients.delete(client));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=====================================================`);
    console.log(`🎮 HoYoverse Ban/Pick Server đang chạy tại:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`=====================================================`);
  });
}

module.exports = {
  server,
  DRAFT_STEPS,
  getRoom,
  getSerializedState,
  handleClientAction
};
