(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const hasExplicitRoomParam = urlParams.has('room');
  let currentRoomId = (urlParams.get('room') || 'MAIN').toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'MAIN';

  const urlRole = (urlParams.get('role') || 'SPEC').toUpperCase();
  let clientRole = urlRole === 'PLAYER' ? 'PLAYER' : 'SPEC';
  let clientTeam = (urlParams.get('team') || 'A').toUpperCase() === 'B' ? 'B' : 'A';

  let firebaseDbUrl = (
    urlParams.get('fb') ||
    localStorage.getItem('hoyo_fb_url') ||
    window.HOYO_FIREBASE_CONFIG?.databaseURL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  if (urlParams.get('fb')) {
    localStorage.setItem('hoyo_fb_url', firebaseDbUrl);
  }

  const urlPassToken = (urlParams.get('pt') || '').trim();
  const sessionDeletedRooms = new Set();
  let pendingUnlockContext = null;
  let isCurrentRoomDeleted = false;
  let clearPasswordRequested = false;

  function getSavedRoomTokens() {
    try {
      const raw = localStorage.getItem('hoyo_room_tokens');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function getRoomAuthToken(roomId = currentRoomId) {
    const cleanId = String(roomId || '').toUpperCase().trim();
    if (!cleanId) return '';
    const map = getSavedRoomTokens();
    return map[cleanId] || '';
  }

  function saveRoomAuthToken(roomId, token) {
    const cleanId = String(roomId || '').toUpperCase().trim();
    if (!cleanId) return;
    try {
      const map = getSavedRoomTokens();
      if (token) {
        map[cleanId] = String(token);
      } else {
        delete map[cleanId];
      }
      localStorage.setItem('hoyo_room_tokens', JSON.stringify(map));
    } catch (e) { }
  }

  if (urlPassToken) {
    saveRoomAuthToken(currentRoomId, urlPassToken);
  }

  let searchQuery = '';
  let selectedElement = 'ALL';
  let selectedWeaponType = 'ALL';
  let selectedRarity = 'ALL';

  let swapSource = null;

  let editingMetaTarget = null;
  let modalConstellation = 'C0';
  let modalRefine = 'R1';
  let modalWeaponId = null;
  let modalWeaponName = '';
  let modalWeaponIcon = '';

  let roomState = null;
  let lastStepIndex = -1;
  let lastHoveredChar = null;
  let lastTimeLeft = -1;
  let isSpectatorFullscreen = urlParams.get('view') === 'fullscreen' && clientRole === 'SPEC';

  let rawRoomMemory = window.DRAFT_ENGINE
    ? window.DRAFT_ENGINE.createInitialRoomState(currentRoomId)
    : null;

  let wsConnection = null;
  let sseConnection = null;
  let vercelPollTimer = null;
  let localTickTimer = null;
  let localBroadcast = null;
  let inFlightActions = 0;
  let isPollingState = false;
  let lastCharacterGridSignature = '';
  const domRenderCache = {
    seqBar: '',
    banA: '',
    banB: '',
    upperA: '',
    lowerA: '',
    upperB: '',
    lowerB: ''
  };

  // ==================== ICON NGUYÊN TỐ CHÍNH THỨC (/sprites/element-icons) ====================
  const ELEMENT_SPRITE_URLS = {
    Pyro: '/sprites/element-icons/UI_Buff_Element_Fire.png',
    Hydro: '/sprites/element-icons/UI_Buff_Element_Water.png',
    Anemo: '/sprites/element-icons/UI_Buff_Element_Wind.png',
    Electro: '/sprites/element-icons/UI_Buff_Element_Elect.png',
    Dendro: '/sprites/element-icons/UI_Buff_Element_Grass.png',
    Cryo: '/sprites/element-icons/UI_Buff_Element_Frost.png',
    Geo: '/sprites/element-icons/UI_Buff_Element_Roach.png'
  };

  const ELEMENT_SVGS = {
    Pyro: `<img src="/sprites/element-icons/UI_Buff_Element_Fire.png" class="char-el-img" alt="Pyro" />`,
    Hydro: `<img src="/sprites/element-icons/UI_Buff_Element_Water.png" class="char-el-img" alt="Hydro" />`,
    Anemo: `<img src="/sprites/element-icons/UI_Buff_Element_Wind.png" class="char-el-img" alt="Anemo" />`,
    Electro: `<img src="/sprites/element-icons/UI_Buff_Element_Elect.png" class="char-el-img" alt="Electro" />`,
    Dendro: `<img src="/sprites/element-icons/UI_Buff_Element_Grass.png" class="char-el-img" alt="Dendro" />`,
    Cryo: `<img src="/sprites/element-icons/UI_Buff_Element_Frost.png" class="char-el-img" alt="Cryo" />`,
    Geo: `<img src="/sprites/element-icons/UI_Buff_Element_Roach.png" class="char-el-img" alt="Geo" />`,
    Multi: `<svg class="char-el-img" viewBox="0 0 24 24" fill="#f0e6d2"><path d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z"/></svg>`
  };

  const ELEMENT_COLORS = {
    Pyro: '#ff6b4a',
    Hydro: '#38b6ff',
    Anemo: '#4ce0b3',
    Electro: '#c074ff',
    Dendro: '#8be04e',
    Cryo: '#7ce8ff',
    Geo: '#f5b942',
    Multi: '#f0e6d2'
  };

  // ==================== BỘ PHÁT NHẠC (/sprites/musics) & HIỆU ỨNG ÂM THANH (/sprites/sfx) ====================
  const BGM_AUDIO_URL = '/sprites/musics/music-ban-pick.m4a';

  // Các hiệu ứng âm thanh đặt tên bằng tiếng Anh trong /sprites/sfx/
  const SFX_AUDIO_MAP = {
    'banned-sound': '/sprites/sfx/banned-sound.mp3',
    'pick-sound': '/sprites/sfx/pick-sound.mp3',
    'click-button-sound': '/sprites/sfx/click-button-sound.mp3',
    ban: '/sprites/sfx/banned-sound.mp3',
    pick: '/sprites/sfx/pick-sound.mp3',
    lock: '/sprites/sfx/pick-sound.mp3',
    click: '/sprites/sfx/click-button-sound.mp3',
    hover: '/sprites/sfx/click-button-sound.mp3'
  };

  const preloadedSfxPool = {};
  Object.entries(SFX_AUDIO_MAP).forEach(([key, src]) => {
    try {
      if (!preloadedSfxPool[src]) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        preloadedSfxPool[src] = audio;
      }
    } catch (e) { }
  });

  let isBgmPlaying = false;
  let bgmVolume = 0.45;

  // Phát hiệu ứng âm thanh từ /sprites/sfx/ (banned-sound, pick-sound, click-button-sound)
  function playLolSfx(type) {
    try {
      const sfxSrc = SFX_AUDIO_MAP[type];
      if (!sfxSrc) return;
      const baseAudio = preloadedSfxPool[sfxSrc] || new Audio(sfxSrc);
      const clone = baseAudio.cloneNode();
      const isClick = type === 'click-button-sound' || type === 'click' || type === 'hover';
      clone.volume = Math.min(1, Math.max(0.18, (bgmVolume || 0.45) * (isClick ? 0.9 : 1.35)));
      clone.play().catch(() => { });
    } catch (e) { }
  }

  function updateBgmPlayback() {
    const audioEl = document.getElementById('genshinBgmAudio');
    const iconOff = document.getElementById('iconBgmOff');
    const iconOn = document.getElementById('iconBgmOn');
    const volSlider = document.getElementById('bgmVolumeSlider');

    if (iconOff) iconOff.classList.toggle('hidden', isBgmPlaying);
    if (iconOn) iconOn.classList.toggle('hidden', !isBgmPlaying);

    if (!audioEl) return;

    if (!isBgmPlaying) {
      audioEl.pause();
      return;
    }

    audioEl.muted = false;
    if (bgmVolume <= 0.02) {
      bgmVolume = 0.45;
      if (volSlider) volSlider.value = '45';
    }

    if (!audioEl.getAttribute('src') || !audioEl.src.includes('music-ban-pick.m4a')) {
      audioEl.src = BGM_AUDIO_URL;
    }
    audioEl.volume = bgmVolume;
    audioEl.play().catch(() => { });
  }

  function autoPlayAndUnmuteBgm() {
    isBgmPlaying = true;
    const audioEl = document.getElementById('genshinBgmAudio');
    if (audioEl) audioEl.muted = false;
    updateBgmPlayback();
  }

  function autoPauseAndMuteBgm() {
    isBgmPlaying = false;
    const audioEl = document.getElementById('genshinBgmAudio');
    if (audioEl) {
      audioEl.muted = true;
      audioEl.pause();
    }
    updateBgmPlayback();
  }

  function generateRandomMatchId() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `GI-${num}`;
  }

  function saveRecentRoomLocal(roomObj) {
    if (!roomObj || !roomObj.roomId) return;
    if (sessionDeletedRooms.has(roomObj.roomId)) return;
    try {
      const raw = localStorage.getItem('hoyo_recent_rooms');
      const list = raw ? JSON.parse(raw) : [];
      const filtered = list.filter((r) => r.roomId !== roomObj.roomId);
      filtered.unshift({
        roomId: roomObj.roomId,
        teamAName: roomObj.teams?.A?.name || 'ĐỘI XANH',
        teamBName: roomObj.teams?.B?.name || 'ĐỘI ĐỎ',
        hasPassword: Boolean(roomObj.hasPassword || roomObj.passwordHash),
        status: roomObj.status || 'WAITING',
        stepIndex: roomObj.stepIndex || 0,
        totalSteps: roomObj.totalSteps || 26,
        updatedAt: Date.now()
      });
      localStorage.setItem('hoyo_recent_rooms', JSON.stringify(filtered.slice(0, 15)));
    } catch (e) { }
  }

  function removeRecentRoomLocal(targetRoomId) {
    const cleanId = String(targetRoomId || '').toUpperCase().trim();
    if (!cleanId) return;
    try {
      const raw = localStorage.getItem('hoyo_recent_rooms');
      if (!raw) return;
      const list = JSON.parse(raw);
      const filtered = list.filter((r) => String(r.roomId || '').toUpperCase() !== cleanId);
      localStorage.setItem('hoyo_recent_rooms', JSON.stringify(filtered));
    } catch (e) { }
  }

  function getRecentRoomsLocal() {
    try {
      const raw = localStorage.getItem('hoyo_recent_rooms');
      const list = raw ? JSON.parse(raw) : [];
      return list.filter((r) => r && r.roomId && !sessionDeletedRooms.has(r.roomId));
    } catch (e) {
      return [];
    }
  }

  function createFallbackAvatarDataUri(name, element) {
    const color = ELEMENT_COLORS[element] || '#c8aa6e';
    const initials = (name || '?')
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#091428"/>
          <stop offset="100%" stop-color="${color}"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="url(#g)"/>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#f0e6d2" font-family="sans-serif" font-weight="bold" font-size="38">${initials}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  window.handleImgFallback = function (imgEl) {
    const fallbacks = (imgEl.getAttribute('data-fallbacks') || '').split('|').filter(Boolean);
    const currentIdx = Number(imgEl.getAttribute('data-fb-idx') || '0');
    if (currentIdx < fallbacks.length) {
      imgEl.setAttribute('data-fb-idx', String(currentIdx + 1));
      imgEl.src = fallbacks[currentIdx];
    } else {
      const name = imgEl.getAttribute('data-name') || '?';
      const el = imgEl.getAttribute('data-el') || 'Pyro';
      imgEl.onerror = null;
      imgEl.src = createFallbackAvatarDataUri(name, el);
    }
  };

  function buildSmartImgTag(urls, name, element, altText, extraClass = '') {
    const list = Array.isArray(urls) && urls.length > 0 ? urls : [];
    const primary = list[0] || createFallbackAvatarDataUri(name, element);
    const rest = list.slice(1).join('|');
    const safeName = (name || '').replace(/"/g, '&quot;');
    const safeAlt = (altText || safeName).replace(/"/g, '&quot;');
    const clsAttr = extraClass ? `class="${extraClass}"` : '';
    return `<img ${clsAttr} src="${primary}" alt="${safeAlt}" loading="lazy" data-fallbacks="${rest}" data-fb-idx="0" data-name="${safeName}" data-el="${element || 'Pyro'}" onerror="window.handleImgFallback(this)" />`;
  }

  function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3200);
  }

  // ==================== ĐỒNG BỘ FIREBASE / SERVER ====================
  function getFirebaseRoomEndpoint(roomId = currentRoomId) {
    if (!firebaseDbUrl) return null;
    return `${firebaseDbUrl}/rooms/${encodeURIComponent(roomId)}.json`;
  }

  async function pushStateToFirebase(rawObj, targetRoomId = currentRoomId) {
    const endpoint = getFirebaseRoomEndpoint(targetRoomId);
    if (!endpoint) return;
    try {
      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawObj)
      });
    } catch (e) { }
  }

  function stopRealtimeConnections() {
    if (sseConnection) {
      sseConnection.close();
      sseConnection = null;
    }
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
    if (vercelPollTimer) {
      clearInterval(vercelPollTimer);
      vercelPollTimer = null;
    }
    if (localTickTimer) {
      clearInterval(localTickTimer);
      localTickTimer = null;
    }
  }

  function openRoomPasswordModal({ roomId, teamAName, teamBName, onUnlocked } = {}) {
    const targetId = String(roomId || currentRoomId || 'MAIN').toUpperCase();
    stopRealtimeConnections();
    finishLoadingOverlay();

    pendingUnlockContext = {
      roomId: targetId,
      onUnlocked: typeof onUnlocked === 'function' ? onUnlocked : null
    };

    const idLabel = document.getElementById('unlockRoomIdLabel');
    const teamsLabel = document.getElementById('unlockRoomTeamsLabel');
    const passInput = document.getElementById('inputUnlockPassword');
    const errText = document.getElementById('unlockErrorText');
    const btnCancel = document.getElementById('btnCancelUnlockRoom');
    const modal = document.getElementById('roomPasswordModal');

    if (idLabel) idLabel.textContent = targetId;
    if (teamsLabel) {
      teamsLabel.textContent =
        teamAName && teamBName
          ? `${teamAName} vs ${teamBName} • Nhập mật khẩu để truy cập`
          : 'Vui lòng nhập mật khẩu để vào phòng đấu';
    }
    if (passInput) passInput.value = '';
    if (errText) errText.classList.add('hidden');
    if (btnCancel) btnCancel.classList.toggle('hidden', clientRole !== 'SPEC');
    if (modal) modal.classList.remove('hidden');

    setTimeout(() => {
      passInput?.focus();
    }, 50);
  }

  function closeRoomPasswordModal() {
    const modal = document.getElementById('roomPasswordModal');
    if (modal) modal.classList.add('hidden');
    pendingUnlockContext = null;
  }

  async function submitUnlockRoomPassword() {
    const passInput = document.getElementById('inputUnlockPassword');
    const errText = document.getElementById('unlockErrorText');
    const rawPwd = (passInput?.value || '').trim();
    const targetId = pendingUnlockContext?.roomId || currentRoomId;
    const onUnlockedCb = pendingUnlockContext?.onUnlocked || null;

    if (!rawPwd) {
      if (errText) {
        errText.textContent = 'Vui lòng nhập mật khẩu phòng!';
        errText.classList.remove('hidden');
      }
      return;
    }

    const candidateHash = window.DRAFT_ENGINE ? window.DRAFT_ENGINE.hashRoomPassword(rawPwd) : '';

    if (firebaseDbUrl && window.DRAFT_ENGINE) {
      try {
        const endpoint = getFirebaseRoomEndpoint(targetId);
        const r = await fetch(endpoint);
        const data = await r.json();
        if (!data) {
          closeRoomPasswordModal();
          handleRoomDeletedEvent(targetId, false);
          return;
        }
        if (!data.passwordHash || data.passwordHash === candidateHash) {
          saveRoomAuthToken(targetId, data.passwordHash || candidateHash);
          closeRoomPasswordModal();
          closeMainMenu();
          currentRoomId = targetId;
          isCurrentRoomDeleted = false;
          document.getElementById('btnCloseMainMenu')?.classList.remove('hidden');
          rawRoomMemory = window.DRAFT_ENGINE.normalizeRoomState(data, targetId);
          connectRealtime();
          const serialized = window.DRAFT_ENGINE.getSerializedState(rawRoomMemory);
          applyRoomState(serialized, { forceAccept: true });
          if (onUnlockedCb) onUnlockedCb(serialized);
          showToast(`Đã mở khóa phòng [${targetId}]`);
        } else if (errText) {
          errText.textContent = 'Mật khẩu phòng không chính xác!';
          errText.classList.remove('hidden');
        }
      } catch (e) {
        if (errText) {
          errText.textContent = 'Lỗi kết nối khi kiểm tra mật khẩu.';
          errText.classList.remove('hidden');
        }
      }
      return;
    }

    try {
      const res = await fetch(`/api/action?room=${encodeURIComponent(targetId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: targetId,
          action: 'VERIFY_PASSWORD',
          password: rawPwd,
          authToken: candidateHash
        })
      });
      const json = await res.json();
      if (json.deleted) {
        closeRoomPasswordModal();
        handleRoomDeletedEvent(targetId, false);
        return;
      }
      if (json.ok) {
        saveRoomAuthToken(targetId, json.authToken || candidateHash);
        closeRoomPasswordModal();
        closeMainMenu();
        currentRoomId = targetId;
        isCurrentRoomDeleted = false;
        document.getElementById('btnCloseMainMenu')?.classList.remove('hidden');
        if (json.state && window.DRAFT_ENGINE) {
          rawRoomMemory = window.DRAFT_ENGINE.normalizeRoomState(json.state, targetId);
        }
        connectRealtime();
        if (json.state) {
          applyRoomState(json.state, { forceAccept: true });
        }
        if (onUnlockedCb) onUnlockedCb(json.state);
        showToast(`Đã mở khóa phòng [${targetId}]`);
      } else if (errText) {
        errText.textContent = json.error || 'Mật khẩu phòng không chính xác!';
        errText.classList.remove('hidden');
      }
    } catch (e) {
      if (errText) {
        errText.textContent = 'Không thể kết nối máy chủ để xác thực.';
        errText.classList.remove('hidden');
      }
    }
  }

  function handleRoomDeletedEvent(deletedRoomId, triggeredBySelf = false) {
    const cleanDelId = String(deletedRoomId || currentRoomId || '').toUpperCase().trim();
    if (cleanDelId) {
      sessionDeletedRooms.add(cleanDelId);
      removeRecentRoomLocal(cleanDelId);
      saveRoomAuthToken(cleanDelId, '');
    }

    stopRealtimeConnections();
    stopDiscordScreenShare('A', true);
    stopDiscordScreenShare('B', true);
    autoPauseAndMuteBgm();

    document.getElementById('settingsModal')?.classList.add('hidden');
    document.getElementById('charMetaModal')?.classList.add('hidden');
    closeRoomPasswordModal();

    isCurrentRoomDeleted = true;
    swapSource = null;
    roomState = null;
    rawRoomMemory = null;

    document.getElementById('btnEndMatchToolbar')?.classList.add('hidden');
    document.getElementById('btnEndMatchStream')?.classList.add('hidden');
    document.getElementById('roomLockIndicator')?.classList.add('hidden');

    if (clientRole === 'SPEC') {
      document.getElementById('btnCloseMainMenu')?.classList.add('hidden');
      const newIdInput = document.getElementById('menuNewRoomId');
      if (newIdInput) newIdInput.value = generateRandomMatchId();

      const fbQuery = firebaseDbUrl ? `&fb=${encodeURIComponent(firebaseDbUrl)}` : '';
      window.history.pushState({}, '', `${window.location.pathname}?role=SPEC${fbQuery}`);

      openMainMenu();
      showToast(
        triggeredBySelf
          ? `Đã kết thúc và xóa phòng đấu [${cleanDelId}].`
          : `Trận đấu [${cleanDelId}] đã kết thúc và phòng đã bị xóa.`
      );
    } else {
      document.getElementById('dualStreamStage')?.classList.add('hidden');
      document.getElementById('lockinBar')?.classList.add('hidden');
      document.getElementById('btnConfirmTeamLineup')?.classList.add('hidden');
      const timerDisp = document.getElementById('timerDisplay');
      const turnInst = document.getElementById('turnInstruction');
      if (timerDisp) timerDisp.textContent = 'END';
      if (turnInst) turnInst.textContent = `TRẬN ĐẤU [${cleanDelId}] ĐÃ KẾT THÚC & PHÒNG ĐÃ ĐÓNG`;
      showToast(`Trận đấu [${cleanDelId}] đã kết thúc và bị xóa.`);
    }
  }

  async function endAndDeleteCurrentMatch() {
    if (clientRole !== 'SPEC') return;
    const targetId = currentRoomId;
    if (!targetId || isCurrentRoomDeleted) return;

    if (!confirm(`Kết thúc trận đấu và xóa vĩnh viễn phòng [${targetId}]?\nPhòng này sẽ bị xóa khỏi danh sách phòng đấu.`)) {
      return;
    }

    const authToken = getRoomAuthToken(targetId);
    stopRealtimeConnections();
    await stopDiscordScreenShare('A', true);
    await stopDiscordScreenShare('B', true);
    autoPauseAndMuteBgm();

    if (firebaseDbUrl) {
      const endpoint = getFirebaseRoomEndpoint(targetId);
      if (endpoint) {
        try {
          await fetch(endpoint, { method: 'DELETE' });
        } catch (e) { }
      }
    } else {
      try {
        const res = await fetch(`/api/action?room=${encodeURIComponent(targetId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: targetId,
            action: 'DELETE_ROOM',
            role: clientRole,
            authToken
          })
        });
        const json = await res.json();
        if (!json.ok && json.authRequired) {
          openRoomPasswordModal({
            roomId: targetId,
            teamAName: roomState?.teams?.A?.name,
            teamBName: roomState?.teams?.B?.name,
            onUnlocked: () => endAndDeleteCurrentMatch()
          });
          return;
        }
        if (!json.ok && json.error) {
          showToast(json.error);
          connectRealtime();
          return;
        }
      } catch (e) { }
    }

    localBroadcast?.postMessage({ type: 'ROOM_DELETED', roomId: targetId });
    handleRoomDeletedEvent(targetId, true);
  }

  async function sendAction(action, payload = {}, extraOptions = {}) {
    if (isCurrentRoomDeleted && !extraOptions.isCreateRoom) {
      showToast('Phòng đấu này đã kết thúc và bị xóa.');
      return { ok: false, deleted: true };
    }

    const baseSnapshot = roomState
      ? JSON.parse(JSON.stringify(roomState))
      : rawRoomMemory
        ? JSON.parse(JSON.stringify(rawRoomMemory))
        : null;

    const currentToken =
      extraOptions.overrideAuthToken !== undefined
        ? extraOptions.overrideAuthToken
        : getRoomAuthToken(currentRoomId);

    const body = {
      roomId: currentRoomId,
      action,
      role: clientRole,
      team: clientTeam,
      authToken: currentToken,
      isCreateRoom: Boolean(extraOptions.isCreateRoom),
      payload,
      clientSnapshot: baseSnapshot
    };

    // Optimistic UI: Phản hồi ngay lập tức trên giao diện 0ms không chờ mạng
    if (window.DRAFT_ENGINE && (roomState || rawRoomMemory)) {
      const tempRoom = window.DRAFT_ENGINE.normalizeRoomState(baseSnapshot, currentRoomId);
      const optimisticRes = window.DRAFT_ENGINE.applyAction(tempRoom, body);
      if (!optimisticRes.ok) {
        if (optimisticRes.authRequired) {
          openRoomPasswordModal({
            roomId: currentRoomId,
            teamAName: tempRoom.teams?.A?.name,
            teamBName: tempRoom.teams?.B?.name
          });
          return optimisticRes;
        }
        if (optimisticRes.error) showToast(optimisticRes.error);
        return optimisticRes;
      }
      if (action === 'UPDATE_SETTINGS' && payload.passwordHash !== undefined) {
        saveRoomAuthToken(currentRoomId, payload.passwordHash);
      }
      rawRoomMemory = tempRoom;
      const optimisticSerialized = window.DRAFT_ENGINE.getSerializedState(tempRoom);
      applyRoomState(optimisticSerialized, { forceAccept: true });
      localBroadcast?.postMessage({ type: 'STATE_UPDATE', state: optimisticSerialized });
    }

    inFlightActions += 1;

    if (firebaseDbUrl && window.DRAFT_ENGINE) {
      try {
        await pushStateToFirebase(rawRoomMemory, currentRoomId);
        const serialized = window.DRAFT_ENGINE.getSerializedState(rawRoomMemory);
        return { ok: true, state: serialized };
      } catch (err) {
        showToast('Lỗi đồng bộ Firebase Realtime Database.');
        return { ok: false };
      } finally {
        inFlightActions = Math.max(0, inFlightActions - 1);
      }
    }

    try {
      const res = await fetch(`/api/action?room=${encodeURIComponent(currentRoomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.deleted) {
        handleRoomDeletedEvent(currentRoomId, false);
        return data;
      }
      if (data.authRequired) {
        openRoomPasswordModal({
          roomId: currentRoomId,
          teamAName: roomState?.teams?.A?.name,
          teamBName: roomState?.teams?.B?.name
        });
        return data;
      }
      if (!data.ok && data.error && data.error.includes('Hành động không hợp lệ') && window.DRAFT_ENGINE) {
        const serialized = window.DRAFT_ENGINE.getSerializedState(rawRoomMemory);
        return { ok: true, state: serialized };
      }
      if (!data.ok && data.error) {
        showToast(data.error);
      }
      if (data.state) {
        applyRoomState(data.state);
        localBroadcast?.postMessage({ type: 'STATE_UPDATE', state: data.state });
      }
      return data;
    } catch (err) {
      if (window.DRAFT_ENGINE && rawRoomMemory) {
        const serialized = window.DRAFT_ENGINE.getSerializedState(rawRoomMemory);
        return { ok: true, state: serialized };
      }
      showToast('Không thể kết nối máy chủ.');
      return { ok: false };
    } finally {
      inFlightActions = Math.max(0, inFlightActions - 1);
    }
  }

  function setupBroadcastChannel() {
    try {
      if (localBroadcast) localBroadcast.close();
      if (typeof BroadcastChannel !== 'undefined') {
        localBroadcast = new BroadcastChannel(`hoyo_banpick_${currentRoomId}`);
        localBroadcast.onmessage = (ev) => {
          if (!ev.data) return;
          if (ev.data.type === 'ROOM_DELETED' && (!ev.data.roomId || ev.data.roomId === currentRoomId)) {
            handleRoomDeletedEvent(currentRoomId, false);
            return;
          }
          if (ev.data.type === 'STATE_UPDATE' && ev.data.state) {
            applyRoomState(ev.data.state);
          }
        };
      }
    } catch (e) { }
  }

  function connectRealtime() {
    if (isCurrentRoomDeleted) return;

    document.getElementById('roomCodeLabel').textContent = currentRoomId;
    const menuRoomText = document.getElementById('menuCurrentRoomText');
    if (menuRoomText) menuRoomText.textContent = currentRoomId;

    const connDot = document.getElementById('connDot');
    const syncTag = document.getElementById('syncModeTag');

    setupBroadcastChannel();
    stopRealtimeConnections();

    // Đồng hồ đếm ngược nội bộ chạy độc lập 1s/lần ngay trên trình duyệt để không bị khựng hay delay do mạng
    localTickTimer = setInterval(() => {
      if (!roomState || roomState.isPaused) return;
      if (roomState.status !== 'DRAFTING' && roomState.status !== 'LINEUP') return;
      if (roomState.timeLeft > 0) {
        roomState.timeLeft = Math.max(0, roomState.timeLeft - 1);
        lastTimeLeft = roomState.timeLeft;
        renderHeaderAndClock();
        triggerGsapTimerTick(roomState.timeLeft);
      }
    }, 1000);

    if (firebaseDbUrl && window.DRAFT_ENGINE) {
      syncTag.textContent = 'FIREBASE';
      const endpoint = getFirebaseRoomEndpoint(currentRoomId);
      let hadFirebaseData = false;

      fetch(endpoint)
        .then((r) => r.json())
        .then((data) => {
          connDot.classList.remove('offline');
          if (!data) {
            if (!hasExplicitRoomParam && clientRole === 'SPEC') {
              return;
            }
            rawRoomMemory = window.DRAFT_ENGINE.createInitialRoomState(currentRoomId);
            pushStateToFirebase(rawRoomMemory, currentRoomId);
            hadFirebaseData = true;
          } else {
            hadFirebaseData = true;
            if (data.passwordHash && getRoomAuthToken(currentRoomId) !== data.passwordHash) {
              openRoomPasswordModal({
                roomId: currentRoomId,
                teamAName: data.teams?.A?.name,
                teamBName: data.teams?.B?.name
              });
              return;
            }
            rawRoomMemory = window.DRAFT_ENGINE.normalizeRoomState(data, currentRoomId);
          }
          applyRoomState(window.DRAFT_ENGINE.getSerializedState(rawRoomMemory));
        })
        .catch(() => {
          connDot.classList.add('offline');
        });

      vercelPollTimer = setInterval(async () => {
        if (inFlightActions > 0 || isPollingState || isCurrentRoomDeleted) return;
        isPollingState = true;
        try {
          const r = await fetch(endpoint);
          if (!r.ok) return;
          const data = await r.json();
          if (!data) {
            if (hadFirebaseData || roomState) {
              handleRoomDeletedEvent(currentRoomId, false);
            }
            return;
          }
          hadFirebaseData = true;
          if (data.passwordHash && getRoomAuthToken(currentRoomId) !== data.passwordHash) {
            openRoomPasswordModal({
              roomId: currentRoomId,
              teamAName: data.teams?.A?.name,
              teamBName: data.teams?.B?.name
            });
            return;
          }
          if (inFlightActions === 0) {
            rawRoomMemory = window.DRAFT_ENGINE.normalizeRoomState(data, currentRoomId);
            if (clientRole === 'SPEC') {
              const ticked = window.DRAFT_ENGINE.tickRoomTimer(rawRoomMemory);
              if (ticked) {
                await pushStateToFirebase(rawRoomMemory, currentRoomId);
              }
            }
            applyRoomState(window.DRAFT_ENGINE.getSerializedState(rawRoomMemory));
          }
        } catch (e) { } finally {
          isPollingState = false;
        }
      }, 1000);

      return;
    }

    syncTag.textContent = 'LIVE';
    const isLocalHost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.');
    let sseConnected = false;
    const passQuery = getRoomAuthToken(currentRoomId)
      ? `&pt=${encodeURIComponent(getRoomAuthToken(currentRoomId))}`
      : '';

    if (isLocalHost) {
      try {
        sseConnection = new EventSource(`/api/events?room=${encodeURIComponent(currentRoomId)}${passQuery}`);
        sseConnection.onopen = () => {
          sseConnected = true;
          connDot.classList.remove('offline');
        };
        sseConnection.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'ROOM_DELETED' || msg.deleted) {
              handleRoomDeletedEvent(msg.roomId || currentRoomId, false);
              return;
            }
            if (msg.type === 'ROOM_LOCKED' || msg.locked) {
              openRoomPasswordModal({
                roomId: msg.roomId || currentRoomId,
                teamAName: msg.teamAName,
                teamBName: msg.teamBName
              });
              return;
            }
            if (msg.type === 'STATE_UPDATE' && msg.state) {
              applyRoomState(msg.state);
            }
          } catch (e) { }
        };
        sseConnection.onerror = () => {
          sseConnected = false;
        };
      } catch (e) { }

      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsConnection = new WebSocket(`${proto}//${window.location.host}/ws?room=${encodeURIComponent(currentRoomId)}${passQuery}`);
        wsConnection.onopen = () => {
          connDot.classList.remove('offline');
        };
        wsConnection.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'ROOM_DELETED' || msg.deleted) {
              handleRoomDeletedEvent(msg.roomId || currentRoomId, false);
              return;
            }
            if (msg.type === 'ROOM_LOCKED' || msg.locked) {
              openRoomPasswordModal({
                roomId: msg.roomId || currentRoomId,
                teamAName: msg.teamAName,
                teamBName: msg.teamBName
              });
              return;
            }
            if (msg.type === 'STATE_UPDATE' && msg.state) {
              applyRoomState(msg.state);
            }
          } catch (e) { }
        };
      } catch (e) { }
    }

    vercelPollTimer = setInterval(async () => {
      if (sseConnected && wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        return;
      }
      if (inFlightActions > 0 || isPollingState || isCurrentRoomDeleted) {
        return;
      }
      isPollingState = true;
      try {
        const tokenParam = getRoomAuthToken(currentRoomId)
          ? `&pt=${encodeURIComponent(getRoomAuthToken(currentRoomId))}`
          : '';
        const res = await fetch(`/api/state?room=${encodeURIComponent(currentRoomId)}${tokenParam}`, {
          cache: 'no-store'
        });
        if (res.ok && inFlightActions === 0) {
          const json = await res.json();
          if (json.deleted) {
            if (!hasExplicitRoomParam && !roomState && clientRole === 'SPEC') {
              stopRealtimeConnections();
              return;
            }
            handleRoomDeletedEvent(currentRoomId, false);
            return;
          }
          if (json.locked) {
            openRoomPasswordModal({
              roomId: json.roomId || currentRoomId,
              teamAName: json.teamAName,
              teamBName: json.teamBName
            });
            return;
          }
          if (json.ok && json.state) {
            connDot.classList.remove('offline');
            const serverRev = Number(json.state.revision || 0);
            const localRev = Number(roomState?.revision || 0);
            if (roomState && serverRev < localRev) {
              // Instance của Vercel bị cũ (cold/multi-instance) -> Đẩy ngay snapshot mới nhất từ Client lên để tự hồi phục
              await fetch(`/api/action?room=${encodeURIComponent(currentRoomId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomId: currentRoomId,
                  action: 'SYNC_SNAPSHOT',
                  role: clientRole,
                  team: clientTeam,
                  authToken: getRoomAuthToken(currentRoomId),
                  clientSnapshot: roomState
                })
              }).catch(() => { });
            } else {
              applyRoomState(json.state);
            }
          }
        }
      } catch (e) {
        if (clientRole === 'SPEC' && window.DRAFT_ENGINE && rawRoomMemory) {
          const changed = window.DRAFT_ENGINE.tickRoomTimer(rawRoomMemory);
          if (changed) {
            const s = window.DRAFT_ENGINE.getSerializedState(rawRoomMemory);
            applyRoomState(s);
            localBroadcast?.postMessage({ type: 'STATE_UPDATE', state: s });
          }
        }
      } finally {
        isPollingState = false;
      }
    }, 600);
  }

  // ==================== SẢNH TRẬN ĐẤU (MAIN MENU) ====================
  function openMainMenu() {
    if (clientRole !== 'SPEC') {
      showToast('Người chơi đã cố định vào phòng đấu.');
      return;
    }
    const overlay = document.getElementById('mainMenuOverlay');
    overlay.classList.remove('hidden');
    const newIdInput = document.getElementById('menuNewRoomId');
    if (newIdInput && !newIdInput.value) {
      newIdInput.value = generateRandomMatchId();
    }
    loadActiveRoomsList();
  }

  function closeMainMenu() {
    document.getElementById('mainMenuOverlay').classList.add('hidden');
  }

  async function switchMatchRoom(newRoomId, initialSettings = null, options = {}) {
    const cleanId = String(newRoomId || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').trim();
    if (!cleanId) {
      showToast('Vui lòng nhập Mã ID trận đấu hợp lệ.');
      return false;
    }

    if (options.isCreateRoom) {
      sessionDeletedRooms.delete(cleanId);
      if (initialSettings && initialSettings.passwordHash !== undefined) {
        saveRoomAuthToken(cleanId, initialSettings.passwordHash);
      }
    }

    // Kiểm tra trước trạng thái khóa mật khẩu / đã bị xóa trước khi chuyển phòng (nếu vào phòng có sẵn)
    if (!options.isCreateRoom) {
      if (firebaseDbUrl) {
        try {
          const r = await fetch(getFirebaseRoomEndpoint(cleanId));
          if (r.ok) {
            const fbRoom = await r.json();
            if (fbRoom && fbRoom.passwordHash && getRoomAuthToken(cleanId) !== fbRoom.passwordHash) {
              openRoomPasswordModal({
                roomId: cleanId,
                teamAName: fbRoom.teams?.A?.name,
                teamBName: fbRoom.teams?.B?.name,
                onUnlocked: options.onAfterEnter || null
              });
              return false;
            }
          }
        } catch (e) { }
      } else {
        try {
          const tokenParam = getRoomAuthToken(cleanId)
            ? `&pt=${encodeURIComponent(getRoomAuthToken(cleanId))}`
            : '';
          const res = await fetch(`/api/state?room=${encodeURIComponent(cleanId)}${tokenParam}`, {
            cache: 'no-store'
          });
          if (res.ok) {
            const preCheck = await res.json();
            if (preCheck.deleted) {
              sessionDeletedRooms.add(cleanId);
              removeRecentRoomLocal(cleanId);
              loadActiveRoomsList();
              showToast(`Phòng đấu [${cleanId}] đã kết thúc và bị xóa.`);
              return false;
            }
            if (preCheck.locked) {
              openRoomPasswordModal({
                roomId: cleanId,
                teamAName: preCheck.teamAName,
                teamBName: preCheck.teamBName,
                onUnlocked: options.onAfterEnter || null
              });
              return false;
            }
          }
        } catch (e) { }
      }
    }

    currentRoomId = cleanId;
    isCurrentRoomDeleted = false;
    swapSource = null;
    roomState = null;
    lastStepIndex = -1;
    lastHoveredChar = null;
    lastTimeLeft = -1;
    lastCharacterGridSignature = '';
    Object.keys(domRenderCache).forEach((k) => {
      domRenderCache[k] = '';
    });

    document.getElementById('btnCloseMainMenu')?.classList.remove('hidden');

    const fbQuery = firebaseDbUrl ? `&fb=${encodeURIComponent(firebaseDbUrl)}` : '';
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}&role=${clientRole}${clientRole === 'PLAYER' ? `&team=${clientTeam}` : ''
      }${fbQuery}`;
    window.history.pushState({ roomId: currentRoomId }, '', newUrl);

    if (window.DRAFT_ENGINE) {
      rawRoomMemory = window.DRAFT_ENGINE.createInitialRoomState(currentRoomId);
    }

    connectRealtime();

    if (initialSettings) {
      const actRes = await sendAction('UPDATE_SETTINGS', initialSettings, {
        isCreateRoom: Boolean(options.isCreateRoom)
      });
      if (actRes && actRes.authRequired) {
        return false;
      }
    } else if (!firebaseDbUrl) {
      try {
        const tokenParam = getRoomAuthToken(currentRoomId)
          ? `&pt=${encodeURIComponent(getRoomAuthToken(currentRoomId))}`
          : '';
        const res = await fetch(`/api/state?room=${encodeURIComponent(currentRoomId)}${tokenParam}`);
        const json = await res.json();
        if (json.locked) {
          openRoomPasswordModal({
            roomId: currentRoomId,
            teamAName: json.teamAName,
            teamBName: json.teamBName,
            onUnlocked: options.onAfterEnter || null
          });
          return false;
        }
        if (json.ok && json.state) {
          applyRoomState(json.state);
        }
      } catch (e) { }
    }

    closeMainMenu();
    showToast(`Đã vào phòng đấu [${currentRoomId}]`);
    if (typeof options.onAfterEnter === 'function') {
      options.onAfterEnter();
    }
    return true;
  }

  async function loadActiveRoomsList() {
    const listContainer = document.getElementById('activeRoomsList');
    if (!listContainer) return;

    const mergedMap = new Map();
    const isLocalHost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.');

    if (firebaseDbUrl) {
      try {
        const r = await fetch(`${firebaseDbUrl}/rooms.json`);
        if (r.ok) {
          const allFb = await r.json();
          if (allFb && typeof allFb === 'object') {
            Object.entries(allFb).forEach(([k, val]) => {
              if (val && typeof val === 'object' && !sessionDeletedRooms.has(k)) {
                mergedMap.set(k, {
                  roomId: k,
                  teamAName: val.teams?.A?.name || 'ĐỘI XANH',
                  teamBName: val.teams?.B?.name || 'ĐỘI ĐỎ',
                  hasPassword: Boolean(val.passwordHash),
                  status: val.status || 'WAITING',
                  stepIndex: val.stepIndex || 0,
                  totalSteps: 26
                });
              }
            });
          }
        }
      } catch (e) {
        getRecentRoomsLocal().forEach((r) => mergedMap.set(r.roomId, r));
      }
    } else {
      if (!isLocalHost) {
        getRecentRoomsLocal().forEach((r) => mergedMap.set(r.roomId, r));
      }
      try {
        const r = await fetch('/api/rooms', { cache: 'no-store' });
        if (r.ok) {
          const json = await r.json();
          if (json.ok && Array.isArray(json.rooms)) {
            if (isLocalHost) {
              mergedMap.clear();
            }
            json.rooms.forEach((rm) => {
              if (!sessionDeletedRooms.has(rm.roomId)) {
                mergedMap.set(rm.roomId, rm);
              }
            });
          }
        }
      } catch (e) {
        getRecentRoomsLocal().forEach((r) => mergedMap.set(r.roomId, r));
      }
    }

    const roomsArr = Array.from(mergedMap.values());
    if (roomsArr.length === 0) {
      listContainer.innerHTML = `<div class="empty-rooms-text">Chưa có phòng đấu nào.</div>`;
      return;
    }

    const statusLabelMap = {
      WAITING: 'Chờ bắt đầu',
      DRAFTING: 'Đang Cấm/Chọn',
      LINEUP: 'Đang xếp đội 90s',
      COMPLETED: 'Hoàn tất'
    };

    listContainer.innerHTML = roomsArr
      .map((rm) => {
        const stText = statusLabelMap[rm.status] || rm.status;
        const lockBadge = rm.hasPassword ? `<span class="room-lock-badge">🔒 CÓ PASS</span>` : '';
        return `
          <div class="room-list-card">
            <div>
              <div class="room-card-id">ID: ${rm.roomId}${lockBadge}</div>
              <div class="room-card-teams">
                <span class="text-blue">${rm.teamAName}</span>
                <span style="color:var(--lol-grey); margin:0 6px;">vs</span>
                <span class="text-red">${rm.teamBName}</span>
              </div>
              <div class="room-card-meta">
                ${stText} ${rm.status === 'DRAFTING' ? `• Lượt ${(rm.stepIndex || 0) + 1}/${rm.totalSteps || 26}` : ''}
              </div>
            </div>
            <div class="room-card-actions">
              <button type="button" class="sys-action-btn sys-btn-gold btn-enter-room" data-room-id="${rm.roomId}">
                VÀO PHÒNG
              </button>
              <button type="button" class="sys-action-btn btn-links-room" data-room-id="${rm.roomId}">
                LẤY LINK
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    listContainer.querySelectorAll('.btn-enter-room').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchMatchRoom(btn.getAttribute('data-room-id'));
      });
    });

    listContainer.querySelectorAll('.btn-links-room').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchMatchRoom(btn.getAttribute('data-room-id'), null, {
          onAfterEnter: () => openSettingsModal()
        });
      });
    });
  }

  // ==================== HỆ THỐNG HIỆU ỨNG HẠT, VỤ NỔ TÂM, 3D PARALLAX & GSAP ====================
  let burstParticlesPool = [];

  function spawnParticleBurst(colorHex = '#0ac8b9', count = 42) {
    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.52;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
      const speed = Math.random() * 8.5 + 2.5;
      burstParticlesPool.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.random() * 2.8 + 1.2,
        alpha: 1,
        decay: Math.random() * 0.018 + 0.014,
        color: i % 3 === 0 ? '#f0e6d2' : colorHex
      });
    }
  }

  function initHextechParticles() {
    const canvas = document.getElementById('hextechParticleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 64 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2.1 + 0.5,
      vy: -(Math.random() * 0.65 + 0.18),
      vx: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.7 + 0.18,
      pulseSpeed: Math.random() * 0.04 + 0.01,
      pulsePhase: Math.random() * Math.PI * 2,
      isCyan: Math.random() > 0.55
    }));

    function drawFrame() {
      ctx.clearRect(0, 0, width, height);

      // 1. Hạt năng lượng bay lên + vệt sáng sao băng
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.pulsePhase += p.pulseSpeed;

        if (p.y < -12) {
          p.y = height + 12;
          p.x = Math.random() * width;
        }
        if (p.x < -12) p.x = width + 12;
        if (p.x > width + 12) p.x = -12;

        const curAlpha = Math.max(0.08, Math.min(0.95, p.alpha + Math.sin(p.pulsePhase) * 0.22));
        const rgb = p.isCyan ? '10, 200, 185' : '200, 170, 110';

        // Vẽ đuôi sao băng mảnh
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 10, p.y - p.vy * 14);
        ctx.strokeStyle = `rgba(${rgb}, ${curAlpha * 0.38})`;
        ctx.lineWidth = p.r * 0.7;
        ctx.stroke();

        // Vẽ hạt nhân sáng
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${curAlpha})`;
        ctx.fill();
      }

      // 2. Hạt vụ nổ từ tâm khi Khóa / Cấm tướng
      for (let j = burstParticlesPool.length - 1; j >= 0; j--) {
        const bp = burstParticlesPool[j];
        bp.x += bp.vx;
        bp.y += bp.vy;
        bp.vx *= 0.96;
        bp.vy *= 0.96;
        bp.alpha -= bp.decay;

        if (bp.alpha <= 0) {
          burstParticlesPool.splice(j, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = bp.alpha;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2);
        ctx.fillStyle = bp.color;
        ctx.shadowColor = bp.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }

      requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);

    // Hiệu ứng 3D Parallax nghiêng nhẹ Tinh Bàn theo chuột
    window.addEventListener('mousemove', (e) => {
      if (!window.gsap) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      const astrolabe = document.getElementById('hextechAstrolabe');
      const showcaseRing = document.getElementById('showcaseRingContainer');
      if (astrolabe) {
        window.gsap.to(astrolabe, {
          rotationY: nx * 9,
          rotationX: -ny * 9,
          duration: 0.65,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
      if (showcaseRing && isSpectatorFullscreen) {
        window.gsap.to(showcaseRing, {
          x: nx * 12,
          y: ny * 10,
          duration: 0.55,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      }
    });
  }

  function triggerGsapLockInEffect(isBan = false, accentColor = '#0ac8b9', lockedSlotSelector = null) {
    const color = isBan ? '#e84057' : accentColor || '#0ac8b9';
    spawnParticleBurst(color, 46);

    if (!window.gsap) return;
    const shockwave1 = document.getElementById('lockinShockwave');
    const shockwave2 = document.getElementById('lockinShockwave2');
    const astrolabe = document.getElementById('hextechAstrolabe');
    const showcaseArt = document.getElementById('showcaseCharArt');
    const showcaseRing = document.getElementById('showcaseRingContainer');
    const flashFx = document.getElementById('screenFlashFx');
    const slashFx = document.getElementById('screenSlashFx');

    if (shockwave1) {
      shockwave1.style.borderColor = color;
      shockwave1.style.boxShadow = `0 0 50px ${color}, inset 0 0 35px ${color}`;
      window.gsap.fromTo(
        shockwave1,
        { width: 50, height: 50, opacity: 1 },
        { width: 1050, height: 1050, opacity: 0, duration: 0.85, ease: 'power3.out' }
      );
    }

    if (shockwave2) {
      shockwave2.style.borderColor = '#f0e6d2';
      window.gsap.fromTo(
        shockwave2,
        { width: 40, height: 40, opacity: 0.9, rotation: 0 },
        { width: 820, height: 820, opacity: 0, rotation: 90, duration: 1.05, delay: 0.08, ease: 'power2.out' }
      );
    }

    if (flashFx) {
      flashFx.style.background = `radial-gradient(circle at 50% 50%, ${color}55 0%, transparent 72%)`;
      window.gsap.fromTo(
        flashFx,
        { opacity: 0.85 },
        { opacity: 0, duration: 0.55, ease: 'power2.out' }
      );
    }

    if (slashFx) {
      const deg = isBan ? -24 : 16;
      slashFx.style.background = `linear-gradient(90deg, transparent 0%, #ffffff 35%, ${color} 50%, #ffffff 65%, transparent 100%)`;
      slashFx.style.boxShadow = `0 0 35px ${color}, 0 0 70px ${color}`;
      window.gsap.fromTo(
        slashFx,
        { opacity: 1, scaleX: 0, scaleY: 1.8, rotation: deg },
        { opacity: 0, scaleX: 1.15, scaleY: 0.2, rotation: deg, duration: 0.52, ease: 'expo.out' }
      );
    }

    if (astrolabe) {
      window.gsap.fromTo(
        astrolabe,
        { scale: 1.16, filter: 'brightness(2)' },
        { scale: 1, filter: 'brightness(1)', duration: 0.72, ease: 'elastic.out(1, 0.55)' }
      );
    }

    if (showcaseArt) {
      window.gsap.fromTo(
        showcaseArt,
        { scale: 1.2, opacity: 0.35 },
        { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.5)' }
      );
    }

    if (showcaseRing && isSpectatorFullscreen) {
      window.gsap.fromTo(
        showcaseRing,
        { scale: 0.9, boxShadow: `0 0 90px ${color}` },
        { scale: 1, boxShadow: '0 0 60px rgba(10, 200, 185, 0.35)', duration: 0.65, ease: 'back.out(1.7)' }
      );
    }

    if (lockedSlotSelector) {
      requestAnimationFrame(() => {
        const el = document.querySelector(lockedSlotSelector);
        if (el) {
          window.gsap.fromTo(
            el,
            { scale: 1.12, filter: 'brightness(2.2)' },
            { scale: 1, filter: 'brightness(1)', duration: 0.55, ease: 'back.out(1.8)' }
          );
        }
      });
    }
  }

  function triggerGsapHoverEffect(accentColor = '#0ac8b9') {
    spawnParticleBurst(accentColor, 14);
    if (!window.gsap) return;
    const showcaseArt = document.getElementById('showcaseCharArt');
    const backdrop = document.getElementById('backdropSplash');
    const astrolabe = document.getElementById('hextechAstrolabe');

    if (showcaseArt && isSpectatorFullscreen) {
      window.gsap.fromTo(
        showcaseArt,
        { scale: 1.09, opacity: 0.5 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out' }
      );
    }
    if (backdrop) {
      window.gsap.fromTo(
        backdrop,
        { scale: 1.06 },
        { scale: 1.01, duration: 0.45, ease: 'power2.out' }
      );
    }
    if (astrolabe) {
      window.gsap.fromTo(
        astrolabe,
        { scale: 1.04 },
        { scale: 1, duration: 0.35, ease: 'power2.out' }
      );
    }
  }

  function triggerGsapTimerTick(timeLeft) {
    if (!window.gsap) return;
    const timerEl = document.getElementById('timerDisplay');
    if (!timerEl) return;
    const isUrgent = timeLeft <= 10;
    window.gsap.fromTo(
      timerEl,
      { scale: isUrgent ? 1.28 : 1.1 },
      { scale: 1, duration: 0.35, ease: 'back.out(2)' }
    );
  }

  function setSpectatorFullscreen(enabled) {
    if (clientRole !== 'SPEC') {
      isSpectatorFullscreen = false;
    } else {
      isSpectatorFullscreen = Boolean(enabled);
    }

    document.body.classList.toggle('spectator-fullscreen', isSpectatorFullscreen);

    const poolContainer = document.getElementById('championPoolContainer');
    const showcaseContainer = document.getElementById('spectatorCenterShowcase');
    const dualStreamStage = document.getElementById('dualStreamStage');
    const lockinBar = document.getElementById('lockinBar');
    const btnTogglePool = document.getElementById('btnTogglePoolView');
    const togglePoolText = document.getElementById('togglePoolBtnText');

    const isStreamPhase = roomState && roomState.status === 'COMPLETED';

    if (isStreamPhase) {
      if (poolContainer) poolContainer.classList.add('hidden');
      if (showcaseContainer) showcaseContainer.classList.add('hidden');
      if (lockinBar) lockinBar.classList.add('hidden');
      if (dualStreamStage) dualStreamStage.classList.remove('hidden');
    } else {
      if (dualStreamStage) dualStreamStage.classList.add('hidden');
      if (poolContainer) poolContainer.classList.toggle('hidden', isSpectatorFullscreen);
      if (showcaseContainer) showcaseContainer.classList.toggle('hidden', !isSpectatorFullscreen);
      if (lockinBar) lockinBar.classList.toggle('hidden', isSpectatorFullscreen);
    }

    if (btnTogglePool) {
      btnTogglePool.classList.toggle('active-view', isSpectatorFullscreen);
    }
    if (togglePoolText) {
      togglePoolText.textContent = isSpectatorFullscreen
        ? 'HIỆN BẢNG TƯỚNG'
        : 'ẨN BẢNG TƯỚNG';
    }

    if (window.gsap && !isStreamPhase) {
      if (isSpectatorFullscreen && showcaseContainer) {
        window.gsap.fromTo(
          showcaseContainer,
          { opacity: 0, scale: 0.88 },
          { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }
        );
      } else if (!isSpectatorFullscreen && poolContainer) {
        window.gsap.fromTo(
          poolContainer,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.38, ease: 'power2.out' }
        );
      }
    }
  }

  // ==================== HỆ THỐNG DISCORD SCREEN SHARE (WEBRTC P2P + EMBED) ====================
  let myPeer = null;
  let myPeerId = null;
  const localScreenStreams = { A: null, B: null };
  const remoteScreenStreams = { A: null, B: null };
  const activePeerCalls = { A: null, B: null };
  const connectedStreamerPeerIds = { A: null, B: null };
  let isVerticalStreamSplit = true;

  function initPeerEngine() {
    if (typeof window.Peer === 'undefined') return;
    try {
      myPeer = new window.Peer();
      myPeer.on('open', (id) => {
        myPeerId = id;
        ['A', 'B'].forEach((tKey) => {
          if (localScreenStreams[tKey]) {
            sendAction('UPDATE_STREAM_INFO', { team: tKey, peerId: myPeerId, active: true });
          }
        });
        if (roomState && roomState.status === 'COMPLETED') {
          renderDualStreamStage();
        }
      });

      // Khi người xem (Viewer) kết nối tới máy đang Share màn hình (Streamer), Streamer gọi lại và truyền MediaStream
      myPeer.on('connection', (conn) => {
        conn.on('open', () => {
          const requestedTeam = conn.metadata?.team;
          if (requestedTeam && localScreenStreams[requestedTeam] && myPeer) {
            myPeer.call(conn.peer, localScreenStreams[requestedTeam], {
              metadata: { team: requestedTeam }
            });
          }
        });
      });

      // Khi người xem nhận được cuộc gọi có chứa MediaStream từ máy đang Share
      myPeer.on('call', (call) => {
        const streamTeam = call.metadata?.team;
        call.answer();
        call.on('stream', (remoteStream) => {
          if (streamTeam === 'A' || streamTeam === 'B') {
            remoteScreenStreams[streamTeam] = remoteStream;
            attachStreamToVideoElement(streamTeam, remoteStream, false);
            updateStreamCardStateUI(streamTeam);
          }
        });
        call.on('close', () => {
          if (streamTeam === 'A' || streamTeam === 'B') {
            remoteScreenStreams[streamTeam] = null;
            updateStreamCardStateUI(streamTeam);
          }
        });
      });
    } catch (e) { }
  }

  function attachStreamToVideoElement(teamKey, mediaStream, isLocalPreview = false) {
    const videoEl = document.getElementById(teamKey === 'A' ? 'streamVideoA' : 'streamVideoB');
    if (!videoEl) return;
    if (videoEl.srcObject !== mediaStream) {
      videoEl.srcObject = mediaStream;
    }
    if (isLocalPreview) {
      videoEl.muted = true;
    }
    videoEl.classList.remove('hidden');
    videoEl.play().catch(() => { });
  }

  async function startDiscordScreenShare(teamKey) {
    if (clientRole !== 'SPEC' && clientTeam !== teamKey) {
      showToast('Bạn chỉ có thể Share màn hình cho đội của mình!');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showToast('Trình duyệt của bạn không hỗ trợ Share màn hình trực tiếp.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 60, max: 60 }
        },
        audio: true
      });

      if (localScreenStreams[teamKey]) {
        localScreenStreams[teamKey].getTracks().forEach((t) => t.stop());
      }

      localScreenStreams[teamKey] = stream;
      attachStreamToVideoElement(teamKey, stream, true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          stopDiscordScreenShare(teamKey);
        });
      }

      if (!myPeer && typeof window.Peer !== 'undefined') {
        initPeerEngine();
      }

      await sendAction('UPDATE_STREAM_INFO', {
        team: teamKey,
        peerId: myPeerId || 'LOCAL_STREAM',
        active: true,
        embedUrl: ''
      });

      renderDualStreamStage();
      showToast(`Đang phát trực tiếp màn hình ${roomState?.teams?.[teamKey]?.name || `Đội ${teamKey}`}!`);
    } catch (err) {
      if (err && err.name !== 'NotAllowedError') {
        showToast('Không thể bắt đầu Share màn hình.');
      }
    }
  }

  async function stopDiscordScreenShare(teamKey, silent = false) {
    if (localScreenStreams[teamKey]) {
      localScreenStreams[teamKey].getTracks().forEach((t) => t.stop());
      localScreenStreams[teamKey] = null;
    }
    remoteScreenStreams[teamKey] = null;
    connectedStreamerPeerIds[teamKey] = null;

    const videoEl = document.getElementById(teamKey === 'A' ? 'streamVideoA' : 'streamVideoB');
    if (videoEl) {
      videoEl.srcObject = null;
      videoEl.classList.add('hidden');
    }

    if (silent) {
      return;
    }

    await sendAction('UPDATE_STREAM_INFO', {
      team: teamKey,
      peerId: null,
      active: false
    });

    renderDualStreamStage();
    showToast(`Đã dừng Share màn hình ${roomState?.teams?.[teamKey]?.name || `Đội ${teamKey}`}.`);
  }

  function normalizeStreamEmbedUrl(rawUrl) {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) return '';
    try {
      const u = new URL(trimmed);
      if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
        return `https://www.youtube.com/embed/${u.searchParams.get('v')}?autoplay=1&mute=0`;
      }
      if (u.hostname === 'youtu.be' && u.pathname.length > 1) {
        return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1&mute=0`;
      }
      if (u.hostname.includes('twitch.tv')) {
        const channel = u.pathname.split('/').filter(Boolean)[0];
        if (channel && channel !== 'videos') {
          return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(window.location.hostname || 'localhost')}`;
        }
      }
      return trimmed;
    } catch (e) {
      return trimmed;
    }
  }

  function connectToRemoteTeamStreamIfNeeded(teamKey) {
    if (!roomState || !roomState.streams || !roomState.streams[teamKey]) return;
    const streamInfo = roomState.streams[teamKey];

    if (!streamInfo.active || !streamInfo.peerId || streamInfo.peerId === 'LOCAL_STREAM') {
      connectedStreamerPeerIds[teamKey] = null;
      return;
    }

    // Nếu chính máy này đang phát stream cho teamKey thì không cần tự gọi chính mình
    if (localScreenStreams[teamKey] || (myPeerId && streamInfo.peerId === myPeerId)) {
      return;
    }

    if (!myPeer || !myPeerId) return;

    if (connectedStreamerPeerIds[teamKey] === streamInfo.peerId && remoteScreenStreams[teamKey]) {
      return;
    }

    connectedStreamerPeerIds[teamKey] = streamInfo.peerId;
    try {
      const conn = myPeer.connect(streamInfo.peerId, {
        metadata: { team: teamKey }
      });
      conn.on('error', () => {
        connectedStreamerPeerIds[teamKey] = null;
      });
    } catch (e) {
      connectedStreamerPeerIds[teamKey] = null;
    }
  }

  function updateStreamCardStateUI(teamKey) {
    if (!roomState) return;
    const streamInfo = roomState.streams?.[teamKey] || { peerId: null, active: false, embedUrl: '' };
    const isLocalStreaming = Boolean(localScreenStreams[teamKey]);
    const isRemoteStreaming = Boolean(remoteScreenStreams[teamKey] && streamInfo.active);
    const hasEmbed = Boolean(streamInfo.embedUrl);
    const isLive = isLocalStreaming || isRemoteStreaming || hasEmbed || Boolean(streamInfo.active);

    const canControlThisTeam =
      clientRole === 'SPEC' || (clientRole === 'PLAYER' && clientTeam === teamKey);

    const nameEl = document.getElementById(teamKey === 'A' ? 'streamTitleA' : 'streamTitleB');
    const liveBadge = document.getElementById(teamKey === 'A' ? 'streamStatusA' : 'streamStatusB');
    const placeholder = document.getElementById(teamKey === 'A' ? 'streamPlaceholderA' : 'streamPlaceholderB');
    const videoEl = document.getElementById(teamKey === 'A' ? 'streamVideoA' : 'streamVideoB');
    const iframeEl = document.getElementById(teamKey === 'A' ? 'streamIframeA' : 'streamIframeB');
    const btnShare = document.getElementById(teamKey === 'A' ? 'btnShareScreenA' : 'btnShareScreenB');
    const btnQuickShare = document.getElementById(teamKey === 'A' ? 'btnQuickShareA' : 'btnQuickShareB');
    const btnStop = document.getElementById(teamKey === 'A' ? 'btnStopScreenA' : 'btnStopScreenB');
    const embedRow = document.getElementById(teamKey === 'A' ? 'streamEmbedRowA' : 'streamEmbedRowB');

    if (nameEl) nameEl.textContent = roomState.teams[teamKey]?.name || `ĐỘI ${teamKey}`;

    if (liveBadge) {
      liveBadge.textContent = isLive ? 'LIVE' : 'OFFLINE';
      liveBadge.classList.toggle('is-live', isLive);
    }

    if (btnShare) btnShare.classList.toggle('hidden', !canControlThisTeam || isLocalStreaming);
    if (btnQuickShare) btnQuickShare.classList.toggle('hidden', !canControlThisTeam || isLocalStreaming);
    if (btnStop) btnStop.classList.toggle('hidden', !canControlThisTeam || (!isLocalStreaming && !hasEmbed && !streamInfo.active));
    if (embedRow) embedRow.classList.toggle('hidden', !canControlThisTeam);

    if (isLocalStreaming && localScreenStreams[teamKey]) {
      if (placeholder) placeholder.classList.add('hidden');
      if (iframeEl) {
        iframeEl.classList.add('hidden');
        iframeEl.src = 'about:blank';
      }
      attachStreamToVideoElement(teamKey, localScreenStreams[teamKey], true);
      return;
    }

    if (isRemoteStreaming && remoteScreenStreams[teamKey]) {
      if (placeholder) placeholder.classList.add('hidden');
      if (iframeEl) {
        iframeEl.classList.add('hidden');
        iframeEl.src = 'about:blank';
      }
      attachStreamToVideoElement(teamKey, remoteScreenStreams[teamKey], false);
      return;
    }

    if (hasEmbed) {
      if (placeholder) placeholder.classList.add('hidden');
      if (videoEl) {
        videoEl.srcObject = null;
        videoEl.classList.add('hidden');
      }
      if (iframeEl) {
        iframeEl.classList.remove('hidden');
        if (iframeEl.src !== streamInfo.embedUrl) {
          iframeEl.src = streamInfo.embedUrl;
        }
      }
      return;
    }

    if (videoEl) {
      videoEl.srcObject = null;
      videoEl.classList.add('hidden');
    }
    if (iframeEl) {
      iframeEl.classList.add('hidden');
      if (iframeEl.src !== 'about:blank') iframeEl.src = 'about:blank';
    }
    if (placeholder) {
      placeholder.classList.remove('hidden');
    }
  }

  function renderDualStreamStage() {
    if (!roomState) return;
    const isStreamPhase = roomState.status === 'COMPLETED';
    const dualStreamStage = document.getElementById('dualStreamStage');
    const poolContainer = document.getElementById('championPoolContainer');
    const showcaseContainer = document.getElementById('spectatorCenterShowcase');
    const lockinBar = document.getElementById('lockinBar');
    const btnEndMatchStream = document.getElementById('btnEndMatchStream');

    if (btnEndMatchStream) {
      btnEndMatchStream.classList.toggle('hidden', !(isStreamPhase && clientRole === 'SPEC'));
    }

    if (isStreamPhase) {
      if (dualStreamStage) dualStreamStage.classList.remove('hidden');
      if (poolContainer) poolContainer.classList.add('hidden');
      if (showcaseContainer) showcaseContainer.classList.add('hidden');
      if (lockinBar) lockinBar.classList.add('hidden');

      connectToRemoteTeamStreamIfNeeded('A');
      connectToRemoteTeamStreamIfNeeded('B');
      updateStreamCardStateUI('A');
      updateStreamCardStateUI('B');
    } else {
      if (dualStreamStage) dualStreamStage.classList.add('hidden');
      if (poolContainer) poolContainer.classList.toggle('hidden', isSpectatorFullscreen);
      if (showcaseContainer) showcaseContainer.classList.toggle('hidden', !isSpectatorFullscreen);
      if (lockinBar) lockinBar.classList.toggle('hidden', isSpectatorFullscreen);
    }
  }

  // ==================== RENDER GIAO DIỆN ====================
  function renderRoleUI() {
    const btnMainMenu = document.getElementById('btnToggleMainMenu');
    const btnTogglePool = document.getElementById('btnTogglePoolView');
    const btcRoleSwitcher = document.getElementById('btcRoleSwitcher');
    const playerLockedBadge = document.getElementById('playerLockedBadge');
    const btcToolbar = document.getElementById('btcToolbar');
    const playerToolbar = document.getElementById('playerToolbar');
    const playerSidePill = document.getElementById('playerSidePill');

    if (clientRole === 'SPEC') {
      btnMainMenu.classList.remove('hidden');
      if (btnTogglePool) btnTogglePool.classList.remove('hidden');
      btcRoleSwitcher.classList.remove('hidden');
      playerLockedBadge.classList.add('hidden');
      btcToolbar.classList.remove('hidden');
      playerToolbar.classList.add('hidden');
      setSpectatorFullscreen(isSpectatorFullscreen);
    } else {
      btnMainMenu.classList.add('hidden');
      if (btnTogglePool) btnTogglePool.classList.add('hidden');
      btcRoleSwitcher.classList.add('hidden');
      playerLockedBadge.classList.remove('hidden');
      btcToolbar.classList.add('hidden');
      playerToolbar.classList.remove('hidden');
      setSpectatorFullscreen(false);

      const teamName = roomState?.teams?.[clientTeam]?.name || `ĐỘI ${clientTeam}`;
      playerSidePill.textContent = teamName;
      playerSidePill.classList.toggle('side-b', clientTeam === 'B');
    }

    const teamASwapHint = document.getElementById('teamASwapHint');
    const teamBSwapHint = document.getElementById('teamBSwapHint');
    if (teamASwapHint) teamASwapHint.textContent = '';
    if (teamBSwapHint) teamBSwapHint.textContent = '';

    if (roomState) {
      renderAll();
    }
  }

  function applyRoomState(newState, options = {}) {
    if (!newState) return;

    // Chống hiện tượng nhảy lùi giai đoạn / vị trí do request cũ về muộn hoặc multi-instance trên Vercel
    if (
      roomState &&
      !options.forceAccept &&
      newState.roomId === roomState.roomId &&
      typeof newState.revision === 'number' &&
      typeof roomState.revision === 'number' &&
      newState.revision < roomState.revision
    ) {
      return;
    }

    // Nếu trạng thái mới y hệt trạng thái hiện tại trên màn hình thì chỉ đồng bộ đồng hồ nhẹ nhàng, không vẽ lại DOM
    if (
      roomState &&
      !options.forceAccept &&
      newState.roomId === roomState.roomId &&
      newState.revision === roomState.revision &&
      newState.status === roomState.status &&
      newState.stepIndex === roomState.stepIndex &&
      newState.hoveredCharId === roomState.hoveredCharId &&
      newState.isPaused === roomState.isPaused
    ) {
      if (typeof newState.timeLeft === 'number' && Math.abs(newState.timeLeft - roomState.timeLeft) >= 2) {
        roomState.timeLeft = newState.timeLeft;
        lastTimeLeft = newState.timeLeft;
        renderHeaderAndClock();
      }
      return;
    }

    let lockedEffectArgs = null;
    let hoverEffectColor = null;
    let shouldPulseTimer = false;
    const prevStatus = roomState ? roomState.status : null;

    if (roomState) {
      // Tự động phát & unmute nhạc khi Bắt đầu trận đấu (WAITING -> DRAFTING)
      if (prevStatus === 'WAITING' && newState.status === 'DRAFTING') {
        autoPlayAndUnmuteBgm();
      }
      // Tự động pause & mute nhạc khi hết 90s sắp xếp đội hình (chuyển sang COMPLETED)
      if (prevStatus && prevStatus !== 'COMPLETED' && newState.status === 'COMPLETED') {
        swapSource = null;
        autoPauseAndMuteBgm();
      }

      if (newState.stepIndex !== lastStepIndex && (newState.status === 'DRAFTING' || newState.status === 'LINEUP')) {
        const prevStep = roomState.currentStep;
        const isBan = prevStep?.type === 'BAN';
        playLolSfx(isBan ? 'banned-sound' : 'pick-sound');
        let accentColor = isBan ? '#e84057' : '#0ac8b9';
        let slotSelector = null;

        if (prevStep) {
          const slotData = isBan
            ? newState.teams?.[prevStep.team]?.bans?.[prevStep.slotIndex]
            : newState.teams?.[prevStep.team]?.picks?.[prevStep.slotIndex];
          if (slotData?.charId) {
            const cObj = window.MIHOYO_DATA.getCharacterById(slotData.charId);
            if (cObj && ELEMENT_COLORS[cObj.element]) {
              accentColor = ELEMENT_COLORS[cObj.element];
            }
          }
          slotSelector = isBan
            ? `#team${prevStep.team}BanSlots .ban-slot:nth-child(${prevStep.slotIndex + 1})`
            : `.pick-slot-card[data-team="${prevStep.team}"][data-slot="${prevStep.slotIndex}"]`;
        }
        const latestLogText = newState.actionLog?.[0]?.text || '';
        if (latestLogText.includes('[BTC/Hết giờ]')) {
          showToast(latestLogText);
        }
        lockedEffectArgs = { isBan, accentColor, slotSelector };
      } else if (newState.hoveredCharId && newState.hoveredCharId !== lastHoveredChar) {
        playLolSfx('click-button-sound');
        const hObj = window.MIHOYO_DATA.getCharacterById(newState.hoveredCharId);
        hoverEffectColor = (hObj && ELEMENT_COLORS[hObj.element]) || '#0ac8b9';
      } else if (
        newState.timeLeft !== lastTimeLeft &&
        (newState.status === 'DRAFTING' || newState.status === 'LINEUP')
      ) {
        shouldPulseTimer = true;
      }
    }

    lastStepIndex = newState.stepIndex;
    lastHoveredChar = newState.hoveredCharId;
    lastTimeLeft = newState.timeLeft;
    roomState = newState;

    saveRecentRoomLocal(newState);
    renderAll();

    if (lockedEffectArgs) {
      triggerGsapLockInEffect(
        lockedEffectArgs.isBan,
        lockedEffectArgs.accentColor,
        lockedEffectArgs.slotSelector
      );
    } else if (hoverEffectColor) {
      triggerGsapHoverEffect(hoverEffectColor);
    } else if (shouldPulseTimer) {
      triggerGsapTimerTick(newState.timeLeft);
    }
  }

  let currentShowcaseCharId = null;
  let currentBackdropCharId = null;

  function updateBackdropSplash() {
    const splashEl = document.getElementById('backdropSplash');
    const ambientGlow = document.getElementById('elementalAmbientGlow');
    const showcaseArt = document.getElementById('showcaseCharArt');
    const showcaseInfo = document.getElementById('showcaseCharInfo');
    const showcaseTag = document.getElementById('showcaseActionTag');
    const showcaseName = document.getElementById('showcaseCharName');
    const showcaseSub = document.getElementById('showcaseCharSub');
    if (!splashEl || !roomState) return;

    const targetCharId = roomState.status === 'DRAFTING' ? roomState.hoveredCharId : null;

    if (targetCharId && roomState.currentStep) {
      const charObj = window.MIHOYO_DATA.getCharacterById(targetCharId);
      if (charObj) {
        const tName = roomState.teams[roomState.currentStep.team]?.name || '';
        const actionLabel = `${tName} • ${roomState.currentStep.type === 'BAN' ? 'CẤM' : 'CHỌN'}`;
        const elColor = ELEMENT_COLORS[charObj.element] || '#0ac8b9';

        // Nền đằng sau (#backdropSplash) hiển thị ảnh Splash Art nhân vật (UI_Gacha_AvatarImg_...)
        if (currentBackdropCharId !== targetCharId) {
          currentBackdropCharId = targetCharId;
          splashEl.style.backgroundImage = '';
          splashEl.innerHTML = buildSmartImgTag(
            charObj.splashUrls || charObj.iconUrls,
            charObj.name,
            charObj.element,
            charObj.nameVi,
            'backdrop-splash-img'
          );
        }

        if (ambientGlow) {
          ambientGlow.style.background = `radial-gradient(circle, ${elColor}38 0%, rgba(200, 170, 110, 0.1) 48%, transparent 72%)`;
        }

        // Vòng tròn trung tâm (#showcaseCharArt) hiển thị Avatar nhân vật (UI_AvatarIcon_...)
        if (showcaseArt && currentShowcaseCharId !== targetCharId) {
          currentShowcaseCharId = targetCharId;
          showcaseArt.style.backgroundImage = '';
          showcaseArt.innerHTML = buildSmartImgTag(
            charObj.iconUrls,
            charObj.name,
            charObj.element,
            charObj.nameVi
          );
        }
        if (showcaseInfo) showcaseInfo.classList.remove('hidden');
        if (showcaseTag) showcaseTag.textContent = actionLabel;
        if (showcaseName) showcaseName.textContent = charObj.nameVi.toUpperCase();
        if (showcaseSub) {
          const elSprite = ELEMENT_SPRITE_URLS[charObj.element]
            ? `<img src="${ELEMENT_SPRITE_URLS[charObj.element]}" class="showcase-el-img" alt="${charObj.element}" />`
            : '';
          const elLabel = charObj.element === 'Multi' ? 'TỰ DO NGUYÊN TỐ' : charObj.element.toUpperCase();
          showcaseSub.innerHTML = `${elSprite}<span>${elLabel} • ${charObj.rarity} SAO</span>`;
        }
        return;
      }
    }

    // Sau khi Khóa / Cấm hoặc chưa chọn tướng: Xóa sạch ảnh nền và ảnh trung tâm về trạng thái ban đầu
    currentBackdropCharId = null;
    currentShowcaseCharId = null;
    splashEl.style.backgroundImage = '';
    splashEl.innerHTML = '';
    if (ambientGlow) {
      ambientGlow.style.background =
        'radial-gradient(circle, rgba(10, 200, 185, 0.16) 0%, rgba(200, 170, 110, 0.08) 45%, transparent 72%)';
    }
    if (showcaseArt) {
      showcaseArt.style.backgroundImage = '';
      showcaseArt.innerHTML = '';
    }
    if (showcaseInfo) showcaseInfo.classList.add('hidden');
    if (showcaseTag) showcaseTag.textContent = '';
    if (showcaseName) showcaseName.textContent = '';
    if (showcaseSub) showcaseSub.textContent = '';
  }

  function renderAll() {
    if (!roomState) return;
    updateBackdropSplash();
    renderHeaderAndClock();
    renderSequenceBar();
    renderBanSlots('A', document.getElementById('teamABanSlots'));
    renderBanSlots('B', document.getElementById('teamBBanSlots'));
    renderTeamPicks('A');
    renderTeamPicks('B');
    renderLockinBar();
    renderCharacterGrid();
    renderDualStreamStage();
  }

  function renderHeaderAndClock() {
    const { status, isPaused, currentStep, timeLeft, teams, banDuration, pickDuration, lineupDuration } = roomState;

    document.getElementById('teamANameDisplay').textContent = teams.A.name;
    document.getElementById('teamBNameDisplay').textContent = teams.B.name;
    document.getElementById('teamAReadyBadge').classList.toggle('hidden', !teams.A.readyLineup);
    document.getElementById('teamBReadyBadge').classList.toggle('hidden', !teams.B.readyLineup);

    if (clientRole === 'PLAYER') {
      const tName = teams[clientTeam]?.name || `ĐỘI ${clientTeam}`;
      document.getElementById('playerSidePill').textContent = tName;
    }

    const isTurnA = status === 'DRAFTING' && currentStep?.team === 'A';
    const isTurnB = status === 'DRAFTING' && currentStep?.team === 'B';
    const isUrgent = timeLeft <= 10 && (status === 'DRAFTING' || status === 'LINEUP');

    const headerA = document.getElementById('teamAHeaderCard');
    const headerB = document.getElementById('teamBHeaderCard');
    if (headerA) headerA.classList.toggle('team-turn-active', isTurnA || status === 'LINEUP');
    if (headerB) headerB.classList.toggle('team-turn-active', isTurnB || status === 'LINEUP');

    const turnBarA = document.getElementById('teamATurnBar');
    const turnBarB = document.getElementById('teamBTurnBar');
    const timerCircle = document.getElementById('timerProgressCircle');
    const circumference = 263.89;
    let ringPct = 0;

    if (status === 'DRAFTING' && currentStep) {
      const maxDur = currentStep.type === 'BAN' ? banDuration : pickDuration;
      const pct = Math.max(0, Math.min(100, (timeLeft / maxDur) * 100));
      ringPct = pct;
      turnBarA.style.width = isTurnA ? `${pct}%` : '0%';
      turnBarB.style.width = isTurnB ? `${pct}%` : '0%';
      turnBarA.classList.toggle('is-active', isTurnA && pct > 0);
      turnBarB.classList.toggle('is-active', isTurnB && pct > 0);
      turnBarA.classList.toggle('is-urgent', isTurnA && isUrgent);
      turnBarB.classList.toggle('is-urgent', isTurnB && isUrgent);
    } else if (status === 'LINEUP') {
      const pct = Math.max(0, Math.min(100, (timeLeft / lineupDuration) * 100));
      ringPct = pct;
      turnBarA.style.width = `${pct}%`;
      turnBarB.style.width = `${pct}%`;
      turnBarA.classList.toggle('is-active', pct > 0);
      turnBarB.classList.toggle('is-active', pct > 0);
      turnBarA.classList.toggle('is-urgent', isUrgent);
      turnBarB.classList.toggle('is-urgent', isUrgent);
    } else {
      ringPct = status === 'WAITING' ? 100 : 0;
      turnBarA.style.width = '0%';
      turnBarB.style.width = '0%';
      turnBarA.classList.remove('is-active', 'is-urgent');
      turnBarB.classList.remove('is-active', 'is-urgent');
    }

    if (timerCircle) {
      const offset = circumference * (1 - ringPct / 100);
      timerCircle.style.strokeDashoffset = `${offset}`;
      const isBanStep = status === 'DRAFTING' && currentStep?.type === 'BAN';
      timerCircle.style.stroke = isUrgent || isBanStep ? '#e84057' : '#0ac8b9';
    }

    const phasePill = document.getElementById('phaseTitlePill');
    const timerDisplay = document.getElementById('timerDisplay');
    const turnInstruction = document.getElementById('turnInstruction');
    const lineupBanner = document.getElementById('lineupPhaseBanner');

    phasePill.className = 'center-phase-title';
    timerDisplay.textContent = `${timeLeft}`;
    timerDisplay.classList.toggle('urgent', timeLeft <= 10 && (status === 'DRAFTING' || status === 'LINEUP'));

    lineupBanner.classList.toggle('hidden', status !== 'LINEUP');

    if (status === 'WAITING') {
      phasePill.textContent = '';
      turnInstruction.textContent = '';
    } else if (status === 'DRAFTING' && currentStep) {
      const teamName = teams[currentStep.team].name;
      phasePill.textContent = '';
      turnInstruction.textContent = `${teamName} • ${currentStep.label}${isPaused ? ' (TẠM DỪNG)' : ''}`;
    } else if (status === 'LINEUP') {
      phasePill.textContent = '';
      turnInstruction.textContent = 'Xếp đội';
    } else if (status === 'COMPLETED') {
      phasePill.textContent = '';
      timerDisplay.textContent = 'LIVE';
      turnInstruction.textContent = '';
    }

    const teamASwapHint = document.getElementById('teamASwapHint');
    const teamBSwapHint = document.getElementById('teamBSwapHint');
    if (teamASwapHint) teamASwapHint.textContent = '';
    if (teamBSwapHint) teamBSwapHint.textContent = '';

    const btnStart = document.getElementById('btnStartMatch');
    const btnPause = document.getElementById('btnPauseMatch');
    const btnUndo = document.getElementById('btnUndoStep');
    const btnEndToolbar = document.getElementById('btnEndMatchToolbar');
    const lockIndicator = document.getElementById('roomLockIndicator');

    if (btnStart) btnStart.disabled = status !== 'WAITING';
    if (btnPause) {
      btnPause.disabled = status !== 'DRAFTING' && status !== 'LINEUP';
      btnPause.textContent = isPaused ? 'TIẾP TỤC' : 'TẠM DỪNG';
    }
    if (btnUndo) btnUndo.disabled = !roomState.canUndo;
    if (btnEndToolbar) {
      btnEndToolbar.classList.toggle('hidden', !(clientRole === 'SPEC' && status === 'COMPLETED'));
    }
    if (lockIndicator) {
      lockIndicator.classList.toggle('hidden', !roomState.hasPassword);
    }

    const btnConfirmTeamLineup = document.getElementById('btnConfirmTeamLineup');
    if (btnConfirmTeamLineup && clientRole === 'PLAYER') {
      btnConfirmTeamLineup.classList.toggle('hidden', status === 'COMPLETED');
      const isReady = teams[clientTeam]?.readyLineup;
      btnConfirmTeamLineup.textContent = isReady ? 'ĐÃ CHỐT (SỬA LẠI)' : 'CHỐT ĐỘI HÌNH';
    }
  }

  function renderSequenceBar() {
    const bar = document.getElementById('sequenceBar');
    if (!bar || !roomState.steps) return;

    const clusters = [
      { label: 'A Cấm 2', team: 'A', range: [0, 1] },
      { label: 'B Cấm 2', team: 'B', range: [2, 3] },
      { label: 'A Cấm 1', team: 'A', range: [4, 4] },
      { label: 'B Cấm 1', team: 'B', range: [5, 5] },
      { label: 'A Chọn 1', team: 'A', range: [6, 6] },
      { label: 'B Chọn 2', team: 'B', range: [7, 8] },
      { label: 'A Chọn 2', team: 'A', range: [9, 10] },
      { label: 'B Chọn 2', team: 'B', range: [11, 12] },
      { label: 'A Chọn 1', team: 'A', range: [13, 13] },
      { label: 'B Cấm 1', team: 'B', range: [14, 14] },
      { label: 'A Cấm 1', team: 'A', range: [15, 15] },
      { label: 'B Cấm 1', team: 'B', range: [16, 16] },
      { label: 'A Cấm 1', team: 'A', range: [17, 17] },
      { label: 'B Chọn 1', team: 'B', range: [18, 18] },
      { label: 'A Chọn 2', team: 'A', range: [19, 20] },
      { label: 'B Chọn 2', team: 'B', range: [21, 22] },
      { label: 'A Chọn 2', team: 'A', range: [23, 24] },
      { label: 'B Chọn 1', team: 'B', range: [25, 25] }
    ];

    const html = clusters
      .map((c) => {
        let stateClass = '';
        if (roomState.status === 'LINEUP' || roomState.status === 'COMPLETED') {
          stateClass = 'done';
        } else if (roomState.status === 'DRAFTING') {
          if (roomState.stepIndex > c.range[1]) stateClass = 'done';
          else if (roomState.stepIndex >= c.range[0] && roomState.stepIndex <= c.range[1]) {
            stateClass = 'active';
          }
        }
        return `<div class="seq-chip seq-team-${c.team.toLowerCase()} ${stateClass}">${c.label}</div>`;
      })
      .concat([
        `<div class="seq-chip ${roomState.status === 'LINEUP' ? 'active' : ''}">Xếp Đội 90s</div>`
      ])
      .join('');

    if (domRenderCache.seqBar !== html) {
      domRenderCache.seqBar = html;
      bar.innerHTML = html;
    }
  }

  function renderBanSlots(teamKey, container) {
    if (!container) return;
    const bans = roomState.teams[teamKey].bans || [];
    const cur = roomState.currentStep;

    const html = bans
      .map((banItem, idx) => {
        const isCurrentBanSlot =
          roomState.status === 'DRAFTING' &&
          cur &&
          cur.type === 'BAN' &&
          cur.team === teamKey &&
          cur.slotIndex === idx;

        const dividerClass = idx === 2 ? 'phase-divider-after' : '';
        const activeClass = isCurrentBanSlot ? 'active-ban-slot' : '';

        if (!banItem || !banItem.charId) {
          if (isCurrentBanSlot && roomState.hoveredCharId) {
            const hChar = window.MIHOYO_DATA.getCharacterById(roomState.hoveredCharId);
            if (hChar) {
              return `<div class="ban-slot ${dividerClass} ${activeClass}" title="${hChar.nameVi}">
                ${buildSmartImgTag(hChar.iconUrls, hChar.name, hChar.element, hChar.nameVi)}
                <div class="ban-slash"></div>
              </div>`;
            }
          }
          return `<div class="ban-slot ${dividerClass} ${activeClass}">
            <span class="ban-slot-num">${idx + 1}</span>
          </div>`;
        }

        if (banItem.charId === 'SKIPPED_BAN') {
          return `<div class="ban-slot ${dividerClass}">
            <span class="ban-slot-num">—</span>
          </div>`;
        }

        const charObj = window.MIHOYO_DATA.getCharacterById(banItem.charId);
        if (!charObj) {
          return `<div class="ban-slot ${dividerClass}"><span class="ban-slot-num">—</span></div>`;
        }

        return `<div class="ban-slot ${dividerClass}" title="Đã cấm: ${charObj.nameVi}">
          ${buildSmartImgTag(charObj.iconUrls, charObj.name, charObj.element, charObj.nameVi)}
          <div class="ban-slash"></div>
        </div>`;
      })
      .join('');

    const cacheKey = teamKey === 'A' ? 'banA' : 'banB';
    if (domRenderCache[cacheKey] !== html) {
      domRenderCache[cacheKey] = html;
      container.innerHTML = html;
    }
  }

  function renderTeamPicks(teamKey) {
    const upperContainer = document.getElementById(teamKey === 'A' ? 'teamAUpperPicks' : 'teamBUpperPicks');
    const lowerContainer = document.getElementById(teamKey === 'A' ? 'teamALowerPicks' : 'teamBLowerPicks');
    if (!upperContainer || !lowerContainer) return;

    const picks = roomState.teams[teamKey].picks || [];
    const cur = roomState.currentStep;
    const isCompleted = roomState.status === 'COMPLETED';

    // Sau 90s (status === 'COMPLETED'): Khóa đổi đội hình, chỉ được phép chọn Cung mệnh & Vũ khí
    const canPlayerSwapThisTeam =
      !isCompleted && ((clientRole === 'PLAYER' && clientTeam === teamKey) || clientRole === 'SPEC');

    const canEditMetaThisTeam =
      clientRole === 'SPEC' || (clientRole === 'PLAYER' && clientTeam === teamKey);

    const buildSlotHtml = (pickItem, slotIdx) => {
      const isCurrentPickSlot =
        roomState.status === 'DRAFTING' &&
        cur &&
        cur.type === 'PICK' &&
        cur.team === teamKey &&
        cur.slotIndex === slotIdx;

      const isSelectedForSwap =
        swapSource && swapSource.team === teamKey && swapSource.slotIndex === slotIdx;

      if (!pickItem || !pickItem.charId) {
        if (isCurrentPickSlot && roomState.hoveredCharId) {
          const hChar = window.MIHOYO_DATA.getCharacterById(roomState.hoveredCharId);
          if (hChar) {
            return `
              <div class="pick-slot-card active-pick-slot" data-team="${teamKey}" data-slot="${slotIdx}">
                ${buildSmartImgTag(hChar.splashUrls || hChar.iconUrls, hChar.name, hChar.element, hChar.nameVi, 'slot-bg-watermark')}
                <div class="slot-avatar-wrap">
                  ${buildSmartImgTag(hChar.iconUrls, hChar.name, hChar.element, hChar.nameVi)}
                </div>
                <div class="slot-info">
                  <div class="slot-char-name">${hChar.nameVi}</div>
                  <div class="slot-empty-text" style="color:var(--lol-gold);">Đang chọn...</div>
                </div>
              </div>
            `;
          }
        }

        return `
          <div class="pick-slot-card ${isCurrentPickSlot ? 'active-pick-slot' : ''} ${isSelectedForSwap ? 'selected-for-swap' : ''
          }" data-team="${teamKey}" data-slot="${slotIdx}">
            <div class="slot-avatar-wrap">
              <span class="slot-index-num">${slotIdx + 1}</span>
            </div>
            <div class="slot-info">
              <div class="slot-empty-text">
                ${isCurrentPickSlot ? 'Đang chọn...' : ''}
              </div>
            </div>
          </div>
        `;
      }

      const charObj = window.MIHOYO_DATA.getCharacterById(pickItem.charId);
      const charName = charObj ? charObj.nameVi : pickItem.charId;
      const element = charObj ? charObj.element : 'Pyro';
      const iconUrls = charObj ? charObj.iconUrls : [];
      const splashUrls = charObj ? charObj.splashUrls || charObj.iconUrls : iconUrls;
      const constBadge = pickItem.constellation || 'C0';
      const weaponName = pickItem.weaponName || '';
      const weaponRefine = pickItem.weaponRefine || 'R1';
      const weaponObj = pickItem.weaponId ? window.MIHOYO_DATA.getWeaponById(pickItem.weaponId) : null;
      const weaponIconUrls = weaponObj
        ? weaponObj.iconUrls
        : pickItem.weaponIcon
          ? window.MIHOYO_DATA.getWeaponIconUrls(pickItem.weaponIcon)
          : null;

      return `
        <div
          class="pick-slot-card ${canPlayerSwapThisTeam || canEditMetaThisTeam ? 'interactive-slot' : ''} ${isSelectedForSwap ? 'selected-for-swap' : ''
        }"
          data-team="${teamKey}"
          data-slot="${slotIdx}"
          draggable="${canPlayerSwapThisTeam ? 'true' : 'false'}"
        >
          ${buildSmartImgTag(splashUrls, charName, element, charName, 'slot-bg-watermark')}
          <div class="slot-avatar-wrap">
            ${buildSmartImgTag(iconUrls, charName, element, charName)}
            <span class="slot-element-badge">${ELEMENT_SVGS[element] || ''}</span>
            <span class="slot-constellation-badge ${constBadge === 'C6' ? 'is-c6' : ''}">${constBadge}</span>
          </div>

          <div class="slot-info">
            <div class="slot-char-name">${charName}</div>
            ${weaponName
          ? `<div class="slot-weapon-row">
                    ${weaponIconUrls ? buildSmartImgTag(weaponIconUrls, weaponName, element, weaponName) : ''}
                    <span class="slot-weapon-name">${weaponName}</span>
                    <span class="slot-refine-tag">${weaponRefine}</span>
                  </div>`
          : `<div class="slot-weapon-row">
                    <span class="slot-weapon-name" style="opacity:0.45;">${canEditMetaThisTeam ? 'Bấm để gán Vũ khí' : ''
          }</span>
                  </div>`
        }
          </div>

          <div class="slot-actions">
            ${canEditMetaThisTeam
          ? `<button type="button" class="btn-slot-action btn-open-meta" data-team="${teamKey}" data-slot="${slotIdx}">CM/VK</button>`
          : ''
        }
            ${canPlayerSwapThisTeam
          ? `<button type="button" class="btn-slot-action btn-swap-slot" data-team="${teamKey}" data-slot="${slotIdx}">ĐỔI</button>`
          : ''
        }
          </div>
        </div>
      `;
    };

    const upperHtml = picks.slice(0, 4).map((p, i) => buildSlotHtml(p, i)).join('');
    const lowerHtml = picks.slice(4, 8).map((p, i) => buildSlotHtml(p, i + 4)).join('');
    const upperKey = teamKey === 'A' ? 'upperA' : 'upperB';
    const lowerKey = teamKey === 'A' ? 'lowerA' : 'lowerB';

    if (domRenderCache[upperKey] === upperHtml && domRenderCache[lowerKey] === lowerHtml) {
      return;
    }
    domRenderCache[upperKey] = upperHtml;
    domRenderCache[lowerKey] = lowerHtml;

    upperContainer.innerHTML = upperHtml;
    lowerContainer.innerHTML = lowerHtml;

    [upperContainer, lowerContainer].forEach((container) => {
      container.querySelectorAll('.pick-slot-card').forEach((card) => {
        const slotIdx = Number(card.getAttribute('data-slot'));
        const tKey = card.getAttribute('data-team');

        const btnMeta = card.querySelector('.btn-open-meta');
        if (btnMeta) {
          btnMeta.addEventListener('click', (e) => {
            e.stopPropagation();
            openCharMetaModal(tKey, slotIdx);
          });
        }

        const btnSwap = card.querySelector('.btn-swap-slot');
        if (btnSwap) {
          btnSwap.addEventListener('click', (e) => {
            e.stopPropagation();
            handleSlotSwapClick(tKey, slotIdx);
          });
        }

        card.addEventListener('click', () => {
          if (isCompleted && canEditMetaThisTeam && picks[slotIdx]?.charId) {
            openCharMetaModal(tKey, slotIdx);
          } else if (clientRole === 'SPEC' && !swapSource && picks[slotIdx]?.charId) {
            openCharMetaModal(tKey, slotIdx);
          } else if (canPlayerSwapThisTeam) {
            handleSlotSwapClick(tKey, slotIdx);
          }
        });

        if (canPlayerSwapThisTeam) {
          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ team: tKey, slotIndex: slotIdx }));
          });
          card.addEventListener('dragover', (e) => {
            e.preventDefault();
          });
          card.addEventListener('drop', (e) => {
            e.preventDefault();
            try {
              const src = JSON.parse(e.dataTransfer.getData('text/plain'));
              if (src && src.team === tKey && src.slotIndex !== slotIdx) {
                sendAction('SWAP_LINEUP', {
                  team: tKey,
                  fromIndex: src.slotIndex,
                  toIndex: slotIdx
                });
                swapSource = null;
              }
            } catch (err) { }
          });
        }
      });
    });
  }

  function handleSlotSwapClick(teamKey, slotIdx) {
    if (roomState && roomState.status === 'COMPLETED') {
      showToast('Đã hết 90s sắp xếp! Đội hình đã bị khóa, chỉ được chọn Cung mệnh & Vũ khí.');
      return;
    }
    if (clientRole !== 'SPEC' && clientTeam !== teamKey) {
      return;
    }

    if (!swapSource || swapSource.team !== teamKey) {
      swapSource = { team: teamKey, slotIndex: slotIdx };
      renderTeamPicks(teamKey);
      return;
    }

    if (swapSource.slotIndex === slotIdx) {
      swapSource = null;
      renderTeamPicks(teamKey);
      return;
    }

    const fromIndex = swapSource.slotIndex;
    swapSource = null;
    sendAction('SWAP_LINEUP', {
      team: teamKey,
      fromIndex,
      toIndex: slotIdx
    });
  }

  function renderLockinBar() {
    const charNameEl = document.getElementById('hoveredCharName');
    const btnLockIn = document.getElementById('btnLockIn');
    const btnSkipBan = document.getElementById('btnSkipBan');

    const cur = roomState.currentStep;
    const isDrafting = roomState.status === 'DRAFTING' && cur;
    const canActNow =
      isDrafting && (clientRole === 'SPEC' || (clientRole === 'PLAYER' && clientTeam === cur.team));

    btnSkipBan.classList.toggle('hidden', !(canActNow && cur.type === 'BAN'));

    if (!isDrafting) {
      charNameEl.textContent = '';
      btnLockIn.disabled = true;
      btnLockIn.classList.remove('is-ban-lock');
      btnLockIn.innerHTML = '<span>KHÓA</span>';
      return;
    }

    const hChar = roomState.hoveredCharId
      ? window.MIHOYO_DATA.getCharacterById(roomState.hoveredCharId)
      : null;

    charNameEl.textContent = hChar ? hChar.nameVi : '';
    btnLockIn.disabled = !(canActNow && hChar);
    btnLockIn.classList.toggle('is-ban-lock', cur.type === 'BAN');
    btnLockIn.innerHTML = `<span>${cur.type === 'BAN' ? 'CẤM' : 'KHÓA'}</span>`;
  }

  function renderCharacterGrid() {
    const grid = document.getElementById('characterGrid');
    if (!grid) return;

    const allChars = window.MIHOYO_DATA.getCharacters();
    const normQuery = window.MIHOYO_DATA.normalizeSearchText(searchQuery);

    const bannedMap = new Map();
    const pickedMap = new Map();

    ['A', 'B'].forEach((tKey) => {
      (roomState.teams[tKey].bans || []).forEach((b) => {
        if (b && b.charId && b.charId !== 'SKIPPED_BAN') {
          const normId = String(b.charId).startsWith('traveler') ? 'traveler' : b.charId;
          bannedMap.set(normId, tKey);
        }
      });
      (roomState.teams[tKey].picks || []).forEach((p) => {
        if (p && p.charId) {
          const normId = String(p.charId).startsWith('traveler') ? 'traveler' : p.charId;
          pickedMap.set(normId, tKey);
        }
      });
    });

    // Chữ ký nội dung lưới nhân vật (không bao gồm hoveredCharId để khi click chọn chỉ đổi class cực nhanh mà không dựng lại 100+ thẻ DOM)
    const gridSignature = [
      allChars.length,
      selectedElement,
      selectedWeaponType,
      selectedRarity,
      normQuery,
      Array.from(bannedMap.entries()).map(([k, v]) => `${k}:${v}`).join(','),
      Array.from(pickedMap.entries()).map(([k, v]) => `${k}:${v}`).join(',')
    ].join('|');

    if (gridSignature === lastCharacterGridSignature && grid.children.length > 0) {
      const targetHover = roomState.hoveredCharId;
      grid.querySelectorAll('.char-card.char-hovered').forEach((el) => {
        if (el.getAttribute('data-char-id') !== targetHover) {
          el.classList.remove('char-hovered');
        }
      });
      if (targetHover) {
        const activeCard = grid.querySelector(`.char-card[data-char-id="${targetHover}"]`);
        if (activeCard && !activeCard.classList.contains('char-hovered')) {
          activeCard.classList.add('char-hovered');
        }
      }
      return;
    }
    lastCharacterGridSignature = gridSignature;

    const filtered = allChars.filter((c) => {
      // Nhà Lữ Hành dùng tự do mọi nguyên tố nên luôn xuất hiện khi lọc theo bất kỳ nguyên tố nào
      if (selectedElement !== 'ALL' && c.element !== 'Multi' && c.element !== selectedElement) return false;
      if (selectedWeaponType !== 'ALL' && c.weaponType !== selectedWeaponType) return false;
      if (selectedRarity !== 'ALL' && String(c.rarity) !== String(selectedRarity)) return false;
      if (normQuery) {
        const haystack = window.MIHOYO_DATA.normalizeSearchText(`${c.name} ${c.nameVi} ${c.id}`);
        if (!haystack.includes(normQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 32px; color: var(--lol-grey);">
        Không tìm thấy tướng phù hợp.
      </div>`;
      return;
    }

    grid.innerHTML = filtered
      .map((c) => {
        const bannedBy = bannedMap.get(c.id);
        const pickedBy = pickedMap.get(c.id);
        const isTaken = Boolean(bannedBy || pickedBy);
        const isHovered = roomState.hoveredCharId === c.id;

        let overlayHtml = '';
        if (bannedBy) {
          overlayHtml = `<div class="char-status-overlay status-banned">ĐÃ CẤM</div>`;
        } else if (pickedBy) {
          overlayHtml = `<div class="char-status-overlay">ĐÃ CHỌN</div>`;
        }

        return `
          <div
            class="char-card ${isTaken ? 'char-disabled' : ''} ${isHovered ? 'char-hovered' : ''}"
            data-char-id="${c.id}"
            title="${c.nameVi}"
          >
            <div class="char-portrait">
              ${buildSmartImgTag(c.iconUrls, c.name, c.element, c.nameVi)}
              <span class="char-el-tag">${ELEMENT_SVGS[c.element] || ''}</span>
              ${overlayHtml}
            </div>
            <div class="char-card-name">${c.nameVi}</div>
          </div>
        `;
      })
      .join('');

    grid.querySelectorAll('.char-card:not(.char-disabled)').forEach((card) => {
      const charId = card.getAttribute('data-char-id');
      card.addEventListener('click', () => {
        if (roomState.status !== 'DRAFTING') return;
        sendAction('HOVER_CHAR', { charId });
      });

      card.addEventListener('dblclick', () => {
        if (roomState.status !== 'DRAFTING') return;
        const charObj = window.MIHOYO_DATA.getCharacterById(charId);
        sendAction('LOCK_CHAR', {
          charId,
          charLabel: charObj ? charObj.nameVi : charId
        });
      });
    });
  }

  function openCharMetaModal(teamKey, slotIndex) {
    if (clientRole !== 'SPEC' && clientTeam !== teamKey) return;
    const slot = roomState?.teams?.[teamKey]?.picks?.[slotIndex];
    if (!slot || !slot.charId) return;

    const charObj = window.MIHOYO_DATA.getCharacterById(slot.charId);
    editingMetaTarget = {
      team: teamKey,
      slotIndex,
      charId: slot.charId,
      weaponType: charObj ? charObj.weaponType : 'ALL'
    };

    modalConstellation = slot.constellation || 'C0';
    modalRefine = slot.weaponRefine || 'R1';
    modalWeaponId = slot.weaponId || null;
    modalWeaponName = slot.weaponName || '';
    modalWeaponIcon = slot.weaponIcon || '';

    const summaryEl = document.getElementById('metaCharSummary');
    if (charObj) {
      summaryEl.innerHTML = `
        ${buildSmartImgTag(charObj.iconUrls, charObj.name, charObj.element, charObj.nameVi)}
        <div>
          <div style="font-size:14px; color:var(--lol-gold-bright);">${charObj.nameVi}</div>
          <div style="font-size:11px; color:var(--lol-grey);">
            ${roomState.teams[teamKey].name} • Ô #${slotIndex + 1} (${slotIndex < 4 ? 'Nửa Trên' : 'Nửa Dưới'
        })
          </div>
        </div>
      `;
    }

    document.getElementById('weaponSearchInput').value = modalWeaponName;
    updateModalPillsUI();
    renderWeaponPickerList('');

    document.getElementById('charMetaModal').classList.remove('hidden');
  }

  function updateModalPillsUI() {
    document.querySelectorAll('#constellationPills .const-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-const') === modalConstellation);
    });
    document.querySelectorAll('#refinePills .refine-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-refine') === modalRefine);
    });
  }

  function renderWeaponPickerList(filterText) {
    const grid = document.getElementById('weaponPickerGrid');
    if (!grid || !editingMetaTarget) return;

    const weaponPool = window.MIHOYO_DATA.getWeapons(editingMetaTarget.weaponType);
    const norm = window.MIHOYO_DATA.normalizeSearchText(filterText);

    const filtered = weaponPool.filter((w) => {
      if (!norm) return true;
      const hay = window.MIHOYO_DATA.normalizeSearchText(`${w.nameVi} ${w.name}`);
      return hay.includes(norm);
    });

    grid.innerHTML = filtered
      .map((w) => {
        const isSel = modalWeaponId === w.id || modalWeaponName === w.nameVi;
        return `
          <div class="weapon-option-card ${isSel ? 'selected' : ''}" data-wep-id="${w.id}">
            ${buildSmartImgTag(w.iconUrls, w.nameVi, 'Geo', w.nameVi)}
            <div>
              <div class="weapon-option-name">${w.nameVi}</div>
              <div style="font-size:9.5px; color:var(--lol-gold);">${w.rarity} SAO</div>
            </div>
          </div>
        `;
      })
      .join('');

    grid.querySelectorAll('.weapon-option-card').forEach((card) => {
      card.addEventListener('click', () => {
        const wepId = card.getAttribute('data-wep-id');
        const wepObj = window.MIHOYO_DATA.getWeaponById(wepId);
        if (wepObj) {
          modalWeaponId = wepObj.id;
          modalWeaponName = wepObj.nameVi;
          modalWeaponIcon = wepObj.icon;
          document.getElementById('weaponSearchInput').value = wepObj.nameVi;
          renderWeaponPickerList('');
        }
      });
    });
  }

  function updateShareLinksInputs() {
    const fbInputVal = (document.getElementById('inputFirebaseUrl')?.value || firebaseDbUrl || '').trim().replace(/\/+$/, '');
    const fbQuery = fbInputVal ? `&fb=${encodeURIComponent(fbInputVal)}` : '';

    const typedNewPass = (document.getElementById('inputRoomPassword')?.value || '').trim();
    const embedChecked = document.getElementById('chkEmbedPassInLink')?.checked !== false;
    let activeToken = '';
    if (typedNewPass && window.DRAFT_ENGINE) {
      activeToken = window.DRAFT_ENGINE.hashRoomPassword(typedNewPass);
    } else if (!clearPasswordRequested && roomState?.hasPassword) {
      activeToken = getRoomAuthToken(currentRoomId) || roomState.passwordHash || '';
    }

    const toggleWrap = document.getElementById('sharePassToggleWrap');
    if (toggleWrap) {
      toggleWrap.classList.toggle('hidden', !activeToken);
    }

    const ptQuery = embedChecked && activeToken ? `&pt=${encodeURIComponent(activeToken)}` : '';
    const baseUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}${fbQuery}${ptQuery}`;
    document.getElementById('shareLinkSpec').value = `${baseUrl}&role=SPEC`;
    document.getElementById('shareLinkTeamA').value = `${baseUrl}&role=PLAYER&team=A`;
    document.getElementById('shareLinkTeamB').value = `${baseUrl}&role=PLAYER&team=B`;
  }

  function refreshSettingsPasswordBadge() {
    const statusBadge = document.getElementById('roomPassStatusBadge');
    const btnClearPass = document.getElementById('btnClearRoomPassword');
    const typedNewPass = (document.getElementById('inputRoomPassword')?.value || '').trim();
    const currentlyHasPass = Boolean(roomState?.hasPassword);

    if (typedNewPass) {
      if (statusBadge) {
        statusBadge.textContent = '🔒 SẼ ĐẶT PASS MỚI';
        statusBadge.classList.add('is-locked');
      }
      if (btnClearPass) btnClearPass.classList.toggle('hidden', !currentlyHasPass);
    } else if (clearPasswordRequested) {
      if (statusBadge) {
        statusBadge.textContent = 'SẼ GỠ PASS KHI LƯU';
        statusBadge.classList.remove('is-locked');
      }
      if (btnClearPass) btnClearPass.classList.add('hidden');
    } else if (currentlyHasPass) {
      if (statusBadge) {
        statusBadge.textContent = '🔒 ĐANG KHÓA PASS';
        statusBadge.classList.add('is-locked');
      }
      if (btnClearPass) btnClearPass.classList.remove('hidden');
    } else {
      if (statusBadge) {
        statusBadge.textContent = 'MỞ TỰ DO';
        statusBadge.classList.remove('is-locked');
      }
      if (btnClearPass) btnClearPass.classList.add('hidden');
    }
    updateShareLinksInputs();
  }

  function openSettingsModal() {
    if (clientRole !== 'SPEC') return;
    const titleCode = document.getElementById('settingsRoomCodeTitle');
    if (titleCode) titleCode.textContent = currentRoomId;

    clearPasswordRequested = false;
    const passInput = document.getElementById('inputRoomPassword');
    if (passInput) passInput.value = '';

    if (roomState) {
      document.getElementById('inputTeamAName').value = roomState.teams.A.name;
      document.getElementById('inputTeamBName').value = roomState.teams.B.name;
      document.getElementById('inputBanDuration').value = roomState.banDuration;
      document.getElementById('inputPickDuration').value = roomState.pickDuration;
      document.getElementById('inputLineupDuration').value = roomState.lineupDuration;
    }
    const fbInput = document.getElementById('inputFirebaseUrl');
    if (fbInput) fbInput.value = firebaseDbUrl;
    refreshSettingsPasswordBadge();
    document.getElementById('settingsModal').classList.remove('hidden');
  }

  function bindEvents() {
    // Điều khiển Nhạc nền (/sprites/musics/music-ban-pick.m4a)
    document.getElementById('btnToggleBgm').addEventListener('click', () => {
      isBgmPlaying = !isBgmPlaying;
      updateBgmPlayback();
    });

    document.getElementById('bgmVolumeSlider').addEventListener('input', (e) => {
      bgmVolume = Number(e.target.value) / 100;
      const audioEl = document.getElementById('genshinBgmAudio');
      if (audioEl) audioEl.volume = bgmVolume;
    });

    // Sảnh trận đấu & Chế độ Full Màn Hình Khán Giả
    document.getElementById('btnToggleMainMenu').addEventListener('click', () => {
      const overlay = document.getElementById('mainMenuOverlay');
      if (overlay.classList.contains('hidden')) openMainMenu();
      else closeMainMenu();
    });

    const btnTogglePoolView = document.getElementById('btnTogglePoolView');
    if (btnTogglePoolView) {
      btnTogglePoolView.addEventListener('click', () => {
        if (clientRole !== 'SPEC') return;
        setSpectatorFullscreen(!isSpectatorFullscreen);
      });
    }

    document.getElementById('btnCloseMainMenu').addEventListener('click', closeMainMenu);

    document.getElementById('btnGenerateRoomId').addEventListener('click', () => {
      document.getElementById('menuNewRoomId').value = generateRandomMatchId();
    });

    document.getElementById('btnCreateNewMatch').addEventListener('click', async () => {
      const newId = document.getElementById('menuNewRoomId').value || generateRandomMatchId();
      const teamAName = document.getElementById('menuNewTeamA').value || 'ĐỘI XANH';
      const teamBName = document.getElementById('menuNewTeamB').value || 'ĐỘI ĐỎ';
      const banDuration = Number(document.getElementById('menuNewBanSec').value) || 45;
      const pickDuration = Number(document.getElementById('menuNewPickSec').value) || 60;
      const lineupDuration = Number(document.getElementById('menuNewLineupSec').value) || 90;
      const newPassEl = document.getElementById('menuNewRoomPassword');
      const rawNewPass = (newPassEl?.value || '').trim();
      const passwordHash =
        rawNewPass && window.DRAFT_ENGINE ? window.DRAFT_ENGINE.hashRoomPassword(rawNewPass) : '';

      if (newPassEl) newPassEl.value = '';

      const entered = await switchMatchRoom(
        newId,
        {
          teamAName,
          teamBName,
          banDuration,
          pickDuration,
          lineupDuration,
          passwordHash
        },
        { isCreateRoom: true }
      );

      if (entered) {
        openSettingsModal();
      }
    });

    document.getElementById('btnJoinRoomById').addEventListener('click', () => {
      const joinId = document.getElementById('menuJoinRoomInput').value;
      if (!joinId || !joinId.trim()) return;
      switchMatchRoom(joinId);
    });
    document.getElementById('menuJoinRoomInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const joinId = document.getElementById('menuJoinRoomInput').value;
        if (joinId && joinId.trim()) switchMatchRoom(joinId);
      }
    });

    document.getElementById('btnRefreshRooms').addEventListener('click', loadActiveRoomsList);

    document.getElementById('btnRolePlayerA').addEventListener('click', () => {
      if (clientRole !== 'SPEC') return;
      if (confirm('Khóa màn hình này vào vai trò Tuyển thủ ĐỘI XANH (A)?')) {
        clientRole = 'PLAYER';
        clientTeam = 'A';
        swapSource = null;
        closeMainMenu();
        renderRoleUI();
      }
    });

    document.getElementById('btnRolePlayerB').addEventListener('click', () => {
      if (clientRole !== 'SPEC') return;
      if (confirm('Khóa màn hình này vào vai trò Tuyển thủ ĐỘI ĐỎ (B)?')) {
        clientRole = 'PLAYER';
        clientTeam = 'B';
        swapSource = null;
        closeMainMenu();
        renderRoleUI();
      }
    });

    document.getElementById('btnConfirmTeamLineup').addEventListener('click', () => {
      sendAction('CONFIRM_LINEUP', { team: clientTeam });
    });

    document.getElementById('btnStartMatch').addEventListener('click', () => {
      autoPlayAndUnmuteBgm();
      sendAction('START_MATCH');
    });

    document.getElementById('btnPauseMatch').addEventListener('click', () => {
      sendAction('TOGGLE_PAUSE');
    });

    document.getElementById('btnSwapTeamsBtc').addEventListener('click', () => {
      if (clientRole !== 'SPEC') return;
      sendAction('SWAP_TEAMS');
    });

    document.getElementById('btnUndoStep').addEventListener('click', () => {
      sendAction('UNDO_STEP');
    });

    document.getElementById('btnEnterLineup').addEventListener('click', () => {
      sendAction('ENTER_LINEUP_PHASE');
    });

    const btnEnterStreamPhase = document.getElementById('btnEnterStreamPhase');
    if (btnEnterStreamPhase) {
      btnEnterStreamPhase.addEventListener('click', () => {
        swapSource = null;
        autoPauseAndMuteBgm();
        sendAction('ENTER_STREAM_PHASE');
      });
    }

    // Điều khiển Sân Khấu Stream Đôi
    const btnToggleStreamSplit = document.getElementById('btnToggleStreamSplit');
    if (btnToggleStreamSplit) {
      btnToggleStreamSplit.addEventListener('click', () => {
        isVerticalStreamSplit = !isVerticalStreamSplit;
        const grid = document.getElementById('dualStreamGrid');
        if (grid) {
          grid.classList.toggle('split-vertical', isVerticalStreamSplit);
          grid.classList.toggle('split-horizontal', !isVerticalStreamSplit);
        }
      });
    }

    ['A', 'B'].forEach((tKey) => {
      const btnShare = document.getElementById(`btnShareScreen${tKey}`);
      const btnQuickShare = document.getElementById(`btnQuickShare${tKey}`);
      const btnStop = document.getElementById(`btnStopScreen${tKey}`);
      const btnSetEmbed = document.getElementById(`btnSetEmbed${tKey}`);
      const inputEmbed = document.getElementById(`inputEmbedUrl${tKey}`);
      const btnMute = document.getElementById(`btnMuteStream${tKey}`);
      const btnFs = document.getElementById(`btnFullscreenStream${tKey}`);

      if (btnShare) {
        btnShare.addEventListener('click', () => startDiscordScreenShare(tKey));
      }
      if (btnQuickShare) {
        btnQuickShare.addEventListener('click', () => startDiscordScreenShare(tKey));
      }
      if (btnStop) {
        btnStop.addEventListener('click', () => stopDiscordScreenShare(tKey));
      }

      const applyEmbedUrlForTeam = async () => {
        if (clientRole !== 'SPEC' && clientTeam !== tKey) {
          return;
        }
        const rawVal = inputEmbed ? inputEmbed.value.trim() : '';
        const cleanEmbed = normalizeStreamEmbedUrl(rawVal);
        await sendAction('UPDATE_STREAM_INFO', {
          team: tKey,
          embedUrl: cleanEmbed,
          active: Boolean(cleanEmbed)
        });
        renderDualStreamStage();
      };

      if (btnSetEmbed) {
        btnSetEmbed.addEventListener('click', applyEmbedUrlForTeam);
      }
      if (inputEmbed) {
        inputEmbed.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyEmbedUrlForTeam();
          }
        });
      }
      if (btnMute) {
        btnMute.addEventListener('click', () => {
          const videoEl = document.getElementById(`streamVideo${tKey}`);
          if (!videoEl) return;
          videoEl.muted = !videoEl.muted;
          btnMute.textContent = videoEl.muted ? '🔇' : '🔊';
        });
      }
      if (btnFs) {
        btnFs.addEventListener('click', () => {
          const viewport = document.getElementById(`streamViewport${tKey}`);
          if (!viewport) return;
          if (document.fullscreenElement) {
            document.exitFullscreen?.();
          } else {
            viewport.requestFullscreen?.();
          }
        });
      }
    });

    document.getElementById('btnResetMatch').addEventListener('click', () => {
      if (confirm('Reset toàn bộ trận đấu này về từ đầu?')) {
        swapSource = null;
        sendAction('RESET_MATCH');
      }
    });

    document.getElementById('btnEndMatchToolbar')?.addEventListener('click', endAndDeleteCurrentMatch);
    document.getElementById('btnEndMatchStream')?.addEventListener('click', endAndDeleteCurrentMatch);

    document.getElementById('btnOpenSettings').addEventListener('click', openSettingsModal);
    document.getElementById('inputFirebaseUrl')?.addEventListener('input', updateShareLinksInputs);
    document.getElementById('inputRoomPassword')?.addEventListener('input', refreshSettingsPasswordBadge);
    document.getElementById('chkEmbedPassInLink')?.addEventListener('change', updateShareLinksInputs);
    document.getElementById('btnClearRoomPassword')?.addEventListener('click', () => {
      clearPasswordRequested = true;
      const passInput = document.getElementById('inputRoomPassword');
      if (passInput) passInput.value = '';
      refreshSettingsPasswordBadge();
    });

    document.getElementById('btnConfirmUnlockRoom')?.addEventListener('click', submitUnlockRoomPassword);
    document.getElementById('inputUnlockPassword')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitUnlockRoomPassword();
      }
    });
    document.getElementById('btnCancelUnlockRoom')?.addEventListener('click', () => {
      closeRoomPasswordModal();
      if (clientRole === 'SPEC') {
        openMainMenu();
      }
    });

    document.getElementById('btnLockIn').addEventListener('click', () => {
      if (!roomState?.hoveredCharId) return;
      const charObj = window.MIHOYO_DATA.getCharacterById(roomState.hoveredCharId);
      sendAction('LOCK_CHAR', {
        charId: roomState.hoveredCharId,
        charLabel: charObj ? charObj.nameVi : roomState.hoveredCharId
      });
    });

    document.getElementById('btnSkipBan').addEventListener('click', () => {
      sendAction('SKIP_BAN');
    });

    const searchInput = document.getElementById('charSearchInput');
    const btnClearSearch = document.getElementById('btnClearSearch');

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      btnClearSearch.classList.toggle('hidden', !searchQuery);
      renderCharacterGrid();
    });

    btnClearSearch.addEventListener('click', () => {
      searchQuery = '';
      searchInput.value = '';
      btnClearSearch.classList.add('hidden');
      renderCharacterGrid();
    });

    document.querySelectorAll('#elementFilters .role-icon-btn').forEach((chip) => {
      chip.addEventListener('click', () => {
        selectedElement = chip.getAttribute('data-element') || 'ALL';
        document.querySelectorAll('#elementFilters .role-icon-btn').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        renderCharacterGrid();
      });
    });

    document.getElementById('weaponTypeSelect').addEventListener('change', (e) => {
      selectedWeaponType = e.target.value;
      renderCharacterGrid();
    });

    document.getElementById('raritySelect').addEventListener('change', (e) => {
      selectedRarity = e.target.value;
      renderCharacterGrid();
    });

    document.querySelectorAll('#constellationPills .const-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        modalConstellation = btn.getAttribute('data-const');
        updateModalPillsUI();
      });
    });

    document.querySelectorAll('#refinePills .refine-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        modalRefine = btn.getAttribute('data-refine');
        updateModalPillsUI();
      });
    });

    document.getElementById('weaponSearchInput').addEventListener('input', (e) => {
      modalWeaponName = e.target.value;
      modalWeaponId = null;
      modalWeaponIcon = '';
      renderWeaponPickerList(e.target.value);
    });

    document.getElementById('btnClearWeaponMeta').addEventListener('click', () => {
      modalWeaponId = null;
      modalWeaponName = '';
      modalWeaponIcon = '';
      document.getElementById('weaponSearchInput').value = '';
      renderWeaponPickerList('');
    });

    const closeMetaModal = () => {
      document.getElementById('charMetaModal').classList.add('hidden');
      editingMetaTarget = null;
    };
    document.getElementById('btnCloseMetaModal').addEventListener('click', closeMetaModal);
    document.getElementById('btnCancelMetaModal').addEventListener('click', closeMetaModal);

    document.getElementById('btnSaveCharMeta').addEventListener('click', () => {
      if (!editingMetaTarget) return;
      sendAction('UPDATE_CHAR_META', {
        targetTeam: editingMetaTarget.team,
        slotIndex: editingMetaTarget.slotIndex,
        constellation: modalConstellation,
        weaponId: modalWeaponId,
        weaponName: modalWeaponName.trim(),
        weaponIcon: modalWeaponIcon,
        weaponRefine: modalRefine
      });
      closeMetaModal();
    });

    const closeSettings = () => document.getElementById('settingsModal').classList.add('hidden');
    document.getElementById('btnCloseSettingsModal').addEventListener('click', closeSettings);
    document.getElementById('btnCancelSettings').addEventListener('click', closeSettings);

    document.getElementById('btnSaveSettings').addEventListener('click', async () => {
      if (clientRole !== 'SPEC') {
        closeSettings();
        return;
      }

      const newFbUrl = (document.getElementById('inputFirebaseUrl')?.value || '').trim().replace(/\/+$/, '');
      if (newFbUrl !== firebaseDbUrl) {
        firebaseDbUrl = newFbUrl;
        if (firebaseDbUrl) localStorage.setItem('hoyo_fb_url', firebaseDbUrl);
        else localStorage.removeItem('hoyo_fb_url');
        connectRealtime();
      }

      const settingsPayload = {
        teamAName: document.getElementById('inputTeamAName').value,
        teamBName: document.getElementById('inputTeamBName').value,
        banDuration: Number(document.getElementById('inputBanDuration').value),
        pickDuration: Number(document.getElementById('inputPickDuration').value),
        lineupDuration: Number(document.getElementById('inputLineupDuration').value)
      };

      const typedNewPass = (document.getElementById('inputRoomPassword')?.value || '').trim();
      const prevAuthToken = getRoomAuthToken(currentRoomId);
      if (typedNewPass && window.DRAFT_ENGINE) {
        settingsPayload.passwordHash = window.DRAFT_ENGINE.hashRoomPassword(typedNewPass);
      } else if (clearPasswordRequested) {
        settingsPayload.passwordHash = '';
      }

      await sendAction('UPDATE_SETTINGS', settingsPayload, {
        overrideAuthToken: prevAuthToken
      });
      if (settingsPayload.passwordHash !== undefined) {
        saveRoomAuthToken(currentRoomId, settingsPayload.passwordHash);
        connectRealtime();
      }
      closeSettings();
    });

    document.querySelectorAll('[data-copy-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const inputId = btn.getAttribute('data-copy-target');
        const inputEl = document.getElementById(inputId);
        if (inputEl) {
          inputEl.select();
          navigator.clipboard?.writeText(inputEl.value);
          showToast('Đã sao chép đường dẫn.');
        }
      });
    });

    // Phát hiệu ứng click-button-sound cho mọi nút bấm tương tác trên giao diện
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button:not(:disabled), .role-icon-btn, .const-pill, .refine-pill, .weapon-option-card');
      if (btn && btn.id !== 'btnLockIn') {
        playLolSfx('click-button-sound');
      }
    });
  }

  function updateLoadingProgress(pct) {
    const fill = document.getElementById('lolLoadingBarFill');
    const label = document.getElementById('lolLoadingPct');
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    if (fill) fill.style.width = `${clamped}%`;
    if (label) label.textContent = `${clamped}%`;
  }

  function finishLoadingOverlay() {
    updateLoadingProgress(100);
    const overlay = document.getElementById('lolLoadingOverlay');
    if (overlay) {
      setTimeout(() => {
        overlay.classList.add('is-loaded');
      }, 220);
    }
  }

  async function init() {
    updateLoadingProgress(18);
    initHextechParticles();
    initPeerEngine();
    updateLoadingProgress(42);
    bindEvents();
    renderRoleUI();
    connectRealtime();
    updateLoadingProgress(68);

    if (!hasExplicitRoomParam && clientRole === 'SPEC') {
      openMainMenu();
    }

    if (!firebaseDbUrl) {
      try {
        const tokenParam = getRoomAuthToken(currentRoomId)
          ? `&pt=${encodeURIComponent(getRoomAuthToken(currentRoomId))}`
          : '';
        const res = await fetch(`/api/state?room=${encodeURIComponent(currentRoomId)}${tokenParam}`);
        const json = await res.json();
        if (json.deleted) {
          if (hasExplicitRoomParam) {
            handleRoomDeletedEvent(currentRoomId, false);
          } else {
            stopRealtimeConnections();
          }
        } else if (json.locked) {
          if (hasExplicitRoomParam || clientRole === 'PLAYER') {
            openRoomPasswordModal({
              roomId: json.roomId || currentRoomId,
              teamAName: json.teamAName,
              teamBName: json.teamBName
            });
          } else {
            stopRealtimeConnections();
          }
        } else if (json.ok && json.state) {
          applyRoomState(json.state);
        }
      } catch (e) {
        if (window.DRAFT_ENGINE && rawRoomMemory) {
          applyRoomState(window.DRAFT_ENGINE.getSerializedState(rawRoomMemory));
        }
      }
    }

    updateLoadingProgress(88);
    await window.MIHOYO_DATA.syncFromLiveAPIs();
    if (roomState) {
      renderAll();
    }
    finishLoadingOverlay();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
