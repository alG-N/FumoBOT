const ITEM_DATABASE = {
    "Stone(B)": {
        rarity: "Basic",
        description: "A simple stone. Found everywhere, useful for nothing. Or is it?",
        lore: "Even the mightiest mountains begin with a single stone.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "Stick(B)": {
        rarity: "Basic",
        description: "A wooden stick. Perfect for poking things you shouldn't.",
        lore: "The first tool of mankind, the last resort of the desperate.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "PetFoob(B)": {
        rarity: "Basic",
        description: "Nutritious food for your pets. Keeps them happy and healthy.",
        lore: "Made with love, consumed with enthusiasm. Your pets deserve the best.",
        category: "Consumable",
        craftable: true,
        usable: true
    },
    "UniqueRock(C)": {
        rarity: "Common",
        description: "A skyfallen fragment, rare yet oddly common.",
        lore: "Legends say these rocks fell from the heavens during the Great Collision. Now they're everywhere.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "Books(C)": {
        rarity: "Common",
        description: "Dusty old books filled with strange, playful stories.",
        lore: "Knowledge is power, but these books are mostly filled with nonsense and doodles.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "Wool(C)": {
        rarity: "Common",
        description: "Soft, fluffy wool. Warm and surprisingly durable.",
        lore: "Sheared from the rarest sheep that only appear during full moons. Or maybe just regular sheep.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "Wood(C)": {
        rarity: "Common",
        description: "Basic, sturdy wood — nothing fancy, just useful.",
        lore: "From the Ancient Forest where trees whisper secrets. This one said 'please don't chop me'.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "ForgottenBook(C)": {
        rarity: "Common",
        description: "A blank-looking book that hums with hidden power.",
        lore: "Its pages were erased by time itself. What knowledge was lost? Perhaps it's better left forgotten.",
        category: "Craftable",
        craftable: true,
        usable: false,
        craftTime: 600000
    },
    "Dice(C)": {
        rarity: "Common",
        description: "A simple six-sided die. Perfectly balanced, as all things should be.",
        lore: "Used by ancient gamblers to decide fates. This one has never rolled a one.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "DailyTicket(C)": {
        rarity: "Common",
        description: "A ticket that grants access to daily rewards.",
        lore: "Time-stamped by the universe itself. Valid for one day only.",
        category: "Consumable",
        craftable: false,
        usable: false
    },
    "FragmentOf1800s(R)": {
        rarity: "Rare",
        description: "A relic from a grim era, heavy with history. Boosts Fumo slot farming.",
        lore: "Recovered from the Industrial Age. Still smells of coal and ambition.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "WeirdGrass(R)": {
        rarity: "Rare",
        description: "Grass bathed in moonlight. Grants a random buff—or a strange curse.",
        lore: "It grows where reality thins. Eating it is... inadvisable. But effective.",
        category: "Consumable",
        craftable: false,
        usable: true
    },
    "FumoTrait(R)": {
        rarity: "Rare",
        description: "A mysterious essence that can modify Fumo characteristics.",
        lore: "Distilled from the dreams of collectors. Handle with care.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "PrayTicket(R)": {
        rarity: "Rare",
        description: "A blessed ticket allowing you to pray to powerful beings.",
        lore: "Stamped with divine approval. The gods are listening... probably.",
        category: "Consumable",
        craftable: false,
        usable: false
    },
    "CoinPotionT1(R)": {
        rarity: "Rare",
        description: "A shimmering potion that increases coin generation by 25%.",
        lore: "Brewed by greedy alchemists who wanted more, always more.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "CoinPotionT2(R)": {
        rarity: "Rare",
        description: "A golden elixir that boosts coin generation by 50%.",
        lore: "The recipe was stolen from a dragon's hoard. Worth it.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "CoinPotionT3(R)": {
        rarity: "Rare",
        description: "A radiant brew that increases coin generation by 75%.",
        lore: "Made from liquid gold and pure greed. Tastes terrible.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "GemPotionT1(R)": {
        rarity: "Rare",
        description: "A crystalline potion that boosts gem generation by 10%.",
        lore: "Contains dissolved gemstones. Don't think about it too hard.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "GemPotionT2(R)": {
        rarity: "Rare",
        description: "A sparkling elixir that increases gem generation by 20%.",
        lore: "Sparkles more than it should. Probably safe.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "GemPotionT3(R)": {
        rarity: "Rare",
        description: "A dazzling brew that boosts gem generation by 45%.",
        lore: "So shiny it hurts to look at. Your gems will thank you.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "EnhancedScroll(E)": {
        rarity: "Epic",
        description: "A scroll enhanced beyond safe limits. Its energy shifts constantly, making it powerful but unpredictable.",
        lore: "Created by a mad scholar who pushed magic too far. The scroll remembers.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "RustedCore(E)": {
        rarity: "Epic",
        description: "Once the heart of a great machine, now just a rusty husk. Still emits a faint, rhythmic hum—as if it remembers something.",
        lore: "From the Clockwork Empire that fell to rust and time. It still dreams of gears.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "AncientRelic(E)": {
        rarity: "Epic",
        description: "A mysterious artifact from a forgotten age. Drastically lowers sell value by 60%, but floods you with fortune—boosting coins, gems, and luck far beyond normal limits.",
        lore: "Unearthed from ruins older than recorded history. Power has a price.",
        category: "Consumable",
        craftable: false,
        usable: true
    },
    "FragmentOfTime(E)": {
        rarity: "Epic",
        description: "A shard of crystallized time. Touching it feels like remembering the future.",
        lore: "Time broke once. This is a piece of what shattered.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "FumoChangeToken(E)": {
        rarity: "Epic",
        description: "A token that allows you to transform one Fumo into another.",
        lore: "Reality is fluid for those with the right currency.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "CoinPotionT4(L)": {
        rarity: "Legendary",
        description: "A magnificent potion that doubles coin generation.",
        lore: "Blessed by the God of Commerce himself. Your wallet will never be empty.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "GemPotionT4(L)": {
        rarity: "Legendary",
        description: "A brilliant elixir that increases gem generation by 90%.",
        lore: "Forged in the heart of a collapsing star. Handle with care.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "BoostPotionT1(L)": {
        rarity: "Legendary",
        description: "A powerful brew that boosts both coin and gem generation by 25%.",
        lore: "Why choose when you can have both? The ultimate efficiency.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "BoostPotionT2(L)": {
        rarity: "Legendary",
        description: "An enhanced potion that increases both currencies by 50%.",
        lore: "Double the power, double the fun. Side effects may include excessive happiness.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "BoostPotionT3(L)": {
        rarity: "Legendary",
        description: "A supreme elixir that doubles both coin and gem generation.",
        lore: "The pinnacle of alchemy. Drink and prosper.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "RedShard(L)": {
        rarity: "Legendary",
        description: "A shard that burns with inner fire. Thought to be a remnant of a volcanic deity's armor.",
        lore: "It remembers the rage of creation, when fire first touched the world.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "BlueShard(L)": {
        rarity: "Legendary",
        description: "Cold and unyielding, this shard is linked to an ancient water spirit. It hums softly when submerged.",
        lore: "From the depths where light cannot reach. The ocean keeps its secrets.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "YellowShard(L)": {
        rarity: "Legendary",
        description: "Crackling with static energy. Believed to have been created during a storm that split the sky.",
        lore: "Born from lightning's first kiss. It still seeks to return home.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "WhiteShard(L)": {
        rarity: "Legendary",
        description: "Pure and celestial. Rumored to be a sliver of a fallen star, used in divine rituals.",
        lore: "When stars die, they leave behind hope. This is what remains.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "DarkShard(L)": {
        rarity: "Legendary",
        description: "Drenched in shadow. Created in the depths of the Abyss during the Eclipse War.",
        lore: "Light cannot touch it. Darkness welcomes it home.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "HakureiTicket(L)": {
        rarity: "Legendary",
        description: "A ticket that allows you to re-visit the Hakurei Shrine and reset your prayer limit.",
        lore: "Stamped by the shrine maiden herself. Divine mercy has a price.",
        category: "Consumable",
        craftable: false,
        usable: true
    },
    "SFumoTrait(L)": {
        rarity: "Legendary",
        description: "A superior trait essence for advanced Fumo modifications.",
        lore: "Refined through countless experiments. Perfection achieved.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "TimeClock-Broken(L)": {
        rarity: "Legendary",
        description: "A shattered clock that once controlled time itself. Maybe you can fix it?",
        lore: "Time stopped when this broke. Someone should really fix that.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "TimeClock(L)": {
        rarity: "Legendary",
        description: "A mystical clock that temporarily boosts coin, gem generation, and summon speed by 2x for 24 hours.",
        lore: "Tick-tock. Time bends for those who hold the clock.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 18000000
    },
    "CoinPotionT5(M)": {
        rarity: "Mythical",
        description: "An transcendent potion that increases coin generation by 150%.",
        lore: "Blessed by every god of wealth simultaneously. They fought over who blessed it more.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "GemPotionT5(M)": {
        rarity: "Mythical",
        description: "A divine elixir that boosts gem generation by 125%.",
        lore: "Crystallized divinity in liquid form. Worth more than kingdoms.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "BoostPotionT4(M)": {
        rarity: "Mythical",
        description: "A legendary brew that increases both currencies by 150%.",
        lore: "The alchemist who made this transcended mortality. Worth it.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "BoostPotionT5(M)": {
        rarity: "Mythical",
        description: "An ultimate elixir that triples both coin and gem generation.",
        lore: "The final word in potion-making. There is nothing beyond this.",
        category: "Potion",
        craftable: true,
        usable: true
    },
    "ChromaShard(M)": {
        rarity: "Mythical",
        description: "A vibrant shard reflecting every color—said to hold the balance between chaos and order.",
        lore: "Where all colors meet, reality fractures. Beautiful and terrifying.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "MonoShard(M)": {
        rarity: "Mythical",
        description: "A colorless shard born from light and dark canceling out. It hums with quiet power.",
        lore: "When opposites clash and neither wins, this is born. Silent. Waiting.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "EquinoxAlloy(M)": {
        rarity: "Mythical",
        description: "Forged only during a perfect equinox. Said to harmonize nature's opposing forces.",
        lore: "Balance is rare. This metal remembers when day and night stood equal.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "StarShard(M)": {
        rarity: "Mythical",
        description: "Gifted by Marisa after 10 donations. Needed for an ultimate blessing—but its true purpose is still unclear.",
        lore: "She smiles when she gives these. What does she know that you don't?",
        category: "Material",
        craftable: false,
        usable: false
    },
    "FantasyBook(M)": {
        rarity: "Mythical",
        description: "A strange book that lets you summon Fumo from another world. Unlocks non-Touhou fumos and ASTRAL+ rarities. Only works once.",
        lore: "Written by someone who crossed dimensions. The pages smell like other realities.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 3000000
    },
    "Lumina(M)": {
        rarity: "Mythical",
        description: "Formed from 10 StarShards. Every 10th roll while holding it boosts your luck by 5×.",
        lore: "Ten stars became one. The universe noticed. Your fate changed.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 6000000
    },
    "MysteriousShard(M)": {
        rarity: "Mythical",
        description: "A shard that defies explanation. It exists in multiple states simultaneously.",
        lore: "Quantum mechanics got drunk and made this. Science cannot explain it.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "PocketWatch(M)": {
        rarity: "Mythical",
        description: "An ornate watch that seems to tick backwards sometimes.",
        lore: "Owned by a time traveler who got stuck in a loop. The watch remembers.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "MysteriousCube(M)": {
        rarity: "Mythical",
        description: "A cube that shifts and changes. Using it grants random boosts to luck, coins, and gems for 24 hours.",
        lore: "Tesseract? Hypercube? No one knows. It just... is.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 12000000
    },
    "MysticOrb(M)": {
        rarity: "Mythical",
        description: "An orb filled with swirling cosmos. Gazing into it reveals glimpses of possible futures.",
        lore: "Fortunes told, destinies glimpsed. The future is never certain.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "MysteriousDice(M)": {
        rarity: "Mythical",
        description: "A die that changes your luck multiplier every hour, ranging from 0.01% to 1000%. Lasts 12 hours.",
        lore: "Chaos incarnate. The gambler's ultimate dream or nightmare.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 24000000
    },
    "CosmicCore(?)": {
        rarity: "???",
        description: "The core of a dying universe, somehow preserved. Grants massive boosts and enables the [GLITCHED] trait (1 in 50k chance).",
        lore: "Universes die. This is what remains. Heavy with the weight of existence.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 180000000
    },
    "CrystalSigil(?)": {
        rarity: "???",
        description: "A crystallized form of pure sigil energy. Grants +500% coin boost, +750% gem boost, and x1.1-x1.5 roll speed.",
        lore: "When magic becomes solid, this is the result. Handle carefully.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 72000000
    },
    "EternalEssence(?)": {
        rarity: "???",
        description: "The essence of eternity itself. Grants +5000% coin boost, +7500% gem boost, and x2 variant luck for 24 hours.",
        lore: "Time means nothing to this. It has always been, will always be.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 144000000
    },
    "VoidCrystal(?)": {
        rarity: "???",
        description: "Mysterious void energy contained in crystal. Grants +1500% coin boost, +2000% gem boost, and enables void traits.",
        lore: "The void stares back. Always.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 108000000
    },
    "GoldenSigil(?)": {
        rarity: "???",
        description: "Forged by an ancestor of AlterGolden, this sigil once brought immense fortune. How it was crafted remains a mystery lost to time. Provides massive coin boost, stacks up to 10 times.",
        lore: "Golden's legacy. Power runs in bloodlines, and this is its purest form.",
        category: "Consumable",
        craftable: false,
        usable: true
    },
    "Undefined(?)": {
        rarity: "???",
        description: "Its name flickers in and out of comprehension. Scholars say it was never meant to be named—used in forbidden rituals.",
        lore: "Before language, before thought, this existed. It should not be.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "Null?(?)": {
        rarity: "???",
        description: "An item with no origin, no weight, and no presence—yet here it is. Whispers say it's a relic from an erased dimension.",
        lore: "What was deleted but remains? A paradox wrapped in nothing.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "Nullified(?)": {
        rarity: "???",
        description: "A strange object said to freeze fate itself. Balances your next roll—no rarity chance, just pure neutrality. Resets after each use.",
        lore: "When destiny becomes too chaotic, this restores balance. Temporarily.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 36000000
    },
    "S!gil?(?)": {
        rarity: "???",
        description: "Forged from twisted reality and layered time. Boosts coins, luck, and sell value based on GoldenSigils. Converts 10 daily rolls into nullified form. All boosts are disabled. Duplicate ASTRAL+ drops are blocked.",
        lore: "The culmination of Golden's power. Reality bends. Rules break. Power absolute.",
        category: "Consumable",
        craftable: true,
        usable: true,
        craftTime: 216000000
    },
    "ShinyShard(?)": {
        rarity: "???",
        description: "A radiant shard that can transform any Fumo into its shiny variant. One-time use.",
        lore: "Extracted from shooting stars. Your collection will sparkle.",
        category: "Consumable",
        craftable: false,
        usable: true
    },
    "VoidFragment(?)": {
        rarity: "???",
        description: "A piece of pure nothingness. Staring at it too long makes you forget things.",
        lore: "The void stares back. Always.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "CrystalSigil(?)": {
        rarity: "???",
        description: "A crystallized form of pure sigil energy. Emanates raw power.",
        lore: "When magic becomes solid, this is the result. Handle carefully.",
        category: "Material",
        craftable: true,
        usable: false,
        craftTime: 72000000
    },
    "EternalEssence(?)": {
        rarity: "???",
        description: "The essence of eternity itself, condensed into physical form.",
        lore: "Time means nothing to this. It has always been, will always be.",
        category: "Material",
        craftable: true,
        usable: false,
        craftTime: 144000000
    },
    "CosmicCore(?)": {
        rarity: "???",
        description: "The core of a dying universe, somehow preserved.",
        lore: "Universes die. This is what remains. Heavy with the weight of existence.",
        category: "Material",
        craftable: true,
        usable: false,
        craftTime: 180000000
    },
    "ObsidianRelic(Un)": {
        rarity: "Unknown",
        description: "A relic carved from obsidian so old it predates recorded history.",
        lore: "Before time was measured, this existed. Silent witness to all.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "ChaosEssence(Un)": {
        rarity: "Unknown",
        description: "Pure, concentrated chaos. It shifts form constantly.",
        lore: "Order is an illusion. This is the truth beneath.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "AbyssalShard(Un)": {
        rarity: "Unknown",
        description: "A shard from the deepest abyss. It absorbs light.",
        lore: "Where light dies, this is born. The abyss remembers.",
        category: "Material",
        craftable: false,
        usable: false
    },
    "alGShard(P)": {
        rarity: "Prime",
        description: "An ultra-rare shard that can transform LEGENDARY+ Fumos into their alG variant. One-time use.",
        lore: "The ultimate refinement. Golden's blessing in crystalline form.",
        category: "Consumable",
        craftable: false,
        usable: true
    },
    "CommonEgg": {
        rarity: "Common",
        description: "A simple egg that will hatch into a common pet.",
        lore: "New life awaits. What will emerge?",
        category: "Egg",
        craftable: false,
        usable: false
    },
    "RareEgg": {
        rarity: "Rare",
        description: "A sparkling egg containing a rare pet.",
        lore: "Something special grows within. Patience.",
        category: "Egg",
        craftable: false,
        usable: false
    },
    "DivineEgg": {
        rarity: "Divine",
        description: "A legendary egg glowing with divine energy.",
        lore: "Blessed by the gods. The creature within is extraordinary.",
        category: "Egg",
        craftable: false,
        usable: false
    }
};

module.exports = ITEM_DATABASE;