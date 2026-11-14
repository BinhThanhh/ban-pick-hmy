const DraftEngine = require('../public/js/draft-engine.js');

// Lưu trữ trạng thái phòng trên bộ nhớ Serverless instance (hoặc kết hợp Firebase Realtime DB ở phía Client)
const rooms = global.__HOYO_ROOMS__ || (global.__HOYO_ROOMS__ = new Map());
const deletedRooms = global.__HOYO_DELETED_ROOMS__ || (global.__HOYO_DELETED_ROOMS__ = new Map());

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
  const roomId = (parsedUrl.searchParams.get('room') || 'MAIN').toUpperCase().trim() || 'MAIN';
  const queryPassToken = parsedUrl.searchParams.get('pt') || '';

  if (parsedUrl.pathname === '/api/rooms' && req.method === 'GET') {
    const list = Array.from(rooms.values()).map((r) => ({
      roomId: r.roomId,
      game: r.game,
      status: r.status,
      hasPassword: Boolean(r.passwordHash),
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

  // Trên Vercel Serverless không giữ kết nối SSE lâu dài để tránh treo function -> trả về 1 gói dữ liệu rồi đóng
  if (parsedUrl.pathname === '/api/events' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');

    if (!rooms.has(roomId) && deletedRooms.has(roomId)) {
      const delPayload = JSON.stringify({ type: 'ROOM_DELETED', deleted: true, roomId });
      res.status(200).end(`data: ${delPayload}\n\n`);
      return;
    }

    const room = getRoom(roomId);
    if (room.passwordHash && queryPassToken !== room.passwordHash) {
      const lockPayload = JSON.stringify({
        type: 'ROOM_LOCKED',
        locked: true,
        hasPassword: true,
        roomId: room.roomId,
        teamAName: room.teams?.A?.name || 'ĐỘI XANH',
        teamBName: room.teams?.B?.name || 'ĐỘI ĐỎ'
      });
      res.status(200).end(`data: ${lockPayload}\n\n`);
      return;
    }

    const initPayload = JSON.stringify({
      type: 'STATE_UPDATE',
      state: DraftEngine.getSerializedState(room)
    });
    res.status(200).end(`data: ${initPayload}\n\n`);
    return;
  }

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');

    if (!rooms.has(roomId) && deletedRooms.has(roomId)) {
      res.status(200).json({ ok: true, deleted: true, roomId });
      return;
    }

    const room = getRoom(roomId);
    if (room.passwordHash && queryPassToken !== room.passwordHash) {
      res.status(200).json({
        ok: true,
        locked: true,
        hasPassword: true,
        roomId: room.roomId,
        teamAName: room.teams?.A?.name || 'ĐỘI XANH',
        teamBName: room.teams?.B?.name || 'ĐỘI ĐỎ'
      });
      return;
    }

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
      const targetRoomId = String(body.roomId || roomId || 'MAIN').toUpperCase().trim() || 'MAIN';

      if (body.isCreateRoom) {
        deletedRooms.delete(targetRoomId);
      } else if (!rooms.has(targetRoomId) && deletedRooms.has(targetRoomId)) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({
          ok: false,
          deleted: true,
          roomId: targetRoomId,
          error: 'Trận đấu này đã kết thúc và phòng đã bị xóa.'
        });
        return;
      }

      let targetRoom = getRoom(targetRoomId);

      if (body.action === 'VERIFY_PASSWORD') {
        const candidate = body.authToken || DraftEngine.hashRoomPassword(body.password || '');
        res.setHeader('Cache-Control', 'no-store');
        if (!targetRoom.passwordHash || candidate === targetRoom.passwordHash) {
          res.status(200).json({
            ok: true,
            authToken: targetRoom.passwordHash || '',
            state: DraftEngine.getSerializedState(targetRoom)
          });
        } else {
          res.status(401).json({
            ok: false,
            authRequired: true,
            error: 'Mật khẩu phòng không chính xác!'
          });
        }
        return;
      }

      if (body.action === 'DELETE_ROOM') {
        res.setHeader('Cache-Control', 'no-store');
        if (body.role !== 'SPEC') {
          res.status(403).json({
            ok: false,
            error: 'Chỉ người xem / Ban Tổ Chức mới có quyền kết thúc và xóa trận đấu!'
          });
          return;
        }
        if (targetRoom.passwordHash && body.authToken !== targetRoom.passwordHash) {
          res.status(401).json({
            ok: false,
            authRequired: true,
            error: 'Cần mở khóa mật khẩu phòng trước khi xóa trận đấu!'
          });
          return;
        }
        rooms.delete(targetRoomId);
        deletedRooms.set(targetRoomId, Date.now());
        res.status(200).json({
          ok: true,
          deleted: true,
          roomId: targetRoomId
        });
        return;
      }

      // Đồng bộ trạng thái mới nhất từ Client nếu request rơi vào một Serverless Instance khác bị cũ (cold/multi-instance)
      if (body.clientSnapshot && typeof body.clientSnapshot === 'object') {
        const snapRev = Number(body.clientSnapshot.revision || 0);
        const curRev = Number(targetRoom.revision || 0);
        const snapPass = String(body.clientSnapshot.passwordHash || '');
        const canRestoreExisting = !targetRoom.passwordHash || body.authToken === targetRoom.passwordHash;
        const canRestoreSnap = !snapPass || body.authToken === snapPass;

        if (snapRev > curRev && canRestoreExisting && canRestoreSnap) {
          targetRoom = DraftEngine.normalizeRoomState(body.clientSnapshot, targetRoomId);
          targetRoom.lastTickAt = Date.now();
          rooms.set(targetRoomId, targetRoom);
        }
      }

      if (body.action === 'SYNC_SNAPSHOT') {
        res.setHeader('Cache-Control', 'no-store');
        if (targetRoom.passwordHash && body.authToken !== targetRoom.passwordHash) {
          res.status(401).json({ ok: false, authRequired: true });
          return;
        }
        res.status(200).json({
          ok: true,
          state: DraftEngine.getSerializedState(targetRoom)
        });
        return;
      }

      const result = DraftEngine.applyAction(targetRoom, body);
      targetRoom.lastTickAt = Date.now();
      res.setHeader('Cache-Control', 'no-store');
      res.status(result.ok ? 200 : 400).json({
        ...result,
        state: result.authRequired ? undefined : DraftEngine.getSerializedState(targetRoom)
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method Not Allowed' });
};
