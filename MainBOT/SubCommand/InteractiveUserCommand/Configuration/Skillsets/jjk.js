module.exports = {
    name: 'jjk',
    displayName: 'Jujutsu Kaisen',
    thumbnail: 'https://steamuserimages-a.akamaihd.net/ugc/5107676531909210294/7A14253B35558071FBE17AD6F27C6158D078960C/?imw=5000&imh=5000&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=false',
    powers: [
        { name: 'hollow purple', char: 'Gojo', type: 'damage', scale: 0.22, desc: 'Hollow Purple' },
        { name: 'infinity', char: 'Gojo', type: 'stun', scale: 0.10, desc: 'Infinity' },
        { name: 'black flash', char: 'Itadori', type: 'damage', scale: 0.13, desc: 'Black Flash' },
        { name: 'summon mahoraga', char: 'Fushiguro', type: 'damage', scale: 0.14, desc: 'Summon Mahoraga' },
        { name: 'seven shadows', char: 'Fushiguro', type: 'random', scale: 0.09, desc: 'Shikigami: Seven Shadows' },
        { name: 'malevolent shrine', char: 'Sukuna', type: 'dot', scale: 0.05, turns: 4, desc: 'Malevolent Shrine' },
        { name: 'world cutting slash', char: 'Sukuna', type: 'damage', scale: 0.16, desc: 'World Cutting Slash' },
        { name: 'cursed speech', char: 'Inumaki', type: 'debuff', scale: 0.09, debuff: 0.7, turns: 2, desc: 'Cursed Speech' },
        { name: 'reverse cursed energy', char: 'Yuta', type: 'heal', scale: 0.10, desc: 'Reverse Cursed Energy' },
        { name: 'boogie woogie', char: 'Todo', type: 'swap', scale: 0.11, desc: 'Boogie Woogie' },
        { name: 'ratio technique', char: 'Nanami', type: 'damage', scale: 0.12, desc: 'Ratio Technique' },
        { name: 'idle death gamble', char: 'Hakari', type: 'gamble', scale: 0.13, desc: 'Idle Death Gamble' },
        { name: 'lightning', char: 'Kashimo', type: 'charge', scale: 0.30, charges: 2, desc: 'Lightning' },
        { name: 'burn', char: 'Jogo', type: 'dot', scale: 0.07, turns: 2, desc: 'Burn' },
        { name: 'ice formation', char: 'Uraume', type: 'slow', scale: 0.09, turns: 2, desc: 'Ice Formation' },
        { name: 'blood manipulation', char: 'Choso', type: 'damage', scale: 0.11, desc: 'Blood Manipulation' },
        { name: 'heavenly restriction', char: 'Maki', type: 'buff', heal: true, boost: 1.3, desc: 'Heavenly Restriction' },
        { name: 'star rage', char: 'Yuki', type: 'sacrifice', scale: 0.4, self: 0.25, desc: 'Star Rage' },
        { name: 'soul transformation', char: 'Mahito', type: 'damage', scale: 0.10, desc: 'Soul Transformation' },
        { name: 'cursed spirit manipulation', char: 'Geto', type: 'random', scale: 0.10, desc: 'Cursed Spirit Manipulation' },
        { name: 'medical technique', char: 'Shoko', type: 'heal', scale: 0.08, desc: 'Medical Technique' }
    ],
    summonNames: {
        'seven shadows': ['Divine Dog', 'Nue', 'Great Serpent', 'Toad', 'Max Elephant', 'Rabbit Escape', 'Black Divine Dog'],
        'cursed spirit manipulation': ['Rika', 'Tamamo-no-Mae', 'Rainbow Dragon', 'Smallpox Deity', 'Fly Heads']
    }
};