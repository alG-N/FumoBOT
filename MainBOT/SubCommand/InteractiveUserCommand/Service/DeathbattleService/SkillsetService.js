const jjkSkillset = require('../../Configuration/Deathbattle/Skillsets/jjk');
const narutoSkillset = require('../../Configuration/Deathbattle/Skillsets/naruto');
const demonSlayerSkillset = require('../../Configuration/Deathbattle/Skillsets/demonslayer');
const onePieceSkillset = require('../../Configuration/Deathbattle/Skillsets/onepiece');

class SkillsetService {
    constructor() {
        this.skillsets = new Map();
        this.skillsets.set('jjk', jjkSkillset);
        this.skillsets.set('naruto', narutoSkillset);
        this.skillsets.set('demonslayer', demonSlayerSkillset);
        this.skillsets.set('onepiece', onePieceSkillset);
    }

    getSkillset(name) {
        return this.skillsets.get(name.toLowerCase());
    }

    getAllSkillsets() {
        return Array.from(this.skillsets.keys());
    }

    isValidSkillset(name) {
        return this.skillsets.has(name.toLowerCase());
    }

    getRandomPower(skillsetName, usedPowers = []) {
        const skillset = this.getSkillset(skillsetName);
        if (!skillset) return null;

        if (usedPowers.length >= skillset.powers.length) {
            usedPowers.length = 0;
        }

        let available = skillset.powers.filter(p => !usedPowers.includes(p.name));
        let selected = available[Math.floor(Math.random() * available.length)];
        usedPowers.push(selected.name);
        
        return selected;
    }

    getSummonName(skillsetName, powerName) {
        const skillset = this.getSkillset(skillsetName);
        if (!skillset || !skillset.summonNames[powerName]) {
            return 'Unknown Summon';
        }

        const summons = skillset.summonNames[powerName];
        return summons[Math.floor(Math.random() * summons.length)];
    }
}

module.exports = new SkillsetService();