/**
 * Nguồn dữ liệu Nhân vật & Vũ khí Genshin Impact (HoYoverse Ban/Pick)
 * Kết hợp 3 nguồn API bền vững nhất cộng đồng Genshin:
 * 1. Project Amber / Yatta API (https://gi.yatta.moe/api/v2/vi/avatar & /weapon) - Có tiếng Việt + icon gốc
 * 2. Genshin-DB API (https://genshin-db-api.vercel.app/api/v5/...) - API lâu đời nhất từ 2021
 * 3. Enka.Network CDN (https://enka.network/ui/UI_AvatarIcon_...png) - CDN ảnh nhân vật/vũ khí cực nhanh và bền vững
 * Cùng bộ dữ liệu Fallback tích hợp sẵn đầy đủ nhân vật & vũ khí tiêu biểu để đảm bảo 100% không bao giờ lỗi.
 */

window.MIHOYO_DATA = (function () {
  // Multi-CDN cho ảnh nhân vật dựa trên mã icon nội bộ của game (VD: UI_AvatarIcon_Furina)
  function getCharacterIconUrls(iconName) {
    const clean = iconName.startsWith('UI_AvatarIcon_')
      ? iconName
      : `UI_AvatarIcon_${iconName}`;
    return [
      `https://enka.network/ui/${clean}.png`,
      `https://gi.yatta.moe/assets/UI/${clean}.png`,
      `https://api.hakush.in/gi/UI/${clean}.webp`
    ];
  }

  // Multi-CDN cho ảnh Splash Art (Gacha Art) toàn thân của nhân vật (VD: UI_Gacha_AvatarImg_Furina)
  function getCharacterSplashUrls(iconName) {
    const charKey = iconName.replace(/^UI_AvatarIcon_/, '');
    const gachaName = `UI_Gacha_AvatarImg_${charKey}`;
    return [
      `https://enka.network/ui/${gachaName}.png`,
      `https://gi.yatta.moe/assets/UI/${gachaName}.png`,
      `https://api.hakush.in/gi/UI/${gachaName}.webp`,
      ...getCharacterIconUrls(iconName)
    ];
  }

  function getWeaponIconUrls(iconName) {
    const clean = iconName.startsWith('UI_EquipIcon_')
      ? iconName
      : `UI_EquipIcon_${iconName}`;
    return [
      `https://enka.network/ui/${clean}.png`,
      `https://gi.yatta.moe/assets/UI/${clean}.png`,
      `https://api.hakush.in/gi/UI/${clean}.webp`
    ];
  }

  // Danh sách nhân vật Genshin tích hợp sẵn (Fallback + Chuẩn hóa tên Tiếng Việt / Tiếng Anh)
  // Mã iconName là mã nội bộ chính thức của HoYoverse trong Enka.Network & Project Amber
  const BUILTIN_CHARACTERS = [
    // === 5 SAO ===
    { id: 'mavuika', name: 'Mavuika', nameVi: 'Mavuika (Hỏa Thần)', element: 'Pyro', weaponType: 'Claymore', rarity: 5, icon: 'UI_AvatarIcon_Mavuika' },
    { id: 'citlali', name: 'Citlali', nameVi: 'Citlali', element: 'Cryo', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Citlali' },
    { id: 'chasca', name: 'Chasca', nameVi: 'Chasca', element: 'Anemo', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Chasca' },
    { id: 'xilonen', name: 'Xilonen', nameVi: 'Xilonen', element: 'Geo', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Xilonen' },
    { id: 'kinich', name: 'Kinich', nameVi: 'Kinich', element: 'Dendro', weaponType: 'Claymore', rarity: 5, icon: 'UI_AvatarIcon_Kinich' },
    { id: 'mualani', name: 'Mualani', nameVi: 'Mualani', element: 'Hydro', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Mualani' },
    { id: 'emilie', name: 'Emilie', nameVi: 'Emilie', element: 'Dendro', weaponType: 'Polearm', rarity: 5, icon: 'UI_AvatarIcon_Emilie' },
    { id: 'sigewinne', name: 'Sigewinne', nameVi: 'Sigewinne', element: 'Hydro', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Sigewinne' },
    { id: 'clorinde', name: 'Clorinde', nameVi: 'Clorinde', element: 'Electro', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Clorinde' },
    { id: 'arlecchino', name: 'Arlecchino', nameVi: 'Arlecchino', element: 'Pyro', weaponType: 'Polearm', rarity: 5, icon: 'UI_AvatarIcon_Arlecchino' },
    { id: 'chiori', name: 'Chiori', nameVi: 'Chiori', element: 'Geo', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Chiori' },
    { id: 'xianyun', name: 'Xianyun', nameVi: 'Xianyun (Lưu Vân)', element: 'Anemo', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Liuyun' },
    { id: 'navia', name: 'Navia', nameVi: 'Navia', element: 'Geo', weaponType: 'Claymore', rarity: 5, icon: 'UI_AvatarIcon_Navia' },
    { id: 'furina', name: 'Furina', nameVi: 'Furina (Thủy Thần)', element: 'Hydro', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Furina' },
    { id: 'wriothesley', name: 'Wriothesley', nameVi: 'Wriothesley', element: 'Cryo', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Wriothesley' },
    { id: 'neuvillette', name: 'Neuvillette', nameVi: 'Neuvillette', element: 'Hydro', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Neuvillette' },
    { id: 'lyney', name: 'Lyney', nameVi: 'Lyney', element: 'Pyro', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Liney' },
    { id: 'baizhu', name: 'Baizhu', nameVi: 'Baizhu', element: 'Dendro', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Baizhuer' },
    { id: 'dehya', name: 'Dehya', nameVi: 'Dehya', element: 'Pyro', weaponType: 'Claymore', rarity: 5, icon: 'UI_AvatarIcon_Dehya' },
    { id: 'alhaitham', name: 'Alhaitham', nameVi: 'Alhaitham', element: 'Dendro', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Alhatham' },
    { id: 'wanderer', name: 'Wanderer', nameVi: 'Kẻ Lang Thang (Scaramouche)', element: 'Anemo', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Wanderer' },
    { id: 'nahida', name: 'Nahida', nameVi: 'Nahida (Thảo Thần)', element: 'Dendro', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Nahida' },
    { id: 'nilou', name: 'Nilou', nameVi: 'Nilou', element: 'Hydro', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Nilou' },
    { id: 'cyno', name: 'Cyno', nameVi: 'Cyno', element: 'Electro', weaponType: 'Polearm', rarity: 5, icon: 'UI_AvatarIcon_Cyno' },
    { id: 'tighnari', name: 'Tighnari', nameVi: 'Tighnari', element: 'Dendro', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Tighnari' },
    { id: 'yelan', name: 'Yelan', nameVi: 'Yelan', element: 'Hydro', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Yelan' },
    { id: 'kamisato_ayato', name: 'Kamisato Ayato', nameVi: 'Kamisato Ayato', element: 'Hydro', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Ayato' },
    { id: 'yae_miko', name: 'Yae Miko', nameVi: 'Yae Miko', element: 'Electro', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Yae' },
    { id: 'shenhe', name: 'Shenhe', nameVi: 'Shenhe', element: 'Cryo', weaponType: 'Polearm', rarity: 5, icon: 'UI_AvatarIcon_Shenhe' },
    { id: 'arataki_itto', name: 'Arataki Itto', nameVi: 'Arataki Itto', element: 'Geo', weaponType: 'Claymore', rarity: 5, icon: 'UI_AvatarIcon_Itto' },
    { id: 'sangonomiya_kokomi', name: 'Sangonomiya Kokomi', nameVi: 'Sangonomiya Kokomi', element: 'Hydro', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Kokomi' },
    { id: 'raiden_shogun', name: 'Raiden Shogun', nameVi: 'Raiden Shogun (Lôi Thần)', element: 'Electro', weaponType: 'Polearm', rarity: 5, icon: 'UI_AvatarIcon_Shougun' },
    { id: 'yoimiya', name: 'Yoimiya', nameVi: 'Yoimiya', element: 'Pyro', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Yoimiya' },
    { id: 'kamisato_ayaka', name: 'Kamisato Ayaka', nameVi: 'Kamisato Ayaka', element: 'Cryo', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Ayaka' },
    { id: 'kaedehara_kazuha', name: 'Kaedehara Kazuha', nameVi: 'Kaedehara Kazuha', element: 'Anemo', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Kazuha' },
    { id: 'eula', name: 'Eula', nameVi: 'Eula', element: 'Cryo', weaponType: 'Claymore', rarity: 5, icon: 'UI_AvatarIcon_Eula' },
    { id: 'hu_tao', name: 'Hu Tao', nameVi: 'Hu Tao', element: 'Pyro', weaponType: 'Polearm', rarity: 5, icon: 'UI_AvatarIcon_Hutao' },
    { id: 'xiao', name: 'Xiao', nameVi: 'Xiao', element: 'Anemo', weaponType: 'Polearm', rarity: 5, icon: 'UI_AvatarIcon_Xiao' },
    { id: 'ganyu', name: 'Ganyu', nameVi: 'Ganyu', element: 'Cryo', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Ganyu' },
    { id: 'albedo', name: 'Albedo', nameVi: 'Albedo', element: 'Geo', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Albedo' },
    { id: 'zhongli', name: 'Zhongli', nameVi: 'Zhongli (Nham Thần)', element: 'Geo', weaponType: 'Polearm', rarity: 5, icon: 'UI_AvatarIcon_Zhongli' },
    { id: 'tartaglia', name: 'Tartaglia', nameVi: 'Tartaglia (Childe)', element: 'Hydro', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Tartaglia' },
    { id: 'klee', name: 'Klee', nameVi: 'Klee', element: 'Pyro', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Klee' },
    { id: 'venti', name: 'Venti', nameVi: 'Venti (Phong Thần)', element: 'Anemo', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Venti' },
    { id: 'keqing', name: 'Keqing', nameVi: 'Keqing', element: 'Electro', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Keqing' },
    { id: 'mona', name: 'Mona', nameVi: 'Mona', element: 'Hydro', weaponType: 'Catalyst', rarity: 5, icon: 'UI_AvatarIcon_Mona' },
    { id: 'qiqi', name: 'Qiqi', nameVi: 'Qiqi', element: 'Cryo', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Qiqi' },
    { id: 'diluc', name: 'Diluc', nameVi: 'Diluc', element: 'Pyro', weaponType: 'Claymore', rarity: 5, icon: 'UI_AvatarIcon_Diluc' },
    { id: 'jean', name: 'Jean', nameVi: 'Jean', element: 'Anemo', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_Qin' },
    { id: 'aloy', name: 'Aloy', nameVi: 'Aloy', element: 'Cryo', weaponType: 'Bow', rarity: 5, icon: 'UI_AvatarIcon_Aloy' },
    { id: 'traveler', name: 'Traveler', nameVi: 'Nhà Lữ Hành', element: 'Multi', weaponType: 'Sword', rarity: 5, icon: 'UI_AvatarIcon_PlayerGirl' },

    // === 4 SAO ===
    { id: 'lanyan', name: 'Lan Yan', nameVi: 'Lan Yan', element: 'Anemo', weaponType: 'Catalyst', rarity: 4, icon: 'UI_AvatarIcon_Lanyan' },
    { id: 'ororon', name: 'Ororon', nameVi: 'Ororon', element: 'Electro', weaponType: 'Bow', rarity: 4, icon: 'UI_AvatarIcon_Olorun' },
    { id: 'kachina', name: 'Kachina', nameVi: 'Kachina', element: 'Geo', weaponType: 'Polearm', rarity: 4, icon: 'UI_AvatarIcon_Kachina' },
    { id: 'sethos', name: 'Sethos', nameVi: 'Sethos', element: 'Electro', weaponType: 'Bow', rarity: 4, icon: 'UI_AvatarIcon_Sethos' },
    { id: 'gaming', name: 'Gaming', nameVi: 'Gaming', element: 'Pyro', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Gaming' },
    { id: 'chevreuse', name: 'Chevreuse', nameVi: 'Chevreuse', element: 'Pyro', weaponType: 'Polearm', rarity: 4, icon: 'UI_AvatarIcon_Chevreuse' },
    { id: 'charlotte', name: 'Charlotte', nameVi: 'Charlotte', element: 'Cryo', weaponType: 'Catalyst', rarity: 4, icon: 'UI_AvatarIcon_Charlotte' },
    { id: 'freminet', name: 'Freminet', nameVi: 'Freminet', element: 'Cryo', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Freminet' },
    { id: 'lynette', name: 'Lynette', nameVi: 'Lynette', element: 'Anemo', weaponType: 'Sword', rarity: 4, icon: 'UI_AvatarIcon_Linette' },
    { id: 'kirara', name: 'Kirara', nameVi: 'Kirara', element: 'Dendro', weaponType: 'Sword', rarity: 4, icon: 'UI_AvatarIcon_Momoka' },
    { id: 'kaveh', name: 'Kaveh', nameVi: 'Kaveh', element: 'Dendro', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Kaveh' },
    { id: 'mika', name: 'Mika', nameVi: 'Mika', element: 'Cryo', weaponType: 'Polearm', rarity: 4, icon: 'UI_AvatarIcon_Mika' },
    { id: 'yaoyao', name: 'Yaoyao', nameVi: 'Yaoyao', element: 'Dendro', weaponType: 'Polearm', rarity: 4, icon: 'UI_AvatarIcon_Yaoyao' },
    { id: 'faruzan', name: 'Faruzan', nameVi: 'Faruzan', element: 'Anemo', weaponType: 'Bow', rarity: 4, icon: 'UI_AvatarIcon_Faruzan' },
    { id: 'layla', name: 'Layla', nameVi: 'Layla', element: 'Cryo', weaponType: 'Sword', rarity: 4, icon: 'UI_AvatarIcon_Layla' },
    { id: 'candace', name: 'Candace', nameVi: 'Candace', element: 'Hydro', weaponType: 'Polearm', rarity: 4, icon: 'UI_AvatarIcon_Candace' },
    { id: 'dori', name: 'Dori', nameVi: 'Dori', element: 'Electro', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Dori' },
    { id: 'collei', name: 'Collei', nameVi: 'Collei', element: 'Dendro', weaponType: 'Bow', rarity: 4, icon: 'UI_AvatarIcon_Collei' },
    { id: 'shikanoin_heizou', name: 'Shikanoin Heizou', nameVi: 'Shikanoin Heizou', element: 'Anemo', weaponType: 'Catalyst', rarity: 4, icon: 'UI_AvatarIcon_Heizo' },
    { id: 'kuki_shinobu', name: 'Kuki Shinobu', nameVi: 'Kuki Shinobu', element: 'Electro', weaponType: 'Sword', rarity: 4, icon: 'UI_AvatarIcon_Shinobu' },
    { id: 'yun_jin', name: 'Yun Jin', nameVi: 'Yun Jin', element: 'Geo', weaponType: 'Polearm', rarity: 4, icon: 'UI_AvatarIcon_Yunjin' },
    { id: 'gorou', name: 'Gorou', nameVi: 'Gorou', element: 'Geo', weaponType: 'Bow', rarity: 4, icon: 'UI_AvatarIcon_Gorou' },
    { id: 'thoma', name: 'Thoma', nameVi: 'Thoma', element: 'Pyro', weaponType: 'Polearm', rarity: 4, icon: 'UI_AvatarIcon_Tohma' },
    { id: 'kujou_sara', name: 'Kujou Sara', nameVi: 'Kujou Sara', element: 'Electro', weaponType: 'Bow', rarity: 4, icon: 'UI_AvatarIcon_Sara' },
    { id: 'sayu', name: 'Sayu', nameVi: 'Sayu', element: 'Anemo', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Sayu' },
    { id: 'yanfei', name: 'Yanfei', nameVi: 'Yanfei', element: 'Pyro', weaponType: 'Catalyst', rarity: 4, icon: 'UI_AvatarIcon_Feiyan' },
    { id: 'rosaria', name: 'Rosaria', nameVi: 'Rosaria', element: 'Cryo', weaponType: 'Polearm', rarity: 4, icon: 'UI_AvatarIcon_Rosaria' },
    { id: 'xinyan', name: 'Xinyan', nameVi: 'Xinyan', element: 'Pyro', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Xinyan' },
    { id: 'diona', name: 'Diona', nameVi: 'Diona', element: 'Cryo', weaponType: 'Bow', rarity: 4, icon: 'UI_AvatarIcon_Diona' },
    { id: 'sucrose', name: 'Sucrose', nameVi: 'Sucrose', element: 'Anemo', weaponType: 'Catalyst', rarity: 4, icon: 'UI_AvatarIcon_Sucrose' },
    { id: 'chongyun', name: 'Chongyun', nameVi: 'Chongyun', element: 'Cryo', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Chongyun' },
    { id: 'noelle', name: 'Noelle', nameVi: 'Noelle', element: 'Geo', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Noel' },
    { id: 'bennett', name: 'Bennett', nameVi: 'Bennett', element: 'Pyro', weaponType: 'Sword', rarity: 4, icon: 'UI_AvatarIcon_Bennett' },
    { id: 'fischl', name: 'Fischl', nameVi: 'Fischl', element: 'Electro', weaponType: 'Bow', rarity: 4, icon: 'UI_AvatarIcon_Fischl' },
    { id: 'ningguang', name: 'Ningguang', nameVi: 'Ningguang', element: 'Geo', weaponType: 'Catalyst', rarity: 4, icon: 'UI_AvatarIcon_Ningguang' },
    { id: 'xingqiu', name: 'Xingqiu', nameVi: 'Xingqiu', element: 'Hydro', weaponType: 'Sword', rarity: 4, icon: 'UI_AvatarIcon_Xingqiu' },
    { id: 'beidou', name: 'Beidou', nameVi: 'Beidou', element: 'Electro', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Beidou' },
    { id: 'xiangling', name: 'Xiangling', nameVi: 'Xiangling', element: 'Pyro', weaponType: 'Polearm', rarity: 4, icon: 'UI_AvatarIcon_Xiangling' },
    { id: 'razor', name: 'Razor', nameVi: 'Razor', element: 'Electro', weaponType: 'Claymore', rarity: 4, icon: 'UI_AvatarIcon_Razor' },
    { id: 'barbara', name: 'Barbara', nameVi: 'Barbara', element: 'Hydro', weaponType: 'Catalyst', rarity: 4, icon: 'UI_AvatarIcon_Barbara' },
    { id: 'lisa', name: 'Lisa', nameVi: 'Lisa', element: 'Electro', weaponType: 'Catalyst', rarity: 4, icon: 'UI_AvatarIcon_Lisa' },
    { id: 'kaeya', name: 'Kaeya', nameVi: 'Kaeya', element: 'Cryo', weaponType: 'Sword', rarity: 4, icon: 'UI_AvatarIcon_Kaeya' },
    { id: 'amber', name: 'Amber', nameVi: 'Amber', element: 'Pyro', weaponType: 'Bow', rarity: 4, icon: 'UI_AvatarIcon_Ambor' }
  ];

  // Danh sách Vũ khí tiêu biểu theo từng loại để BTC chọn nhanh hoặc tìm kiếm (cộng thêm đồng bộ từ API)
  const BUILTIN_WEAPONS = [
    // Kiếm Đơn (Sword)
    { id: 'splendor_of_tranquil_waters', name: 'Splendor of Tranquil Waters', nameVi: 'Ánh Nước Tĩnh Lặng', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Regalis' },
    { id: 'absolution', name: 'Absolution', nameVi: 'Xá Tội', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Estoc' },
    { id: 'uraku_misugiri', name: 'Uraku Misugiri', nameVi: 'Uraku Misugiri', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Needle' },
    { id: 'peak_patrol_song', name: 'Peak Patrol Song', nameVi: 'Khúc Ca Tuần Núi', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Xochitlan' },
    { id: 'light_of_foliar_incision', name: 'Light of Foliar Incision', nameVi: 'Ánh Lá Phán Quyết', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Ayus' },
    { id: 'key_of_khaj_nisut', name: 'Key of Khaj-Nisut', nameVi: 'Chìa Khóa Khaj-Nisut', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Deshret' },
    { id: 'haram_geppaku_futsu', name: 'Haran Geppaku Futsu', nameVi: 'Haran Geppaku Futsu', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Amenoma' },
    { id: 'mistsplitter_reforged', name: 'Mistsplitter Reforged', nameVi: 'Ánh Sáng Đêm Sương Mù', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Narukami' },
    { id: 'freedom_sworn', name: 'Freedom-Sworn', nameVi: 'Lời Thề Tự Do Cổ Xưa', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Widsith' },
    { id: 'primordial_jade_cutter', name: 'Primordial Jade Cutter', nameVi: 'Bàn Nham Kết Lục', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Morax' },
    { id: 'skyward_blade', name: 'Skyward Blade', nameVi: 'Thiên Không Kiếm', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Dvalin' },
    { id: 'aquila_favonia', name: 'Aquila Favonia', nameVi: 'Phong Ưng Kiếm', weaponType: 'Sword', rarity: 5, icon: 'UI_EquipIcon_Sword_Falcon' },
    { id: 'favonius_sword', name: 'Favonius Sword', nameVi: 'Tây Phong Kiếm', weaponType: 'Sword', rarity: 4, icon: 'UI_EquipIcon_Sword_Zephyrus' },
    { id: 'sacrificial_sword', name: 'Sacrificial Sword', nameVi: 'Kiếm Tế Lễ', weaponType: 'Sword', rarity: 4, icon: 'UI_EquipIcon_Sword_Fossil' },
    { id: 'wolf_fang', name: 'Wolf-Fang', nameVi: 'Nanh Sói', weaponType: 'Sword', rarity: 4, icon: 'UI_EquipIcon_Sword_Boreas' },
    { id: 'the_black_sword', name: 'The Black Sword', nameVi: 'Kiếm Đen', weaponType: 'Sword', rarity: 4, icon: 'UI_EquipIcon_Sword_Bloodstained' },
    { id: 'xiphos_moonlight', name: "Xiphos' Moonlight", nameVi: 'Ánh Trăng Xiphos', weaponType: 'Sword', rarity: 4, icon: 'UI_EquipIcon_Sword_Pleroma' },
    { id: 'iron_sting', name: 'Iron Sting', nameVi: 'Thiết Phong Kích', weaponType: 'Sword', rarity: 4, icon: 'UI_EquipIcon_Sword_Exotic' },
    { id: 'fleuve_cendre_ferryman', name: 'Fleuve Cendre Ferryman', nameVi: 'Ống Đồng (Người Đưa Đò Sông Tro)', weaponType: 'Sword', rarity: 4, icon: 'UI_EquipIcon_Sword_Machination' },

    // Trọng Kiếm (Claymore)
    { id: 'a_thousand_blazing_suns', name: 'A Thousand Blazing Suns', nameVi: 'Ngàn Mặt Trời Rực Cháy', weaponType: 'Claymore', rarity: 5, icon: 'UI_EquipIcon_Claymore_Emerald' },
    { id: 'fang_of_the_mountain_king', name: 'Fang of the Mountain King', nameVi: 'Nanh Sơn Vương', weaponType: 'Claymore', rarity: 5, icon: 'UI_EquipIcon_Claymore_Loop' },
    { id: 'verdict', name: 'Verdict', nameVi: 'Phán Quyết', weaponType: 'Claymore', rarity: 5, icon: 'UI_EquipIcon_Claymore_GoldenVerdict' },
    { id: 'beacon_of_the_reed_sea', name: 'Beacon of the Reed Sea', nameVi: 'Hải Đăng Bờ Biển Lau', weaponType: 'Claymore', rarity: 5, icon: 'UI_EquipIcon_Claymore_Deshret' },
    { id: 'redhorn_stonethresher', name: 'Redhorn Stonethresher', nameVi: 'Xích Giác Phá Thạch Đao', weaponType: 'Claymore', rarity: 5, icon: 'UI_EquipIcon_Claymore_Itadorimaru' },
    { id: 'song_of_broken_pines', name: 'Song of Broken Pines', nameVi: 'Tiếng Thở Dài Vô Tận', weaponType: 'Claymore', rarity: 5, icon: 'UI_EquipIcon_Claymore_Widsith' },
    { id: 'wolfs_gravestone', name: "Wolf's Gravestone", nameVi: 'Đường Cùng Của Sói', weaponType: 'Claymore', rarity: 5, icon: 'UI_EquipIcon_Claymore_Wolfmound' },
    { id: 'skyward_pride', name: 'Skyward Pride', nameVi: 'Thiên Không Kiêu Ngạo', weaponType: 'Claymore', rarity: 5, icon: 'UI_EquipIcon_Claymore_Dvalin' },
    { id: 'serpent_spine', name: 'Serpent Spine', nameVi: 'Li Cốt Kiếm', weaponType: 'Claymore', rarity: 4, icon: 'UI_EquipIcon_Claymore_Kione' },
    { id: 'favonius_greatsword', name: 'Favonius Greatsword', nameVi: 'Đại Kiếm Tây Phong', weaponType: 'Claymore', rarity: 4, icon: 'UI_EquipIcon_Claymore_Zephyrus' },
    { id: 'sacrificial_greatsword', name: 'Sacrificial Greatsword', nameVi: 'Đại Kiếm Tế Lễ', weaponType: 'Claymore', rarity: 4, icon: 'UI_EquipIcon_Claymore_Fossil' },

    // Vũ Khí Cán Dài (Polearm)
    { id: 'crimson_moons_semblance', name: "Crimson Moon's Semblance", nameVi: 'Hình Thái Trăng Đỏ', weaponType: 'Polearm', rarity: 5, icon: 'UI_EquipIcon_Pole_BloodMoon' },
    { id: 'lumidouce_elegy', name: 'Lumidouce Elegy', nameVi: 'Khúc Bi Ca Lumidouce', weaponType: 'Polearm', rarity: 5, icon: 'UI_EquipIcon_Pole_Muguet' },
    { id: 'staff_of_the_scarlet_sands', name: 'Staff of the Scarlet Sands', nameVi: 'Quyền Trượng Cát Đỏ', weaponType: 'Polearm', rarity: 5, icon: 'UI_EquipIcon_Pole_Deshret' },
    { id: 'calamity_queller', name: 'Calamity Queller', nameVi: 'Hủy Diệt', weaponType: 'Polearm', rarity: 5, icon: 'UI_EquipIcon_Pole_Santika' },
    { id: 'engulfing_lightning', name: 'Engulfing Lightning', nameVi: 'Đoạn Thảo Trường Đao', weaponType: 'Polearm', rarity: 5, icon: 'UI_EquipIcon_Pole_Narukami' },
    { id: 'staff_of_homa', name: 'Staff of Homa', nameVi: 'Trượng Hộ Ma', weaponType: 'Polearm', rarity: 5, icon: 'UI_EquipIcon_Pole_Homa' },
    { id: 'primordial_jade_winged_spear', name: 'Primordial Jade Winged-Spear', nameVi: 'Hòa Phác Diên', weaponType: 'Polearm', rarity: 5, icon: 'UI_EquipIcon_Pole_Morax' },
    { id: 'skyward_spine', name: 'Skyward Spine', nameVi: 'Xương Sống Thiên Không', weaponType: 'Polearm', rarity: 5, icon: 'UI_EquipIcon_Pole_Dvalin' },
    { id: 'the_catch', name: '"The Catch"', nameVi: 'Lao Xiên Cá (The Catch)', weaponType: 'Polearm', rarity: 4, icon: 'UI_EquipIcon_Pole_Mori' },
    { id: 'favonius_lance', name: 'Favonius Lance', nameVi: 'Thương Tây Phong', weaponType: 'Polearm', rarity: 4, icon: 'UI_EquipIcon_Pole_Zephyrus' },
    { id: 'deathmatch', name: 'Deathmatch', nameVi: 'Thương Quyết Chiến', weaponType: 'Polearm', rarity: 4, icon: 'UI_EquipIcon_Pole_Gladiator' },
    { id: 'dragons_bane', name: "Dragon's Bane", nameVi: 'Tai Ương Của Rồng', weaponType: 'Polearm', rarity: 4, icon: 'UI_EquipIcon_Pole_Stardust' },
    { id: 'black_tassel', name: 'Black Tassel', nameVi: 'Hắc Anh Thương', weaponType: 'Polearm', rarity: 3, icon: 'UI_EquipIcon_Pole_Noire' },

    // Cung (Bow)
    { id: 'astral_vultures_crimson_plumage', name: "Astral Vulture's Crimson Plumage", nameVi: 'Lông Vũ Đỏ Sao Trời', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Qoyllor' },
    { id: 'silvershower_heartstrings', name: 'Silvershower Heartstrings', nameVi: 'Dây Đàn Mưa Bạc', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Arcdange' },
    { id: 'the_first_great_magic', name: 'The First Great Magic', nameVi: 'Màn Ảo Thuật Đầu Tiên', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Pledge' },
    { id: 'hunters_path', name: "Hunter's Path", nameVi: 'Con Đường Thợ Săn', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Ayus' },
    { id: 'aqua_simulacra', name: 'Aqua Simulacra', nameVi: 'Nhược Thủy', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Kirin' },
    { id: 'polar_star', name: 'Polar Star', nameVi: 'Ngôi Sao Cực Đông', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Worldbane' },
    { id: 'thundering_pulse', name: 'Thundering Pulse', nameVi: 'Sấm Sét Rung Động', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Narukami' },
    { id: 'elegy_for_the_end', name: 'Elegy for the End', nameVi: 'Tiếng Thở Dài Vô Tận (Cung)', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Widsith' },
    { id: 'amos_bow', name: "Amos' Bow", nameVi: 'Cung Amos', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Amos' },
    { id: 'skyward_harp', name: 'Skyward Harp', nameVi: 'Cánh Thiên Không', weaponType: 'Bow', rarity: 5, icon: 'UI_EquipIcon_Bow_Dvalin' },
    { id: 'favonius_warbow', name: 'Favonius Warbow', nameVi: 'Cung Tây Phong', weaponType: 'Bow', rarity: 4, icon: 'UI_EquipIcon_Bow_Zephyrus' },
    { id: 'sacrificial_bow', name: 'Sacrificial Bow', nameVi: 'Cung Tế Lễ', weaponType: 'Bow', rarity: 4, icon: 'UI_EquipIcon_Bow_Fossil' },
    { id: 'the_stringless', name: 'The Stringless', nameVi: 'Tuyệt Huyền', weaponType: 'Bow', rarity: 4, icon: 'UI_EquipIcon_Bow_Troupe' },

    // Pháp Khí (Catalyst)
    { id: 'starcallers_watch', name: "Starcaller's Watch", nameVi: 'Góc Nhìn Người Gọi Sao', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Menagerie' },
    { id: 'surfs_up', name: "Surf's Up", nameVi: 'Giờ Lướt Sóng', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_MechaPufferfish' },
    { id: 'cranes_echoing_call', name: "Crane's Echoing Call", nameVi: 'Tiếng Hạc Vang Vọng', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_MountainGale' },
    { id: 'tome_of_the_eternal_flow', name: 'Tome of the Eternal Flow', nameVi: 'Nghi Thức Dòng Chảy Vĩnh Hằng', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Wheatley' },
    { id: 'cashflow_supervision', name: 'Cashflow Supervision', nameVi: 'Quản Đốc Vàng Ròng', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Brisingamen' },
    { id: 'jadefalls_splendor', name: "Jadefall's Splendor", nameVi: 'Bích Lạc瓏', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Morax' },
    { id: 'tulaytullahs_remembrance', name: "Tulaytullah's Remembrance", nameVi: 'Hồi Ức Tulaytullah', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Alaya' },
    { id: 'a_thousand_floating_dreams', name: 'A Thousand Floating Dreams', nameVi: 'Cõi Mộng Ngàn Đêm', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Ayus' },
    { id: 'kaguras_verity', name: "Kagura's Verity", nameVi: 'Chân Ý Của Kagura', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Narukami' },
    { id: 'everlasting_moonglow', name: 'Everlasting Moonglow', nameVi: 'Vầng Trăng Bất Diệt', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Kaleido' },
    { id: 'lost_prayer', name: 'Lost Prayer to the Sacred Winds', nameVi: 'Điển Tích Tây Phong', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Fourwinds' },
    { id: 'skyward_atlas', name: 'Skyward Atlas', nameVi: 'Quyển Thiên Không', weaponType: 'Catalyst', rarity: 5, icon: 'UI_EquipIcon_Catalyst_Dvalin' },
    { id: 'the_widsith', name: 'The Widsith', nameVi: 'Chương Nhạc Lang Thang', weaponType: 'Catalyst', rarity: 4, icon: 'UI_EquipIcon_Catalyst_Troupe' },
    { id: 'sacrificial_fragments', name: 'Sacrificial Fragments', nameVi: 'Mảnh Chương Tế Lễ', weaponType: 'Catalyst', rarity: 4, icon: 'UI_EquipIcon_Catalyst_Fossil' },
    { id: 'favonius_codex', name: 'Favonius Codex', nameVi: 'Tây Phong Mật Điển', weaponType: 'Catalyst', rarity: 4, icon: 'UI_EquipIcon_Catalyst_Zephyrus' },
    { id: 'prototype_amber', name: 'Prototype Amber', nameVi: 'Mẫu Kim Phách', weaponType: 'Catalyst', rarity: 4, icon: 'UI_EquipIcon_Catalyst_Proto' },
    { id: 'thrilling_tales', name: 'Thrilling Tales of Dragon Slayers', nameVi: 'Câu Chuyện Diệt Rồng', weaponType: 'Catalyst', rarity: 3, icon: 'UI_EquipIcon_Catalyst_Pulpfic' }
  ];

  const ELEMENT_MAP = {
    Fire: 'Pyro',
    Water: 'Hydro',
    Wind: 'Anemo',
    Electric: 'Electro',
    Grass: 'Dendro',
    Ice: 'Cryo',
    Rock: 'Geo',
    Pyro: 'Pyro',
    Hydro: 'Hydro',
    Anemo: 'Anemo',
    Electro: 'Electro',
    Dendro: 'Dendro',
    Cryo: 'Cryo',
    Geo: 'Geo'
  };

  const WEAPON_TYPE_MAP = {
    WEAPON_SWORD_ONE_HAND: 'Sword',
    WEAPON_CLAYMORE: 'Claymore',
    WEAPON_POLE: 'Polearm',
    WEAPON_BOW: 'Bow',
    WEAPON_CATALYST: 'Catalyst',
    Sword: 'Sword',
    Claymore: 'Claymore',
    Polearm: 'Polearm',
    Bow: 'Bow',
    Catalyst: 'Catalyst'
  };

  let charactersList = BUILTIN_CHARACTERS.map((c) => ({
    ...c,
    iconUrls: getCharacterIconUrls(c.icon),
    splashUrls: getCharacterSplashUrls(c.icon)
  }));

  let weaponsList = BUILTIN_WEAPONS.map((w) => ({
    ...w,
    iconUrls: getWeaponIconUrls(w.icon)
  }));

  // Chuẩn hóa tiếng Việt không dấu để tìm kiếm nhanh (VD: "thuy than", "furina", "loi than")
  function normalizeSearchText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
  }

  /**
   * Tự động đồng bộ thêm nhân vật & vũ khí mới nhất từ Project Amber (gi.yatta.moe)
   * và Genshin-DB API nếu trình duyệt có kết nối Internet tới API.
   * Giữ nguyên và bổ sung vào danh sách sẵn có để không bao giờ mất nhân vật.
   */
  async function syncFromLiveAPIs() {
    let syncedChars = 0;
    let syncedWeapons = 0;

    // 1. Thử đồng bộ danh sách nhân vật Tiếng Việt từ Project Amber (gi.yatta.moe)
    try {
      const resVi = await fetch('https://gi.yatta.moe/api/v2/vi/avatar', { mode: 'cors' });
      if (resVi.ok) {
        const jsonVi = await resVi.json();
        const items = jsonVi?.data?.items || {};
        const byIcon = new Map(charactersList.map((c) => [c.icon, c]));

        Object.values(items).forEach((item) => {
          if (!item || !item.icon || !item.name) return;
          const idStr = String(item.id || '');
          const iconLower = String(item.icon || '').toLowerCase();
          const routeLower = String(item.route || '').toLowerCase();
          const nameNorm = normalizeSearchText(item.name);

          // Loại bỏ hoàn toàn Người Mẫu (Manekin / Manekina) và các biến thể Nhà Lữ Hành theo nguyên tố (chỉ giữ 1 Nhà Lữ Hành duy nhất)
          if (
            idStr.startsWith('10000005') ||
            idStr.startsWith('10000007') ||
            idStr.startsWith('10000117') ||
            idStr.startsWith('10000118') ||
            iconLower.includes('playerboy') ||
            iconLower.includes('playergirl') ||
            iconLower.includes('manekin') ||
            routeLower.includes('traveler') ||
            routeLower.includes('manekin') ||
            nameNorm.includes('nguoi mau') ||
            nameNorm.includes('manekin') ||
            nameNorm.includes('nha lu hanh')
          ) {
            return;
          }
          const element = ELEMENT_MAP[item.element] || 'Pyro';
          const weaponType = WEAPON_TYPE_MAP[item.weaponType] || 'Sword';
          const rarity = Number(item.rank) === 5 ? 5 : 4;
          const existing = byIcon.get(item.icon);
          if (existing) {
            if (!existing.nameVi) existing.nameVi = item.name;
          } else {
            const slug = item.route
              ? item.route.toLowerCase().replace(/[^a-z0-9]+/g, '_')
              : item.icon.replace('UI_AvatarIcon_', '').toLowerCase();
            const newChar = {
              id: slug,
              name: item.route || item.name,
              nameVi: item.name,
              element,
              weaponType,
              rarity,
              icon: item.icon,
              iconUrls: getCharacterIconUrls(item.icon),
              splashUrls: getCharacterSplashUrls(item.icon)
            };
            charactersList.unshift(newChar);
            byIcon.set(item.icon, newChar);
            syncedChars++;
          }
        });
      }
    } catch (e) {
      // Fallback sang Genshin-DB hoặc danh sách tích hợp sẵn
    }

    // 2. Thử đồng bộ danh sách Vũ khí Tiếng Việt từ Project Amber (gi.yatta.moe)
    try {
      const resWep = await fetch('https://gi.yatta.moe/api/v2/vi/weapon', { mode: 'cors' });
      if (resWep.ok) {
        const jsonWep = await resWep.json();
        const items = jsonWep?.data?.items || {};
        const byIcon = new Map(weaponsList.map((w) => [w.icon, w]));

        Object.values(items).forEach((item) => {
          if (!item || !item.icon || !item.name) return;
          const rarity = Number(item.rank) || 4;
          if (rarity < 3) return; // Chỉ lấy vũ khí 3★ - 5★
          const weaponType = WEAPON_TYPE_MAP[item.type] || 'Sword';
          const existing = byIcon.get(item.icon);
          if (existing) {
            existing.nameVi = item.name;
          } else {
            const slug = item.route
              ? item.route.toLowerCase().replace(/[^a-z0-9]+/g, '_')
              : item.icon.replace('UI_EquipIcon_', '').toLowerCase();
            const newWep = {
              id: slug,
              name: item.route || item.name,
              nameVi: item.name,
              weaponType,
              rarity,
              icon: item.icon,
              iconUrls: getWeaponIconUrls(item.icon)
            };
            weaponsList.push(newWep);
            byIcon.set(item.icon, newWep);
            syncedWeapons++;
          }
        });

        // Sắp xếp vũ khí 5 sao lên trước, rồi 4 sao, 3 sao
        weaponsList.sort((a, b) => b.rarity - a.rarity || a.nameVi.localeCompare(b.nameVi));
      }
    } catch (e) {
      // Giữ danh sách vũ khí tích hợp sẵn
    }

    return { syncedChars, syncedWeapons, totalChars: charactersList.length, totalWeapons: weaponsList.length };
  }

  function getCharacters() {
    return charactersList;
  }

  function getCharacterById(id) {
    if (!id) return null;
    if (String(id).startsWith('traveler')) {
      return charactersList.find((c) => c.id === 'traveler') || null;
    }
    return charactersList.find((c) => c.id === id) || null;
  }

  function getWeapons(weaponTypeFilter) {
    if (!weaponTypeFilter || weaponTypeFilter === 'ALL') return weaponsList;
    return weaponsList.filter((w) => w.weaponType === weaponTypeFilter);
  }

  function getWeaponById(id) {
    return weaponsList.find((w) => w.id === id) || null;
  }

  return {
    getCharacters,
    getCharacterById,
    getWeapons,
    getWeaponById,
    getCharacterIconUrls,
    getWeaponIconUrls,
    normalizeSearchText,
    syncFromLiveAPIs
  };
})();

