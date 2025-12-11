const fumos = [
    // EPIC
    { name: 'Ran(EPIC)', picture: 'https://fumo.website/img/524.jpg', rarity: 'EPIC' },
    { name: 'Satori(EPIC)', picture: 'https://fumo.website/img/820.jpg', rarity: 'EPIC' },
    { name: 'Kasen(EPIC)', picture: 'https://fumo.website/img/454.jpg', rarity: 'EPIC' },
    // { name: 'Aya(EPIC)', picture: 'https://fumo.website/img/493.jpg', rarity: 'EPIC' },
    // { name: 'Joon(EPIC)', picture: 'https://fumo.website/img/837.jpg', rarity: 'EPIC' },
    // { name: 'Miko(EPIC)', picture: 'https://fumo.website/img/900.jpg', rarity: 'EPIC' },
    // { name: 'Doremy(EPIC)', picture: 'https://pbs.twimg.com/media/EwupbULXAAQ2HSk.jpg:large', rarity: 'EPIC' },
    // { name: 'Keine(EPIC)', picture: 'https://pbs.twimg.com/media/EVQhXQMU0AAGlR6.jpg', rarity: 'EPIC' },
    // { name: 'Kogasa(EPIC)', picture: 'https://pbs.twimg.com/media/DzPQndbU8AATi09?format=jpg&name=large', rarity: 'EPIC' },

    // LEGENDARY
    { name: 'Flandere(LEGENDARY)', picture: 'https://i.imgur.com/q7f9gh2.png', rarity: 'LEGENDARY' },
    { name: 'Yukari(LEGENDARY)', picture: 'https://i.imgur.com/5X6wQ3g.jpeg', rarity: 'LEGENDARY' },
    { name: 'Yuyuko(LEGENDARY)', picture: 'https://m.media-amazon.com/images/I/515DN59NQXL._AC_UF894,1000_QL80_.jpg', rarity: 'LEGENDARY' },
    // { name: 'Eiki(LEGENDARY)', picture: 'https://i.imgur.com/0e6Ztnc.png', rarity: 'LEGENDARY' },
    // { name: 'Suwako(LEGENDARY)', picture: 'https://fumo.website/img/015.jpg', rarity: 'LEGENDARY' },
    // { name: 'Kaguya(LEGENDARY)', picture: 'https://fumo.website/img/138.jpg', rarity: 'LEGENDARY' },
    // { name: 'Mokou(LEGENDARY)', picture: 'https://fumo.website/img/139.jpg', rarity: 'LEGENDARY' },
    // { name: 'Koishi(LEGENDARY)', picture: 'https://fumo.website/img/821.jpg', rarity: 'LEGENDARY' },
    // { name: 'Suika(LEGENDARY)', picture: 'https://img.amiami.com/images/product/main/232/GOODS-04347171.jpg', rarity: 'LEGENDARY' },
    // { name: 'Byakuren(LEGENDARY)', picture: 'https://images-ng.pixai.art/images/orig/9dd36cd2-0d00-405e-9a0b-fb3f038f036f', rarity: 'LEGENDARY' },
    // { name: 'Kanako(LEGENDARY)', picture: 'https://i.pinimg.com/originals/95/91/f2/9591f24dda0b16fd0b742ec0d6289875.jpg', rarity: 'LEGENDARY' },
    // { name: 'Iku(LEGENDARY)', picture: 'https://pbs.twimg.com/media/FH5fBfrUUAAJbQ_.jpg:large', rarity: 'LEGENDARY' },
    // { name: 'Urumi(LEGENDARY)', picture: 'https://pbs.twimg.com/media/D8LreeNU0AA4MVj.jpg:large', rarity: 'LEGENDARY' },
    // { name: 'Keiki(LEGENDARY)', picture: 'https://i.ebayimg.com/images/g/ki4AAOSw4GdjWNMQ/s-l1600.jpg', rarity: 'LEGENDARY' },
    // { name: 'Utsuho(LEGENDARY)', picture: 'https://cdn.donmai.us/original/39/0b/390bab435fac9fd2b17bb9bf99766567.jpg', rarity: 'LEGENDARY' },
    // { name: 'Sagume(LEGENDARY)', picture: 'https://i.ebayimg.com/images/g/B~oAAOSwqpBlgVfQ/s-l1200.jpg', rarity: 'LEGENDARY' },
    // { name: 'Oirin(LEGENDARY)', picture: 'https://pbs.twimg.com/media/E-jDFYpVIAMqXeQ.png', rarity: 'LEGENDARY' },

    // MYTHICAL
    { name: 'Junko(MYTHICAL)', picture: 'https://m.media-amazon.com/images/I/41gFcESKY3L.jpg', rarity: 'MYTHICAL' },
    { name: 'Tenshi(MYTHICAL)', picture: 'https://fumo.website/img/593.jpg', rarity: 'MYTHICAL' },
    { name: 'Yuuka(MYTHICAL)', picture: 'https://fumo.website/img/685.jpg', rarity: 'MYTHICAL' },
    { name: 'Eirin(MYTHICAL)', picture: 'https://fumo.website/img/807.jpg', rarity: 'MYTHICAL' },
    // { name: 'Okina(MYTHICAL)', picture: 'https://ih1.redbubble.net/image.2942665500.5787/flat,750x,075,f-pad,750x1000,f8f8f8.u2.jpg', rarity: 'MYTHICAL' },
    // { name: 'Momoyi(MYTHICAL)', picture: 'https://pbs.twimg.com/media/E02izy7X0AETpeQ?format=jpg&name=4096x4096', rarity: 'MYTHICAL' },
    // { name: 'TheDualFumo(MYTHICAL)', picture: 'https://cdnb.artstation.com/p/assets/images/images/059/270/433/large/alphalilly-fumo.jpg?1675999566', rarity: 'MYTHICAL' },

    // EXCLUSIVE
    { name: 'DarkYoumu(EXCLUSIVE)', picture: 'https://fumo.website/img/918.jpg', rarity: 'EXCLUSIVE' },
    { name: 'BlueReimu(EXCLUSIVE)', picture: 'https://i.imgur.com/n6LCPHS.png', rarity: 'EXCLUSIVE' },
    { name: 'RedMarisa(EXCLUSIVE)', picture: 'https://i.imgur.com/yoeKCEb.png', rarity: 'EXCLUSIVE' },
    { name: 'CirnoSitting(EXCLUSIVE)', picture: 'https://art.ngfiles.com/images/2071000/2071347_elperez678_cirno-fumo.jpg?f1631463942', rarity: 'EXCLUSIVE' },
    { name: 'HyperSakuya(EXCLUSIVE)', picture: 'https://th.bing.com/th/id/OIP.RjaoWcmyjdWdbQ7GOaUN2wAAAA?cb=iwp2&rs=1&pid=ImgDetMain', rarity: 'EXCLUSIVE' },
    // { name: 'GamingReimu(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1208372690453405696/1217157994802970765/a0f.jpg?ex=660301b7&is=65f08cb7&hm=f0a6bd8100eafaf3f0cdd819999555a2e993320cafc3e073014038500572ba6c&', rarity: 'EXCLUSIVE' },
    // { name: 'MarketableDon(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1208372690453405696/1217157820537901056/Screenshot_2024-03-13-00-10-31-11_40deb401b9ffe8e1df2f1cc5ba480b12.jpg?ex=6603018e&is=65f08c8e&hm=c91b51e3f8a68591416afaf19bd49e3bee28b16f65d45a059bff7aba7fe29ac4&', rarity: 'EXCLUSIVE' },
    // { name: 'MarketableBobo(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1208372690453405696/1217154877239722015/Screenshot_2024-03-12-23-58-43-92_9f82565f1cce6b03acbe3170c44848fb.jpg?ex=6602fed0&is=65f089d0&hm=dd1e8b29ae858d77cf2d1505a835dc95f1b22356dabc8eeaf78350d674f8408f&', rarity: 'EXCLUSIVE' },
    // { name: 'Ishmael(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218075291742638110/IMG_3338.webp?ex=66065804&is=65f3e304&hm=e3eb7174d97b523192942e6e3576e55ebb486f2fb3f9a47200dbd319837d0f43&', rarity: 'EXCLUSIVE' },
    // { name: 'Shiroko(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218080408785391706/IMG_3347.jpg?ex=66065cc8&is=65f3e7c8&hm=a5a696751713ffbc57708fedbc3a68bcf8323995b929c39cc6ffb276cf1f5268&', rarity: 'EXCLUSIVE' },
    // { name: 'Amiya(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218080466083774494/IMG_3346.jpg?ex=66065cd5&is=65f3e7d5&hm=447ceaedbc113fd23c51606313a14d4a9f5f453bd4e1aa9323c9997156706120&', rarity: 'EXCLUSIVE' },

    // OTHERWORLDLY
    // { name: 'Xinyan(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2022/04/17/87506230/24e001ebc9d3b3ea4686f7706b47bf15_2247610847522308088.jpg', rarity: 'OTHERWORLDLY' },
    // { name: 'Aether(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2022/04/17/87506230/bcc79551023b2521b1bce6031cefd308_992408365969996096.jpg', rarity: 'OTHERWORLDLY' },
    // { name: 'Zhongli(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2022/04/17/87506230/a27398144efa5dec75d0b5355ee6256f_9128781543375233341.jpg', rarity: 'OTHERWORLDLY' },
    // { name: 'Amber(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2021/08/05/87506230/5df70c579f600e8599a714e4938ba021_3526443551709464553.jpg', rarity: 'OTHERWORLDLY' },
    // { name: 'Rosaria(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2021/08/05/87506230/cfc4bf8528b81b83e093b6e4819766fc_6418692249356840816.jpg', rarity: 'OTHERWORLDLY' },
    // { name: 'May(OTHERWORLDLY)', picture: 'https://pics.craiyon.com/2023-09-17/11697f223bfe40a39ce7681967e12777.webp', rarity: 'OTHERWORLDLY' },
    // { name: 'Monika(OTHERWORLDLY)', picture: 'https://pbs.twimg.com/media/E-AxiXhXEAIRrJj.png', rarity: 'OTHERWORLDLY' },
    { name: 'Bocchi(OTHERWORLDLY)', picture: 'https://i.kym-cdn.com/photos/images/original/002/627/704/46f', rarity: 'OTHERWORLDLY' },
    { name: 'Faruzamn(OTHERWORLDLY)', picture: 'https://image.tensorartassets.com/cdn-cgi/image/w=500,q=85/model_showcase/601734324150123536/151af48b-fa47-0325-04ae-51d091a3e727.png', rarity: 'OTHERWORLDLY' },
    { name: 'Cloaker(OTHERWORLDLY)', picture: 'https://static.wikia.nocookie.net/ce1e73b1-13a8-438d-b6e4-6f239b168895/scale-to-width/755', rarity: 'OTHERWORLDLY' },

    // ???
    { name: 'SkibidiToilet(???)', picture: 'https://i.imgur.com/pOZ9Sdf.png', rarity: '???' },
    { name: 'GawrGura(???)', picture: 'https://pbs.twimg.com/media/FNjhm89X0AEtPcU.jpg', rarity: '???' },
    // { name: 'MarketableHutao(???)', picture: 'https://i.ebayimg.com/images/g/LT8AAOSwdq5i54Bi/s-l1200.webp', rarity: '???' },
    { name: 'Miku(???)', picture: 'https://pbs.twimg.com/media/F-7Re-BWYAEJ6Zx?format=jpg&name=large', rarity: '???' },
    { name: 'Rin(???)', picture: 'https://pics.craiyon.com/2023-09-09/877b164806f6483192cb6a19d648ff97.webp', rarity: '???' },
    // { name: 'Penance(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218078331619246120/IMG_3344.jpg?ex=66065ad9&is=65f3e5d9&hm=a09e73c995ed37981a79a264b7a6fc2470ac328806597f95e38b189e7af6f3fc&', rarity: '???' },
    // { name: 'FrostNova(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218080520974503986/IMG_3345.jpg?ex=66065ce3&is=65f3e7e3&hm=27d76dc09ce43f0ce6738407f8e58a261bf7ef1eef16cfdae41acc505ca1ada1&', rarity: '???' },
    // { name: 'Serika(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218081151474995300/IMG_3349.jpg?ex=66065d79&is=65f3e879&hm=d7559fe3b4e2dc39ebc4d42f34baded407126e7aea49ac8690f15d2bdda228bc&', rarity: '???' },

    // ASTRAL
    { name: 'Athena(ASTRAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372426818594017311/OIP.png?ex=6826bb94&is=68256a14&hm=eb47a890b02dc810beefb84938f01c70b98522c1fe3c4a2ccb96de9293da28ac&=&format=webp&quality=lossless&width=309&height=309', rarity: 'ASTRAL' },
    // { name: 'TheClaw-LoR(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218075793826250772/IMG_3339.png?ex=6606587c&is=65f3e37c&hm=b364cc9a2d0142e0f4717477055a32e92ebf047b80497d4267f8466ab9baace5&', rarity: 'ASTRAL' },
    // { name: 'UltraKillV1(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218077015434067988/IMG_3341.jpg?ex=6606599f&is=65f3e49f&hm=b0fc465d9fdf70d43aef5463ba8e5d81b4d89c508dfaef385d70901903f4bab3&', rarity: 'ASTRAL' },

    // INFINITE
    { name: 'Mima(INFINITE)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372428382263967824/svru2t354ix81.png?ex=6826bd08&is=68256b88&hm=9ff0e6a614af9fee9626a549a57b331e4940ade36f9de38472dbcb452d965d97&=&format=webp&quality=lossless&width=698&height=930', rarity: 'INFINITE' },

    // ETERNAL
    { name: 'UltraKillV2(ETERNAL)', picture: 'https://th.bing.com/th/id/OIP.0rsVamUgjh_eW_1Ep5NDfAAAAA?cb=iwp2&rs=1&pid=ImgDetMain', rarity: 'ETERNAL' },

    // CELESTIAL
    { name: 'Mostima(CELESTIAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372427631877685389/mostima-fumo-mostimo-v0-httirpx8ghhb1.png?ex=6826bc55&is=68256ad5&hm=e9511d6de0f908e22eedeb4ab965753e76446ed39a3bdb9ac4af7ef099c62dd6&=&format=webp&quality=lossless&width=1429&height=800', rarity: 'CELESTIAL' },
    { name: 'Grani(CELESTIAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372427631877685389/mostima-fumo-mostimo-v0-httirpx8ghhb1.png?ex=6826bc55&is=68256ad5&hm=e9511d6de0f908e22eedeb4ab965753e76446ed39a3bdb9ac4af7ef099c62dd6&=&format=webp&quality=lossless&width=1429&height=800', rarity: 'CELESTIAL' },

    // TRANSCENDENT
    { name: 'Arisu(TRANSCENDENT)', picture: 'https://www.picclickimg.com/I70AAOSwPVJmW9NO/Blue-Archive-Tendou-Arisu-Fumo-Fumo-Plushie-Plush.webp', rarity: 'TRANSCENDENT' },
];
module.exports = fumos;