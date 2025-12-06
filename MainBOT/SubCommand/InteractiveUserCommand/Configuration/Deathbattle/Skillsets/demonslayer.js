module.exports = {
    name: 'demonslayer',
    displayName: 'Demon Slayer',
    thumbnail: 'https://i.pinimg.com/originals/27/7c/88/277c88c0c1c7e7e5b4f5e5d8f5c5c9d0.png',
    powers: [
        { name: 'water breathing combo', char: 'Tanjiro', type: 'combo', scale: 0.08, hits: 3, desc: 'Water Breathing: Flow Chain' },
        { name: 'hinokami kagura', char: 'Tanjiro', type: 'burn_stack', scale: 0.12, stacks: 3, desc: 'Hinokami Kagura: Rising Sun' },
        { name: 'thunderclap flash', char: 'Zenitsu', type: 'execute', scale: 0.35, threshold: 0.30, desc: 'Thunder Breathing: Godspeed Execute' },
        { name: 'beast fang', char: 'Inosuke', type: 'bleed', scale: 0.06, turns: 4, desc: 'Beast Breathing: Tearing Fangs' },
        { name: 'insect sting', char: 'Shinobu', type: 'poison_weaken', scale: 0.05, turns: 5, weaken: 0.15, desc: 'Insect Breathing: Wisteria Venom' },
        { name: 'flame tiger', char: 'Rengoku', type: 'momentum', scale: 0.14, bonus: 0.05, desc: 'Flame Breathing: Momentum Strike' },
        { name: 'rengoku spirit', char: 'Rengoku', type: 'revive', scale: 0.25, desc: 'Unyielding Spirit' },
        { name: 'obscuring mist', char: 'Muichiro', type: 'dodge', turns: 2, desc: 'Mist Breathing: Evasion' },
        { name: 'love whip', char: 'Mitsuri', type: 'lifesteal', scale: 0.16, steal: 0.40, desc: 'Love Breathing: Draining Lash' },
        { name: 'serpent coil', char: 'Obanai', type: 'constrict', scale: 0.10, turns: 3, desc: 'Serpent Breathing: Binding Coils' },
        { name: 'sound waves', char: 'Tengen', type: 'echo', scale: 0.13, desc: 'Sound Breathing: Resonance' },
        { name: 'stone fortress', char: 'Gyomei', type: 'reflect', scale: 0.50, desc: 'Stone Breathing: Iron Defense' },
        { name: 'wind scythe', char: 'Sanemi', type: 'execute', scale: 0.33, threshold: 0.25, desc: 'Wind Breathing: Final Gale' },
        { name: 'demon blood', char: 'Nezuko', type: 'berserk', scale: 0.18, recoil: 0.08, desc: 'Blood Demon Art: Berserk Mode' },
        { name: 'exploding blood', char: 'Nezuko', type: 'detonate', scale: 0.20, desc: 'Exploding Blood: Chain Reaction' },
        { name: 'moon crescent', char: 'Kokushibo', type: 'piercing', scale: 0.19, ignore: 0.30, desc: 'Moon Breathing: Armor Break' },
        { name: 'compass needle', char: 'Akaza', type: 'counter', scale: 0.25, desc: 'Destructive Death: Perfect Counter' },
        { name: 'frozen blood', char: 'Doma', type: 'freeze', turns: 2, damage: 0.08, desc: 'Crystalline Divine Child' },
        { name: 'red blade', char: 'Tanjiro', type: 'mark_boost', scale: 0.17, boost: 1.25, desc: 'Red Nichirin Blade' },
        { name: 'transparent world', char: 'Tanjiro', type: 'critical', scale: 0.22, crit: 2.0, desc: 'Transparent World Vision' }
    ],
    summonNames: {}
};