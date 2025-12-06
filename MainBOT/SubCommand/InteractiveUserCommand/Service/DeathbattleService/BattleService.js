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
                user1: {
                    shrine: 0, speech: 1, speechTurns: 0, binding: false, burn: 0, slow: 0, lightning: 0,
                    bleed: 0, poison: 0, poisonWeaken: 1, constrict: 0, constrictDmg: 0, dodge: 0,
                    reflect: false, frozen: 0, markBoost: 1, critNext: false, burnStacks: 0, momentum: 0,
                    berserk: false, speedBoost: 1, foresight: 0, transform: 0, transformBoost: 1, ghostMode: false
                },
                user2: {
                    shrine: 0, speech: 1, speechTurns: 0, binding: false, burn: 0, slow: 0, lightning: 0,
                    bleed: 0, poison: 0, poisonWeaken: 1, constrict: 0, constrictDmg: 0, dodge: 0,
                    reflect: false, frozen: 0, markBoost: 1, critNext: false, burnStacks: 0, momentum: 0,
                    berserk: false, speedBoost: 1, foresight: 0, transform: 0, transformBoost: 1, ghostMode: false
                }
            },
            lastDamageDealt: { user1: 0, user2: 0 },
            battleLog: '',
            interval: null,
            revivedOnce: { user1: false, user2: false }
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

        if (defEff.dodge > 0) {
            defEff.dodge--;
            return `${defender.username} dodged ${attacker.username}'s attack with perfect evasion!`;
        }

        if (defEff.foresight > 0 && Math.random() < 0.6) {
            defEff.foresight--;
            return `${defender.username} saw the future and avoided ${attacker.username}'s attack!`;
        }

        let bindingBoost = atkEff.binding ? 1.3 : 1;
        let debuff = defEff.speech * defEff.poisonWeaken;
        let speedMult = atkEff.speedBoost;
        let markMult = atkEff.markBoost;
        let transformMult = atkEff.transform > 0 ? atkEff.transformBoost : 1;
        let berserkMult = atkEff.berserk ? 1.5 : 1;

        let totalBoost = bindingBoost * speedMult * markMult * transformMult * berserkMult;

        let power = skillsetService.getRandomPower(battle.skillsetName, battle.usedPowers);

        switch (power.type) {
            case 'combo':
                damage = 0;
                for (let i = 0; i < power.hits; i++) {
                    damage += this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, totalBoost);
                }
                log = `${attacker.username} used ${power.desc} hitting ${power.hits} times for **${damage}** total damage!`;
                break;

            case 'execute':
                let hpPercent = defenderHp / defenderMaxHp;
                if (hpPercent <= power.threshold) {
                    damage = Math.floor(defenderHp * 0.9);
                    log = `${attacker.username} executed ${defender.username} with ${power.desc} dealing **${damage}** massive damage!`;
                } else {
                    damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff, totalBoost);
                    log = `${attacker.username} used ${power.desc} for **${damage}** damage (execute failed - HP too high)!`;
                }
                break;

            case 'bleed':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, totalBoost);
                defEff.bleed = power.turns;
                log = `${attacker.username} used ${power.desc}, dealing **${damage}** damage and causing bleeding for ${power.turns} turns!`;
                break;

            case 'poison_weaken':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 8, defenderMaxHp, debuff, totalBoost);
                defEff.poison = power.turns;
                defEff.poisonWeaken = 1 - power.weaken;
                log = `${attacker.username} used ${power.desc}, dealing **${damage}** damage and weakening defense by ${Math.floor(power.weaken * 100)}%!`;
                break;

            case 'momentum':
                let momentumBonus = atkEff.momentum * power.bonus;
                damage = this.calculateDamage(Math.floor(defenderMaxHp * (power.scale + momentumBonus)) + 15, defenderMaxHp, debuff, totalBoost);
                atkEff.momentum++;
                log = `${attacker.username} used ${power.desc} with momentum x${atkEff.momentum} dealing **${damage}** damage!`;
                break;

            case 'revive':
                atkEff.revive = true;
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, totalBoost);
                log = `${attacker.username} activated ${power.desc}! Next fatal blow will revive with ${Math.floor(power.scale * 100)}% HP! Dealt **${damage}** damage!`;
                break;

            case 'dodge':
                atkEff.dodge = power.turns;
                log = `${attacker.username} used ${power.desc}! Will dodge the next ${power.turns} attacks!`;
                break;

            case 'lifesteal':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 12, defenderMaxHp, debuff, totalBoost);
                let stolen = Math.floor(damage * power.steal);
                if (isPlayer1Turn) battle.player1Health = Math.min(battle.player1Health + stolen, battle.player1MaxHp);
                else battle.player2Health = Math.min(battle.player2Health + stolen, battle.player2MaxHp);
                log = `${attacker.username} used ${power.desc}, dealing **${damage}** damage and stealing **${stolen}** HP!`;
                break;

            case 'constrict':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, totalBoost);
                defEff.constrict = power.turns;
                defEff.constrictDmg = Math.floor(defenderMaxHp * 0.04);
                log = `${attacker.username} used ${power.desc}, dealing **${damage}** damage and constricting for ${power.turns} turns!`;
                break;

            case 'echo':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 12, defenderMaxHp, debuff, totalBoost);
                let lastDmg = isPlayer1Turn ? battle.lastDamageDealt.user1 : battle.lastDamageDealt.user2;
                let echoDmg = Math.floor(lastDmg * 0.5);
                damage += echoDmg;
                log = `${attacker.username} used ${power.desc}, dealing **${damage}** damage (${echoDmg} echo from last attack)!`;
                break;

            case 'reflect':
                atkEff.reflect = true;
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 8, defenderMaxHp, debuff, totalBoost);
                log = `${attacker.username} used ${power.desc}! Next attack will reflect ${Math.floor(power.scale * 100)}% damage back! Dealt **${damage}** damage!`;
                break;

            case 'berserk':
                atkEff.berserk = true;
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff, totalBoost);
                let recoil = Math.floor(attackerMaxHp * power.recoil);
                if (isPlayer1Turn) battle.player1Health = Math.max(0, battle.player1Health - recoil);
                else battle.player2Health = Math.max(0, battle.player2Health - recoil);
                log = `${attacker.username} went berserk with ${power.desc}! Dealt **${damage}** damage but took **${recoil}** recoil! All attacks boosted!`;
                break;

            case 'detonate':
                let burnDmg = (defEff.burnStacks || 0) * Math.floor(defenderMaxHp * 0.03);
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff, totalBoost) + burnDmg;
                defEff.burnStacks = 0;
                log = `${attacker.username} used ${power.desc}, detonating burn stacks for **${damage}** total damage!`;
                break;

            case 'piercing':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff * (1 + power.ignore), totalBoost);
                log = `${attacker.username} used ${power.desc}, ignoring ${Math.floor(power.ignore * 100)}% defense for **${damage}** damage!`;
                break;

            case 'counter':
                let counterDmg = isPlayer1Turn ? battle.lastDamageDealt.user2 : battle.lastDamageDealt.user1;
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + counterDmg, defenderMaxHp, debuff, totalBoost);
                log = `${attacker.username} countered with ${power.desc}, dealing **${damage}** damage (${counterDmg} from last hit)!`;
                break;

            case 'freeze':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.damage) + 10, defenderMaxHp, debuff, totalBoost);
                defEff.frozen = power.turns;
                log = `${attacker.username} used ${power.desc}, dealing **${damage}** damage and freezing for ${power.turns} turns!`;
                break;

            case 'mark_boost':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff, totalBoost);
                atkEff.markBoost = power.boost;
                log = `${attacker.username} activated ${power.desc}! All damage increased by ${Math.floor((power.boost - 1) * 100)}%! Dealt **${damage}** damage!`;
                break;

            case 'critical':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff, totalBoost);
                if (Math.random() < 0.4) {
                    damage = Math.floor(damage * power.crit);
                    log = `${attacker.username} landed a CRITICAL HIT with ${power.desc} for **${damage}** damage!`;
                } else {
                    log = `${attacker.username} used ${power.desc} for **${damage}** damage!`;
                }
                break;

            case 'burn_stack':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 12, defenderMaxHp, debuff, totalBoost);
                defEff.burnStacks = (defEff.burnStacks || 0) + power.stacks;
                log = `${attacker.username} used ${power.desc}, dealing **${damage}** damage and stacking ${power.stacks} burn charges!`;
                break;

            case 'bloodpump':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff, totalBoost);
                atkEff.speedBoost = power.speed;
                log = `${attacker.username} activated ${power.desc}! Attack speed x${power.speed}! Dealt **${damage}** damage!`;
                break;

            case 'reality_warp':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 20, defenderMaxHp, debuff, totalBoost);
                if (Math.random() < 0.3) {
                    damage = Math.floor(damage * 1.8);
                    log = `${attacker.username} warped reality with ${power.desc}! Cartoon physics dealt **${damage}** chaotic damage!`;
                } else {
                    log = `${attacker.username} used ${power.desc} for **${damage}** damage!`;
                }
                break;

            case 'drain_power':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff, totalBoost);
                let selfDrain = Math.floor(attackerMaxHp * power.self);
                if (isPlayer1Turn) battle.player1Health = Math.max(0, battle.player1Health - selfDrain);
                else battle.player2Health = Math.max(0, battle.player2Health - selfDrain);
                defEff.speech = Math.max(0.5, defEff.speech - 0.1);
                log = `${attacker.username} used ${power.desc}, dealing **${damage}** damage, taking **${selfDrain}** self-damage, and weakening opponent!`;
                break;

            case 'phantom':
                damage = 0;
                for (let i = 0; i < power.illusions; i++) {
                    damage += this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 8, defenderMaxHp, debuff, totalBoost);
                }
                log = `${attacker.username} created ${power.illusions} phantoms with ${power.desc}, dealing **${damage}** total damage!`;
                break;

            case 'foresight':
                atkEff.foresight = power.turns;
                log = `${attacker.username} activated ${power.desc}! Can see ${power.turns} turns ahead and may dodge attacks!`;
                break;

            case 'aerial':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 18, defenderMaxHp, debuff, totalBoost);
                log = `${attacker.username} used ${power.desc}, diving from above for **${damage}** damage!`;
                break;

            case 'chain_lightning':
                let baseDmg = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 12, defenderMaxHp, debuff, totalBoost);
                damage = baseDmg;
                for (let i = 0; i < power.chains; i++) {
                    damage += Math.floor(baseDmg * 0.5);
                }
                log = `${attacker.username} used ${power.desc}, chaining ${power.chains} times for **${damage}** total damage!`;
                break;

            case 'illusion_copy':
                atkEff.illusionCopy = power.turns;
                log = `${attacker.username} created an illusion copy with ${power.desc}! May confuse attacks for ${power.turns} turns!`;
                break;

            case 'trap':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 10, defenderMaxHp, debuff, totalBoost);
                defEff.trapped = 2;
                log = `${attacker.username} set ${power.desc}, dealing **${damage}** damage and trapping opponent for 2 turns!`;
                break;

            case 'transform':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 18, defenderMaxHp, debuff, totalBoost);
                atkEff.transform = power.duration;
                atkEff.transformBoost = power.boost;
                log = `${attacker.username} transformed with ${power.desc}! Damage boosted ${Math.floor((power.boost - 1) * 100)}% for ${power.duration} turns! Dealt **${damage}** damage!`;
                break;

            case 'giant_limbs':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 16, defenderMaxHp, debuff, totalBoost * 1.2);
                log = `${attacker.username} used ${power.desc}, crushing with giant limbs for **${damage}** damage!`;
                break;

            case 'demon_form':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 18, defenderMaxHp, debuff, totalBoost);
                let demonSteal = Math.floor(damage * power.lifesteal);
                if (isPlayer1Turn) battle.player1Health = Math.min(battle.player1Health + demonSteal, battle.player1MaxHp);
                else battle.player2Health = Math.min(battle.player2Health + demonSteal, battle.player2MaxHp);
                log = `${attacker.username} unleashed ${power.desc}, dealing **${damage}** damage and stealing **${demonSteal}** HP!`;
                break;

            case 'laser':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 15, defenderMaxHp, debuff, totalBoost);
                if (power.piercing) {
                    damage = Math.floor(damage * 1.3);
                    log = `${attacker.username} fired ${power.desc}, piercing through for **${damage}** damage!`;
                } else {
                    log = `${attacker.username} fired ${power.desc} for **${damage}** damage!`;
                }
                break;

            case 'ghost':
                atkEff.ghostMode = true;
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 12, defenderMaxHp, debuff, totalBoost);
                log = `${attacker.username} entered ${power.desc}! Next attack passes through and becomes intangible! Dealt **${damage}** damage!`;
                break;

            case 'water_prison':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 12, defenderMaxHp, debuff, totalBoost);
                defEff.waterPrison = power.turns;
                log = `${attacker.username} trapped opponent in ${power.desc}, dealing **${damage}** damage and drowning for ${power.turns} turns!`;
                break;

            case 'redirect':
                atkEff.redirect = true;
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 8, defenderMaxHp, debuff, totalBoost);
                log = `${attacker.username} prepared ${power.desc}! Next attack will redirect ${Math.floor(power.scale * 100)}% damage back! Dealt **${damage}** damage!`;
                break;

            case 'earthquake':
                damage = this.calculateDamage(Math.floor(defenderMaxHp * power.scale) + 20, defenderMaxHp, debuff, totalBoost);
                if (power.aoe) {
                    damage = Math.floor(damage * 1.15);
                    log = `${attacker.username} caused ${power.desc}, shaking the entire battlefield for **${damage}** massive damage!`;
                } else {
                    log = `${attacker.username} used ${power.desc} for **${damage}** damage!`;
                }
                break;

            default:
                damage = this.calculateDamage(Math.floor(defenderMaxHp * 0.10) + 10, defenderMaxHp, debuff, totalBoost);
                log = `${attacker.username} used a combo attack and dealt **${damage}** damage to ${defender.username}!`;
        }

        if (defEff.reflect && damage > 0) {
            let reflectDmg = Math.floor(damage * 0.5);
            if (isPlayer1Turn) battle.player1Health = Math.max(0, battle.player1Health - reflectDmg);
            else battle.player2Health = Math.max(0, battle.player2Health - reflectDmg);
            log += ` **${reflectDmg}** damage reflected back to ${attacker.username}!`;
            defEff.reflect = false;
        }

        if (defEff.redirect && damage > 0) {
            let redirectDmg = Math.floor(damage * 0.5);
            if (isPlayer1Turn) battle.player1Health = Math.max(0, battle.player1Health - redirectDmg);
            else battle.player2Health = Math.max(0, battle.player2Health - redirectDmg);
            log += ` **${redirectDmg}** damage redirected back to ${attacker.username}!`;
            defEff.redirect = false;
        }

        if (isPlayer1Turn) {
            battle.player2Health = Math.max(0, battle.player2Health - damage);
            battle.lastDamageDealt.user1 = damage;
        } else {
            battle.player1Health = Math.max(0, battle.player1Health - damage);
            battle.lastDamageDealt.user2 = damage;
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
        if (battle.effects.user1.bleed > 0) {
            let bleedDmg = Math.floor(battle.player1MaxHp * 0.04);
            battle.player1Health = Math.max(0, battle.player1Health - bleedDmg);
            logs.push(`**Bleed**: **${battle.player1.username}** took **${bleedDmg}** bleed damage!`);
            battle.effects.user1.bleed--;
        }
        if (battle.effects.user2.bleed > 0) {
            let bleedDmg = Math.floor(battle.player2MaxHp * 0.04);
            battle.player2Health = Math.max(0, battle.player2Health - bleedDmg);
            logs.push(`**Bleed**: **${battle.player2.username}** took **${bleedDmg}** bleed damage!`);
            battle.effects.user2.bleed--;
        }
        if (battle.effects.user1.poison > 0) {
            let poisonDmg = Math.floor(battle.player1MaxHp * 0.03);
            battle.player1Health = Math.max(0, battle.player1Health - poisonDmg);
            logs.push(`**Poison**: **${battle.player1.username}** took **${poisonDmg}** poison damage!`);
            battle.effects.user1.poison--;
            if (battle.effects.user1.poison === 0) battle.effects.user1.poisonWeaken = 1;
        }
        if (battle.effects.user2.poison > 0) {
            let poisonDmg = Math.floor(battle.player2MaxHp * 0.03);
            battle.player2Health = Math.max(0, battle.player2Health - poisonDmg);
            logs.push(`**Poison**: **${battle.player2.username}** took **${poisonDmg}** poison damage!`);
            battle.effects.user2.poison--;
            if (battle.effects.user2.poison === 0) battle.effects.user2.poisonWeaken = 1;
        }
        if (battle.effects.user1.constrict > 0) {
            battle.player1Health = Math.max(0, battle.player1Health - battle.effects.user1.constrictDmg);
            logs.push(`**Constrict**: **${battle.player1.username}** took **${battle.effects.user1.constrictDmg}** constriction damage!`);
            battle.effects.user1.constrict--;
        }
        if (battle.effects.user2.constrict > 0) {
            battle.player2Health = Math.max(0, battle.player2Health - battle.effects.user2.constrictDmg);
            logs.push(`**Constrict**: **${battle.player2.username}** took **${battle.effects.user2.constrictDmg}** constriction damage!`);
            battle.effects.user2.constrict--;
        }
        if (battle.effects.user1.frozen > 0) {
            let frozenDmg = Math.floor(battle.player1MaxHp * 0.02);
            battle.player1Health = Math.max(0, battle.player1Health - frozenDmg);
            logs.push(`**Frozen**: **${battle.player1.username}** took **${frozenDmg}** freeze damage!`);
            battle.effects.user1.frozen--;
        }
        if (battle.effects.user2.frozen > 0) {
            let frozenDmg = Math.floor(battle.player2MaxHp * 0.02);
            battle.player2Health = Math.max(0, battle.player2Health - frozenDmg);
            logs.push(`**Frozen**: **${battle.player2.username}** took **${frozenDmg}** freeze damage!`);
            battle.effects.user2.frozen--;
        }
        if (battle.effects.user1.waterPrison > 0) {
            let drownDmg = Math.floor(battle.player1MaxHp * 0.045);
            battle.player1Health = Math.max(0, battle.player1Health - drownDmg);
            logs.push(`**Water Prison**: **${battle.player1.username}** is drowning for **${drownDmg}** damage!`);
            battle.effects.user1.waterPrison--;
        }
        if (battle.effects.user2.waterPrison > 0) {
            const drownDmg = Math.floor(battle.player2MaxHp * 0.045);
            battle.player2Health = Math.max(0, battle.player2Health - drownDmg);

            logs.push(`**Water Prison**: **${battle.player2.username}** is drowning for **${drownDmg}** damage!`);

            battle.effects.user2.waterPrison--;
        }
        if (battle.effects.user1.speechTurns > 0) {
            battle.effects.user1.speechTurns--;
            if (battle.effects.user1.speechTurns === 0) {
                battle.effects.user1.speech = 1;
            }
        }
        if (battle.effects.user2.speechTurns > 0) {
            battle.effects.user2.speechTurns--;
            if (battle.effects.user2.speechTurns === 0) {
                battle.effects.user2.speech = 1;
            }
        }
        if (battle.effects.user1.transform > 0) {
            battle.effects.user1.transform--;
            if (battle.effects.user1.transform === 0) {
                battle.effects.user1.transformBoost = 1;
                logs.push(`**${battle.player1.username}**'s transformation ended!`);
            }
        }
        if (battle.effects.user2.transform > 0) {
            battle.effects.user2.transform--;
            if (battle.effects.user2.transform === 0) {
                battle.effects.user2.transformBoost = 1;
                logs.push(`**${battle.player2.username}**'s transformation ended!`);
            }
        }

        return logs;
    }

    checkRevive(battle, isPlayer1) {
        const effects = isPlayer1 ? battle.effects.user1 : battle.effects.user2;
        const revived = isPlayer1 ? battle.revivedOnce.user1 : battle.revivedOnce.user2;

        if (effects.revive && !revived) {
            const maxHp = isPlayer1 ? battle.player1MaxHp : battle.player2MaxHp;
            const reviveHp = Math.floor(maxHp * 0.25);

            if (isPlayer1) {
                battle.player1Health = reviveHp;
                battle.revivedOnce.user1 = true;
            } else {
                battle.player2Health = reviveHp;
                battle.revivedOnce.user2 = true;
            }

            effects.revive = false;
            return true;
        }

        return false;
    }
}

module.exports = new BattleService();