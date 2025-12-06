module.exports = {
    name: 'naruto',
    displayName: 'Naruto',
    thumbnail: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/2f78d7b0-22ad-42da-b6cd-ce88f18e8123/dg5yyyl-f4c83fec-4b1d-4ad5-8dd4-09b3e3e0f4e9.png/v1/fill/w_894,h_894/naruto_icon_by_kotoamatsukami_dg5yyyl-pre.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9MTAyNCIsInBhdGgiOiJcL2ZcLzJmNzhkN2IwLTIyYWQtNDJkYS1iNmNkLWNlODhmMThlODEyM1wvZGc1eXl5bC1mNGM4M2ZlYy00YjFkLTRhZDUtOGRkNC0wOWIzZTNlMGY0ZTkucG5nIiwid2lkdGgiOiI8PTEwMjQifV1dLCJhdWQiOlsidXJuOnNlcnZpY2U6aW1hZ2Uub3BlcmF0aW9ucyJdfQ.lqzKG0H_LYKaQJvW9v-0M9MYNFBq3m_qG0YN9dJCq_Y',
    powers: [
        { name: 'rasengan', char: 'Naruto', type: 'damage', scale: 0.18, desc: 'Rasengan' },
        { name: 'shadow clone jutsu', char: 'Naruto', type: 'random', scale: 0.12, desc: 'Shadow Clone Jutsu' },
        { name: 'nine tails chakra', char: 'Naruto', type: 'buff', heal: true, boost: 1.35, desc: 'Nine Tails Chakra' },
        { name: 'chidori', char: 'Sasuke', type: 'damage', scale: 0.19, desc: 'Chidori' },
        { name: 'amaterasu', char: 'Sasuke', type: 'dot', scale: 0.08, turns: 3, desc: 'Amaterasu' },
        { name: 'susanoo', char: 'Sasuke', type: 'stun', scale: 0.11, desc: 'Susanoo' },
        { name: 'byakugan', char: 'Hinata', type: 'debuff', scale: 0.10, debuff: 0.65, turns: 2, desc: 'Byakugan' },
        { name: 'eight trigrams', char: 'Neji', type: 'damage', scale: 0.15, desc: 'Eight Trigrams Sixty-Four Palms' },
        { name: 'primary lotus', char: 'Rock Lee', type: 'sacrifice', scale: 0.38, self: 0.20, desc: 'Primary Lotus' },
        { name: 'puppet master', char: 'Sasori', type: 'random', scale: 0.11, desc: 'Puppet Master Jutsu' },
        { name: 'sand coffin', char: 'Gaara', type: 'damage', scale: 0.17, desc: 'Sand Coffin' },
        { name: 'wood style', char: 'Hashirama', type: 'damage', scale: 0.20, desc: 'Wood Style' },
        { name: 'reanimation', char: 'Orochimaru', type: 'heal', scale: 0.12, desc: 'Reanimation Jutsu' },
        { name: 'rasen shuriken', char: 'Naruto', type: 'damage', scale: 0.21, desc: 'Rasen Shuriken' },
        { name: 'kamui', char: 'Kakashi', type: 'swap', scale: 0.13, desc: 'Kamui' },
        { name: 'tsukuyomi', char: 'Itachi', type: 'stun', scale: 0.09, desc: 'Tsukuyomi' },
        { name: 'explosive clay', char: 'Deidara', type: 'damage', scale: 0.16, desc: 'Explosive Clay' },
        { name: 'summoning jutsu', char: 'Jiraiya', type: 'random', scale: 0.14, desc: 'Summoning Jutsu' },
        { name: 'healing jutsu', char: 'Sakura', type: 'heal', scale: 0.09, desc: 'Medical Ninjutsu' },
        { name: 'particle style', char: 'Onoki', type: 'damage', scale: 0.19, desc: 'Particle Style' }
    ],
    summonNames: {
        'shadow clone jutsu': ['Shadow Clone 1', 'Shadow Clone 2', 'Shadow Clone 3', 'Shadow Clone Army'],
        'puppet master': ['Hiruko', 'Crow', 'Black Ant', 'Salamander'],
        'summoning jutsu': ['Gamabunta', 'Gamaken', 'Gamahiro', 'Ma and Pa']
    }
};