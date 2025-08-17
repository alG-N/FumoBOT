const allFumoList = [
    // Common
    { name: 'Reimu(Common)', price: 125 },
    { name: 'Marisa(Common)', price: 125 },
    { name: 'Cirno(Common)', price: 125 },
    { name: 'Sanae(Common)', price: 125 },
    // { name: 'Reisen(Common)', price: 305 },
    // { name: 'Tewi(Common)', price: 125 },
    // { name: 'Shion(Common)', price: 120 },
    // { name: 'Renko(Common)', price: 125 },
    // { name: 'LilyWhite(Common)', price: 125 },
    // { name: 'Kosuzu(Common)', price: 115 },
    // { name: 'Akyuu(Common)', price: 125 },

    // Uncommon
    { name: 'Sakuya(UNCOMMON)', price: 200 },
    { name: 'Meiling(UNCOMMON)', price: 200 },
    { name: 'Patchouli(UNCOMMON)', price: 215 },
    // { name: 'Momiji(UNCOMMON)', price: 120 },
    // { name: 'Rumia(UNCOMMON)', price: 255 },
    // { name: 'Koakuma(UNCOMMON)', price: 250 },

    // Rare
    { name: 'Remilia(RARE)', price: 300 },
    { name: 'Youmu(RARE)', price: 350 },
    // { name: 'Komachi(RARE)', price: 275 },
    // { name: 'Chen(RARE)', price: 345 },
    // { name: 'Kokoro(RARE)', price: 295 },
    // { name: 'Hatate(RARE)', price: 400 },
    // { name: 'Nitori(RARE)', price: 450 },

    // Epic
    { name: 'Ran(EPIC)', price: 765 },
    { name: 'Satori(EPIC)', price: 765 },
    { name: 'Kasen(EPIC)', price: 900 },
    // { name: 'Aya(EPIC)', price: 875 },
    // { name: 'Joon(EPIC)', price: 850 },
    // { name: 'Miko(EPIC)', price: 875 },
    // { name: 'Doremy(EPIC)', price: 1000 },
    // { name: 'Keine(EPIC)', price: 995 },
    // { name: 'Kosaga(EPIC)', price: 875 },

    // Otherworldly
    { name: 'TankReisen(OTHERWORLDLY)', price: 10000 },
    // { name: 'Texas(OTHERWORLDLY)', price: 13500 },
    // { name: 'Xinyan(OTHERWORLDLY)', price: 13500 },
    // { name: 'Aether(OTHERWORLDLY)', price: 13500 },
    // { name: 'Zhongli(OTHERWORLDLY)', price: 13500 },
    // { name: 'Amber(OTHERWORLDLY)', price: 13500 },
    // { name: 'Rosaria(OTHERWORLDLY)', price: 13500 },
    // { name: 'May(OTHERWORLDLY)', price: 13500 },
    // { name: 'Monika(OTHERWORLDLY)', price: 13500 },
    { name: 'Bocchi(OTHERWORLDLY)', price: 9500 },

    // Legendary
    { name: 'Flandere(LEGENDARY)', price: 17500 },
    { name: 'Yukari(LEGENDARY)', price: 12500 },
    { name: 'Yuyuko(LEGENDARY)', price: 15500 },
    // { name: 'Eiki(LEGENDARY)', price: 15500 },
    // { name: 'Suwako(LEGENDARY)', price: 20000 },
    // { name: 'Kaguya(LEGENDARY)', price: 19500 },
    // { name: 'Mokou(LEGENDARY)', price: 19500 },
    // { name: 'Koishi(LEGENDARY)', price: 17650 },
    // { name: 'Suika(LEGENDARY)', price: 39500 },
    // { name: 'Byakuren(LEGENDARY)', price: 19000 },
    // { name: 'Kanako(LEGENDARY)', price: 15550 },
    // { name: 'Iku(LEGENDARY)', price: 20000 },
    // { name: 'Urumi(LEGENDARY)', price: 20000 },
    // { name: 'Keiki(LEGENDARY)', price: 16750 },
    // { name: 'Sagume(LEGENDARY)', price: 17505 },
    // { name: 'Utsuho(LEGENDARY)', price: 21500 },
    // { name: 'Oirin(LEGENDARY)', price: 13500 },

    // Mythical
    { name: 'Junko(MYTHICAL)', price: 1500000 },
    { name: 'Tenshi(MYTHICAL)', price: 975000 },
    { name: 'Yuuka(MYTHICAL)', price: 1500000 },
    { name: 'Eirin(MYTHICAL)', price: 1350000 },
    // { name: 'Okina(MYTHICAL)', price: 1400000 },
    // { name: 'Momoyi(MYTHICAL)', price: 1875000 },
    // { name: 'TheDualFumo(MYTHICAL)', price: 1350000 },

    // Exclusive
    { name: 'BlueReimu(EXCLUSIVE)', price: 2750000 },
    { name: 'RedMarisa(EXCLUSIVE)', price: 3250000 },
    { name: 'DarkYoumu(EXCLUSIVE)', price: 3000000 },
    // { name: 'CirnoSitting(EXCLUSIVE)', price: 3150000 },
    // { name: 'HyperSakuya(EXCLUSIVE)', price: 2950000 },
    // { name: 'Ishmael(EXCLUSIVE)', price: 3430000 },
    // { name: 'Shiroko(EXCLUSIVE)', price: 3450000 },
    // { name: 'Amiya(EXCLUSIVE)', price: 3000000 },

    // ???
    { name: 'SkibidiToilet(???)', price: 57250000 },
    { name: 'GawrGura(???)', price: 60203000 },
    // { name: 'MarketableHutao(???)', price: 59250000 },
    { name: 'Miku-Senbonzakura,version(???)', price: 62150000 },
    { name: 'ImSorryOfficerFumo(???)', price: 54150000 },
    // { name: 'Penance(???)', price: 45000000 },
    // { name: 'FrostNova(???)', price: 42500000 },
    // { name: 'Serika(???)', price: 44444444 },
    // { name: 'WarCrimeReimu(???)', price: 45250000 },

    // Astral
    { name: 'Athena(ASTRAL)', price: 75940000 },
    // { name: 'TheClaw-LoR(ASTRAL)', price: 67950000 },
    // { name: 'UltraKillV1(ASTRAL)', price: 70150000 },
    // { name: 'Yukari-RinnosukeVer(ASTRAL)', price: 75940000 },
    // { name: 'Patchouli-RinnosukeVer(ASTRAL)', price: 64300000 },
    // { name: 'Noshiro(ASTRAL)', price: 72500000 },
    // { name: 'Shinano(ASTRAL)', price: 64634444 },
    // { name: 'LeMalin(ASTRAL)', price: 70000000 },
    // { name: 'Formidable(ASTRAL)', price: 62150000 },
    { name: 'Cheshire(ASTRAL)', price: 64150000 },

    // Infinite
    { name: 'Mima(INFINITE)', price: 100000000 },
    // { name: 'PC-98Reimu(INFINITE)', price: 124550000 },
    // { name: 'PC-98Marisa(INFINITE)', price: 139575000 },
    // { name: 'Sans(INFINITE)', price: 115000000 },

    // Celestial
    { name: 'Mostima(CELESTIAL)', price: 124550000 },
    { name: 'Grani(CELESTIAL)', price: 139575000 },

    // Eternal
    { name: 'UltraKillV2(ETERNAL)', price: 154590000 },
    // { name: 'TheBugAbuser(ETERNAL)', price: 174610000 },
    // { name: 'TheIntrovertedOne(ETERNAL)', price: 62150000 },
    // { name: 'TheGermanMan-BoboVer(ETERNAL)', price: 54150000 },
    // { name: 'Flandere-VampirePursingTheHunter(ETERNAL)', price: 701500000 },
    // { name: 'Remilia-TinyDevilMansion(ETERNAL)', price: 654590000 },
    // { name: 'PlushieFlandere?-TouhouLostwordVer(ETERNAL)', price: 450000000 },

    // Transcendent
    { name: 'Arisu(TRANSCENDENT)', price: 1000000000 },
    // { name: 'MarketableMaomao(TRANSCENDENT)', price: 1000000000 },
    // { name: 'MarketableJinshi(TRANSCENDENT)', price: 1000000000 },
    { name: 'TheOwner(TRANSCENDENT)', price: 7777777777},
    { name: 'Rinnosuke(TRANSCENDENT)', price: 1000000000 },
];

const market = []; // this will store your current market (5 refreshed items)

module.exports = {
    allFumoList,
    market
};