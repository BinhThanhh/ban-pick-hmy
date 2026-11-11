/**
 * Bộ máy xử lý Quy luật Ban/Pick (Cấm 5 - Chọn 8) dùng chung cho cả:
 * 1. Cloud Serverless / Static + Firebase Realtime Database (100% Free trên Vercel / Firebase Hosting)
 * 2. Local Node.js Server (server.js)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DRAFT_ENGINE = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function buildDraftSteps() {
    const rawClusters = [
      // Phase 1 Bans (3 ban mỗi bên)
      { phase: 1, type: 'BAN', team: 'A', count: 2, duration: 45, label: 'Giai đoạn 1 - Đội A Cấm (2)' },
      { phase: 1, type: 'BAN', team: 'B', count: 2, duration: 45, label: 'Giai đoạn 1 - Đội B Cấm (2)' },
      { phase: 1, type: 'BAN', team: 'A', count: 1, duration: 45, label: 'Giai đoạn 1 - Đội A Cấm (1)' },
      { phase: 1, type: 'BAN', team: 'B', count: 1, duration: 45, label: 'Giai đoạn 1 - Đội B Cấm (1)' },
      // Phase 1 Picks (4 pick mỗi bên)
      { phase: 1, type: 'PICK', team: 'A', count: 1, duration: 60, label: 'Giai đoạn 1 - Đội A Chọn (1)' },
      { phase: 1, type: 'PICK', team: 'B', count: 2, duration: 60, label: 'Giai đoạn 1 - Đội B Chọn (2)' },
      { phase: 1, type: 'PICK', team: 'A', count: 2, duration: 60, label: 'Giai đoạn 1 - Đội A Chọn (2)' },
      { phase: 1, type: 'PICK', team: 'B', count: 2, duration: 60, label: 'Giai đoạn 1 - Đội B Chọn (2)' },
      { phase: 1, type: 'PICK', team: 'A', count: 1, duration: 60, label: 'Giai đoạn 1 - Đội A Chọn (1)' },
      // Phase 2 Bans (thêm 2 ban mỗi bên -> Tổng 5 ban)
      { phase: 2, type: 'BAN', team: 'B', count: 1, duration: 45, label: 'Giai đoạn 2 - Đội B Cấm (4/5)' },
      { phase: 2, type: 'BAN', team: 'A', count: 1, duration: 45, label: 'Giai đoạn 2 - Đội A Cấm (4/5)' },
      { phase: 2, type: 'BAN', team: 'B', count: 1, duration: 45, label: 'Giai đoạn 2 - Đội B Cấm (5/5)' },
      { phase: 2, type: 'BAN', team: 'A', count: 1, duration: 45, label: 'Giai đoạn 2 - Đội A Cấm (5/5)' },
      // Phase 2 Picks (thêm 4 pick mỗi bên -> Tổng 8 pick)
      { phase: 2, type: 'PICK', team: 'B', count: 1, duration: 60, label: 'Giai đoạn 2 - Đội B Chọn (Nhân vật thứ 5)' },
      { phase: 2, type: 'PICK', team: 'A', count: 2, duration: 60, label: 'Giai đoạn 2 - Đội A Chọn (2)' },
      { phase: 2, type: 'PICK', team: 'B', count: 2, duration: 60, label: 'Giai đoạn 2 - Đội B Chọn (2)' },
      { phase: 2, type: 'PICK', team: 'A', count: 2, duration: 60, label: 'Giai đoạn 2 - Đội A Chọn (2)' },
      { phase: 2, type: 'PICK', team: 'B', count: 1, duration: 60, label: 'Giai đoạn 2 - Đội B Chọn (Nhân vật thứ 8)' }
    ];

    const steps = [];
    const slotCounters = { A_BAN: 0, B_BAN: 0, A_PICK: 0, B_PICK: 0 };

    rawClusters.forEach((cluster, clusterIndex) => {
      for (let i = 0; i < cluster.count; i++) {
        const key = `${cluster.team}_${cluster.type}`;
        const slotIndex = slotCounters[key]++;
        steps.push({
          stepIndex: steps.length,
          clusterIndex,
          phase: cluster.phase,
          type: cluster.type,
          team: cluster.team,
          slotIndex,
          subTurn: i + 1,
          subTotal: cluster.count,
          duration: cluster.duration,
          label: cluster.count > 1 ? `${cluster.label} • Lượt ${i + 1}/${cluster.count}` : cluster.label
        });
      }
    });

    return steps;
  }

  const DRAFT_STEPS = buildDraftSteps();

  // Danh sách nhân vật mặc định phục vụ Random Pick khi hết giờ (đồng bộ cả Server & Client)
  const DEFAULT_CHAR_POOL = [
    { id: 'mavuika', name: 'Mavuika (Hỏa Thần)' },
    { id: 'citlali', name: 'Citlali' },
    { id: 'chasca', name: 'Chasca' },
    { id: 'xilonen', name: 'Xilonen' },
    { id: 'kinich', name: 'Kinich' },
    { id: 'mualani', name: 'Mualani' },
    { id: 'emilie', name: 'Emilie' },
    { id: 'sigewinne', name: 'Sigewinne' },
    { id: 'clorinde', name: 'Clorinde' },
    { id: 'arlecchino', name: 'Arlecchino' },
    { id: 'chiori', name: 'Chiori' },
    { id: 'xianyun', name: 'Xianyun (Lưu Vân)' },
    { id: 'navia', name: 'Navia' },
    { id: 'furina', name: 'Furina (Thủy Thần)' },
    { id: 'wriothesley', name: 'Wriothesley' },
    { id: 'neuvillette', name: 'Neuvillette' },
    { id: 'lyney', name: 'Lyney' },
    { id: 'baizhu', name: 'Baizhu' },
    { id: 'dehya', name: 'Dehya' },
    { id: 'alhaitham', name: 'Alhaitham' },
    { id: 'wanderer', name: 'Kẻ Lang Thang' },
    { id: 'nahida', name: 'Nahida (Thảo Thần)' },
    { id: 'nilou', name: 'Nilou' },
    { id: 'cyno', name: 'Cyno' },
    { id: 'tighnari', name: 'Tighnari' },
    { id: 'yelan', name: 'Yelan' },
    { id: 'kamisato_ayato', name: 'Kamisato Ayato' },
    { id: 'yae_miko', name: 'Yae Miko' },
    { id: 'shenhe', name: 'Shenhe' },
    { id: 'arataki_itto', name: 'Arataki Itto' },
    { id: 'sangonomiya_kokomi', name: 'Sangonomiya Kokomi' },
    { id: 'raiden_shogun', name: 'Raiden Shogun (Lôi Thần)' },
    { id: 'yoimiya', name: 'Yoimiya' },
    { id: 'kamisato_ayaka', name: 'Kamisato Ayaka' },
    { id: 'kaedehara_kazuha', name: 'Kaedehara Kazuha' },
    { id: 'eula', name: 'Eula' },
    { id: 'hu_tao', name: 'Hu Tao' },
    { id: 'xiao', name: 'Xiao' },
    { id: 'ganyu', name: 'Ganyu' },
    { id: 'albedo', name: 'Albedo' },
    { id: 'zhongli', name: 'Zhongli (Nham Thần)' },
    { id: 'tartaglia', name: 'Tartaglia (Childe)' },
    { id: 'klee', name: 'Klee' },
    { id: 'venti', name: 'Venti (Phong Thần)' },
    { id: 'keqing', name: 'Keqing' },
    { id: 'mona', name: 'Mona' },
    { id: 'qiqi', name: 'Qiqi' },
    { id: 'diluc', name: 'Diluc' },
    { id: 'jean', name: 'Jean' },
    { id: 'aloy', name: 'Aloy' },
    { id: 'traveler_pyro', name: 'Nhà Lữ Hành (Hỏa)' },
    { id: 'traveler_dendro', name: 'Nhà Lữ Hành (Thảo)' },
    { id: 'traveler_hydro', name: 'Nhà Lữ Hành (Thủy)' },
    { id: 'traveler_electro', name: 'Nhà Lữ Hành (Lôi)' },
    { id: 'traveler_geo', name: 'Nhà Lữ Hành (Nham)' },
    { id: 'traveler_anemo', name: 'Nhà Lữ Hành (Phong)' },
    { id: 'lanyan', name: 'Lan Yan' },
    { id: 'ororon', name: 'Ororon' },
    { id: 'kachina', name: 'Kachina' },
    { id: 'sethos', name: 'Sethos' },
    { id: 'gaming', name: 'Gaming' },
    { id: 'chevreuse', name: 'Chevreuse' },
    { id: 'charlotte', name: 'Charlotte' },
    { id: 'freminet', name: 'Freminet' },
    { id: 'lynette', name: 'Lynette' },
    { id: 'kirara', name: 'Kirara' },
    { id: 'kaveh', name: 'Kaveh' },
    { id: 'mika', name: 'Mika' },
    { id: 'yaoyao', name: 'Yaoyao' },
    { id: 'faruzan', name: 'Faruzan' },
    { id: 'layla', name: 'Layla' },
    { id: 'candace', name: 'Candace' },
    { id: 'dori', name: 'Dori' },
    { id: 'collei', name: 'Collei' },
    { id: 'shikanoin_heizou', name: 'Shikanoin Heizou' },
    { id: 'kuki_shinobu', name: 'Kuki Shinobu' },
    { id: 'yun_jin', name: 'Yun Jin' },
    { id: 'gorou', name: 'Gorou' },
    { id: 'thoma', name: 'Thoma' },
    { id: 'kujou_sara', name: 'Kujou Sara' },
    { id: 'sayu', name: 'Sayu' },
    { id: 'yanfei', name: 'Yanfei' },
    { id: 'rosaria', name: 'Rosaria' },
    { id: 'xinyan', name: 'Xinyan' },
    { id: 'diona', name: 'Diona' },
    { id: 'sucrose', name: 'Sucrose' },
    { id: 'chongyun', name: 'Chongyun' },
    { id: 'noelle', name: 'Noelle' },
    { id: 'bennett', name: 'Bennett' },
    { id: 'fischl', name: 'Fischl' },
    { id: 'ningguang', name: 'Ningguang' },
    { id: 'xingqiu', name: 'Xingqiu' },
    { id: 'beidou', name: 'Beidou' },
    { id: 'xiangling', name: 'Xiangling' },
    { id: 'razor', name: 'Razor' },
    { id: 'barbara', name: 'Barbara' },
    { id: 'lisa', name: 'Lisa' },
    { id: 'kaeya', name: 'Kaeya' },
    { id: 'amber', name: 'Amber' }
  ];

  function getRandomAvailableCharacter(room) {
    let pool = DEFAULT_CHAR_POOL;
    if (typeof window !== 'undefined' && window.MIHOYO_DATA && typeof window.MIHOYO_DATA.getCharacters === 'function') {
      const liveChars = window.MIHOYO_DATA.getCharacters();
      if (Array.isArray(liveChars) && liveChars.length > 0) {
        pool = liveChars.map((c) => ({ id: c.id, name: c.nameVi || c.name || c.id }));
      }
    }
    const available = pool.filter((c) => c && c.id && !isCharacterTaken(room, c.id));
    if (available.length === 0) {
      return { id: 'amber', name: 'Amber' };
    }
    const randIdx = Math.floor(Math.random() * available.length);
    return available[randIdx];
  }

  function createInitialRoomState(roomId = 'MAIN') {
    return {
      roomId,
      revision: 0,
      updatedAt: Date.now(),
      game: 'genshin',
      status: 'WAITING', // 'WAITING' | 'DRAFTING' | 'LINEUP' | 'COMPLETED'
      isPaused: false,
      stepIndex: 0,
      timeLeft: 45,
      banDuration: 45,
      pickDuration: 60,
      lineupDuration: 90,
      hoveredCharId: null,
      hoveredByTeam: null,
      teams: {
        A: {
          name: 'ĐỘI A (ĐI TRƯỚC)',
          readyLineup: false,
          bans: Array(5).fill(null),
          picks: Array(8).fill(null)
        },
        B: {
          name: 'ĐỘI B (ĐI SAU)',
          readyLineup: false,
          bans: Array(5).fill(null),
          picks: Array(8).fill(null)
        }
      },
      streams: {
        A: { peerId: null, active: false, embedUrl: '' },
        B: { peerId: null, active: false, embedUrl: '' }
      },
      actionLog: [
        { id: 'init', time: Date.now(), text: 'Phòng thi đấu đã sẵn sàng. Chờ Ban Tổ Chức bắt đầu lượt Cấm/Chọn.' }
      ],
      history: []
    };
  }

  // Firebase Realtime Database có thể xóa mảng rỗng/null nên cần chuẩn hóa lại khi đọc từ Firebase
  function normalizeRoomState(raw, roomId = 'MAIN') {
    const base = createInitialRoomState(roomId);
    if (!raw || typeof raw !== 'object') return base;

    const normBans = (arr) => {
      const out = Array(5).fill(null);
      if (Array.isArray(arr) || (arr && typeof arr === 'object')) {
        for (let i = 0; i < 5; i++) {
          if (arr[i] && arr[i].charId) out[i] = arr[i];
        }
      }
      return out;
    };

    const normPicks = (arr) => {
      const out = Array(8).fill(null);
      if (Array.isArray(arr) || (arr && typeof arr === 'object')) {
        for (let i = 0; i < 8; i++) {
          if (arr[i] && arr[i].charId) {
            out[i] = {
              charId: arr[i].charId,
              constellation: arr[i].constellation || 'C0',
              weaponId: arr[i].weaponId || null,
              weaponName: arr[i].weaponName || '',
              weaponIcon: arr[i].weaponIcon || '',
              weaponRefine: arr[i].weaponRefine || 'R1',
              timestamp: arr[i].timestamp || Date.now()
            };
          }
        }
      }
      return out;
    };

    return {
      roomId: raw.roomId || roomId,
      revision: typeof raw.revision === 'number' ? raw.revision : 0,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
      game: raw.game || 'genshin',
      status: raw.status || 'WAITING',
      isPaused: Boolean(raw.isPaused),
      stepIndex: typeof raw.stepIndex === 'number' ? raw.stepIndex : 0,
      timeLeft: typeof raw.timeLeft === 'number' ? raw.timeLeft : 45,
      banDuration: Number(raw.banDuration) || 45,
      pickDuration: Number(raw.pickDuration) || 60,
      lineupDuration: Number(raw.lineupDuration) || 90,
      hoveredCharId: raw.hoveredCharId || null,
      hoveredByTeam: raw.hoveredByTeam || null,
      teams: {
        A: {
          name: raw.teams?.A?.name || 'ĐỘI A (ĐI TRƯỚC)',
          readyLineup: Boolean(raw.teams?.A?.readyLineup),
          bans: normBans(raw.teams?.A?.bans),
          picks: normPicks(raw.teams?.A?.picks)
        },
        B: {
          name: raw.teams?.B?.name || 'ĐỘI B (ĐI SAU)',
          readyLineup: Boolean(raw.teams?.B?.readyLineup),
          bans: normBans(raw.teams?.B?.bans),
          picks: normPicks(raw.teams?.B?.picks)
        }
      },
      streams: {
        A: {
          peerId: raw.streams?.A?.peerId || null,
          active: Boolean(raw.streams?.A?.active),
          embedUrl: raw.streams?.A?.embedUrl || ''
        },
        B: {
          peerId: raw.streams?.B?.peerId || null,
          active: Boolean(raw.streams?.B?.active),
          embedUrl: raw.streams?.B?.embedUrl || ''
        }
      },
      actionLog: Array.isArray(raw.actionLog) && raw.actionLog.length > 0 ? raw.actionLog : base.actionLog,
      history: Array.isArray(raw.history) ? raw.history : []
    };
  }

  function cloneStateForHistory(room) {
    return JSON.parse(
      JSON.stringify({
        status: room.status,
        isPaused: room.isPaused,
        stepIndex: room.stepIndex,
        timeLeft: room.timeLeft,
        hoveredCharId: room.hoveredCharId,
        hoveredByTeam: room.hoveredByTeam,
        teams: room.teams
      })
    );
  }

  function addLog(room, text) {
    if (!Array.isArray(room.actionLog)) room.actionLog = [];
    room.actionLog.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: Date.now(),
      text
    });
    if (room.actionLog.length > 50) room.actionLog.length = 50;
  }

  function isCharacterTaken(room, charId) {
    if (!charId || charId === 'SKIPPED_BAN') return false;
    for (const teamKey of ['A', 'B']) {
      const t = room.teams[teamKey];
      if ((t.bans || []).some((b) => b && b.charId === charId)) return true;
      if ((t.picks || []).some((p) => p && p.charId === charId)) return true;
    }
    return false;
  }

  function getCurrentStep(room) {
    if (room.status !== 'DRAFTING') return null;
    return DRAFT_STEPS[room.stepIndex] || null;
  }

  function advanceTurn(room) {
    room.hoveredCharId = null;
    room.hoveredByTeam = null;

    if (room.stepIndex + 1 < DRAFT_STEPS.length) {
      room.stepIndex += 1;
      const nextStep = DRAFT_STEPS[room.stepIndex];
      room.timeLeft = nextStep.type === 'BAN' ? room.banDuration : room.pickDuration;
    } else {
      room.status = 'LINEUP';
      room.timeLeft = room.lineupDuration;
      room.isPaused = false;
      addLog(room, 'Hoàn tất 26 lượt Cấm & Chọn! Bắt đầu 90 giây sắp xếp đội hình (4 Trên & 4 Dưới).');
    }
  }

  function lockSelection(room, charId, charLabel, forcedByBTC = false) {
    const step = getCurrentStep(room);
    if (!step) return { ok: false, error: 'Hiện không trong giai đoạn Cấm/Chọn.' };

    if (charId !== 'SKIPPED_BAN' && isCharacterTaken(room, charId)) {
      return { ok: false, error: 'Nhân vật này đã bị Cấm hoặc đã được Chọn trước đó!' };
    }

    if (!Array.isArray(room.history)) room.history = [];
    room.history.push(cloneStateForHistory(room));
    if (room.history.length > 30) room.history.shift();

    const teamObj = room.teams[step.team];
    const displayChar = charLabel || charId;

    if (step.type === 'BAN') {
      teamObj.bans[step.slotIndex] = {
        charId,
        timestamp: Date.now()
      };
      addLog(
        room,
        `${teamObj.name} đã CẤM [${displayChar === 'SKIPPED_BAN' ? 'Bỏ lượt cấm' : displayChar}] (Ô cấm #${step.slotIndex + 1}/5)${forcedByBTC ? ' [BTC/Hết giờ]' : ''}`
      );
    } else {
      teamObj.picks[step.slotIndex] = {
        charId,
        constellation: 'C0',
        weaponId: null,
        weaponName: '',
        weaponIcon: '',
        weaponRefine: 'R1',
        timestamp: Date.now()
      };
      addLog(
        room,
        `${teamObj.name} đã CHỌN [${displayChar}] (Vị trí #${step.slotIndex + 1}/8)${forcedByBTC ? ' [BTC/Hết giờ]' : ''}`
      );
    }

    advanceTurn(room);
    return { ok: true };
  }

  function bumpRevision(room) {
    room.revision = (typeof room.revision === 'number' ? room.revision : 0) + 1;
    room.updatedAt = Date.now();
  }

  function tickRoomTimer(room) {
    if (room.isPaused) return false;

    if (room.status === 'DRAFTING') {
      if (room.timeLeft > 0) {
        room.timeLeft -= 1;
        bumpRevision(room);
        return true;
      } else {
        const step = getCurrentStep(room);
        if (!step) return false;

        if (step.type === 'BAN') {
          // Hết thời gian Cấm mà chưa khóa -> Tính là Skip Ban (Bỏ lượt cấm)
          lockSelection(room, 'SKIPPED_BAN', 'Bỏ lượt cấm (Hết giờ)', true);
          bumpRevision(room);
          return true;
        } else {
          // Hết thời gian Chọn mà chưa khóa -> Tự động chọn ngẫu nhiên 1 nhân vật chưa bị cấm/chọn
          const randomChar = getRandomAvailableCharacter(room);
          lockSelection(room, randomChar.id, `${randomChar.name} (Ngẫu nhiên)`, true);
          bumpRevision(room);
          return true;
        }
      }
    } else if (room.status === 'LINEUP') {
      if (room.timeLeft > 0) {
        room.timeLeft -= 1;
        if (room.timeLeft === 0) {
          room.status = 'COMPLETED';
          addLog(room, 'Hết 90 giây sắp xếp đội hình! Đội hình 2 bên đã được chốt.');
        }
        bumpRevision(room);
        return true;
      }
    }
    return false;
  }

  function getSerializedState(room) {
    const norm = normalizeRoomState(room, room.roomId);
    return {
      ...norm,
      totalSteps: DRAFT_STEPS.length,
      currentStep: getCurrentStep(norm),
      steps: DRAFT_STEPS,
      canUndo: Array.isArray(norm.history) && norm.history.length > 0,
      serverTime: Date.now()
    };
  }

  function applyAction(room, body) {
    const res = applyActionInternal(room, body);
    if (res && res.ok) {
      bumpRevision(room);
    }
    return res;
  }

  function applyActionInternal(room, body) {
    const { action, role, team, payload = {} } = body;

    switch (action) {
      case 'START_MATCH': {
        if (role !== 'SPEC') {
          return { ok: false, error: 'Chỉ Ban Tổ Chức mới có quyền bắt đầu trận đấu!' };
        }
        if (room.status === 'WAITING') {
          room.history.push(cloneStateForHistory(room));
          room.status = 'DRAFTING';
          room.isPaused = false;
          room.stepIndex = 0;
          const firstStep = DRAFT_STEPS[0];
          room.timeLeft = firstStep.type === 'BAN' ? room.banDuration : room.pickDuration;
          addLog(room, 'Trận đấu Cấm/Chọn chính thức bắt đầu!');
          return { ok: true };
        }
        return { ok: false, error: 'Trận đấu đã bắt đầu rồi.' };
      }

      case 'TOGGLE_PAUSE': {
        if (role !== 'SPEC') {
          return { ok: false, error: 'Chỉ Ban Tổ Chức mới có quyền tạm dừng / tiếp tục!' };
        }
        room.isPaused = !room.isPaused;
        addLog(room, room.isPaused ? 'Ban tổ chức đã TẠM DỪNG đồng hồ.' : 'Ban tổ chức đã TIẾP TỤC đồng hồ.');
        return { ok: true };
      }

      case 'SWAP_TEAMS': {
        // Chỉ Ban Tổ Chức mới được quyền đổi Phe A <-> Phe B
        if (role !== 'SPEC') {
          return { ok: false, error: 'Người chơi không được tự ý đổi team! Chỉ Ban Tổ Chức mới có quyền đổi đội.' };
        }
        room.history.push(cloneStateForHistory(room));
        const tempTeam = JSON.parse(JSON.stringify(room.teams.A));
        room.teams.A = JSON.parse(JSON.stringify(room.teams.B));
        room.teams.B = tempTeam;
        addLog(room, `Ban tổ chức đã HOÁN ĐỔI PHE (Đội A ↔ Đội B): ${room.teams.A.name} đi trước, ${room.teams.B.name} đi sau.`);
        return { ok: true };
      }

      case 'RESET_MATCH': {
        if (role !== 'SPEC') {
          return { ok: false, error: 'Chỉ Ban Tổ Chức mới có quyền Reset trận đấu!' };
        }
        const nameA = room.teams.A.name;
        const nameB = room.teams.B.name;
        const banDur = room.banDuration;
        const pickDur = room.pickDuration;
        const lineupDur = room.lineupDuration;

        const nextRev = (typeof room.revision === 'number' ? room.revision : 0) + 1;
        const fresh = createInitialRoomState(room.roomId);
        fresh.revision = nextRev;
        fresh.teams.A.name = nameA;
        fresh.teams.B.name = nameB;
        fresh.banDuration = banDur;
        fresh.pickDuration = pickDur;
        fresh.lineupDuration = lineupDur;
        fresh.timeLeft = banDur;

        Object.assign(room, fresh);
        addLog(room, 'Ban tổ chức đã RESET toàn bộ trận đấu về trạng thái ban đầu.');
        return { ok: true };
      }

      case 'UNDO_STEP': {
        if (role !== 'SPEC') {
          return { ok: false, error: 'Chỉ Ban Tổ Chức mới có quyền hoàn tác (Undo)!' };
        }
        if (!room.history || room.history.length === 0) {
          return { ok: false, error: 'Không có bước nào trước đó để hoàn tác.' };
        }
        const prev = room.history.pop();
        room.status = prev.status;
        room.isPaused = true;
        room.stepIndex = prev.stepIndex;
        room.timeLeft = prev.timeLeft;
        room.hoveredCharId = prev.hoveredCharId;
        room.hoveredByTeam = prev.hoveredByTeam;
        room.teams = prev.teams;
        addLog(room, 'Ban tổ chức đã HOÀN TÁC (Undo) lại lượt trước đó.');
        return { ok: true };
      }

      case 'HOVER_CHAR': {
        if (room.status !== 'DRAFTING') {
          return { ok: false, error: 'Chỉ có thể chọn nhân vật khi đang trong lượt Ban/Pick.' };
        }
        const step = getCurrentStep(room);
        if (!step) return { ok: false, error: 'Không tìm thấy lượt hiện tại.' };

        if (role !== 'SPEC' && team !== step.team) {
          return { ok: false, error: `Hiện đang là lượt của ${room.teams[step.team].name}!` };
        }

        const { charId } = payload;
        if (isCharacterTaken(room, charId)) {
          return { ok: false, error: 'Nhân vật này đã bị Cấm hoặc đã được Chọn!' };
        }

        room.hoveredCharId = charId;
        room.hoveredByTeam = step.team;
        return { ok: true };
      }

      case 'LOCK_CHAR': {
        if (room.status !== 'DRAFTING') {
          return { ok: false, error: 'Hiện không trong giai đoạn Ban/Pick.' };
        }
        const step = getCurrentStep(room);
        if (!step) return { ok: false, error: 'Không có lượt hiện tại.' };

        if (role !== 'SPEC' && team !== step.team) {
          return { ok: false, error: `Hiện đang là lượt của ${room.teams[step.team].name}!` };
        }

        const charId = payload.charId || room.hoveredCharId;
        const charLabel = payload.charLabel || charId;
        if (!charId) {
          return { ok: false, error: 'Vui lòng chọn 1 nhân vật trước khi bấm Khóa!' };
        }

        const res = lockSelection(room, charId, charLabel, role === 'SPEC');
        if (res.ok && room.isPaused && room.status === 'DRAFTING') {
          room.isPaused = false;
        }
        return res;
      }

      case 'SKIP_BAN': {
        if (room.status !== 'DRAFTING') {
          return { ok: false, error: 'Hiện không trong giai đoạn Ban/Pick.' };
        }
        const step = getCurrentStep(room);
        if (!step || step.type !== 'BAN') {
          return { ok: false, error: 'Chỉ có thể bỏ lượt ở giai đoạn CẤM (Ban).' };
        }
        if (role !== 'SPEC' && team !== step.team) {
          return { ok: false, error: `Hiện đang là lượt của ${room.teams[step.team].name}!` };
        }
        return lockSelection(room, 'SKIPPED_BAN', 'Bỏ lượt cấm', role === 'SPEC');
      }

      case 'SWAP_LINEUP': {
        if (room.status === 'COMPLETED') {
          return {
            ok: false,
            error: 'Đã hết 90 giây sắp xếp! Đội hình đã bị khóa, chỉ được chọn Cung mệnh & Vũ khí.'
          };
        }
        const targetTeam = payload.team || team;
        if (!['A', 'B'].includes(targetTeam)) {
          return { ok: false, error: 'Đội không hợp lệ.' };
        }
        if (role !== 'SPEC' && team !== targetTeam) {
          return { ok: false, error: 'Bạn chỉ có quyền thay đổi đội hình 8 nhân vật của phe mình!' };
        }

        const { fromIndex, toIndex } = payload;
        if (
          typeof fromIndex !== 'number' ||
          typeof toIndex !== 'number' ||
          fromIndex < 0 ||
          fromIndex > 7 ||
          toIndex < 0 ||
          toIndex > 7
        ) {
          return { ok: false, error: 'Vị trí hoán đổi không hợp lệ.' };
        }

        const picks = room.teams[targetTeam].picks;
        const temp = picks[fromIndex];
        picks[fromIndex] = picks[toIndex];
        picks[toIndex] = temp;

        const halfLabel = (idx) => (idx < 4 ? `Nửa Trên #${idx + 1}` : `Nửa Dưới #${idx - 3}`);
        addLog(
          room,
          `${room.teams[targetTeam].name} đã đổi vị trí đội hình: ${halfLabel(fromIndex)} ↔ ${halfLabel(toIndex)}.`
        );
        return { ok: true };
      }

      case 'CONFIRM_LINEUP': {
        if (room.status === 'COMPLETED') {
          return { ok: false, error: 'Đã hết 90 giây sắp xếp, đội hình đã được khóa!' };
        }
        const targetTeam = payload.team || team;
        if (!['A', 'B'].includes(targetTeam)) {
          return { ok: false, error: 'Đội không hợp lệ.' };
        }
        if (role !== 'SPEC' && team !== targetTeam) {
          return { ok: false, error: 'Bạn chỉ có thể xác nhận đội hình cho phe của mình.' };
        }
        room.teams[targetTeam].readyLineup = !room.teams[targetTeam].readyLineup;
        addLog(
          room,
          `${room.teams[targetTeam].name} ${
            room.teams[targetTeam].readyLineup ? 'đã XÁC NHẬN chốt đội hình 4 Trên / 4 Dưới!' : 'đang chỉnh sửa lại đội hình.'
          }`
        );
        if (room.status === 'LINEUP' && room.teams.A.readyLineup && room.teams.B.readyLineup) {
          room.status = 'COMPLETED';
          room.timeLeft = 0;
          addLog(room, 'Cả 2 đội đã chốt đội hình 4 Trên & 4 Dưới! Mở màn hình Stream 2 đội.');
        }
        return { ok: true };
      }

      case 'UPDATE_STREAM_INFO': {
        const targetTeam = payload.team || team;
        if (!['A', 'B'].includes(targetTeam)) {
          return { ok: false, error: 'Đội không hợp lệ.' };
        }
        if (role !== 'SPEC' && team !== targetTeam) {
          return { ok: false, error: 'Bạn chỉ có thể điều khiển Stream của đội mình!' };
        }
        if (!room.streams) {
          room.streams = {
            A: { peerId: null, active: false, embedUrl: '' },
            B: { peerId: null, active: false, embedUrl: '' }
          };
        }
        if (payload.peerId !== undefined) room.streams[targetTeam].peerId = payload.peerId;
        if (payload.active !== undefined) room.streams[targetTeam].active = Boolean(payload.active);
        if (payload.embedUrl !== undefined) room.streams[targetTeam].embedUrl = String(payload.embedUrl || '').trim();
        return { ok: true };
      }

      case 'ENTER_STREAM_PHASE': {
        if (role !== 'SPEC') {
          return { ok: false, error: 'Chỉ Ban Tổ Chức mới có quyền chuyển giai đoạn.' };
        }
        room.status = 'COMPLETED';
        room.timeLeft = 0;
        room.isPaused = false;
        room.teams.A.readyLineup = true;
        room.teams.B.readyLineup = true;
        addLog(room, 'Đã khóa đổi đội hình và mở màn hình Stream 2 đội.');
        return { ok: true };
      }

      case 'UPDATE_CHAR_META': {
        const { targetTeam, slotIndex, constellation, weaponId, weaponName, weaponIcon, weaponRefine } = payload;
        if (!['A', 'B'].includes(targetTeam)) {
          return { ok: false, error: 'Đội không hợp lệ.' };
        }
        if (role !== 'SPEC' && team !== targetTeam) {
          return { ok: false, error: 'Bạn chỉ có quyền cập nhật Cung mệnh và Vũ khí cho đội của mình!' };
        }
        const slot = room.teams[targetTeam].picks[slotIndex];
        if (!slot || !slot.charId) {
          return { ok: false, error: 'Ô nhân vật này chưa được chọn!' };
        }

        if (constellation !== undefined) slot.constellation = constellation;
        if (weaponId !== undefined) slot.weaponId = weaponId;
        if (weaponName !== undefined) slot.weaponName = weaponName;
        if (weaponIcon !== undefined) slot.weaponIcon = weaponIcon;
        if (weaponRefine !== undefined) slot.weaponRefine = weaponRefine;

        addLog(
          room,
          `Đã cập nhật thông số nhân vật ô #${slotIndex + 1} (${room.teams[targetTeam].name}): ${slot.constellation}${
            slot.weaponName ? ` • ${slot.weaponName} (${slot.weaponRefine || 'R1'})` : ''
          }`
        );
        return { ok: true };
      }

      case 'UPDATE_SETTINGS': {
        if (role !== 'SPEC') {
          return { ok: false, error: 'Chỉ Ban Tổ Chức mới có quyền thay đổi cài đặt phòng.' };
        }
        if (payload.teamAName && String(payload.teamAName).trim()) {
          room.teams.A.name = String(payload.teamAName).trim();
        }
        if (payload.teamBName && String(payload.teamBName).trim()) {
          room.teams.B.name = String(payload.teamBName).trim();
        }
        if (payload.banDuration) {
          room.banDuration = Math.max(10, Math.min(300, Number(payload.banDuration) || 45));
        }
        if (payload.pickDuration) {
          room.pickDuration = Math.max(10, Math.min(300, Number(payload.pickDuration) || 60));
        }
        if (payload.lineupDuration) {
          room.lineupDuration = Math.max(15, Math.min(600, Number(payload.lineupDuration) || 90));
        }
        addLog(room, `BTC đã cập nhật thông tin trận đấu: ${room.teams.A.name} vs ${room.teams.B.name}.`);
        return { ok: true };
      }

      case 'ENTER_LINEUP_PHASE': {
        if (role !== 'SPEC') {
          return { ok: false, error: 'Chỉ Ban Tổ Chức mới có quyền chuyển giai đoạn.' };
        }
        room.status = 'LINEUP';
        room.timeLeft = room.lineupDuration;
        room.isPaused = false;
        addLog(room, 'BTC đã mở giai đoạn 90 giây sắp xếp đội hình (4 Trên & 4 Dưới).');
        return { ok: true };
      }

      default:
        return { ok: false, error: `Hành động không hợp lệ: ${action}` };
    }
  }

  return {
    DRAFT_STEPS,
    createInitialRoomState,
    normalizeRoomState,
    getSerializedState,
    applyAction,
    tickRoomTimer
  };
});

