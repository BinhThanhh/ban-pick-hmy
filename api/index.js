const DraftEngine = require('../public/js/draft-engine.js');

// Lưu trữ trạng thái phòng trên bộ nhớ Serverless instance (hoặc kết hợp Firebase Realtime DB ở phía Client)
const rooms = global.__HOYO_ROOMS__ || (global.__HOYO_ROOMS__ = new Map());

function getRoom(roomId = 'MAIN') {
  const cleanId = String(roomId || 'MAIN').toUpperCase().trim() || 'MAIN';
  if (!rooms.has(cleanId)) {
    const init = DraftEngine.createInitialRoomState(cleanId);
    init.lastTickAt = Date.now();
    rooms.set(cleanId, init);
  }
  const room = rooms.get(cleanId);
  syncElapsedSeconds(room);
  return room;
}

// Tự động tính số giây đã trôi qua giữa các lần gọi Serverless Function trên Vercel
function syncElapsedSeconds(room) {
  const now = Date.now();
  if (!room.lastTickAt) {
    room.lastTickAt = now;
    return;
  }
  if (room.isPaused || (room.status !== 'DRAFTING' && room.status !== 'LINEUP')) {
    room.lastTickAt = now;
    return;
  }
  const elapsed = Math.floor((now - room.lastTickAt) / 1000);
  if (elapsed > 0) {
    const stepsToTick = Math.min(elapsed, 300);
    for (let i = 0; i < stepsToTick; i++) {
      DraftEngine.tickRoomTimer(room);
    }
    room.lastTickAt += elapsed * 1000;
  }
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const roomId = (parsedUrl.searchParams.get('room') || 'MAIN').toUpperCase();

  // Trên Vercel Serverless không giữ kết nối SSE lâu dài để tránh treo function -> trả về 1 gói dữ liệu rồi đóng để client dùng polling 1s mượt mà
  if (parsedUrl.pathname === '/api/events' && req.method === 'GET') {
    const room = getRoom(roomId);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    const initPayload = JSON.stringify({
      type: 'STATE_UPDATE',
      state: DraftEngine.getSerializedState(room)
    });
    res.status(200).end(`data: ${initPayload}\n\n`);
    return;
  }

  if (parsedUrl.pathname === '/api/rooms' && req.method === 'GET') {
    const list = Array.from(rooms.values()).map((r) => ({
      roomId: r.roomId,
      game: r.game,
      status: r.status,
      stepIndex: r.stepIndex,
      totalSteps: DraftEngine.DRAFT_STEPS.length,
      teamAName: r.teams?.A?.name || 'ĐỘI A',
      teamBName: r.teams?.B?.name || 'ĐỘI B',
      banCountA: (r.teams?.A?.bans || []).filter(Boolean).length,
      banCountB: (r.teams?.B?.bans || []).filter(Boolean).length,
      pickCountA: (r.teams?.A?.picks || []).filter(Boolean).length,
      pickCountB: (r.teams?.B?.picks || []).filter(Boolean).length
    }));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, rooms: list });
    return;
  }

  if (req.method === 'GET') {
    const room = getRoom(roomId);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      state: DraftEngine.getSerializedState(room)
    });
    return;
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body || '{}');
      } else if (Buffer.isBuffer(body)) {
        body = JSON.parse(body.toString('utf8') || '{}');
      } else if (!body || typeof body !== 'object') {
        body = {};
      }
      const targetRoom = getRoom(body.roomId || roomId);
      const result = DraftEngine.applyAction(targetRoom, body);
      targetRoom.lastTickAt = Date.now();
      res.status(result.ok ? 200 : 400).json({
        ...result,
        state: DraftEngine.getSerializedState(targetRoom)
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method Not Allowed' });
};

