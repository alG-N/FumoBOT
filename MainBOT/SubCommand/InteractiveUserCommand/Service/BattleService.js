const skillsetService = require('./SkillsetService');

class BattleService {
    constructor() {
        this.activeBattles = new Map();
    }

    createBattle(guildId, player1, player2, skillsetName, player1Hp, player2Hp) {
        const skillset = skillsetService.getSkillset(skillsetName);
        
        const battle = {
            player1,
            player2,
            skillsetName,
            skillset,
            player1Health: player1Hp,
            player2Health: player2Hp,
            player1MaxHp: player1Hp,
            player2MaxHp: player2Hp,
            roundCount: 1,
            player1Stunned: false,
            player2Stunned: false,
            player1Immune: false,
            player2Immune: false,
            usedPowers: [],
            effects: {
                user1: { shrine: 0, speech: 1, speechTurns: 0, binding: false, beam: 0, burn: 0, slow: 0, lightning: 0 },
                user2: { shrine: 0, speech: 1, speechTurns: 0, binding: false, beam: 0, burn: 0, slow: 0, lightning: 0 }
            },
            battleLog: '',
            interval: null
        };

        this.activeBattles.set(guildId, battle);
        return battle;
    }

    getBattle(guildId) {
        return this.activeBattles.get(guildId);
    }

    removeBattle(guildId) {
        const battle = this.activeBattles.get(guildId);
        if (battle?.interval) {
            clearInterval(battle.interval);
        }
        this.activeBattles.delete(guildId);
    }

    calculateDamage(base, hp, debuff = 1, boost = 1) {
        let scale = 1;
        if (hp > 1000000) scale = 3.5;
        else if (hp > 100000) scale = 2.5;
        else if (hp > 10000) scale = 1.7;
        else if (hp > 1000) scale = 1.2;
        else if (hp > 100) scale = 1;
        else scale = 0.7;
        return Math.floor(base * scale * debuff * boost);
    }

    dealDamage(battle, isPlayer1Turn) {
        const attacker = isPlayer1Turn ? battle.player1 : battle.player2;
        const defender = isPlayer1Turn ? battle.player2 : battle.player1;
        const attackerHp = isPlayer1Turn ? battle.player1Health : battle.player2Health;
        const defenderHp = isPlayer1Turn ? battle.player2Health : battle.player1Health;
        const attackerMaxHp = isPlayer1Turn ? battle.player1MaxHp : battle.player2MaxHp;
        const defenderMaxHp = isPlayer1Turn ? battle.player1MaxHp : battle.player2MaxHp;

        let log = '', damage = 0;
        let atkEff = isPlayer1Turn ? battle.effects.user1 : battle.effects.user2;
        let defEff = isPlayer1Turn ? battle.effects.user2 : battle.effects.user1;
        let bindingBoost = atkEff.binding ? 1.3 : 1;
        let debuff = defEff.speech;
        
        let power = skillsetService.getRandomPower(battle.skillsetName, battle.usedPowers);

        switch (power.type) {
            case 'damage':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff, bindingBoost);
                log = `${attacker.username} used ${power.desc} and dealt **${damage}** damage to ${defender.username}!`;
                break;

            case 'debuff':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, bindingBoost);
                defEff.speech = power.debuff;
                defEff.speechTurns = power.turns;
                log = `${attacker.username} used ${power.desc}, dealt **${damage}** damage and applied a defense debuff for ${power.turns} turns!`;
                break;

            case 'stun':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, bindingBoost);
                if (isPlayer1Turn) battle.player2Stunned = true; 
                else battle.player1Stunned = true;
                log = `${attacker.username} used ${power.desc}, stunned the opponent and dealt **${damage}** damage!`;
                break;

            case 'gamble':
                if (Math.random() < 0.5) {
                    atkEff.immune = true;
                    log = `${attacker.username} won ${power.desc} and is immune this round!`;
                } else {
                    damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, bindingBoost);
                    log = `${attacker.username} lost ${power.desc} and dealt **${damage}** damage to ${defender.username}!`;
                }
                break;

            case 'heal':
                let heal = Math.floor(attackerMaxHp * power.scale);
                if (isPlayer1Turn) battle.player1Health = Math.min(battle.player1Health + heal, battle.player1MaxHp);
                else battle.player2Health = Math.min(battle.player2Health + heal, battle.player2MaxHp);
                log = `${attacker.username} used ${power.desc} and healed for **${heal}** HP!`;
                break;

            case 'dot':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, bindingBoost);
                if (power.desc.includes('Burn') || power.desc.includes('Amaterasu')) {
                    defEff.burn = power.turns;
                } else {
                    defEff.shrine = power.turns;
                }
                log = `${attacker.username} used ${power.desc}, dealt **${damage}** damage and applied a DoT for ${power.turns} turns!`;
                break;

            case 'buff':
                if (!atkEff.binding) {
                    atkEff.binding = true;
                    if (isPlayer1Turn) battle.player1Health = battle.player1MaxHp;
                    else battle.player2Health = battle.player2MaxHp;
                    log = `${attacker.username} used ${power.desc}! Fully healed and damage increased for the rest of the battle!`;
                } else {
                    log = `${attacker.username} tried to use ${power.desc} again, but it can only be used once!`;
                }
                break;

            case 'random':
                let summon = skillsetService.getSummonName(battle.skillsetName, power.name);
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, bindingBoost);
                log = `${attacker.username} summoned ${summon} with ${power.desc}, dealing **${damage}** damage to ${defender.username}!`;
                break;

            case 'charge':
                if (atkEff.lightning < power.charges - 1) {
                    atkEff.lightning++;
                    log = `${attacker.username} is charging ${power.desc} (${atkEff.lightning}/${power.charges})!`;
                } else {
                    atkEff.lightning = 0;
                    damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 25, defenderMaxHp, debuff, bindingBoost);
                    if (isPlayer1Turn) battle.player2Stunned = true; 
                    else battle.player1Stunned = true;
                    log = `${attacker.username} unleashed ${power.desc} and dealt **${damage}** damage, stunning ${defender.username}!`;
                }
                break;

            case 'slow':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, bindingBoost);
                defEff.slow = power.turns;
                log = `${attacker.username} used ${power.desc}, dealt **${damage}** damage and slowed ${defender.username} for ${power.turns} rounds!`;
                break;

            case 'sacrifice':
                damage = Math.floor(defenderMaxHp * power.scale);
                let selfDmg = Math.floor(attackerMaxHp * power.self);
                if (isPlayer1Turn) battle.player1Health = Math.max(0, battle.player1Health - selfDmg);
                else battle.player2Health = Math.max(0, battle.player2Health - selfDmg);
                log = `${attacker.username} used ${power.desc}, dealt **${damage}** to ${defender.username} and took **${selfDmg}** self-damage!`;
                break;

            case 'swap':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, bindingBoost);
                let temp = battle.player1Health;
                battle.player1Health = battle.player2Health;
                battle.player2Health = temp;
                log = `${attacker.username} used ${power.desc}, swapped HP with ${defender.username} and dealt **${damage}** damage!`;
                break;

            default:
                damage = this.calculateDamage(Math.floor(defenderMaxHp * 0.10) + 10, defenderMaxHp, debuff, bindingBoost);
                log = `${attacker.username} used a combo attack and dealt **${damage}** damage to ${defender.username}!`;
        }

        if (isPlayer1Turn) {
            battle.player2Health = Math.max(0, battle.player2Health - damage);
        } else {
            battle.player1Health = Math.max(0, battle.player1Health - damage);
        }

        return log;
    }

    handleEffects(battle) {
        let logs = [];

        if (battle.effects.user1.shrine > 0) {
            let dmg = Math.max(Math.floor(battle.player2MaxHp * 0.05), 1);
            battle.player2Health = Math.max(0, battle.player2Health - dmg);
            logs.push(`**Malevolent Shrine**: Dealt **${dmg}** damage to **${battle.player2.username}**!`);
            battle.effects.user1.shrine--;
        }
        if (battle.effects.user2.shrine > 0) {
            let dmg = Math.max(Math.floor(battle.player1MaxHp * 0.05), 1);
            battle.player1Health = Math.max(0, battle.player1Health - dmg);
            logs.push(`**Malevolent Shrine**: Dealt **${dmg}** damage to **${battle.player1.username}**!`);
            battle.effects.user2.shrine--;
        }
        if (battle.effects.user1.burn > 0) {
            let burnDmg = Math.floor(battle.player1MaxHp * 0.035);
            battle.player1Health = Math.max(0, battle.player1Health - burnDmg);
            logs.push(`**Burn**: **${battle.player2.username}** dealt **${burnDmg}** burn damage to **${battle.player1.username}**!`);
            battle.effects.user1.burn--;
        }
        if (battle.effects.user2.burn > 0) {
            let burnDmg = Math.floor(battle.player2MaxHp * 0.035);
            battle.player2Health = Math.max(0, battle.player2Health - burnDmg);
            logs.push(`**Burn**: **${battle.player1.username}** dealt **${burnDmg}** burn damage to **${battle.player2.username}**!`);
            battle.effects.user2.burn--;
        }
        if (battle.effects.user1.speechTurns > 0) {
            battle.effects.user1.speechTurns--;
            if (battle.effects.user1.speechTurns === 0) battle.effects.user1.speech = 1;
        }
        if (battle.effects.user2.speechTurns > 0) {
            battle.effects.user2.speechTurns--;
            if (battle.effects.user2.speechTurns === 0) battle.effects.user2.speech = 1;
        }

        return logs;
    }
}

module.exports = new BattleService();