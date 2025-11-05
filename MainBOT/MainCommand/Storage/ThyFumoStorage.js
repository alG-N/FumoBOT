const https = require('https');
const http = require('http');

const fumos = [
    // common
    { name: 'Reimu(Common)', picture: 'https://i.imgur.com/AGQm5nR.jpeg' },
    { name: 'Marisa(Common)', picture: 'https://i.imgur.com/DQFXnHT.jpeg' },
    { name: 'Cirno(Common)', picture: 'https://i.imgur.com/zM7kUaq.jpeg' },
    { name: 'Sanae(Common)', picture: 'https://m.media-amazon.com/images/I/61+FZ2SklRL._AC_UF894,1000_QL80_.jpg' },
    // { name: 'Reisen(Common)', picture: 'https://fumo.website/img/424.jpg' },
    // { name: 'Tewi(Common)', picture: 'https://fumo.website/img/237.jpg' },
    // { name: 'Shion(Common)', picture: 'https://fumo.website/img/644.jpg' },
    // { name: 'Renko(Common)', picture: 'https://fumo.website/img/899.jpg' },
    // { name: 'LilyWhite(Common)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114283431526441/IMG_4147.jpg?ex=66067c54&is=65f40754&hm=0ed0007d183d77c3eecc349d85d3981d0764d5100cc45688fadceabc1bbd073f&' },
    // { name: 'Kosuzu(Common)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114285125763092/IMG_4152.png?ex=66067c55&is=65f40755&hm=6cc270031a733b57d14e227af7687c3a2158b718ab61bf61fe8f6b8bd1e791ca&' },
    // { name: 'Akyuu(Common)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114326561558578/IMG_4154.jpg?ex=66067c5e&is=65f4075e&hm=b578d7bfeb3b468d6ec2b57c74d0a683b0f4f67f41d5371372d7192d258d55a0&' },

    // uncommon 
    { name: 'Sakuya(UNCOMMON)', picture: 'https://i.imgur.com/F3gmWW5.png' },
    { name: 'Meiling(UNCOMMON)', picture: 'https://i.imgur.com/zwEcy1J.png' },
    { name: 'Patchouli(UNCOMMON)', picture: 'https://fumo.website/img/492.jpg' },
    // { name: 'Momiji(UNCOMMON)', picture: 'https://fumo.website/img/773.jpg' },
    // { name: 'Rumia(UNCOMMON)', picture: 'https://fumo.website/img/834.jpg' },
    // { name: 'Koakuma(UNCOMMON)', picture: 'https://pbs.twimg.com/media/FGwYmI_VIAYjQUX.png' },

    // rare 
    { name: 'Remilia(RARE)', picture: 'https://m.media-amazon.com/images/I/51J89dEWxSL._AC_SL1200_.jpg' },
    { name: 'Youmu(RARE)', picture: 'https://m.media-amazon.com/images/I/515nP-iA6RL.jpg' },
    // { name: 'Komachi(RARE)', picture: 'https://i.imgur.com/0CItfah.png' },
    // { name: 'Chen(RARE)', picture: 'https://fumo.website/img/523.jpg' },
    // { name: 'Kokoro(RARE)', picture: 'https://fumo.website/img/310.jpg' },
    // { name: 'Hatate(RARE)', picture: 'https://fumo.website/img/494.jpg' },
    // { name: 'Nitori(RARE)', picture: 'https://fumo.website/img/836.jpg' },

    // epic 
    { name: 'Ran(EPIC)', picture: 'https://fumo.website/img/524.jpg' },
    { name: 'Satori(EPIC)', picture: 'https://fumo.website/img/820.jpg' },
    { name: 'Kasen(EPIC)', picture: 'https://fumo.website/img/454.jpg' },
    // { name: 'Aya(EPIC)', picture: 'https://fumo.website/img/493.jpg' },
    // { name: 'Joon(EPIC)', picture: 'https://fumo.website/img/837.jpg' },
    // { name: 'Miko(EPIC)', picture: 'https://fumo.website/img/900.jpg' },
    // { name: 'Doremy(EPIC)', picture: 'https://pbs.twimg.com/media/EwupbULXAAQ2HSk.jpg:large' },
    // { name: 'Keine(EPIC)', picture: 'https://pbs.twimg.com/media/EVQhXQMU0AAGlR6.jpg' },
    // { name: 'Kogasa(EPIC)', picture: 'https://pbs.twimg.com/media/DzPQndbU8AATi09?format=jpg&name=large' },

    // otherworldly
    { name: 'TankReisen(OTHERWORLDLY)', picture: 'https://i.ytimg.com/vi/45czjxFVlh4/maxresdefault.jpg' },
    // { name: 'Texas(OTHERWORLDLY)', picture: 'https://pbs.twimg.com/media/FTABmb-VEAIEyhP.jpg' },
    // { name: 'Xinyan(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2022/04/17/87506230/24e001ebc9d3b3ea4686f7706b47bf15_2247610847522308088.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80' },
    // { name: 'Aether(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2022/04/17/87506230/bcc79551023b2521b1bce6031cefd308_992408365969996096.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80' },
    // { name: 'Zhongli(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2022/04/17/87506230/a27398144efa5dec75d0b5355ee6256f_9128781543375233341.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80' },
    // { name: 'Amber(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2021/08/05/87506230/5df70c579f600e8599a714e4938ba021_3526443551709464553.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80' },
    // { name: 'Rosaria(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2021/08/05/87506230/cfc4bf8528b81b83e093b6e4819766fc_6418692249356840816.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80' },
    // { name: 'May(OTHERWORLDLY)', picture: 'https://pics.craiyon.com/2023-09-17/11697f223bfe40a39ce7681967e12777.webp' },
    // { name: 'Monika(OTHERWORLDLY)', picture: 'https://pbs.twimg.com/media/E-AxiXhXEAIRrJj.png' },
    { name: 'Bocchi(OTHERWORLDLY)', picture: 'https://i.kym-cdn.com/photos/images/original/002/627/704/46f' },

    // legendary 
    { name: 'Flandere(LEGENDARY)', picture: 'https://i.imgur.com/q7f9gh2.png' },
    { name: 'Yukari(LEGENDARY)', picture: 'https://i.imgur.com/5X6wQ3g.jpeg' },
    { name: 'Yuyuko(LEGENDARY)', picture: 'https://m.media-amazon.com/images/I/515DN59NQXL._AC_UF894,1000_QL80_.jpg' },
    // { name: 'Eiki(LEGENDARY)', picture: 'https://i.imgur.com/0e6Ztnc.png' },
    // { name: 'Suwako(LEGENDARY)', picture: 'https://fumo.website/img/015.jpg' },
    // { name: 'Kaguya(LEGENDARY)', picture: 'https://fumo.website/img/138.jpg' },
    // { name: 'Mokou(LEGENDARY)', picture: 'https://fumo.website/img/139.jpg' },
    // { name: 'Koishi(LEGENDARY)', picture: 'https://fumo.website/img/821.jpg' },
    // { name: 'Suika(LEGENDARY)', picture: 'https://img.amiami.com/images/product/main/232/GOODS-04347171.jpg' },
    // { name: 'Byakuren(LEGENDARY)', picture: 'https://images-ng.pixai.art/images/orig/9dd36cd2-0d00-405e-9a0b-fb3f038f036f' },
    // { name: 'Kanako(LEGENDARY)', picture: 'https://i.pinimg.com/originals/95/91/f2/9591f24dda0b16fd0b742ec0d6289875.jpg' },
    // { name: 'Iku(LEGENDARY)', picture: 'https://pbs.twimg.com/media/FH5fBfrUUAAJbQ_.jpg:large' },
    // { name: 'Urumi(LEGENDARY)', picture: 'https://pbs.twimg.com/media/D8LreeNU0AA4MVj.jpg:large' },
    // { name: 'Keiki(LEGENDARY)', picture: 'https://i.ebayimg.com/images/g/ki4AAOSw4GdjWNMQ/s-l1600.jpg' },
    // { name: 'Utsuho(LEGENDARY)', picture: 'https://cdn.donmai.us/original/39/0b/390bab435fac9fd2b17bb9bf99766567.jpg' },
    // { name: 'Sagume(LEGENDARY)', picture: 'https://i.ebayimg.com/images/g/B~oAAOSwqpBlgVfQ/s-l1200.jpg' },
    // { name: 'Oirin(LEGENDARY)', picture: 'https://pbs.twimg.com/media/E-jDFYpVIAMqXeQ.png' },

    // mythical  
    { name: 'Junko(MYTHICAL)', picture: 'https://m.media-amazon.com/images/I/41gFcESKY3L.jpg' },
    { name: 'Tenshi(MYTHICAL)', picture: 'https://fumo.website/img/593.jpg' },
    { name: 'Yuuka(MYTHICAL)', picture: 'https://fumo.website/img/685.jpg' },
    { name: 'Eirin(MYTHICAL)', picture: 'https://fumo.website/img/807.jpg' },
    // { name: 'Okina(MYTHICAL)', picture: 'https://ih1.redbubble.net/image.2942665500.5787/flat,750x,075,f-pad,750x1000,f8f8f8.u2.jpg' },
    // { name: 'Momoyi(MYTHICAL)', picture: 'https://pbs.twimg.com/media/E02izy7X0AETpeQ?format=jpg&name=4096x4096' },
    // { name: 'TheDualFumo(MYTHICAL)', picture: 'https://cdnb.artstation.com/p/assets/images/images/059/270/433/large/alphalilly-fumo.jpg?1675999566' },

    // exclusive 
    { name: 'BlueReimu(EXCLUSIVE)', picture: 'https://i.imgur.com/n6LCPHS.png' },
    { name: 'RedMarisa(EXCLUSIVE)', picture: 'https://i.imgur.com/yoeKCEb.png' },
    { name: 'DarkYoumu(EXCLUSIVE)', picture: 'https://fumo.website/img/918.jpg' },
    { name: 'CirnoSitting(EXCLUSIVE)', picture: 'https://art.ngfiles.com/images/2071000/2071347_elperez678_cirno-fumo.jpg?f1631463942' },
    { name: 'HyperSakuya(EXCLUSIVE)', picture: 'https://th.bing.com/th/id/OIP.RjaoWcmyjdWdbQ7GOaUN2wAAAA?cb=iwp2&rs=1&pid=ImgDetMain' },
    // { name: 'Furina(EXCLUSIVE)', picture: 'https://pbs.twimg.com/media/GCCyCqzbkAA2tXM.jpg:large' },
    // { name: 'HyperFlandere(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1208372690453405696/1217154158684274859/images.jpg?ex=6602fe25&is=65f08925&hm=c0cb577277e9cf227fbd2fd9b2d38db11c1444d0889a6a76b62d7edaef750d67&' },
    // { name: 'HyperYoumu(EXCLUSIVE)', picture: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRx_u49-DjYYAkgZVETPiTWKreyTapJPa-Mbg&usqp=CAU' },
    // { name: 'Ishmael(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218075291742638110/IMG_3338.webp?ex=66065804&is=65f3e304&hm=e3eb7174d97b523192942e6e3576e55ebb486f2fb3f9a47200dbd319837d0f43&' },
    // { name: 'Shiroko(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218080408785391706/IMG_3347.jpg?ex=66065cc8&is=65f3e7c8&hm=a5a696751713ffbc57708fedbc3a68bcf8323995b929c39cc6ffb276cf1f5268&' },
    // { name: 'Amiya(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218080466083774494/IMG_3346.jpg?ex=66065cd5&is=65f3e7d5&hm=447ceaedbc113fd23c51606313a14d4a9f5f453bd4e1aa9323c9997156706120&' },

    // ??? 
    { name: 'SkibidiToilet(???)', picture: 'https://i.imgur.com/pOZ9Sdf.png' },
    { name: 'GawrGura(???)', picture: 'https://pbs.twimg.com/media/FNjhm89X0AEtPcU.jpg' },
    // { name: 'MarketableHutao(???)', picture: 'https://i.ebayimg.com/images/g/LT8AAOSwdq5i54Bi/s-l1200.webp' },
    // { name: 'Gebura(???)', picture: 'https://pbs.twimg.com/media/EyZRl6HVgAIpex6?format=jpg&name=4096x4096' },
    // { name: 'Penance(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218078331619246120/IMG_3344.jpg?ex=66065ad9&is=65f3e5d9&hm=a09e73c995ed37981a79a264b7a6fc2470ac328806597f95e38b189e7af6f3fc&' },
    // { name: 'FrostNova(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218080520974503986/IMG_3345.jpg?ex=66065ce3&is=65f3e7e3&hm=27d76dc09ce43f0ce6738407f8e58a261bf7ef1eef16cfdae41acc505ca1ada1&' },
    // { name: 'Serika(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218081151474995300/IMG_3349.jpg?ex=66065d79&is=65f3e879&hm=d7559fe3b4e2dc39ebc4d42f34baded407126e7aea49ac8690f15d2bdda228bc&' },
    // { name: 'WarCrimeReimu(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114326855028816/IMG_4155.png?ex=66067c5e&is=65f4075e&hm=5aacead2e224603f9a0a3ccd3713e1c47cd19749324ee0a44a59a8d69457b414&' },

    // astral 
    { name: 'Athena(ASTRAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372426818594017311/OIP.png?ex=6826bb94&is=68256a14&hm=eb47a890b02dc810beefb84938f01c70b98522c1fe3c4a2ccb96de9293da28ac&=&format=webp&quality=lossless&width=309&height=309' },
    // { name: 'TheClaw-LoR(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218075793826250772/IMG_3339.png?ex=6606587c&is=65f3e37c&hm=b364cc9a2d0142e0f4717477055a32e92ebf047b80497d4267f8466ab9baace5&' },
    // { name: 'UltraKillV1(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218077015434067988/IMG_3341.jpg?ex=6606599f&is=65f3e49f&hm=b0fc465d9fdf70d43aef5463ba8e5d81b4d89c508dfaef385d70901903f4bab3&' },
    // { name: 'Yukari-RinnosukeVer(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114282613637201/IMG_4145.jpg?ex=66067c54&is=65f40754&hm=95a07fce7fbbd0bcd2a7989896e7e3e282fbaeb4fe35092763741ddd64d31d60&' },
    // { name: 'Patchouli-RinnosukeVer(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114282957574154/IMG_4146.jpg?ex=66067c54&is=65f40754&hm=f5a9e37b2684dbf298a54a48dd8fe3ed4fb119cc7d41745f0e077b6e141aa6f8&' },
    // { name: 'Noshiro(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114327110750208/IMG_4156.jpg?ex=66067c5f&is=65f4075f&hm=d82bb8a68cc8c164c34633d2c90b11c12ada4ab9238422e0326b739234f31576&' },
    // { name: 'Shinano(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114327354282114/IMG_4157.jpg?ex=66067c5f&is=65f4075f&hm=3eedd5a3dee8312e838cbf16101d5916b1acccbe158ecd224bc4c480ee111de3&' },
    // { name: 'LeMalin(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114327618392115/IMG_4158.jpg?ex=66067c5f&is=65f4075f&hm=a68adab556fdf8688a8723b44bc602f77e6c3a7decc1d4bf24e83016a4e94a50&' },
    // { name: 'Formidable(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114327882502164/IMG_4159.jpg?ex=66067c5f&is=65f4075f&hm=94fb0984b5b719635de0a2e33c453df121c0e3f6b78c132af58869f25cede6e7&' },
    { name: 'Cheshire(ASTRAL)', picture: 'https://images.tokopedia.net/img/cache/500-square/VqbcmM/2024/2/25/932b310d-4256-42bc-abf7-c7d83869ee0c.jpg' },

    //celestial
    { name: 'Mostima(CELESTIAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372427631877685389/mostima-fumo-mostimo-v0-httirpx8ghhb1.png?ex=6826bc55&is=68256ad5&hm=e9511d6de0f908e22eedeb4ab965753e76446ed39a3bdb9ac4af7ef099c62dd6&=&format=webp&quality=lossless&width=1429&height=800' },
    { name: 'Grani(CELESTIAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372427631877685389/mostima-fumo-mostimo-v0-httirpx8ghhb1.png?ex=6826bc55&is=68256ad5&hm=e9511d6de0f908e22eedeb4ab965753e76446ed39a3bdb9ac4af7ef099c62dd6&=&format=webp&quality=lossless&width=1429&height=800' },

    // infinite
    { name: 'Mima(INFINITE)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372428382263967824/svru2t354ix81.png?ex=6826bd08&is=68256b88&hm=9ff0e6a614af9fee9626a549a57b331e4940ade36f9de38472dbcb452d965d97&=&format=webp&quality=lossless&width=698&height=930' },
    // { name: 'PC-98Reimu(INFINITE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114284563992586/IMG_4150.png?ex=66067c54&is=65f40754&hm=643958f8ab4aa305569c3c3edd54ff4e150c181ee0cacda23ddc420680da60dd&' },
    // { name: 'PC-98Marisa(INFINITE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114284828229662/IMG_4151.png?ex=66067c54&is=65f40754&hm=859b40662122d9ca25c8878b0cc7bc6df58843444d9ac7bd91227b4d447c776a&' },
    // { name: 'Sans(INFINITE)', picture: 'https://pm1.aminoapps.com/8732/54ec9083116a05b338676ac91f64f9d9db490bd7r1-1478-1536v2_hq.jpg' },

    //eternal
    // { name: 'TheBugAbuser(ETERNAL)', picture: 'https://tr.rbxcdn.com/30DAY-Avatar-1C21F96ABAF199046D71EA79C561CB08-Png/352/352/Avatar/Png/noFilter' },
    // { name: 'TheIntrovertedOne(ETERNAL)', picture: 'https://tr.rbxcdn.com/30DAY-Avatar-13A0AAC41294429047B449246908AE22-Png/352/352/Avatar/Png/noFilter' },
    // { name: 'TheGermanMan-BoboVer(ETERNAL)', picture: 'https://tr.rbxcdn.com/30DAY-Avatar-99FDC68F08F7295E041D7C008C9962AD-Png/352/352/Avatar/Png/noFilter' },
    // { name: 'Flandere-VampirePursingTheHunter(ETERNAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114283708088360/IMG_4148.png?ex=66067c54&is=65f40754&hm=e9e448783f69ed5e4ad199b39da58f447f59be7d84761b738f8d04cd8b284355&' },
    // { name: 'Remilia-TinyDevilMansion(ETERNAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114284111003648/IMG_4149.png?ex=66067c54&is=65f40754&hm=532c341906b2dbd1e0ff77580fed3a1e534408e32432c7cd17d33054194f6de5&' },
    // { name: 'PlushieFlandere?-TouhouLostwordVer(ETERNAL)', picture: '' },
    { name: 'UltraKillV2(ETERNAL)', picture: 'https://th.bing.com/th/id/OIP.0rsVamUgjh_eW_1Ep5NDfAAAAA?cb=iwp2&rs=1&pid=ImgDetMain' },

    //transcendent
    { name: 'Arisu(TRANSCENDENT)', picture: 'https://www.picclickimg.com/I70AAOSwPVJmW9NO/Blue-Archive-Tendou-Arisu-Fumo-Fumo-Plushie-Plush.webp' },
    // { name: 'MarketableMaomao(TRANSCENDENT)', picture: 'https://images.goodsmile.info/cgm/images/product/20231025/15132/122650/large/7bc971d1e918654bd78e093215dda3cc.jpg' },
    // { name: 'MarketableJinshi(TRANSCENDENT)', picture: 'https://images.goodsmile.info/cgm/images/product/20231025/15132/122652/large/ef54cd26eb2fd463dc776d7fa2dad88a.jpg' },
    { name: 'Rinnosuke(TRANSCENDENT)', picture: 'https://img1.picmix.com/output/stamp/normal/6/1/0/7/2577016_a2c58.png' },
]

// function checkImage(url) {
//     return new Promise((resolve) => {
//         const lib = url.startsWith('https') ? https : http;
//         const req = lib.get(url, (res) => {
//             resolve(res.statusCode === 200);
//         });
//         req.on('error', () => resolve(false));
//         req.setTimeout(5000, () => {
//             req.abort();
//             resolve(false);
//         });
//     });
// }

// async function checkAllImages() {
//     for (const fumo of fumos) {
//         const isValid = await checkImage(fumo.picture);
//         if (!isValid) {
//             console.log(`❌ Image missing or broken for: ${fumo.name}`);
//         } else {
//             console.log(`✅ Image OK: ${fumo.name}`);
//         }
//     }
// }

// checkAllImages();
//120 lines
module.exports = fumos;