const fs = require('fs');
const path = require('path');

// OLD DATA from oldinform.js
const gemFumos = [
    { name: 'Gambler(LEGENDARY)', picture: 'https://ih1.redbubble.net/image.5028045676.6139/flat,750x,075,f-pad,750x1000,f8f8f8.jpg', currency: 'gems', origin: '', fact: '' },
    { name: 'Go/jo(???)', picture: 'https://m.media-amazon.com/images/I/41PQuj80tDS._AC_UF894,1000_QL80_.jpg', currency: 'gems', origin: 'The strongest sorcerer of Today in Jujutsu Kaisen', fact: 'Kitkat' },
    { name: 'Fraudkuna(???)', rarity: '???', picture: 'https://i.ebayimg.com/images/g/JEsAAOSwxOBguJZG/s-l1200.webp', currency: 'gems', origin: 'The strongest sorcerer of HISTORY in Jujutsu Kaisen', fact: 'Lame ahh death' },
    { name: 'Traumatized(EPIC)', rarity: 'EPIC', picture: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTO5lppyMpyRD7ABC_QLJ6-sF2DXmepDOjpgg&s', currency: 'gems', origin: 'Yuji Itadori from Jujutsu Kaisen', fact: 'Did you know, Itadori was meant to be a side character, yuta was the main character. Until Gege think again.' },
    { name: 'Eye-Popping(EPIC)', rarity: 'EPIC', picture: 'https://www.mugentoys.com/shop/image/cache/catalog/img/01/451391400a-500x500.jpg', currency: 'gems', origin: 'Nobara from Jujutsu Kaisen', fact: 'She came back...As a MVP' },
    { name: 'AbandonedChild(EPIC)', rarity: 'EPIC', picture: 'https://ae01.alicdn.com/kf/Hcb03f9597b394d6c8b5e225623379208c/Jujutsu-Kaisen-Plush-Toys-Plushies-Doll-Yuji-Gojo-Megumi-Toge-Stuffed-Toy-Doll-Removable-Clothes-Christmas.jpg', currency: 'gems', origin: '', fact: '' },
    { name: 'MonkeyLeader(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://m.media-amazon.com/images/I/517MfPrGaRL.jpg', currency: 'gems', origin: '', fact: '' },
    { name: 'OneShotCurse(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://animeislandca.com/cdn/shop/files/jujutsu-kaisen-kyurumaru-mahito-big-plush-toy-anime-island-ca.png?v=1692739157&width=1445', currency: 'gems', origin: 'The villain thats everyone hate in Jujutsu Kaisen', fact: 'Dont let me touch you ahh skill-set' },
    { name: 'AvoidChildSupport(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://i.ebayimg.com/images/g/d7wAAOSwtcdk2cIg/s-l1200.webp', currency: 'gems', origin: 'The strongest child support avoider of today in Jujutsu Kaisen', fact: 'Apple Logo' },
    { name: 'ExplodedMan(LEGENDARY)', rarity: 'LEGENDARY', picture: 'https://i.ebayimg.com/images/g/XeIAAOSwdTtheKuc/s-l1200.webp', currency: 'gems', origin: 'Chill blone guy in Jujutsu Kaisen', fact: 'And he does not deserved that' },
    { name: 'HeianSukuna(TRANSCENDENT)', rarity: 'TRANSCENDENT', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372880397599244378/raw.png?ex=68286201&is=68271081&hm=354b51c0bb278e08cef1d63050e9e0fc41765335d37309f15298050a8fdd03da&=&format=webp&quality=lossless&width=438&height=438', currency: 'gems', origin: 'The strongest sorcerer of all time in Jujutsu Kaisen', fact: 'He is the one who created the curse technique' },
];

const coinFumos = [
    { name: 'Reimu(Common)', picture: 'https://i.imgur.com/AGQm5nR.jpeg', currency: 'coins', origin: '', fact: '' },
    { name: 'Marisa(Common)', picture: 'https://i.imgur.com/DQFXnHT.jpeg', currency: 'coins', origin: '', fact: '' },
    { name: 'Cirno(Common)', picture: 'https://i.imgur.com/zM7kUaq.jpeg', currency: 'coins', origin: '', fact: '' },
    { name: 'BlueReimu(EXCLUSIVE)', picture: 'https://i.imgur.com/n6LCPHS.png', currency: 'coins', origin: '', fact: '' },
    { name: 'RedMarisa(EXCLUSIVE)', picture: 'https://i.imgur.com/yoeKCEb.png', currency: 'coins', origin: '', fact: '' },
    { name: 'Remilia(RARE)', picture: 'https://m.media-amazon.com/images/I/51J89dEWxSL._AC_SL1200_.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Flandere(LEGENDARY)', picture: 'https://i.imgur.com/q7f9gh2.png', currency: 'coins', origin: '', fact: '' },
    { name: 'Sakuya(UNCOMMON)', picture: 'https://i.imgur.com/F3gmWW5.png', currency: 'coins', origin: '', fact: '' },
    { name: 'Meiling(UNCOMMON)', picture: 'https://i.imgur.com/zwEcy1J.png', currency: 'coins', origin: '', fact: '' },
    { name: 'Junko(MYTHICAL)', picture: 'https://m.media-amazon.com/images/I/41gFcESKY3L.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Yukari(LEGENDARY)', picture: 'https://i.imgur.com/5X6wQ3g.jpeg', currency: 'coins', origin: '', fact: '' },
    { name: 'Sanae(Common)', picture: 'https://m.media-amazon.com/images/I/61+FZ2SklRL._AC_UF894,1000_QL80_.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'SkibidiToilet(???)', picture: 'https://i.imgur.com/pOZ9Sdf.png', currency: 'coins', origin: '', fact: '' },
    { name: 'GawrGura(???)', picture: 'https://pbs.twimg.com/media/FNjhm89X0AEtPcU.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Youmu(RARE)', picture: 'https://m.media-amazon.com/images/I/515nP-iA6RL.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Yuyuko(LEGENDARY)', picture: 'https://m.media-amazon.com/images/I/515DN59NQXL._AC_UF894,1000_QL80_.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Patchouli(UNCOMMON)', picture: 'https://fumo.website/img/492.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'DarkYoumu(EXCLUSIVE)', picture: 'https://fumo.website/img/918.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Ran(EPIC)', picture: 'https://fumo.website/img/524.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Satori(EPIC)', picture: 'https://fumo.website/img/820.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Kasen(EPIC)', picture: 'https://fumo.website/img/454.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Tenshi(MYTHICAL)', picture: 'https://fumo.website/img/593.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Yuuka(MYTHICAL)', picture: 'https://fumo.website/img/685.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Eirin(MYTHICAL)', picture: 'https://fumo.website/img/807.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'TankReisen(OTHERWORLDLY)', picture: 'https://i.ytimg.com/vi/45czjxFVlh4/maxresdefault.jpg', currency: 'coins', origin: '', fact: '' },
    { name: 'Bocchi(OTHERWORLDLY)', picture: 'https://i.kym-cdn.com/photos/images/original/002/627/704/46f', currency: 'coins', origin: '', fact: '' },
    { name: 'CirnoSitting(EXCLUSIVE)', picture: 'https://art.ngfiles.com/images/2071000/2071347_elperez678_cirno-fumo.jpg?f1631463942', currency: 'coins', origin: '', fact: '' },
    { name: 'HyperSakuya(EXCLUSIVE)', picture: 'https://th.bing.com/th/id/OIP.RjaoWcmyjdWdbQ7GOaUN2wAAAA?cb=iwp2&rs=1&pid=ImgDetMain', currency: 'coins', origin: '', fact: '' },
    { name: 'Mima(INFINITE)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372428382263967824/svru2t354ix81.png?ex=6826bd08&is=68256b88&hm=9ff0e6a614af9fee9626a549a57b331e4940ade36f9de38472dbcb452d965d97&=&format=webp&quality=lossless&width=698&height=930', currency: 'coins', origin: '', fact: '' },
    { name: 'Athena(ASTRAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372426818594017311/OIP.png?ex=6826bb94&is=68256a14&hm=eb47a890b02dc810beefb84938f01c70b98522c1fe3c4a2ccb96de9293da28ac&=&format=webp&quality=lossless&width=309&height=309', currency: 'coins', origin: '', fact: '' },
    { name: 'UltraKillV2(ETERNAL)', picture: 'https://th.bing.com/th/id/OIP.0rsVamUgjh_eW_1Ep5NDfAAAAA?cb=iwp2&rs=1&pid=ImgDetMain', currency: 'coins', origin: '', fact: '' },
    { name: 'Mostima(CELESTIAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372427631877685389/mostima-fumo-mostimo-v0-httirpx8ghhb1.png?ex=6826bc55&is=68256ad5&hm=e9511d6de0f908e22eedeb4ab965753e76446ed39a3bdb9ac4af7ef099c62dd6&=&format=webp&quality=lossless&width=1429&height=800', currency: 'coins', origin: '', fact: '' },
    { name: 'Grani(CELESTIAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372427631877685389/mostima-fumo-mostimo-v0-httirpx8ghhb1.png?ex=6826bc55&is=68256ad5&hm=e9511d6de0f908e22eedeb4ab965753e76446ed39a3bdb9ac4af7ef099c62dd6&=&format=webp&quality=lossless&width=1429&height=800', currency: 'coins', origin: '', fact: '' },
    { name: 'Arisu(TRANSCENDENT)', picture: 'https://www.picclickimg.com/I70AAOSwPVJmW9NO/Blue-Archive-Tendou-Arisu-Fumo-Fumo-Plushie-Plush.webp', currency: 'coins', origin: '', fact: '' },
    { name: 'Rinnosuke(TRANSCENDENT)', picture: 'https://img1.picmix.com/output/stamp/normal/6/1/0/7/2577016_a2c58.png', currency: 'coins', origin: '', fact: '' },
    { name: 'Cheshire(ASTRAL)', picture: 'https://images.tokopedia.net/img/cache/500-square/VqbcmM/2024/2/25/932b310d-4256-42bc-abf7-c7d83869ee0c.jpg', currency: 'coins', origin: '', fact: '' },
];

const Reimu = [
    { name: 'Miku(???)', picture: 'https://pbs.twimg.com/media/F-7Re-BWYAEJ6Zx?format=jpg&name=large', currency: 'coins', origin: 'One of the most popular vocaloid, and still for now', fact: 'Miku miku beam' },
    { name: 'Rin(???)', picture: 'https://pics.craiyon.com/2023-09-09/877b164806f6483192cb6a19d648ff97.webp', currency: 'coins', origin: 'One of the most popular vocaloid, just behind Miku? Perhaps', fact: 'Electric Angel is a nice song!' },
    { name: 'Faruzamn(OTHERWORLDLY)', picture: 'https://image.tensorartassets.com/cdn-cgi/image/w=500,q=85/model_showcase/601734324150123536/151af48b-fa47-0325-04ae-51d091a3e727.png', currency: 'coins', origin: '', fact: '' },
    { name: 'Cloaker(OTHERWORLDLY)', picture: 'https://static.wikia.nocookie.net/ce1e73b1-13a8-438d-b6e4-6f239b168895/scale-to-width/755', currency: 'coins', origin: 'This enemy is from NvD, one of the most ANNOYING enemy', fact: 'I just got pissed off due to him one shot me everytime so i added this so i can sell him.' },
];

const market = [
    { name: 'Miku-Senbonzakura,version(???)', picture: 'https://media.karousell.com/media/photos/products/2024/1/27/hatsune_miku_b3007_1706379047_07e6315f_progressive.jpg', currency: 'coins', price: 62150000, origin: 'This fumo is from Senbonzakura, a Miku`s song.', fact: 'That song is a banger, try out if you havent\n-Golden' },
    { name: 'ImSorryOfficerFumo(???)', picture: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ12E41aug7Gz4o2480KbQh0VMuqeILVCzCbA&usqp=CAU', currency: 'coins', price: 54150000, origin: '', fact: '' },
    { name: 'TheOwner(TRANSCENDENT)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372439224485150750/raw.png?ex=6826c721&is=682575a1&hm=a72a009e12f63be9b10c5dba154451bc7704a54c1e68ef997c83bb2d9f9ee092&=&format=webp&quality=lossless&width=930&height=930', currency: 'coins', price: 777777777, origin: 'alterGolden or golden_exist', fact: 'I love fixing bug' },
];

// Combine all sources
const allOldFumos = [...gemFumos, ...coinFumos, ...Reimu, ...market];

// Parse name to get base name and rarity
function parseFumoName(fullName) {
    const match = fullName.match(/^(.+?)\((.+?)\)$/);
    if (match) {
        return { name: match[1], rarity: match[2] };
    }
    return { name: fullName, rarity: 'Common' };
}

function mergeFumoData() {
    console.log('🔄 Starting fumo data merge...');
    
    // Try multiple possible paths
    const possiblePaths = [
        path.join(__dirname, 'fumos.json'),
        path.join(__dirname, 'MainBOT/MainCommand/Data/fumos.json'),
        path.join(__dirname, 'MainCommand/Data/fumos.json'),
        path.join(process.cwd(), 'MainBOT/MainCommand/Data/fumos.json'),
        'D:/DiscordBOTCore/MainBOTCore/FumoBOT/MainBOT/MainCommand/Data/fumos.json'
    ];
    
    let fumoJsonPath = null;
    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            fumoJsonPath = testPath;
            console.log(`✅ Found fumos.json at: ${testPath}`);
            break;
        }
    }
    
    if (!fumoJsonPath) {
        console.error('❌ Could not find fumos.json in any expected location!');
        console.error('Please place this script in the same folder as fumos.json');
        console.error('Or update the script with the correct path.');
        return;
    }
    
    let fumoData;
    
    try {
        const rawData = fs.readFileSync(fumoJsonPath, 'utf8');
        fumoData = JSON.parse(rawData);
    } catch (error) {
        console.error('❌ Failed to load fumos.json:', error.message);
        return;
    }

    console.log(`📊 Loaded ${fumoData.fumos.length} fumos from fumos.json`);
    console.log(`📊 Found ${allOldFumos.length} fumos with additional data`);

    // Create a map for quick lookup
    const oldDataMap = new Map();
    for (const oldFumo of allOldFumos) {
        const { name, rarity } = parseFumoName(oldFumo.name);
        const key = `${name.toLowerCase()}_${rarity.toLowerCase()}`;
        oldDataMap.set(key, oldFumo);
    }

    let updatedCount = 0;
    let missingCount = 0;

    // Update each fumo in fumos.json
    for (const fumo of fumoData.fumos) {
        const key = `${fumo.name.toLowerCase()}_${fumo.rarity.toLowerCase()}`;
        const oldData = oldDataMap.get(key);

        if (oldData) {
            // Merge the data
            if (oldData.origin && !fumo.origin) {
                fumo.origin = oldData.origin;
            }
            if (oldData.fact && !fumo.fact) {
                fumo.fact = oldData.fact;
            }
            if (oldData.price && !fumo.marketPrice) {
                fumo.marketPrice = oldData.price;
            }
            // Update picture if it's missing or different
            if (oldData.picture && (!fumo.picture || fumo.picture !== oldData.picture)) {
                fumo.picture = oldData.picture;
            }
            
            updatedCount++;
            console.log(`✅ Updated: ${fumo.name}(${fumo.rarity})`);
        } else {
            missingCount++;
            console.log(`⚠️  No additional data for: ${fumo.name}(${fumo.rarity})`);
        }
    }

    // Update metadata
    fumoData.version = "1.1.0";
    fumoData.generatedAt = new Date().toISOString();
    fumoData.lastMerge = {
        timestamp: new Date().toISOString(),
        updatedFumos: updatedCount,
        missingData: missingCount
    };

    // Save updated fumos.json
    const backupPath = path.join(__dirname, `fumos.backup.${Date.now()}.json`);
    
    try {
        // Create backup
        fs.copyFileSync(fumoJsonPath, backupPath);
        console.log(`💾 Backup created: ${path.basename(backupPath)}`);
        
        // Save updated data
        fs.writeFileSync(fumoJsonPath, JSON.stringify(fumoData, null, 2), 'utf8');
        console.log(`✅ Successfully updated fumos.json`);
        
        console.log(`\n📊 Summary:`);
        console.log(`   - Total fumos: ${fumoData.fumos.length}`);
        console.log(`   - Updated with additional data: ${updatedCount}`);
        console.log(`   - Missing additional data: ${missingCount}`);
        console.log(`   - New version: ${fumoData.version}`);
        
    } catch (error) {
        console.error('❌ Failed to save updated fumos.json:', error.message);
    }
}

// Run the merge
mergeFumoData();

console.log('\n🎉 Merge complete! Your fumos.json now includes:');
console.log('   ✅ Market prices');
console.log('   ✅ Origin information');
console.log('   ✅ Fun facts');
console.log('   ✅ Updated pictures');