const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../Core/Database/db.js');
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
client.setMaxListeners(150);
function formatNumber(number) {
    return number.toLocaleString();
}
const { maintenance, developerID } = require("../../Configuration/MaintenanceConfig.js");
const { isBanned } = require('../../Administrator/BannedList/BanUtils.js');
const { format } = require('date-fns');
module.exports = (client) => {
    client.on('messageCreate', async message => {
        try {
            if (!/^\.(inform|in)(\s|$)/.test(message.content)) return;

            // Check for maintenance mode or ban
            const banData = isBanned(message.author.id);
            if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
                let description = '';
                let footerText = '';

                if (maintenance === "yes" && message.author.id !== developerID) {
                    description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
                    footerText = "Thank you for your patience";
                } else if (banData) {
                    description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

                    if (banData.expiresAt) {
                        const remaining = banData.expiresAt - Date.now();
                        const seconds = Math.floor((remaining / 1000) % 60);
                        const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                        const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

                        const timeString = [
                            days ? `${days}d` : '',
                            hours ? `${hours}h` : '',
                            minutes ? `${minutes}m` : '',
                            seconds ? `${seconds}s` : ''
                        ].filter(Boolean).join(' ');

                        description += `\n**Time Remaining:** ${timeString}`;
                    } else {
                        description += `\n**Ban Type:** Permanent`;
                    }

                    footerText = "Ban enforced by developer";
                }

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                    .setDescription(description)
                    .setFooter({ text: footerText })
                    .setTimestamp();

                console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);

                return message.reply({ embeds: [embed] });
            }

            const fumoName = message.content.split(' ').slice(1).join(' ').trim();

            if (!fumoName) {
                const tutorialEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('📘 How to Use the .inform Command')
                    .setDescription('Learn how to gather detailed information about your fumos.')
                    .addFields(
                        { name: '📌 Command Format', value: '`.inform <Fumo(Rarity)> or .in <Fumo(Rarity)>`' },
                        { name: '🔧 Parameters', value: '**<fumo name>:** The exact name of the fumo to get information about.' },
                        { name: '❗ Example', value: '`.inform Marisa(Common)`\nThis shows detailed information about the fumo named "Marisa".' }
                    )
                    .setFooter({ text: 'If you encounter any issues, please use .report' });
                return message.reply({ embeds: [tutorialEmbed] });
            }

            // --- Data Definitions (move to a separate file for maintainability) ---
            const coinBannerChances = {
                'TRANSCENDENT': '0.0000667%',
                'ETERNAL': '0.0002%',
                'INFINITE': '0.0005%',
                'CELESTIAL': '0.001111%',
                'ASTRAL': '0.003333%',
                '???': '0.006666%',
                'EXCLUSIVE': '0.02%',
                'MYTHICAL': '0.1%',
                'LEGENDARY': '0.4%',
                'OTHERWORLDLY': '1%',
                'EPIC': '6%',
                'RARE': '10%',
                'UNCOMMON': '25%',
                'Common': '57.4681233%',
            };
            const gemBannerChances = {
                'RARE': '90%',
                'EPIC': '55%',
                'LEGENDARY': '10%',
                'MYTHICAL': '0.1%',
                '???': '0.01%',
                'TRANSCENDENT': '0.0001%'
            };
            const ReimuChances = {
                'EPIC': '44.20%',
                'LEGENDARY': '19.89%',
                'OTHERWORLDLY': '14.36%',
                'MYTHICAL': '7.73%',
                'EXCLUSIVE': '5.52%',
                '???': '2.76%',
                'ASTRAL': '2.21%',
                'CELESTIAL': '1.66%',
                'INFINITE': '0.88%',
                'ETERNAL': '0.55%',
                'TRANSCENDENT': '0.22%'
            };
            const gemFumos = [
                // { name: 'SillyCirno(RARE)', picture: 'https://i.pinimg.com/236x/fe/8d/11/fe8d110352a31f344e08edfe67036735.jpg', currency: 'gems', chance: gemBannerChances['RARE'] },
                { name: 'Gambler(LEGENDARY)', picture: 'https://ih1.redbubble.net/image.5028045676.6139/flat,750x,075,f-pad,750x1000,f8f8f8.jpg', currency: 'gems', chance: gemBannerChances['LEGENDARY'] },
                // { name: 'Junko,realperson(LEGENDARY)', picture: 'https://i.kym-cdn.com/photos/images/original/002/627/802/ffd', currency: 'gems', chance: gemBannerChances['LEGENDARY'], origin: 'Hakari from Jujutsu Kaisen', fact: '99% Gambler quit before they hit their big win' },
                { name: 'Go/jo(???)', picture: 'https://m.media-amazon.com/images/I/41PQuj80tDS._AC_UF894,1000_QL80_.jpg', currency: 'gems', chance: gemBannerChances['???'], origin: 'The strongest sorcerer of Today in Jujutsu Kaisen', fact: 'Kitkat' },
                // { name: 'LuckySanae(EPIC)', rarity: 'EPIC', picture: 'https://i.pinimg.com/736x/78/d8/61/78d861457b9ad338ef157142551ec3ba.jpg', currency: 'gems', chance: gemBannerChances['EPIC'] },
                // { name: 'BathRan(LEGENDARY)', rarity: 'LEGENDARY', picture: 'https://scontent.fhan7-1.fna.fbcdn.net/v/t39.30808-6/397275313_749739983864527_4920842130954587032_n.jpg?stp=dst-jpg_s960x960&_nc_cat=107&ccb=1-7&_nc_sid=5f2048&_nc_ohc=UYrRNVZLeOMAX-G8SH_&_nc_ht=scontent.fhan7-1.fna&oh=00_AfBfKnXa01CGf7f4Fydn0Unq2SFQvsSVpovDl5A8ce23Qg&oe=65F324C1', currency: 'gems', chance: gemBannerChances['LEGENDARY'] },
                // { name: 'CupOfRemilia(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/9ed6e931-7c20-492f-a096-d1928aecb5d4/dgcaplg-dbaee1f3-582f-4cc5-8eda-8b00d9c722db.png/v1/fit/w_375,h_494,q_70,strp/remilia_cup_fumo_by_pierrelucstl_dgcaplg-375w.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NTg1IiwicGF0aCI6IlwvZlwvOWVkNmU5MzEtN2MyMC00OTJmLWEwOTYtZDE5MjhhZWNiNWQ0XC9kZ2NhcGxnLWRiYWVlMWYzLTU4MmYtNGNjNS04ZWRhLThiMDBkOWM3MjJkYi5wbmciLCJ3aWR0aCI6Ijw9NDQ0In1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmltYWdlLm9wZXJhdGlvbnMiXX0.pVeJgMS8L-cE-nwfEVelXqwHwnmFpRYLruswVwrtjy4', currency: 'gems', chance: gemBannerChances['MYTHICAL'] },
                { name: 'Fraudkuna(???)', rarity: '???', picture: 'https://i.ebayimg.com/images/g/JEsAAOSwxOBguJZG/s-l1200.webp', currency: 'gems', chance: gemBannerChances['???'], origin: 'The strongest sorcerer of HISTORY in Jujutsu Kaisen', fact: 'Lame ahh death' },
                // { name: 'YaeMiko(MYTHICAL)', picture: 'https://media.karousell.com/media/photos/products/2022/10/25/genshin_impact_yae_miko_guuji__1666692285_f1995720_progressive', currency: 'gems', chance: gemBannerChances['MYTHICAL'] },
                { name: 'Traumatized(EPIC)', rarity: 'EPIC', picture: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTO5lppyMpyRD7ABC_QLJ6-sF2DXmepDOjpgg&s', currency: 'gems', chance: gemBannerChances['EPIC'], origin: 'Yuji Itadori from Jujutsu Kaisen', fact: 'Did you know, Itadori was meant to be a side character, yuta was the main character. Until Gege think again.' },
                { name: 'Eye-Popping(EPIC)', rarity: 'EPIC', picture: 'https://www.mugentoys.com/shop/image/cache/catalog/img/01/451391400a-500x500.jpg', currency: 'gems', chance: gemBannerChances['EPIC'], origin: 'Nobara from Jujutsu Kaisen', fact: 'She came back...As a MVP' },
                { name: 'AbandonedChild(EPIC)', rarity: 'EPIC', picture: 'https://ae01.alicdn.com/kf/Hcb03f9597b394d6c8b5e225623379208c/Jujutsu-Kaisen-Plush-Toys-Plushies-Doll-Yuji-Gojo-Megumi-Toge-Stuffed-Toy-Doll-Removable-Clothes-Christmas.jpg', currency: 'gems', chance: gemBannerChances['EPIC'] },
                { name: 'MonkeyLeader(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://m.media-amazon.com/images/I/517MfPrGaRL.jpg', currency: 'gems', chance: gemBannerChances['MYTHICAL'] },
                { name: 'OneShotCurse(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://animeislandca.com/cdn/shop/files/jujutsu-kaisen-kyurumaru-mahito-big-plush-toy-anime-island-ca.png?v=1692739157&width=1445', currency: 'gems', chance: gemBannerChances['MYTHICAL'], origin: 'The villain thats everyone hate in Jujutsu Kaisen', fact: 'Dont let me touch you ahh skill-set' },
                { name: 'AvoidChildSupport(MYTHICAL)', rarity: 'MYTHICAL', picture: 'https://i.ebayimg.com/images/g/d7wAAOSwtcdk2cIg/s-l1200.webp', currency: 'gems', chance: gemBannerChances['MYTHICAL'], origin: 'The strongest child support avoider of today in Jujutsu Kaisen', fact: 'Apple Logo' },
                { name: 'ExplodedMan(LEGENDARY)', rarity: 'LEGENDARY', picture: 'https://i.ebayimg.com/images/g/XeIAAOSwdTtheKuc/s-l1200.webp', currency: 'gems', chance: gemBannerChances['LEGENDARY'], origin: 'Chill blone guy in Jujutsu Kaisen', fact: 'And he does not deserved that' },
                { name: 'HeianSukuna(TRANSCENDENT)', rarity: 'TRANSCENDENT', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372880397599244378/raw.png?ex=68286201&is=68271081&hm=354b51c0bb278e08cef1d63050e9e0fc41765335d37309f15298050a8fdd03da&=&format=webp&quality=lossless&width=438&height=438', currency: 'gems', chance: gemBannerChances['TRANSCENDENT'], origin: 'The strongest sorcerer of all time in Jujutsu Kaisen', fact: 'He is the one who created the curse technique' },
            ];
            const coinFumos = [
                { name: 'Reimu(Common)', picture: 'https://i.imgur.com/AGQm5nR.jpeg', currency: 'coins', chance: coinBannerChances['Common'] },
                { name: 'Marisa(Common)', picture: 'https://i.imgur.com/DQFXnHT.jpeg', currency: 'coins', chance: coinBannerChances['Common'] },
                { name: 'Cirno(Common)', picture: 'https://i.imgur.com/zM7kUaq.jpeg', currency: 'coins', chance: coinBannerChances['Common'] },
                { name: 'BlueReimu(EXCLUSIVE)', picture: 'https://i.imgur.com/n6LCPHS.png', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                { name: 'RedMarisa(EXCLUSIVE)', picture: 'https://i.imgur.com/yoeKCEb.png', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                { name: 'Remilia(RARE)', picture: 'https://m.media-amazon.com/images/I/51J89dEWxSL._AC_SL1200_.jpg', currency: 'coins', chance: coinBannerChances['RARE'] },
                { name: 'Flandere(LEGENDARY)', picture: 'https://i.imgur.com/q7f9gh2.png', currency: 'coins', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                { name: 'Sakuya(UNCOMMON)', picture: 'https://i.imgur.com/F3gmWW5.png', currency: 'coins', chance: coinBannerChances['UNCOMMON'] },
                { name: 'Meiling(UNCOMMON)', picture: 'https://i.imgur.com/zwEcy1J.png', currency: 'coins', chance: coinBannerChances['UNCOMMON'] },
                { name: 'Junko(MYTHICAL)', picture: 'https://m.media-amazon.com/images/I/41gFcESKY3L.jpg', currency: 'coins', chance: coinBannerChances['MYTHICAL'] },
                { name: 'Yukari(LEGENDARY)', picture: 'https://i.imgur.com/5X6wQ3g.jpeg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                { name: 'Sanae(Common)', picture: 'https://m.media-amazon.com/images/I/61+FZ2SklRL._AC_UF894,1000_QL80_.jpg', currency: 'coins', chance: coinBannerChances['Common'] },
                { name: 'SkibidiToilet(???)', picture: 'https://i.imgur.com/pOZ9Sdf.png', currency: 'coins', chance: coinBannerChances['???'] },
                { name: 'GawrGura(???)', picture: 'https://pbs.twimg.com/media/FNjhm89X0AEtPcU.jpg', currency: 'coins', chance: coinBannerChances['???'] },
                { name: 'Youmu(RARE)', picture: 'https://m.media-amazon.com/images/I/515nP-iA6RL.jpg', currency: 'coins', chance: coinBannerChances['RARE'] },
                { name: 'Yuyuko(LEGENDARY)', picture: 'https://m.media-amazon.com/images/I/515DN59NQXL._AC_UF894,1000_QL80_.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Komachi(RARE)', picture: 'https://i.imgur.com/0CItfah.png', currency: 'coins', chance: coinBannerChances['RARE'] },
                // { name: 'Eiki(LEGENDARY)', picture: 'https://i.imgur.com/0e6Ztnc.png', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                { name: 'Patchouli(UNCOMMON)', picture: 'https://fumo.website/img/492.jpg', currency: 'coins', chance: coinBannerChances['UNCOMMON'] },
                // { name: 'Suwako(LEGENDARY)', picture: 'https://fumo.website/img/015.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                { name: 'DarkYoumu(EXCLUSIVE)', picture: 'https://fumo.website/img/918.jpg', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                // { name: 'Chen(RARE)', picture: 'https://fumo.website/img/523.jpg', currency: 'coins', chance: coinBannerChances['RARE'] },
                { name: 'Ran(EPIC)', picture: 'https://fumo.website/img/524.jpg', currency: 'coins', chance: coinBannerChances['EPIC'] },
                // { name: 'Kaguya(LEGENDARY)', picture: 'https://fumo.website/img/138.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Mokou(LEGENDARY)', picture: 'https://fumo.website/img/139.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                { name: 'Satori(EPIC)', picture: 'https://fumo.website/img/820.jpg', currency: 'coins', chance: coinBannerChances['EPIC'] },
                // { name: 'Koishi(LEGENDARY)', picture: 'https://fumo.website/img/821.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Reisen(Common)', picture: 'https://fumo.website/img/424.jpg', currency: 'coins', chance: coinBannerChances['UNCOMMON'] },
                // { name: 'Tewi(Common)', picture: 'https://fumo.website/img/237.jpg', currency: 'coins', chance: coinBannerChances['Common'] },
                // { name: 'Kokoro(RARE)', picture: 'https://fumo.website/img/310.jpg', currency: 'coins', chance: coinBannerChances['RARE'] },
                { name: 'Kasen(EPIC)', picture: 'https://fumo.website/img/454.jpg', currency: 'coins', chance: coinBannerChances['EPIC'] },
                // { name: 'Hatate(RARE)', picture: 'https://fumo.website/img/494.jpg', currency: 'coins', chance: coinBannerChances['RARE'] },
                // { name: 'Aya(EPIC)', picture: 'https://fumo.website/img/493.jpg', currency: 'coins', chance: coinBannerChances['EPIC'] },
                { name: 'Tenshi(MYTHICAL)', picture: 'https://fumo.website/img/593.jpg', currency: 'coins', chance: coinBannerChances['MYTHICAL'] },
                // { name: 'Shion(Common)', picture: 'https://fumo.website/img/644.jpg', currency: 'coins', chance: coinBannerChances['Common'] },
                { name: 'Yuuka(MYTHICAL)', picture: 'https://fumo.website/img/685.jpg', currency: 'coins', chance: coinBannerChances['MYTHICAL'] },
                // { name: 'Momiji(UNCOMMON)', picture: 'https://fumo.website/img/773.jpg', currency: 'coins', chance: coinBannerChances['UNCOMMON'] },
                { name: 'Eirin(MYTHICAL)', picture: 'https://fumo.website/img/807.jpg', currency: 'coins', chance: coinBannerChances['MYTHICAL'] },
                // { name: 'Rumia(UNCOMMON)', picture: 'https://fumo.website/img/834.jpg', currency: 'coins', chance: coinBannerChances['UNCOMMON'] },
                // { name: 'Nitori(RARE)', picture: 'https://fumo.website/img/836.jpg', currency: 'coins', chance: coinBannerChances['RARE'] },
                // { name: 'Joon(EPIC)', picture: 'https://fumo.website/img/837.jpg', currency: 'coins', chance: coinBannerChances['EPIC'] },
                // { name: 'Renko(Common)', picture: 'https://fumo.website/img/899.jpg', currency: 'coins', chance: coinBannerChances['Common'] },
                // { name: 'Miko(EPIC)', picture: 'https://fumo.website/img/900.jpg', currency: 'coins', chance: coinBannerChances['EPIC'] },
                // { name: 'Koakuma(UNCOMMON)', picture: 'https://pbs.twimg.com/media/FGwYmI_VIAYjQUX.png', currency: 'coins', chance: coinBannerChances['UNCOMMON'] },
                // { name: 'Suika(LEGENDARY)', picture: 'https://img.amiami.com/images/product/main/232/GOODS-04347171.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Okina(MYTHICAL)', picture: 'https://ih1.redbubble.net/image.2942665500.5787/flat,750x,075,f-pad,750x1000,f8f8f8.u2.jpg', currency: 'coins', chance: coinBannerChances['MYTHICAL'] },
                // { name: 'Byakuren(LEGENDARY)', picture: 'https://images-ng.pixai.art/images/orig/9dd36cd2-0d00-405e-9a0b-fb3f038f036f', currency: 'coins' },
                // { name: 'Doremy(EPIC)', picture: 'https://pbs.twimg.com/media/EwupbULXAAQ2HSk.jpg:large', currency: 'coins', chance: coinBannerChances['EPIC'] },
                // { name: 'Kanako(LEGENDARY)', picture: 'https://i.pinimg.com/originals/95/91/f2/9591f24dda0b16fd0b742ec0d6289875.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Keine(EPIC)', picture: 'https://pbs.twimg.com/media/EVQhXQMU0AAGlR6.jpg', currency: 'coins', chance: coinBannerChances['EPIC'] },
                // { name: 'Iku(LEGENDARY)', picture: 'https://pbs.twimg.com/media/FH5fBfrUUAAJbQ_.jpg:large', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Momoyi(MYTHICAL)', picture: 'https://pbs.twimg.com/media/E02izy7X0AETpeQ?format=jpg&name=4096x4096', currency: 'coins', chance: coinBannerChances['MYTHICAL'] },
                // { name: 'Urumi(LEGENDARY)', picture: 'https://pbs.twimg.com/media/D8LreeNU0AA4MVj.jpg:large', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Kogasa(EPIC)', picture: 'https://pbs.twimg.com/media/DzPQndbU8AATi09?format=jpg&name=large', currency: 'coins', chance: coinBannerChances['EPIC'] },
                // { name: 'Keiki(LEGENDARY)', picture: 'https://i.ebayimg.com/images/g/ki4AAOSw4GdjWNMQ/s-l1600.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Utsuho(LEGENDARY)', picture: 'https://cdn.donmai.us/original/39/0b/390bab435fac9fd2b17bb9bf99766567.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Sagume(LEGENDARY)', picture: 'https://i.ebayimg.com/images/g/B~oAAOSwqpBlgVfQ/s-l1200.jpg', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                { name: 'TankReisen(OTHERWORLDLY)', picture: 'https://i.ytimg.com/vi/45czjxFVlh4/maxresdefault.jpg', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                // { name: 'Texas(OTHERWORLDLY)', picture: 'https://pbs.twimg.com/media/FTABmb-VEAIEyhP.jpg', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                //start from 3/9/2024
                // { name: 'Xinyan(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2022/04/17/87506230/24e001ebc9d3b3ea4686f7706b47bf15_2247610847522308088.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                // { name: 'Aether(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2022/04/17/87506230/bcc79551023b2521b1bce6031cefd308_992408365969996096.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                // { name: 'Zhongli(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2022/04/17/87506230/a27398144efa5dec75d0b5355ee6256f_9128781543375233341.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                // { name: 'Amber(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2021/08/05/87506230/5df70c579f600e8599a714e4938ba021_3526443551709464553.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                // { name: 'Rosaria(OTHERWORLDLY)', picture: 'https://upload-os-bbs.hoyolab.com/upload/2021/08/05/87506230/cfc4bf8528b81b83e093b6e4819766fc_6418692249356840816.jpg?x-oss-process=image%2Fresize%2Cs_1000%2Fauto-orient%2C0%2Finterlace%2C1%2Fformat%2Cwebp%2Fquality%2Cq_80', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                // { name: 'May(OTHERWORLDLY)', picture: 'https://pics.craiyon.com/2023-09-17/11697f223bfe40a39ce7681967e12777.webp', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                // { name: 'Oirin(LEGENDARY)', picture: 'https://pbs.twimg.com/media/E-jDFYpVIAMqXeQ.png', currency: 'coins', chance: coinBannerChances['LEGENDARY'] },
                // { name: 'Monika(OTHERWORLDLY)', picture: 'https://pbs.twimg.com/media/E-AxiXhXEAIRrJj.png', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                // { name: 'TheDualFumo(MYTHICAL)', picture: 'https://cdnb.artstation.com/p/assets/images/images/059/270/433/large/alphalilly-fumo.jpg?1675999566', currency: 'coins', chance: coinBannerChances['MYTHICAL'] },
                { name: 'Bocchi(OTHERWORLDLY)', picture: 'https://i.kym-cdn.com/photos/images/original/002/627/704/46f', currency: 'coins', chance: coinBannerChances['OTHERWORLDLY'] },
                // Add the new fumos here...
                { name: 'CirnoSitting(EXCLUSIVE)', picture: 'https://art.ngfiles.com/images/2071000/2071347_elperez678_cirno-fumo.jpg?f1631463942', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                { name: 'HyperSakuya(EXCLUSIVE)', picture: 'https://th.bing.com/th/id/OIP.RjaoWcmyjdWdbQ7GOaUN2wAAAA?cb=iwp2&rs=1&pid=ImgDetMain', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                // { name: 'MarketableHutao(???)', picture: 'https://i.ebayimg.com/images/g/LT8AAOSwdq5i54Bi/s-l1200.webp', currency: 'coins', chance: coinBannerChances['???'] },
                // { name: 'Gebura(???)', picture: 'https://pbs.twimg.com/media/EyZRl6HVgAIpex6?format=jpg&name=4096x4096', currency: 'coins', chance: coinBannerChances['???'] },
                // { name: 'Furina(EXCLUSIVE)', picture: 'https://pbs.twimg.com/media/GCCyCqzbkAA2tXM.jpg:large', currency: 'coins', chance: coinBannerChances['???'] },
                // { name: 'HyperFlandere(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1208372690453405696/1217154158684274859/images.jpg?ex=6602fe25&is=65f08925&hm=c0cb577277e9cf227fbd2fd9b2d38db11c1444d0889a6a76b62d7edaef750d67&', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                // { name: 'HyperYoumu(EXCLUSIVE)', picture: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRx_u49-DjYYAkgZVETPiTWKreyTapJPa-Mbg&usqp=CAU', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                { name: 'Mima(INFINITE)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372428382263967824/svru2t354ix81.png?ex=6826bd08&is=68256b88&hm=9ff0e6a614af9fee9626a549a57b331e4940ade36f9de38472dbcb452d965d97&=&format=webp&quality=lossless&width=698&height=930', currency: 'coins', chance: coinBannerChances['INFINITE'] },
                { name: 'Athena(ASTRAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372426818594017311/OIP.png?ex=6826bb94&is=68256a14&hm=eb47a890b02dc810beefb84938f01c70b98522c1fe3c4a2ccb96de9293da28ac&=&format=webp&quality=lossless&width=309&height=309', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                // { name: 'Ishmael(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218075291742638110/IMG_3338.webp?ex=66065804&is=65f3e304&hm=e3eb7174d97b523192942e6e3576e55ebb486f2fb3f9a47200dbd319837d0f43&', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                // { name: 'TheClaw-LoR(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218075793826250772/IMG_3339.png?ex=6606587c&is=65f3e37c&hm=b364cc9a2d0142e0f4717477055a32e92ebf047b80497d4267f8466ab9baace5&', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                // { name: 'UltraKillV1(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218077015434067988/IMG_3341.jpg?ex=6606599f&is=65f3e49f&hm=b0fc465d9fdf70d43aef5463ba8e5d81b4d89c508dfaef385d70901903f4bab3&', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                { name: 'UltraKillV2(ETERNAL)', picture: 'https://th.bing.com/th/id/OIP.0rsVamUgjh_eW_1Ep5NDfAAAAA?cb=iwp2&rs=1&pid=ImgDetMain', currency: 'coins', chance: coinBannerChances['ETERNAL'] },
                { name: 'Mostima(CELESTIAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372427631877685389/mostima-fumo-mostimo-v0-httirpx8ghhb1.png?ex=6826bc55&is=68256ad5&hm=e9511d6de0f908e22eedeb4ab965753e76446ed39a3bdb9ac4af7ef099c62dd6&=&format=webp&quality=lossless&width=1429&height=800', currency: 'coins', chance: coinBannerChances['CELESTIAL'] },
                { name: 'Grani(CELESTIAL)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372427631877685389/mostima-fumo-mostimo-v0-httirpx8ghhb1.png?ex=6826bc55&is=68256ad5&hm=e9511d6de0f908e22eedeb4ab965753e76446ed39a3bdb9ac4af7ef099c62dd6&=&format=webp&quality=lossless&width=1429&height=800', currency: 'coins', chance: coinBannerChances['CELESTIAL'] },
                // { name: 'Penance(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218078331619246120/IMG_3344.jpg?ex=66065ad9&is=65f3e5d9&hm=a09e73c995ed37981a79a264b7a6fc2470ac328806597f95e38b189e7af6f3fc&', currency: 'coins', chance: coinBannerChances['???'] },
                { name: 'Arisu(TRANSCENDENT)', picture: 'https://www.picclickimg.com/I70AAOSwPVJmW9NO/Blue-Archive-Tendou-Arisu-Fumo-Fumo-Plushie-Plush.webp', currency: 'coins', chance: coinBannerChances['TRANSCENDENT'] },
                // { name: 'Shiroko(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218080408785391706/IMG_3347.jpg?ex=66065cc8&is=65f3e7c8&hm=a5a696751713ffbc57708fedbc3a68bcf8323995b929c39cc6ffb276cf1f5268&', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                // { name: 'Amiya(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218080466083774494/IMG_3346.jpg?ex=66065cd5&is=65f3e7d5&hm=447ceaedbc113fd23c51606313a14d4a9f5f453bd4e1aa9323c9997156706120&', currency: 'coins', chance: coinBannerChances['EXCLUSIVE'] },
                // { name: 'FrostNova(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218080520974503986/IMG_3345.jpg?ex=66065ce3&is=65f3e7e3&hm=27d76dc09ce43f0ce6738407f8e58a261bf7ef1eef16cfdae41acc505ca1ada1&', currency: 'coins', chance: coinBannerChances['???'] },
                // { name: 'Serika(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218081151474995300/IMG_3349.jpg?ex=66065d79&is=65f3e879&hm=d7559fe3b4e2dc39ebc4d42f34baded407126e7aea49ac8690f15d2bdda228bc&', currency: 'coins', chance: coinBannerChances['???'] },
                // { name: 'MarketableMaomao(TRANSCENDENT)', picture: 'https://images.goodsmile.info/cgm/images/product/20231025/15132/122650/large/7bc971d1e918654bd78e093215dda3cc.jpg', currency: 'coins', chance: coinBannerChances['TRANSCENDENT'] },
                // { name: 'MarketableJinshi(TRANSCENDENT)', picture: 'https://images.goodsmile.info/cgm/images/product/20231025/15132/122652/large/ef54cd26eb2fd463dc776d7fa2dad88a.jpg', currency: 'coins', chance: coinBannerChances['TRANSCENDENT'] },
                // { name: 'TheBugAbuser(ETERNAL)', picture: 'https://tr.rbxcdn.com/30DAY-Avatar-1C21F96ABAF199046D71EA79C561CB08-Png/352/352/Avatar/Png/noFilter', currency: 'coins', chance: coinBannerChances['ETERNAL'], origin: 'ho_suh', fact: 'I love abusing bug!' },
                //new fumo for day 3/16/2024
                // { name: 'TheIntrovertedOne(ETERNAL)', picture: 'https://tr.rbxcdn.com/30DAY-Avatar-13A0AAC41294429047B449246908AE22-Png/352/352/Avatar/Png/noFilter', currency: 'coins', chance: coinBannerChances['ETERNAL'], origin: 'normalguy', fact: 'He never gonna be talkactive :(' },
                // { name: 'TheGermanMan-BoboVer(ETERNAL)', picture: 'https://tr.rbxcdn.com/30DAY-Avatar-99FDC68F08F7295E041D7C008C9962AD-Png/352/352/Avatar/Png/noFilter', currency: 'coins', chance: coinBannerChances['ETERNAL'], origin: 'bob', fact: 'RAP BATTLE, BOB VERSUS DARTH VADER, BEGIN!' },
                { name: 'Rinnosuke(TRANSCENDENT)', picture: 'https://img1.picmix.com/output/stamp/normal/6/1/0/7/2577016_a2c58.png', currency: 'coins', chance: coinBannerChances['TRANSCENDENT'] },
                // { name: 'Yukari-RinnosukeVer(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114282613637201/IMG_4145.jpg?ex=66067c54&is=65f40754&hm=95a07fce7fbbd0bcd2a7989896e7e3e282fbaeb4fe35092763741ddd64d31d60&', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                // { name: 'Patchouli-RinnosukeVer(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114282957574154/IMG_4146.jpg?ex=66067c54&is=65f40754&hm=f5a9e37b2684dbf298a54a48dd8fe3ed4fb119cc7d41745f0e077b6e141aa6f8&', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                // { name: 'LilyWhite(Common)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114283431526441/IMG_4147.jpg?ex=66067c54&is=65f40754&hm=0ed0007d183d77c3eecc349d85d3981d0764d5100cc45688fadceabc1bbd073f&', currency: 'coins', chance: coinBannerChances['Common'] },
                // { name: 'Flandere-VampirePursingTheHunter(ETERNAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114283708088360/IMG_4148.png?ex=66067c54&is=65f40754&hm=e9e448783f69ed5e4ad199b39da58f447f59be7d84761b738f8d04cd8b284355&', currency: 'coins', chance: coinBannerChances['ETERNAL'] },
                // { name: 'Remilia-TinyDevilMansion(ETERNAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114284111003648/IMG_4149.png?ex=66067c54&is=65f40754&hm=532c341906b2dbd1e0ff77580fed3a1e534408e32432c7cd17d33054194f6de5&', currency: 'coins', chance: coinBannerChances['ETERNAL'] },
                // { name: 'PC-98Reimu(INFINITE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114284563992586/IMG_4150.png?ex=66067c54&is=65f40754&hm=643958f8ab4aa305569c3c3edd54ff4e150c181ee0cacda23ddc420680da60dd&', currency: 'coins', chance: coinBannerChances['INFINITE'] },
                // { name: 'PC-98Marisa(INFINITE)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114284828229662/IMG_4151.png?ex=66067c54&is=65f40754&hm=859b40662122d9ca25c8878b0cc7bc6df58843444d9ac7bd91227b4d447c776a&', currency: 'coins', chance: coinBannerChances['INFINITE'] },
                // { name: 'PlushieFlandere?-TouhouLostwordVer(ETERNAL)', picture: '', currency: 'coins', chance: coinBannerChances['ETERNAL'] },
                // { name: 'Kosuzu(Common)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114285125763092/IMG_4152.png?ex=66067c55&is=65f40755&hm=6cc270031a733b57d14e227af7687c3a2158b718ab61bf61fe8f6b8bd1e791ca&', currency: 'coins', chance: coinBannerChances['Common'] },
                // { name: 'Akyuu(Common)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114326561558578/IMG_4154.jpg?ex=66067c5e&is=65f4075e&hm=b578d7bfeb3b468d6ec2b57c74d0a683b0f4f67f41d5371372d7192d258d55a0&', currency: 'coins', chance: coinBannerChances['Common'] },
                // { name: 'WarCrimeReimu(???)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114326855028816/IMG_4155.png?ex=66067c5e&is=65f4075e&hm=5aacead2e224603f9a0a3ccd3713e1c47cd19749324ee0a44a59a8d69457b414&', currency: 'coins', chance: coinBannerChances['???'] },
                // { name: 'Noshiro(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114327110750208/IMG_4156.jpg?ex=66067c5f&is=65f4075f&hm=d82bb8a68cc8c164c34633d2c90b11c12ada4ab9238422e0326b739234f31576&', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                // { name: 'Shinano(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114327354282114/IMG_4157.jpg?ex=66067c5f&is=65f4075f&hm=3eedd5a3dee8312e838cbf16101d5916b1acccbe158ecd224bc4c480ee111de3&', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                // { name: 'LeMalin(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114327618392115/IMG_4158.jpg?ex=66067c5f&is=65f4075f&hm=a68adab556fdf8688a8723b44bc602f77e6c3a7decc1d4bf24e83016a4e94a50&', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                // { name: 'Formidable(ASTRAL)', picture: 'https://cdn.discordapp.com/attachments/1218071817202307082/1218114327882502164/IMG_4159.jpg?ex=66067c5f&is=65f4075f&hm=94fb0984b5b719635de0a2e33c453df121c0e3f6b78c132af58869f25cede6e7&', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                { name: 'Cheshire(ASTRAL)', picture: 'https://images.tokopedia.net/img/cache/500-square/VqbcmM/2024/2/25/932b310d-4256-42bc-abf7-c7d83869ee0c.jpg', currency: 'coins', chance: coinBannerChances['ASTRAL'] },
                // { name: 'Sans(INFINITE)', picture: 'https://pm1.aminoapps.com/8732/54ec9083116a05b338676ac91f64f9d9db490bd7r1-1478-1536v2_hq.jpg', currency: 'coins', chance: coinBannerChances['INFINITE'], origin: 'Sans from UNDERTALE, a game by Toby Fox', fact: 'Nice boss theme!' }
            ];
            const Reimu = [
                { name: 'Miku(???)', picture: 'https://pbs.twimg.com/media/F-7Re-BWYAEJ6Zx?format=jpg&name=large', chance: ReimuChances['???'], currency: 'coins', origin: 'One of the most popular vocaloid, and still for now', fact: 'Miku miku beam' },
                { name: 'Rin(???)', picture: 'https://pics.craiyon.com/2023-09-09/877b164806f6483192cb6a19d648ff97.webp', chance: ReimuChances['???'], currency: 'coins', origin: 'One of the most popular vocaloid, just behind Miku? Perhaps', fact: 'Electric Angel is a nice song!' },
                { name: 'Faruzamn(OTHERWORLDLY)', picture: 'https://image.tensorartassets.com/cdn-cgi/image/w=500,q=85/model_showcase/601734324150123536/151af48b-fa47-0325-04ae-51d091a3e727.png', chance: ReimuChances['OTHERWORLDLY'], currency: 'coins' },
                // { name: 'GamingReimu(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1208372690453405696/1217157994802970765/a0f.jpg?ex=660301b7&is=65f08cb7&hm=f0a6bd8100eafaf3f0cdd819999555a2e993320cafc3e073014038500572ba6c&', chance: ReimuChances['EXCLUSIVE'], currency: 'coins', origin: 'Reimu when she get into gaming', fact: 'Probably one of the toxic gamer' },
                // { name: 'MarketableDon(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1208372690453405696/1217157820537901056/Screenshot_2024-03-13-00-10-31-11_40deb401b9ffe8e1df2f1cc5ba480b12.jpg?ex=6603018e&is=65f08c8e&hm=c91b51e3f8a68591416afaf19bd49e3bee28b16f65d45a059bff7aba7fe29ac4&', chance: ReimuChances['EXCLUSIVE'], currency: 'coins' },
                // { name: 'MarketableBobo(EXCLUSIVE)', picture: 'https://cdn.discordapp.com/attachments/1208372690453405696/1217154877239722015/Screenshot_2024-03-12-23-58-43-92_9f82565f1cce6b03acbe3170c44848fb.jpg?ex=6602fed0&is=65f089d0&hm=dd1e8b29ae858d77cf2d1505a835dc95f1b22356dabc8eeaf78350d674f8408f&', chance: ReimuChances['EXCLUSIVE'], currency: 'coins', origin: 'Used to be popular, now turned to markettable fumo', fact: 'Cool' },
                { name: 'Cloaker(OTHERWORLDLY)', picture: 'https://static.wikia.nocookie.net/ce1e73b1-13a8-438d-b6e4-6f239b168895/scale-to-width/755', chance: ReimuChances['OTHERWORLDLY'], currency: 'coins', origin: 'This enemy is from NvD, one of the most ANNOYING enemy', fact: 'I just got pissed off due to him one shot me everytime so i added this so i can sell him.' },
            ];
            const market = [
                { name: 'Miku-Senbonzakura,version(???)', picture: 'https://media.karousell.com/media/photos/products/2024/1/27/hatsune_miku_b3007_1706379047_07e6315f_progressive.jpg', currency: 'coins', price: 62150000, origin: 'This fumo is from Senbonzakura, a Miku`s song.', fact: 'That song is a banger, try out if you havent\n-Golden' },
                { name: 'ImSorryOfficerFumo(???)', picture: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ12E41aug7Gz4o2480KbQh0VMuqeILVCzCbA&usqp=CAU', currency: 'coins', price: 54150000, origin: '', fact: '' },
                { name: 'TheOwner(TRANSCENDENT)', picture: 'https://media.discordapp.net/attachments/1372426801472737280/1372439224485150750/raw.png?ex=6826c721&is=682575a1&hm=a72a009e12f63be9b10c5dba154451bc7704a54c1e68ef997c83bb2d9f9ee092&=&format=webp&quality=lossless&width=930&height=930', currency: 'coins', price: 777777777, origin: 'alterGolden or golden_exist', fact: 'I love fixing bug' },
            ];
            // ... (keep your coinBannerChances, gemBannerChances, ReimuChances, gemFumos, coinFumos, Reimu, market as is) ...

            // Assign summonPlace for each fumo
            [...Reimu, ...market].forEach(fumo => fumo.summonPlace = fumo.summonPlace || (market.includes(fumo) ? 'Market' : 'Reimus Prayer'));
            coinFumos.forEach(fumo => fumo.summonPlace = 'Coins Banner');
            gemFumos.forEach(fumo => fumo.summonPlace = 'Gems Banner');

            // --- Variant Detection ---
            let isShiny = false, isAlg = false;
            let normalizedFumoName = fumoName;

            if (/\[✨SHINY\]$/i.test(normalizedFumoName) || /^shiny\s+/i.test(normalizedFumoName)) {
                isShiny = true;
                normalizedFumoName = normalizedFumoName.replace(/\[✨SHINY\]$/i, '').replace(/^shiny\s+/i, '').trim();
            }
            if (/\[🌟alG\]$/i.test(normalizedFumoName) || /^alg\s+/i.test(normalizedFumoName)) {
                isAlg = true;
                normalizedFumoName = normalizedFumoName.replace(/\[🌟alG\]$/i, '').replace(/^alg\s+/i, '').trim();
            }
            normalizedFumoName = normalizedFumoName.replace(/\s+/g, ' ').trim();

            // --- Fumo Lookup ---
            const fumos = [...gemFumos, ...coinFumos, ...Reimu, ...market];
            const fumo = fumos.find(f => f.name.toLowerCase() === normalizedFumoName.toLowerCase());

            if (!fumo) {
                return message.reply({
                    content: "I think you just typed nothing or you just typed a non-existent fumo, well that's okay! Please re-type again, or contact support if there is any problem using /report"
                });
            }

            // --- Variant Handling ---
            let variantTag = '';
            let fullFumoName = fumo.name;
            let rarityModifier = 1;
            if (isShiny) {
                variantTag = '[✨SHINY]';
                fullFumoName += variantTag;
                rarityModifier = 1 / 100;
            } else if (isAlg) {
                variantTag = '[🌟alG]';
                fullFumoName += variantTag;
                rarityModifier = 1 / 100000;
            }

            // --- Database Queries ---
            db.get('SELECT COUNT(*) as totalCount FROM userInventory WHERE fumoName = ?', [fullFumoName], (err, totalRow) => {
                if (err) {
                    console.error(`[inform] DB error (totalCount):`, err);
                    return message.reply({ content: 'An error occurred while fetching the fumo data.' });
                }

                db.all('SELECT dateObtained FROM userInventory WHERE userId = ? AND fumoName = ? ORDER BY dateObtained', [message.author.id, fullFumoName], (err, rows) => {
                    if (err) {
                        console.error(`[inform] DB error (userInventory):`, err);
                        return message.reply({ content: 'An error occurred while fetching your inventory.' });
                    }

                    let firstFumoDate = rows.length > 0 && rows[0].dateObtained ? format(new Date(rows[0].dateObtained), 'PPPppp') : 'N/A';
                    let titleSuffix = isShiny ? ' - [✨SHINY] Variant' : isAlg ? ' - [🌟alG] Variant' : '';

                    // --- Embed Construction ---
                    const embed = new EmbedBuilder()
                        .setTitle(`Fumo Information: ${fumo.name}${titleSuffix}`)
                        .setColor('#0099ff')
                        .setImage(fumo.picture);

                    if (fumo.origin) embed.addFields({ name: 'Origin', value: fumo.origin, inline: true });
                    if (fumo.fact) embed.addFields({ name: 'Interesting Fact', value: fumo.fact, inline: true });

                    let description = '';
                    if (rows.length === 0) {
                        description += `❌ You currently don't own this fumo.\n`;
                    } else {
                        description += `🎉 You are the proud owner of ${rows.length} of this fumo. ✅\n`;
                    }
                    description += `🌐 Currently, there are ${formatNumber(totalRow.totalCount)} of this fumo in existence.`;
                    if (rows.length > 0) description += `\n📅 You welcomed your first fumo on ${firstFumoDate}.`;

                    // Summon source
                    if (fumo.summonPlace === 'Market') {
                        description += `\n🛍️ This fumo can be acquired at the ${fumo.summonPlace} for a mere ${formatNumber(fumo.price)} coins.`;
                    } else if (fumo.summonPlace === 'Code') {
                        description += `\n🔑 This fumo is obtained using a special code.`;
                    } else if (fumo.summonPlace === 'Crate') {
                        // Not used in your data, but kept for extensibility
                        const modChance = (parseFloat(fumo.chance) * rarityModifier).toFixed(2);
                        description += `\n📦 This fumo is obtained from the ${fumo.crateType} crate with a chance of ${modChance}%.`;
                    } else {
                        let baseChance = parseFloat(fumo.chance) * rarityModifier;
                        let chanceDisplay = '';
                        if (!isNaN(baseChance)) {
                            if (baseChance >= 0.01) {
                                chanceDisplay = `${baseChance.toFixed(2)}%`;
                            } else if (baseChance > 0) {
                                const inverse = Math.round(100 / baseChance);
                                chanceDisplay = `1 in ${formatNumber(inverse)}`;
                            } else {
                                chanceDisplay = fumo.chance;
                            }
                            description += `\n🔮 This fumo is summoned at the mystical ${fumo.summonPlace} using ${fumo.currency} with a chance of ${chanceDisplay}.`;
                        }
                    }

                    if (isShiny) {
                        description += `\n✨ This is a rare **SHINY** variant with a 1% base summon chance.`;
                    } else if (isAlg) {
                        description += `\n🌟 This is an **Extremely Rare alG** variant with a 0.001% base summon chance.`;
                    }

                    // --- New Feature: Show how many unique users own this fumo ---
                    db.get('SELECT COUNT(DISTINCT userId) as userCount FROM userInventory WHERE fumoName = ?', [fullFumoName], (err, userRow) => {
                        if (!err && userRow) {
                            description += `\n👥 Owned by ${formatNumber(userRow.userCount)} unique users.`;
                        }
                        embed.setDescription(description);
                        message.channel.send({ embeds: [embed] });
                    });
                });
            });
        } catch (e) {
            console.error(`[inform] Unexpected error:`, e);
            message.reply({ content: 'An unexpected error occurred while processing your request.' });
        }
    });
};
