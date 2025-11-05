const https = require('https');
const http = require('http');

const Efumos = [
    // epic
    { name: 'Traumatized(EPIC)', rarity: 'EPIC', picture: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTO5lppyMpyRD7ABC_QLJ6-sF2DXmepDOjpgg&s' },
    { name: 'Eye-Popping(EPIC)', rarity: 'EPIC', picture: 'https://www.mugentoys.com/shop/image/cache/catalog/img/01/451391400a-500x500.jpg' },
    { name: 'AbandonedChild(EPIC)', rarity: 'EPIC', picture: 'https://ae01.alicdn.com/kf/Hcb03f9597b394d6c8b5e225623379208c/Jujutsu-Kaisen-Plush-Toys-Plushies-Doll-Yuji-Gojo-Megumi-Toge-Stuffed-Toy-Doll-Removable-Clothes-Christmas.jpg' },
    
    //legendary
    { name: 'Gambler(LEGENDARY)', rarity: 'LEGENDARY', picture: 'https://ih1.redbubble.net/image.5028045676.6139/flat,750x,075,f-pad,750x1000,f8f8f8.jpg' },
    { name: 'ExplodedMan(LEGENDARY)', rarity: 'LEGENDARY', picture: 'https://i.ebayimg.com/images/g/XeIAAOSwdTtheKuc/s-l1200.webp' },
    
    //mythical
    { name: 'MonkeyLeader(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://m.media-amazon.com/images/I/517MfPrGaRL.jpg' },
    { name: 'OneShotCurse(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://animeislandca.com/cdn/shop/files/jujutsu-kaisen-kyurumaru-mahito-big-plush-toy-anime-island-ca.png?v=1692739157&width=1445' },
    { name: 'AvoidChildSupport(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://i.ebayimg.com/images/g/d7wAAOSwtcdk2cIg/s-l1200.webp' },
    
    //???
    { name: 'Fraudkuna(???)', rarity: '???', picture: 'https://i.ebayimg.com/images/g/JEsAAOSwxOBguJZG/s-l1200.webp' },
    { name: 'Go/jo(???)', rarity: '???', picture: 'https://m.media-amazon.com/images/I/41PQuj80tDS._AC_UF894,1000_QL80_.jpg' },

    //Transcendent
    { name: 'HeianSukuna(TRANSCENDENT)', rarity: 'TRANSCENDENT', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372880397599244378/raw.png?ex=68286201&is=68271081&hm=354b51c0bb278e08cef1d63050e9e0fc41765335d37309f15298050a8fdd03da&=&format=webp&quality=lossless&width=438&height=438' },
];

// Function to check if an image URL is still valid (returns a promise)
// function checkImage(url) {
//     return new Promise((resolve) => {
//         const lib = url.startsWith('https') ? https : http;
//         const req = lib.get(url, (res) => {
//             resolve(res.statusCode === 200);
//         });
//         req.on('error', () => resolve(false));
//         req.setTimeout(5000, () => { // Timeout protection
//             req.abort();
//             resolve(false);
//         });
//     });
// }

// Loop through all Efumos and check their images
// async function checkAllImages() {
//     for (const efumo of Efumos) {
//         const isValid = await checkImage(efumo.picture);
//         if (!isValid) {
//             console.log(`❌ Image missing or broken for: ${efumo.name}`);
//         } else {
//             console.log(`✅ Image OK: ${efumo.name}`);
//         }
//     }
// }

// checkAllImages();

module.exports = Efumos; 