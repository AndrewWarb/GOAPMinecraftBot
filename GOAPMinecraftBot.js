// ============================== IMPORTS ==============================

const mineflayer = require('mineflayer')
const vec3 = require('vec3')
const navigatePlugin = require('mineflayer-navigate')(mineflayer);
var scaffoldPlugin = require('mineflayer-scaffold')(mineflayer);
const mcdata = require('minecraft-data')('1.12.2')
const say = require('say')
var bloodhoundPlugin = require('mineflayer-bloodhound')(mineflayer);
var blockFinderPlugin = require('mineflayer-blockfinder')(mineflayer);

// =================================== CREATING THE BOT ===================================

// MODIFIED CODE FROM https://github.com/PrismarineJS/mineflayer/blob/master/examples/trader.js
const bot = mineflayer.createBot({
    host: process.argv[2],
    port: parseInt(process.argv[3]),
    username: process.argv[4] ? process.argv[4] : 'GOAP_Bot',
    password: process.argv[5],
    verbose: true
})
// END OF MODIFIED CODE FROM https://github.com/PrismarineJS/mineflayer/blob/master/examples/trader.js

// == Load Plugins ==
navigatePlugin(bot);
scaffoldPlugin(bot);
bloodhoundPlugin(bot);
bot.loadPlugin(blockFinderPlugin);

// =========================================================================== GLOBAL VARIABLES ===========================================================================

var actionQueue = new Queue()

var isWaitingForNavigationToComplete = false
var isWaitingForEatingToComplete = false
var navigationFailed = false
var scaffoldChangeStateCount = 0

// Food
const foodIDs = [260, 393, 457, 459, 297, 354, 391, 432, 366, 350, 424, 320, 412, 357, 322, 466, 396, 360, 282, 394, 392, 349, 400, 413, 363, 365, 423, 319, 411, 367, 375, 364]

// Entities
const foodBearingPassiveMobs = ['pig', 'chicken', 'cod', 'cow', 'mooshroom', 'rabbit', 'salmon', 'sheep', 'tropical_fish']
const foodBearingUnusedMobs = ['zombie_horse']
const foodBearingDefensiveMobs = ['pufferfish']
const foodBearingNeutralMobs = ['cave_spider', 'dolphin', 'polar_bear', 'spider', 'zombie_pigman']
const foodBearingHostileMobs = ['drowned', 'elder_guardian', 'guardian', 'husk', 'witch', 'zombie_villager', 'zombie']

const mobsBloodhoundCantDetect = ['blaze', 'elder_guardian', 'skeleton', 'evoker', 'vex', 'ghast', 'guardian', 'magma_cube', 'shulker', 'slime', 'stray', 'witch']

var attackMode = false
var targetEntity

// Tools
const pickaxeIDs = [278, 257, 274, 270, 285]
const swordIDs = [276, 267, 272, 268, 283]

// List of weapons in order of most possible damage per second to least, and if equal, from
// highest durability to lowest
// Also iron and diamond hoes assumed to have dps of 2, see note on the Damage minecraft 
// gamepedia page.
// Also not added any with a damage value of 1, because the hand is as strong as that.
// Also ranged weapons are not yet included.
const weaponIDsAndDamagePerSecond =
    [
        { id: 276, dps: 11.2 },
        { id: 267, dps: 9.6 },
        { id: 279, dps: 9.0 },
        { id: 258, dps: 8.1 },
        { id: 272, dps: 8.0 },
        { id: 275, dps: 7.2 },
        { id: 286, dps: 7.0 },
        { id: 268, dps: 6.4 },
        { id: 283, dps: 6.4 },
        { id: 278, dps: 6.0 },
        { id: 271, dps: 5.6 },
        { id: 277, dps: 5.5 },
        { id: 257, dps: 4.8 },
        { id: 256, dps: 4.5 },
        { id: 274, dps: 3.6 },
        { id: 273, dps: 3.5 },
        { id: 269, dps: 2.5 },
        { id: 284, dps: 2.5 },
        { id: 270, dps: 2.4 },
        { id: 285, dps: 2.4 },
        { id: 293, dps: 2.0 },
        { id: 292, dps: 2.0 },
        { id: 291, dps: 2.0 }
    ]

// Armour
const helmetIDs = [310, 306, 302, 314, 298]
const chestplateIDs = [311, 307, 303, 315, 299]
const leggingsIDs = [312, 308, 304, 316, 300]
const bootsIDs = [313, 309, 305, 317, 301]

const armourDataValues =
    [
        { id: 310, destination: "head" },
        { id: 311, destination: "torso" },
        { id: 312, destination: "legs" },
        { id: 313, destination: "feet" },
        { id: 306, destination: "head" },
        { id: 307, destination: "torso" },
        { id: 308, destination: "legs" },
        { id: 309, destination: "feet" },
        { id: 302, destination: "head" },
        { id: 303, destination: "torso" },
        { id: 304, destination: "legs" },
        { id: 305, destination: "feet" },
        { id: 314, destination: "head" },
        { id: 315, destination: "torso" },
        { id: 316, destination: "legs" },
        { id: 317, destination: "feet" },
        { id: 298, destination: "head" },
        { id: 299, destination: "torso" },
        { id: 300, destination: "legs" },
        { id: 301, destination: "feet" }
    ]

// Blocks
const scaffoldBlockTypes = [3, 4, 87]

// States, Actions and Goals

// Structure of currentState object, goals object and actions object from
// https://github.com/wmdmark/goap-js

var currentPlan

var currentState =
{
    "I_FOOD": 0,
    "I_TORCHES": 0,
    "I_SATIATION": 0,
    "I_WOODEN_SWORDS": 0,
    "I_STONE_SWORDS": 0,
    "I_IRON_SWORDS": 0,
    "I_DIAMOND_SWORDS": 0,
    "I_SWORDS": 0,
    "I_WOODEN_PICKAXES": 0,
    "I_STONE_PICKAXES": 0,
    "I_IRON_PICKAXES": 0,
    "I_PICKAXES": 0,
    "I_SHOVELS": 0,
    "I_AXES": 0,
    "I_HOES": 0,
    "I_FLINTS_AND_STEELS": 0,
    "I_SHEARS": 0,
    "I_FISHING_RODS": 0,
    "I_LEADS": 0,
    "I_DIAMOND_HELMETS": 0,
    "I_HELMETS": 0,
    "I_DIAMOND_CHESTPLATES": 0,
    "I_CHESTPLATES": 0,
    "I_DIAMOND_LEGGINGS": 0,
    "I_LEGGINGS": 0,
    "I_DIAMOND_BOOTS": 0,
    "I_BOOTS": 0,
    "I_SCAFFOLD_BLOCKS": 0,
    "I_DIRT": 0,
    "I_PLANKS": 0,
    "I_LOGS": 0,
    "I_CRAFTING_BENCHES": 0,
    "I_STICKS": 0,
    "I_DIAMONDS": 0,
    "I_IRON_ORE": 0,
    "I_COAL": 0,
    "I_FURNACES": 0,
    "I_COBBLESTONE": 0,
    "I_IRON": 0,

    "I_FULL_DIAMOND": false,

    "I_JUST_EXPLORED": false,

    "WORLD_FOOD_ITEMS_ARE_NEARBY_ON_THE_FLOOR": false,
    "WORLD_FOOD_BEARING_MOBS_ARE_NEARBY": false,

    "WORLD_SWORDS_ARE_LYING_AROUND": false,
    "WORLD_PICKAXES_ARE_LYING_AROUND": false,

    "WORLD_HELMETS_ARE_LYING_AROUND": false,
    "WORLD_CHESTPLATES_ARE_LYING_AROUND": false,
    "WORLD_LEGGINGS_ARE_LYING_AROUND": false,
    "WORLD_BOOTS_ARE_LYING_AROUND": false,
    "WORLD_SCAFFOLD_BLOCKS_ARE_LYING_AROUND": false,

    "WORLD_THERE_IS_DIRT_NEARBY": false,
    "WORLD_THERE_ARE_LOGS_NEARBY": false,
    "WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY": false,
    "WORLD_THERE_IS_A_FURNACE_NEARBY": false,
};

var goals =
{
    haveEnoughFood:
    {
        label: "Have enough food",
        validate: (prevState, nextState) =>
        {
            return nextState["I_FOOD"] >= 8
        },
        states:
        {
            "I_FOOD": 8
        }
    },

    satiate:
    {
        label: "Eat enough food",
        validate: (prevState, nextState) =>
        {
            return nextState["I_SATIATION"] >= 18
        },
        states:
        {
            "I_SATIATION": 18
        }
    },

    haveSword:
    {
        label: "Have a sword.",
        validate: (prevState, nextState) =>
        {
            return nextState["I_SWORDS"] >= 1
        },
        states:
        {
            "I_SWORDS": 1
        }
    },

    haveHelmet:
    {
        label: "Have a helmet.",
        validate: (prevState, nextState) =>
        {
            return nextState["I_HELMETS"] >= 1
        },
        states:
        {
            "I_HELMETS": 1
        }
    },

    haveChestplate:
    {
        label: "Have a Chestplate.",
        validate: (prevState, nextState) =>
        {
            return nextState["I_CHESTPLATES"] >= 1
        },
        states:
        {
            "I_CHESTPLATES": 1
        }
    },

    haveLeggings:
    {
        label: "Have Pants.",
        validate: (prevState, nextState) =>
        {
            return nextState["I_LEGGINGS"] >= 1
        },
        states:
        {
            "I_LEGGINGS": 1
        }
    },

    haveBoots:
    {
        label: "Have Boots.",
        validate: (prevState, nextState) =>
        {
            return nextState["I_BOOTS"] >= 1
        },
        states:
        {
            "I_BOOTS": 1
        }
    },

    haveEnoughScaffoldBlocks:
    {
        label: "Have enough Scaffold Blocks.",
        validate: (prevState, nextState) =>
        {
            return nextState["I_SCAFFOLD_BLOCKS"] >= 64
        },
        states:
        {
            "I_SCAFFOLD_BLOCKS": 64
        }
    },

    idleGoal:
    {
        label: "Idle.",
        validate: (prevState, nextState) =>
        {
            return true
        },
        states:
        {
        }
    },
    obtainFullDiamond:
    {
        label: "Obtain a full set of diamond armour and a diamond sword.",
        validate(prevState, nextState)
        {
            return nextState["I_FULL_DIAMOND"] == true
        },
        states:
        {
            "I_FULL_DIAMOND": true
        }
    }
};

const actions = {
    "findFoodLyingAround": {
        description: "Find food lying around.",
        preconditions: a => a["WORLD_FOOD_ITEMS_ARE_NEARBY_ON_THE_FLOOR"],
        postconditions: a =>
        {
            a["I_FOOD"]++
            return a
        },
        cost: 1
    },

    "killFoodBearingAnimals": {
        description: "Kill food-bearing animals.",
        preconditions: a => a["WORLD_FOOD_BEARING_MOBS_ARE_NEARBY"],
        postconditions:
            a =>
            {
                a["I_FOOD"]++
                return a
            },
        cost: 1
    },

    "eatFood": {
        description: "Eat food.",
        preconditions: a => a["I_FOOD"] >= 1 && a["I_SATIATION"] < 20,
        postconditions: a =>
        {
            a["I_SATIATION"]++
            return a
        },
        cost: 1
    },

    "findSwordLyingAround": {
        description: "Find swords lying around.",
        preconditions: a => a["WORLD_SWORDS_ARE_LYING_AROUND"],
        postconditions: a =>
        {
            a["I_SWORDS"]++
            return a
        },
        cost: 1
    },

    "findHelmetLyingAround": {
        description: "Find helmets lying around.",
        preconditions: a => a["WORLD_HELMETS_ARE_LYING_AROUND"],
        postconditions: a =>
        {
            a["I_HELMETS"]++
            return a
        },
        cost: 1
    },

    "findChestplateLyingAround": {
        description: "Find chestplates lying around.",
        preconditions: a => a["WORLD_CHESTPLATES_ARE_LYING_AROUND"],
        postconditions: a =>
        {
            a["I_CHESTPLATES"]++
            return a
        },
        cost: 1
    },

    "findLeggingsLyingAround": {
        description: "Find pants lying around.",
        preconditions: a => a["WORLD_LEGGINGS_ARE_LYING_AROUND"],
        postconditions: a =>
        {
            a["I_LEGGINGS"]++
            return a
        },
        cost: 1
    },

    "findBootsLyingAround": {
        description: "Find boots lying around",
        preconditions: a => a["WORLD_BOOTS_ARE_LYING_AROUND"],
        postconditions: a =>
        {
            a["I_BOOTS"]++
            return a
        },
        cost: 1
    },

    "findPickaxeLyingAround": {
        description: "Find pickaxes lying around.",
        preconditions: a => a["WORLD_PICKAXES_ARE_LYING_AROUND"],
        postconditions: a =>
        {
            a["I_PICKAXES"]++
            return a
        },
        cost: 1
    },

    "findScaffoldBlocksLyingAround": {
        description: "Find scaffold blocks lying around.",
        preconditions: a => a["WORLD_SCAFFOLD_BLOCKS_ARE_LYING_AROUND"],
        postconditions: a =>
        {
            a["I_SCAFFOLD_BLOCKS"]++
            return a
        },
        cost: 1
    },

    "mineDirt": {
        description: "Mine dirt.",
        preconditions: a => a["WORLD_THERE_IS_DIRT_NEARBY"],
        postconditions: a =>
        {
            a["I_DIRT"]++
            a["I_SCAFFOLD_BLOCKS"]++
            return a
        },
        cost: 1
    },
    
    "mineLogs": {
        preconditions: a => a["WORLD_THERE_ARE_LOGS_NEARBY"],
        postconditions: a =>
        {
            a["I_LOGS"]++
            return a;
        },
        cost: 1
    },

    "idleAction": {
        description: "Idle.",
        preconditions: a => true,
        postconditions: a =>
        {
            return a
        },
        cost: 0
    },

    "craftPlanks":
    {
        description: "Craft planks out of logs.",
        preconditions: a => a["I_LOGS"] >= 1,
        postconditions: a =>
        {
            a["I_PLANKS"]+= 4
            return a
        },
        cost: 1
    },

    "craftCraftingBench":
    {
        description: "Craft a crafting bench out of planks.",
        preconditions: a => a["I_PLANKS"] >= 4,
        postconditions: a =>
        {
            a["I_CRAFTING_BENCHES"]++
            return a
        },
        cost: 1
    },

    "craftSticks":
    {
        description: "Craft sticks out of planks.",
        preconditions: a => a["I_PLANKS"] >= 2,
        postconditions: a =>
        {
            a["I_STICKS"] += 4
            return a
        },
        cost: 1
    },

    "craftWoodenPickaxe":
    {
        description: "Craft a wooden pickaxe.",
        preconditions: a =>
        {
            a["I_PLANKS"] >= 3
            a["I_STICKS"] >= 2
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] == true
        },
        postconditions: a =>
        {
            a["I_WOODEN_PICKAXES"]++
            a["I_PICKAXES"]++
            return a
        },
        cost: 1
    },

    "placeCraftingBench":
    {
        description: "Place down a crafting bench.",
        preconditions: a => a["I_CRAFTING_BENCHES"] >= 1,
        postconditions: a =>
        {
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] = true
            a["I_CRAFTING_BENCHES"]--
            return a
        },
        cost: 1
    },

    "mineStone":
    {
        description: "Mine stone.",
        preconditions: a => a["I_PICKAXES"] >= 1,
        postconditions: a =>
        {
            a["I_COBBLESTONE"]++
        },
        cost: 1
    },

    "craftStonePickaxe":
    {
        description: "Craft a stone pickaxe.",
        preconditions: a => 
        {
            a["I_STICKS"] >= 2
            a["I_COBBLESTONE"] >= 3
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] == true
        },
        postconditions: a =>
        {
            a["I_STONE_PICKAXES"]++
            a["I_PICKAXES"]++
        },
        cost: 1
    },

    "mineIronOre":
    {
        description: "Mine iron ore.",
        preconditions: a => a["I_STONE_PICKAXES"] >= 1,
        postconditions: a =>
        {
            a["I_IRON_ORE"]++
        },
        cost: 1
    },

    "craftIronPickaxe":
    {
        description: "Craft an iron pickaxe.",
        preconditions: a => 
        {
            a["I_STICKS"] >= 2
            a["I_IRON"] >= 3
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] == true
        },
        postconditions: a =>
        {
            a["I_IRON_PICKAXES"]++
            a["I_PICKAXES"]++
        },
        cost: 1
    },

    "craftFurnace":
    {
        description: "Craft a furnace.",
        preconditions: a =>
        {
            a["I_COBBLESTONE"] >= 8
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] == true
        },
        postconditions: a =>
        {
            a["I_FURNACES"]++
            return a
        },
        cost: 1
    },

    "placeFurnace":
    {
        description: "Place down a furnace.",
        preconditions: a => a["I_FURNACES"] >= 1,
        postconditions: a =>
        {
            a["WORLD_THERE_IS_A_FURNACE_NEARBY"] = true
            a["I_FURNACES"]--
            return a
        },
        cost: 1
    },

    "mineCoal":
    {
        description: "Mine coal.",
        preconditions: a => a["I_PICKAXES"] >= 1,
        postconditions: a =>
        {
            a["I_COAL"]++
        },
        cost: 1
    },

    "smeltIronOre":
    {
        description: "Smelt iron ore to make iron.",
        preconditions: a =>
        {
            a["WORLD_THERE_IS_A_FURNACE_NEARBY"] == true
            a["I_IRON_ORE"] >= 1
            a["I_COAL"] >= 1
        },
        postconditions: a =>
        {
            a["I_IRON"]++
        }
    },

    "mineDiamond":
    {
        description: "Mine diamond.",
        preconditions: a => a["I_IRON_PICKAXES"] >= 1,
        postconditions: a =>
        {
            a["I_DIAMONDS"]++
        },
        cost: 1
    },

    "craftDiamondSword":
    {
        description: "Craft a diamond sword.",
        preconditions: a => 
        {
            a["I_STICKS"] >= 2
            a["I_DIAMONDS"] >= 3
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] == true
        },
        postconditions: a =>
        {
            a["I_DIAMOND_SWORDS"]++
            a["I_SWORDS"]++
        },
        cost: 1
    },

    "craftDiamondBoots":
    {
        description: "Craft diamond boots.",
        preconditions: a => 
        {
            a["I_DIAMONDS"] >= 4
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] == true
        },
        postconditions: a =>
        {
            a["I_DIAMOND_BOOTS"]++
            a["I_BOOTS"]++
        },
        cost: 1
    },

    "craftDiamondLeggings":
    {
        description: "Craft diamond leggings.",
        preconditions: a => 
        {
            a["I_DIAMONDS"] >= 7
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] == true
        },
        postconditions: a =>
        {
            a["I_DIAMOND_LEGGINGS"]++
            a["I_LEGGINGS"]++
        },
        cost: 1
    },

    "craftDiamondChestplate":
    {
        description: "Craft a diamond chestplate.",
        preconditions: a => 
        {
            a["I_DIAMONDS"] >= 8
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] == true
        },
        postconditions: a =>
        {
            a["I_DIAMOND_CHESTPLATES"]++
            a["I_CHESTPLATES"]++
        },
        cost: 1
    },

    "craftDiamondHelmet":
    {
        description: "Craft a diamond helmet.",
        preconditions: a => 
        {
            a["I_DIAMONDS"] >= 5
            a["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] == true
        },
        postconditions: a =>
        {
            a["I_DIAMOND_HELMETS"]++
            a["I_HELMETS"]++
        },
        cost: 1
    },

    "confirmFullDiamond":
    {
        description: "Declare that we have achieved full diamond.",
        preconditions: a =>
        {
            a["I_DIAMOND_SWORDS"] >= 1
            a["I_DIAMOND_BOOTS"] >= 1
            a["I_DIAMOND_LEGGINGS"] >= 1
            a["I_DIAMOND_CHESTPLATES"] >= 1
            a["I_DIAMOND_HELMETS"] >= 1
        },
        postconditions: a =>
        {
            a["I_FULL_DIAMOND"] = true
        }
    }
}

// ====================== NAVIGATION SETUP ======================

// CODE FROM https://github.com/PrismarineJS/mineflayer-navigate
// optional configuration
bot.navigate.blocksToAvoid[132] = true; // avoid tripwire
bot.navigate.blocksToAvoid[59] = true; // ok to trample crops
// END OF CODE FROM https://github.com/PrismarineJS/mineflayer-navigate

// Avoid water
bot.navigate.blocksToAvoid[8] = true;
bot.navigate.blocksToAvoid[9] = true;

// ============================ EVENT HANDLING ============================

bot.on('login', () =>
{
    console.log("Logged in.")
    initialiseAI()
})

bot.scaffold.on('changeState', function (oldState, newState, reason, data)
{
    if (newState == 'off' && (reason == 'success' || reason == 'itemRequired'))
    {
        declareNavigationComplete()
    }
    if (newState == 'off' && reason == 'danger')
    {
        isWaitingForNavigationToComplete = false
        navigationFailed = true
    }

    scaffoldChangeStateCount++
    if (scaffoldChangeStateCount > 100)
    {
        console.log("SPAM DETECTED")
        bot.scaffold.stop
        bot.setControlState('jump', true)
    }
});

bot.on('death', () =>
{
    attackMode = false
    declareNavigationComplete()
    isWaitingForEatingToComplete = false
    chat('Whoops.')
    console.log('Whoops.')
})

bot.on('onCorrelateAttack', function (attacker, victim, weapon)
{
    if (targetEntity != null)
    {
        if (victim.username == bot.username && (!attackMode || targetEntity.kind == 'Passive mobs'))
        {
            declareNavigationComplete()
            isWaitingForEatingToComplete = false
            initialiseKillingMode(attacker)
        }
    } else
    {
        if (victim.username == bot.username && (!attackMode))
        {
            declareNavigationComplete()
            isWaitingForEatingToComplete = false
            initialiseKillingMode(attacker)
        }
    }
});

bot.on("entityHurt", function (entity)
{
    setTimeout(function () { dealWithMobsBloodhoundCantDetect(entity) }, 100)
});

// MODIFIED CODE FROM https://github.com/G07cha/MineflayerArmorManager
bot.on('playerCollect', function (collector, item)
{
    try
    {
        isArmour = false
        var armourSlot
        var itemId = item.metadata['6'].blockId;
        for (i = 0; i < armourDataValues.length; i++)
        {
            if (armourDataValues[i].id == itemId)
            {
                isArmour = true
                armourSlot = armourDataValues[i].destination
                break
            }
        }
        if (collector.username === bot.username && isArmour)
        {
            // Little delay to receive inventory
            setTimeout(function ()
            {
                for (i = 0; i < bot.inventory.slots.length; i++)
                {
                    if (bot.inventory.slots[i] != null)
                    {
                        if (bot.inventory.slots[i].type == itemId)
                        {
                            bot.equip(bot.inventory.slots[i], armourSlot)
                            break
                        }
                    }
                }
            }, 100);
        }
    } catch (err)
    {
        console.log("Error in playerCollect event response: " + err);
    }
});
// END OF MODIFIED CODE FROM https://github.com/G07cha/MineflayerArmorManager

bot.on('spawn', function ()
{
    // Apply strength effect of value 1, for a time period of 1000000 seconds. (Longer than the experiment run time).
    // This is to counteract the strength bug causing the bot to deal far less damage than it should do per hit.
    bot.chat("/effect GOAP_Bot strength 1000000 1")
    console.log("Bot applying strength effect to itself of value 1.")
});


// =============================== FUNCTIONS ==============================

// ---------------------------- Initialisation ----------------------------

function initialiseAI()
{
    console.log("Initialising AI.")
    setTimeout(initialiseState, 4000)
    setTimeout(AI, 5000)
}

function initialiseState()
{
    console.log("Initialising state.")
    updateStates()
}

// ---------------------------------- AI ----------------------------------

var GOAPDone = true

function doGOAP()
{
    GOAPDone = false
    // First update all states
    updateStates()

    // Then decide on the current goal
    var currentGoal = goals.idleGoal

    if (!(currentState["I_SCAFFOLD_BLOCKS"] >= 10) && (isThereXLyingAround(scaffoldBlockTypes) || areBlocktypesNearby(scaffoldBlockTypes)))
    {
        currentGoal = goals.haveEnoughScaffoldBlocks
    } else if (!(currentState["I_PICKAXES"] >= 1) && (isThereXLyingAround(pickaxeIDs)))
    {
        currentGoal = goals.havePickaxe
    } else if (currentState["I_SWORDS"] < 1 && isThereXLyingAround(swordIDs))
    {
        currentGoal = goals.haveSword
    } else if (currentState["I_CHESTPLATES"] < 1 && isThereXLyingAround(chestplateIDs))
    {
        currentGoal = goals.haveChestplate
    } else if (currentState["I_LEGGINGS"] < 1 && isThereXLyingAround(leggingsIDs))
    {
        currentGoal = goals.haveLeggings
    } else if (currentState["I_BOOTS"] < 1 && isThereXLyingAround(bootsIDs))
    {
        currentGoal = goals.haveBoots
    } else if (currentState["I_HELMETS"] < 1 && isThereXLyingAround(helmetIDs))
    {
        currentGoal = goals.haveHelmet
    }
    else if (currentState["I_SATIATION"] < 18)
    {
        currentGoal = goals.satiate
    }
    else if (currentState["I_FOOD"] < 8)
    {
        currentGoal = goals.haveEnoughFood
    } else
    {
        console.log("========== OBTAINING FULL DIAMOND ==========")
        chat("========== OBTAINING FULL DIAMOND ==========")
        currentGoal = goals.obtainFullDiamond
    }

    // Print the decided upon goal
    console.log("Goal: " + currentGoal.label)

    // Then run the planner:
    const plan = AStar(currentState, currentGoal);

    // Log the plan:
    console.log("Plan length: " + plan.length)
    console.log('The plan: =======================================================================')
    for (element in plan)
    {
        process.stdout.write(plan[element] + ", ")
    }
    console.log("\nEnd of Plan. ====================================================================")

    currentPlan = plan
    GOAPDone = true
}

function updateStates()
{
    currentState["WORLD_FOOD_ITEMS_ARE_NEARBY_ON_THE_FLOOR"] = isThereXLyingAround(foodIDs)
    currentState["WORLD_FOOD_BEARING_MOBS_ARE_NEARBY"] = areThereFoodBearingMobsNearby()
    currentState["WORLD_SWORDS_ARE_LYING_AROUND"] = isThereXLyingAround(swordIDs)
    currentState["WORLD_HELMETS_ARE_LYING_AROUND"] = isThereXLyingAround(helmetIDs)
    currentState["WORLD_CHESTPLATES_ARE_LYING_AROUND"] = isThereXLyingAround(chestplateIDs)
    currentState["WORLD_LEGGINGS_ARE_LYING_AROUND"] = isThereXLyingAround(leggingsIDs)
    currentState["WORLD_BOOTS_ARE_LYING_AROUND"] = isThereXLyingAround(bootsIDs)
    currentState["WORLD_PICKAXES_ARE_LYING_AROUND"] = isThereXLyingAround(pickaxeIDs)
    currentState["WORLD_SCAFFOLD_BLOCKS_ARE_LYING_AROUND"] = isThereXLyingAround(scaffoldBlockTypes)
    currentState["WORLD_THERE_IS_DIRT_NEARBY"] = areBlocktypesNearby([2, 3])
    currentState["WORLD_SCAFFOLD_BLOCKS_ARE_NEARBY"] = currentState.thereIsDirtNearby
    currentState["WORLD_THERE_ARE_LOGS_NEARBY"] = areBlocktypesNearby([17])
    currentState["WORLD_THERE_IS_A_CRAFTING_BENCH_NEARBY"] = areBlocktypesNearby([58])
    currentState["WORLD_THERE_IS_A_FURNACE_NEARBY"] = areBlocktypesNearby([61])

    currentState["I_FOOD"] = getQuantityOfXWeHave(foodIDs)
    currentState["I_TORCHES"] = getQuantityOfXWeHave([50])
    currentState["I_SATIATION"] = bot.food
    currentState["I_WOODEN_SWORDS"] = getQuantityOfXWeHave([268])
    currentState["I_STONE_SWORDS"] = getQuantityOfXWeHave([272])
    currentState["I_IRON_SWORDS"] = getQuantityOfXWeHave([267])
    currentState["I_DIAMOND_SWORDS"] = getQuantityOfXWeHave([276])
    currentState["I_SWORDS"] = getQuantityOfXWeHave(swordIDs)
    currentState["I_WOODEN_PICKAXES"] = getQuantityOfXWeHave([270])
    currentState["I_STONE_PICKAXES"] = getQuantityOfXWeHave([274])
    currentState["I_IRON_PICKAXES"] = getQuantityOfXWeHave([257])
    currentState["I_PICKAXES"] = getQuantityOfXWeHave(pickaxeIDs)
    currentState["I_SHOVELS"] = getQuantityOfXWeHave([269, 273, 256, 277, 284])
    currentState["I_AXES"] = getQuantityOfXWeHave([271, 275, 258, 279, 286])
    currentState["I_HOES"] = getQuantityOfXWeHave([290, 291, 292, 293, 294])
    currentState["I_FLINTS_AND_STEELS"] = getQuantityOfXWeHave([259])
    currentState["I_SHEARS"] = getQuantityOfXWeHave([270])
    currentState["I_FISHING_RODS"] = getQuantityOfXWeHave([346])
    currentState["I_LEADS"] = getQuantityOfXWeHave([420])
    currentState["I_DIAMOND_HELMETS"] = getQuantityOfXWeHave([310])
    currentState["I_HELMETS"] = getQuantityOfXWeHave(helmetIDs)
    currentState["I_DIAMOND_CHESTPLATES"] = getQuantityOfXWeHave([311])
    currentState["I_CHESTPLATES"] = getQuantityOfXWeHave(chestplateIDs)
    currentState["I_DIAMOND_LEGGINGS"] = getQuantityOfXWeHave([312])
    currentState["I_LEGGINGS"] = getQuantityOfXWeHave(leggingsIDs)
    currentState["I_DIAMOND_BOOTS"] = getQuantityOfXWeHave([313])
    currentState["I_BOOTS"] = getQuantityOfXWeHave(bootsIDs)
    currentState["I_SCAFFOLD_BLOCKS"] = getQuantityOfXWeHave(scaffoldBlockTypes)
    currentState["I_DIRT"] = getQuantityOfXWeHave([2, 3])
    currentState["I_PLANKS"] = getQuantityOfXWeHave([5])
    currentState["I_LOGS"] = getQuantityOfXWeHave([17])
    currentState["I_CRAFTING_BENCHES"] = getQuantityOfXWeHave([58])
    currentState["I_STICKS"] = getQuantityOfXWeHave([280])
    currentState["I_DIAMONDS"] = getQuantityOfXWeHave([264])
    currentState["I_IRON_ORE"] = getQuantityOfXWeHave([15])
    currentState["I_COAL"] = getQuantityOfXWeHave([263])
    currentState["I_FURNACES"] = getQuantityOfXWeHave([61])
    currentState["I_COBBLESTONE"] = getQuantityOfXWeHave([4])
    currentState["I_IRON"] = getQuantityOfXWeHave([265])

    currentState["I_JUST_EXPLORED"] = false
    currentState["I_FULL_DIAMOND"] = false
}

function AI()
{
    console.log("AI() being run.")
    setInterval(updateCurrentAction, 700)
    setInterval(detectSpam, 3000)
}

function getActionsWeCanTake(state)
{
    var actionsWeCanTake = []
    for (var i in actions)
    {
        if (actions.hasOwnProperty(i))
        {
            if (actions[i].preconditions(state))
            {
                actionsWeCanTake.push(i);
            }
        }
    }
    return actionsWeCanTake
}

// CODE ADAPTED FROM https://www.redblobgames.com/pathfinding/a-star/introduction.html
function AStar(start, goal)
{
    var frontier = new PriorityQueue()
    var actionList = new PriorityQueue()
    frontier.push(start, 0)
    actionList.push(start, 0)
    came_from = []
    cost_so_far = []
    came_from[JSON.stringify(start)] = [null, null]
    cost_so_far[JSON.stringify(start)] = 0

    iterationCounter = 0

    var lastState

    while (frontier.size() > 0)
    {
        iterationCounter++
        current = frontier.pop()
        actionList.pop()
        reachedGoal = true
        if (!goal.validate(start, current))
        {
            reachedGoal = false
        }

        lastState = current

        if (reachedGoal)
        {
            console.log('A* reached goal.')
            break
        }

        if (iterationCounter > 64)
        {
            break
        }
        actionsWeCanTake = getActionsWeCanTake(current)
        for (next in actionsWeCanTake)
        {

            nextAsAState = actions[actionsWeCanTake[next]].postconditions(JSON.parse(JSON.stringify(current)))

            new_cost = cost_so_far[JSON.stringify(current)] + actions[actionsWeCanTake[next]].cost

            if (!(JSON.stringify(nextAsAState) in cost_so_far) || Object.keys(cost_so_far).length === 0 || new_cost < cost_so_far[JSON.stringify(nextAsAState)])
            {
                cost_so_far[JSON.stringify(nextAsAState)] = new_cost
                priority = new_cost + heuristic(goal, nextAsAState)
                frontier.push(nextAsAState, priority)
                actionList.push(actionsWeCanTake[next], priority)
                currentStateAndAction = []
                currentStateAndAction[0] = JSON.stringify(current)
                currentStateAndAction[1] = actionsWeCanTake[next]
                came_from[JSON.stringify(nextAsAState)] = currentStateAndAction
            }
        }
    }

    // 0 is state, 1 is action
    listOfActionsToTakeInReverseOrder = []
    listOfActionsToTakeInReverseOrder.push(came_from[JSON.stringify(lastState)][1])
    nextStateInChain = came_from[JSON.stringify(lastState)][0]

    if (typeof came_from[nextStateInChain] !== "undefined" && came_from[nextStateInChain] !== null && came_from[nextStateInChain][1] !== null)
    {
        listOfActionsToTakeInReverseOrder.push(came_from[nextStateInChain][1])
    }
    while (came_from.hasOwnProperty(nextStateInChain)) // To deal with the end of the chain.
    {
        nextStateInChain = came_from[nextStateInChain][0]
        if (typeof came_from[nextStateInChain] !== "undefined" && came_from[nextStateInChain] !== null && came_from[nextStateInChain][1] !== null) // This is to deal with the end of the chain and any other possible
        // problems.
        {
            listOfActionsToTakeInReverseOrder.push(came_from[nextStateInChain][1])
        }
    }
    return listOfActionsToTakeInReverseOrder.reverse()
}

function heuristic(a, b)
{
    atLeastOneMatch = false
    // a is the goal, b is the current state.
    d = 0
    // For every state in b
    for (var s in b)
    {
        // If that state is in a
        if (s in a.states)
        {
            atLeastOneMatch = true
            // If they don't match
            if (b[s] != a.states[s])
            {
                if (isNaN(a.states[s])) // If this state is not a number
                {
                    // Increase the (numerical) distance that we are away from state b.
                    d++
                } else // otherwise add the difference to the distance.
                {
                    d += Math.abs(a.states[s] - b[s])
                }
            }
        }
    }
    return d
}

// END OF CODE ADAPTED FROM https://www.redblobgames.com/pathfinding/a-star/introduction.html

function updateCurrentAction()
{
    if (attackMode)
    {
        executeAttackMode()
    } else if (isActionComplete())
        {
            if (actionQueue.isEmpty())
            {
                if (GOAPDone)
                {
                    doGOAP()
                }
                if (currentPlan != null)
                {
                    addActionToActionQueue(currentPlan[0])
                }
            } else
            {
                doAction()
            }
        }
}

function addActionToActionQueue(actionName)
{
    actionQueue.enqueue(actionName)
}

function isActionComplete()
{
    return !isWaitingForNavigationToComplete && !attackMode && !isWaitingForEatingToComplete
}

function doAction()
{
    // The links between the actions and their associated functions.
    if (isActionComplete())
    {
        newAction = actionQueue.dequeue()
        switch (newAction)
        {
            case 'findFoodLyingAround':
                actionFindXOnFloor(foodIDs)
                break
            case 'killFoodBearingAnimals':
                actionKillFoodBearingMob()
                break
            case 'eatFood':
                actionEatFood()
                break
            case 'findSwordLyingAround':
                actionFindXOnFloor(swordIDs)
                break
            case 'findHelmetLyingAround':
                actionFindXOnFloor(helmetIDs)
                break
            case 'findChestplateLyingAround':
                actionFindXOnFloor(chestplateIDs)
                break
            case 'findLeggingsLyingAround':
                actionFindXOnFloor(leggingsIDs)
                break
            case 'findBootsLyingAround':
                actionFindXOnFloor(bootsIDs)
                break
            case 'findPickaxeLyingAround':
                actionFindXOnFloor(pickaxeIDs)
                break
            case 'idleAction':
                break
            case 'findScaffoldBlocksLyingAround':
                actionFindXOnFloor(scaffoldBlockTypes)
                break
            case 'mineDirt':
                mine([2, 3])
                break
            case 'explore':
                exploreAction()
                break
            case 'mineLogs':
                mine([17])
                break
            case 'craftPlanks':
                craft(5, null, 1, false, 1)
                break
            case 'craftCraftingBench':
                craft(58, null, 1, false, 1)
                break
            case 'craftSticks':
                craft(280, null, 1, false, 1)
                break
            case 'craftWoodenPickaxe':
                craft(270, null, 1, true, 1)
                break
            case 'placeCraftingBench':
                equip(58)
                place()
                break
        }
    }
}

// A function for responding to attacks from entities the Bloodhound plugin cannot detect
function dealWithMobsBloodhoundCantDetect(entity)
{
    if (thereAreMobsBloodhoundCantDetectNearby())
    {
        if (targetEntity != null)
        {
            if (entity.username == bot.username && (!attackMode || targetEntity.kind == 'Passive mobs'))
            {
                detectAndAttackMobWhichBloodhoundCantDetect()
            }
        } else
        {
            if (entity.username == bot.username && (!attackMode))
            {
                detectAndAttackMobWhichBloodhoundCantDetect()
            }
        }
    }
}

function actionFindXOnFloor(IDList)
{
    allStrayItems = findAllStrayItems()
    strayItems = []

    ourPosition = bot.entity.position
    currentClosestIndex = 0
    currentShortestDistance = 99999.0

    for (i = 0; i < allStrayItems.length; i++)
    {
        if (allStrayItems[i].metadata['6'] != null)
        {
            if (IDList.includes(allStrayItems[i].metadata['6'].blockId))
            {
                distanceFromUs = ourPosition.distanceTo(allStrayItems[i].position)
                strayItems.push(allStrayItems[i])
                if (distanceFromUs < currentShortestDistance)
                {
                    currentShortestDistance = distanceFromUs
                    currentClosestIndex = strayItems.length - 1
                }
            }
        }
    }
    if (strayItems.length > 0)
    {
        goToLocation(strayItems[currentClosestIndex].position)
        if (mcdata.items[strayItems[currentClosestIndex].metadata['6'].blockId] != null)
        {
            chat('I found ' + mcdata.items[strayItems[currentClosestIndex].metadata['6'].blockId].displayName + '.')
            console.log('I found ' + mcdata.items[strayItems[currentClosestIndex].metadata['6'].blockId].displayName + '.')
        } else if (mcdata.blocks[strayItems[currentClosestIndex].metadata['6'].blockId] != null)
        {
            chat('I found ' + mcdata.blocks[strayItems[currentClosestIndex].metadata['6'].blockId].displayName + '.')
            console.log('I found ' + mcdata.blocks[strayItems[currentClosestIndex].metadata['6'].blockId].displayName + '.')
        } else
        {
            chat('I found ' + strayItems[currentClosestIndex].metadata['6'].blockId + '.')
            console.log('I found ' + strayItems[currentClosestIndex].metadata['6'].blockId + '.')
        }
    } else
    {
        chat('I was unable to find any stray items.')
        console.log('I was unable to find any stray items.')
    }
}

function isThereXLyingAround(IDList)
{
    allStrayItems = findAllStrayItems()
    for (i = 0; i < allStrayItems.length; i++)
    {
        if (allStrayItems[i].metadata['6'] != null)
        {
            if (IDList.includes(allStrayItems[i].metadata['6'].blockId))
            {
                return true
            }
        }
    }
    return false
}

function actionKillFoodBearingMob()
{
    ourPosition = bot.entity.position
    mobsWeCouldKill = []
    currentClosestIndex = 0
    currentShortestDistance = 99999.0

    // This searches fore mobs in a priority order, from easiest to get food from to hardest.
    // First search for passive mobs
    Object.entries(bot.entities).forEach(entry =>
    {
        if (foodBearingPassiveMobs.includes(entry[1].name))
        {
            distanceFromUs = ourPosition.distanceTo(entry[1].position)
            mobsWeCouldKill.push(entry[1])
            if (distanceFromUs < currentShortestDistance)
            {
                currentShortestDistance = distanceFromUs
                currentClosestIndex = mobsWeCouldKill.length - 1
            }
        }
    })

    if (mobsWeCouldKill.length > 0)
    {
        mobToKill = mobsWeCouldKill[currentClosestIndex]
        initialiseKillingMode(mobToKill)
    } else
    {
        // Then unused mobs
        Object.entries(bot.entities).forEach(entry =>
        {
            if (foodBearingUnusedMobs.includes(entry[1].name))
            {
                distanceFromUs = ourPosition.distanceTo(entry[1].position)
                mobsWeCouldKill.push(entry[1])
                if (distanceFromUs < currentShortestDistance)
                {
                    currentShortestDistance = distanceFromUs
                    currentClosestIndex = mobsWeCouldKill.length - 1
                }
            }
        })
        if (mobsWeCouldKill.length > 0)
        {
            mobToKill = mobsWeCouldKill[currentClosestIndex]
            initialiseKillingMode(mobToKill)
        } else
        {
            // Then defensive mobs
            Object.entries(bot.entities).forEach(entry =>
            {
                if (foodBearingDefensiveMobs.includes(entry[1].name))
                {
                    distanceFromUs = ourPosition.distanceTo(entry[1].position)
                    mobsWeCouldKill.push(entry[1])
                    if (distanceFromUs < currentShortestDistance)
                    {
                        currentShortestDistance = distanceFromUs
                        currentClosestIndex = mobsWeCouldKill.length - 1
                    }
                }
            })
            if (mobsWeCouldKill.length > 0)
            {
                mobToKill = mobsWeCouldKill[currentClosestIndex]
                initialiseKillingMode(mobToKill)
            } else
            {
                // Then neutral mobs
                Object.entries(bot.entities).forEach(entry =>
                {
                    if (foodBearingNeutralMobs.includes(entry[1].name))
                    {
                        distanceFromUs = ourPosition.distanceTo(entry[1].position)
                        mobsWeCouldKill.push(entry[1])
                        if (distanceFromUs < currentShortestDistance)
                        {
                            currentShortestDistance = distanceFromUs
                            currentClosestIndex = mobsWeCouldKill.length - 1
                        }
                    }
                })
                if (mobsWeCouldKill.length > 0)
                {
                    mobToKill = mobsWeCouldKill[currentClosestIndex]
                    initialiseKillingMode(mobToKill)
                } else
                {
                    // Then hostile mobs
                    Object.entries(bot.entities).forEach(entry =>
                    {
                        if (foodBearingHostileMobs.includes(entry[1].name))
                        {
                            distanceFromUs = ourPosition.distanceTo(entry[1].position)
                            mobsWeCouldKill.push(entry[1])
                            if (distanceFromUs < currentShortestDistance)
                            {
                                currentShortestDistance = distanceFromUs
                                currentClosestIndex = mobsWeCouldKill.length - 1
                            }
                        }
                    })
                    mobToKill = mobsWeCouldKill[currentClosestIndex]
                    initialiseKillingMode(mobToKill)
                }
            }
        }
    }
}

function initialiseKillingMode(mobToKill)
{
    targetEntity = mobToKill
    if (targetEntity != null)
    {
        attackMode = true
        chat('Attacking a ' + targetEntity.displayName + '.')
        console.log('Attacking a ' + targetEntity.displayName + '.')
    }
}

function executeAttackMode()
{
    if (targetEntity.isValid == false || targetEntity == null)
    {
        attackMode = false
        return
    }
    if (!isWaitingForNavigationToComplete)
    {
        var i
        outer:
        for (j = 0; j < weaponIDsAndDamagePerSecond.length; j++)
        {
            for (i = 0; i < bot.inventory.slots.length; i++)
            {
                if (bot.inventory.slots[i] != null)
                {
                    if (bot.inventory.slots[i].type == weaponIDsAndDamagePerSecond[j].id)
                    {
                        try
                        {
                            bot.equip(bot.inventory.slots[i], 'hand')
                        } catch (error)
                        {
                            server.log(error)
                        }
                        break outer
                    }
                }
            }
        }
        theirLocation = targetEntity.position
        ourLocation = bot.entity.position
        if (ourLocation.distanceTo(theirLocation) > 4.0)
        {
            goToLocation(theirLocation)
        }
        actuallyAttack()
    }
}

// Modified code from Mineflayer ----------------------------
function actuallyAttack()
{
    if (bot.entity.position.distanceTo(targetEntity.position) <= 4.0)
    {
        bot.lookAt(targetEntity.position)
        bot._client.write('arm_animation', { hand: 0 })
        bot.attack(targetEntity)
    }
}
// End of Modified code from Mineflayer ---------------------

function areThereFoodBearingMobsNearby()
{
    foodBearingMobFound = false
    Object.entries(bot.entities).forEach(entry =>
    {
        if (foodBearingPassiveMobs.includes(entry[1].name) || foodBearingUnusedMobs.includes(entry[1].name) || foodBearingDefensiveMobs.includes(entry[1].name) || foodBearingNeutralMobs.includes(entry[1].name) || foodBearingHostileMobs.includes(entry[1].name))
        {
            foodBearingMobFound = true
        }
    })
    return foodBearingMobFound
}

function findAllStrayItems()
{
    strayItems = []

    Object.entries(bot.entities).forEach(entry =>
    {
        if (entry[1].type == 'object')
        {
            strayItems.push(entry[1])
        }
    })
    return strayItems
}

function actionEatFood()
{
    if (currentState["I_SATIATION"] >= 20)
    {
        console.log('Eating cancelled since already full')
        return
    }
    var i
    for (i = 0; i < bot.inventory.slots.length; i++)
    {
        if (bot.inventory.slots[i] != null)
        {
            if (foodIDs.includes(bot.inventory.slots[i].type))
            {
                bot.equip(bot.inventory.slots[i], 'hand')
                bot.activateItem()
                isWaitingForEatingToComplete = true
                setTimeout(setIsWaitingForEatingToCompleteToFalse, 8000)
                return
            }
        }
    }
}

function setIsWaitingForEatingToCompleteToFalse()
{
    isWaitingForEatingToComplete = false
    return
}

function thereAreMobsBloodhoundCantDetectNearby()
{
    mobFound = false
    Object.entries(bot.entities).forEach(entry =>
    {
        // 16 because that's the detection range of a Skeleton
        if (mobsBloodhoundCantDetect.includes(entry[1].name) && bot.entity.position.distanceTo(entry[1].position) <= 16.0)
        {
            mobFound = true
        }
    })
    return mobFound
}

function detectAndAttackMobWhichBloodhoundCantDetect()
{
    ourPosition = bot.entity.position
    mobsWeCouldKill = []
    currentClosestIndex = 0
    currentShortestDistance = 99999.0

    // First search for passive mobs
    Object.entries(bot.entities).forEach(entry =>
    {
        if (mobsBloodhoundCantDetect.includes(entry[1].name))
        {
            distanceFromUs = ourPosition.distanceTo(entry[1].position)
            mobsWeCouldKill.push(entry[1])
            if (distanceFromUs < currentShortestDistance)
            {
                currentShortestDistance = distanceFromUs
                currentClosestIndex = mobsWeCouldKill.length - 1
            }
        }
    })

    if (mobsWeCouldKill.length > 0)
    {
        mobToKill = mobsWeCouldKill[currentClosestIndex]
        declareNavigationComplete()
        isWaitingForEatingToComplete = false
        initialiseKillingMode(mobToKill)
    }
}

function areBlocktypesNearby(blockIDs)
{
    for (i = 0; i < blockIDs.length; i++)
    {
        // MODIFIED CODE FROM https://github.com/Darthfett/mineflayer-blockFinder
        if (bot.findBlockSerially({
            point: bot.entity.position,
            matching: blockIDs[i],
            maxDistance: 128,
            count: 1,
        }).length)
        {
            return true
        }
        // END OF MODIFIED CODE FROM https://github.com/Darthfett/mineflayer-blockFinder
    }
    return false
}

function mine(blockIDs)
{
    var blockFound
    for (i = 0; i < blockIDs.length; i++)
    {
        // MODIFIED CODE FROM https://github.com/Darthfett/mineflayer-blockFinder
        
        if (bot.findBlockSerially({
            point: bot.entity.position,
            matching: blockIDs[i],
            maxDistance: 256,
            count: 1,
        }).length)
        {
            if (!navigationFailed)
            {
                blockFound = bot.findBlockSerially({
                    point: bot.entity.position,
                    matching: blockIDs[i],
                    maxDistance: 256,
                    count: 1,
                })[0]
            } else if (bot.findBlockSerially({
                point: bot.entity.position,
                matching: blockIDs[i],
                maxDistance: 256,
                count: 2,
            }).length > 1)
            {
                blockFound = bot.findBlockSerially({
                    point: bot.entity.position,
                    matching: blockIDs[i],
                    maxDistance: 256,
                    count: 2,
                })[1]
            }
            break
        }
        // END OF MODIFIED CODE FROM https://github.com/Darthfett/mineflayer-blockFinder
    }
    chat('Mining ' + blockFound.displayName + '.')
    console.log('Mining ' + blockFound.displayName + '.')
    goToLocation(blockFound.position)
}

function findBlock(id)
{
    // MODIFIED CODE FROM https://github.com/Darthfett/mineflayer-blockFinder
    if (bot.findBlockSerially({
        point: bot.entity.position,
        matching: id,
        maxDistance: 256,
        count: 1,
    }).length)
    {
        if (!navigationFailed)
        {
            blockFound = bot.findBlockSerially({
                point: bot.entity.position,
                matching: id,
                maxDistance: 256,
                count: 1,
            })[0]
            return blockFound
        } else if (bot.findBlockSerially({
            point: bot.entity.position,
            matching: id,
            maxDistance: 256,
            count: 2,
        }).length > 1)
        {
            blockFound = bot.findBlockSerially({
                point: bot.entity.position,
                matching: id,
                maxDistance: 256,
                count: 2,
            })[1]
            return blockFound
        }
    }
    // END OF MODIFIED CODE FROM https://github.com/Darthfett/mineflayer-blockFinder
    return null
}

function getQuantityOfXWeHave(IDList)
{
    itemCount = 0
    var i
    for (i = 0; i < bot.inventory.slots.length; i++)
    {
        if (bot.inventory.slots[i] != null)
        {
            if (IDList.includes(bot.inventory.slots[i].type))
            {
                itemCount += bot.inventory.slots[i].count
            }
        }
    }
    return itemCount
}

function exploreAction(){}

function craft(itemType, metadata, minResultCount, needsCraftingTable, count)
{
    var craftingTable = null
    if (needsCraftingTable)
    {
        craftingTable = findBlock(58)
    }
    bot.craft(bot.recipesFor(itemType, metadata, minResultCount, craftingTable)[0], count, craftingTable, actionFindXOnFloor([itemType]))
}

function equip(id)
{
    var i
    for (i = 0; i < bot.inventory.slots.length; i++)
    {
        if (bot.inventory.slots[i] != null)
        {
            if (bot.inventory.slots[i].type == id)
            {
                bot.equip(bot.inventory.slots[i], 'hand')
                return
            }
        }
    }
}

function place()
{
    var theBlock = bot.blockAt(bot.entity.position.offset(1, -1, 0))
    bot.placeBlock(theBlock, new vec3(0, 1, 0))
}

// ------------------------------ Navigation ------------------------------

function goToLocation(position)
{
    isWaitingForNavigationToComplete = true
    bot.scaffold.to(position)
}

function declareNavigationComplete()
{
    isWaitingForNavigationToComplete = false
    navigationFailed = false
}

// --------------------------------- Chat ---------------------------------

function chat(thingToSay) 
{
    bot.chat(thingToSay)
    say.speak(thingToSay)
}

// ---------------------------- Error Detection ----------------------------

function detectSpam()
{
    scaffoldChangeStateCount = 0
}

// ================================ QUEUE.JS ==================================

/*

Queue.js

A function to represent a queue

Created by Kate Morley - http://code.iamkate.com/ - and released under the terms
of the CC0 1.0 Universal legal code:

http://creativecommons.org/publicdomain/zero/1.0/legalcode

*/

/* Creates a new queue. A queue is a first-in-first-out (FIFO) data structure -
 * items are added to the end of the queue and removed from the front.
 */
function Queue()
{

    // initialise the queue and offset
    var queue = [];
    var offset = 0;

    // Returns the length of the queue.
    this.getLength = function ()
    {
        return (queue.length - offset);
    }

    // Returns true if the queue is empty, and false otherwise.
    this.isEmpty = function ()
    {
        return (queue.length == 0);
    }

    /* Enqueues the specified item. The parameter is:
     *
     * item - the item to enqueue
     */
    this.enqueue = function (item)
    {
        queue.push(item);
    }

    /* Dequeues an item and returns it. If the queue is empty, the value
     * 'undefined' is returned.
     */
    this.dequeue = function ()
    {

        // if the queue is empty, return immediately
        if (queue.length == 0) return undefined;

        // store the item at the front of the queue
        var item = queue[offset];

        // increment the offset and remove the free space if necessary
        if (++offset * 2 >= queue.length)
        {
            queue = queue.slice(offset);
            offset = 0;
        }

        // return the dequeued item
        return item;

    }

    /* Returns the item at the front of the queue (without dequeuing it). If the
     * queue is empty then undefined is returned.
     */
    this.peek = function ()
    {
        return (queue.length > 0 ? queue[offset] : undefined);
    }

}
// ============================= End of Queue.js ===============================

// CODE FROM https://lowrey.me/priority-queue-in-es6-javascript/
class PriorityQueue
{
    constructor()
    {
        this.data = [];
    }

    push(value, priority = 0)
    {
        return this.data.push({
            value: value,
            priority: priority
        });
    }

    pop()
    {
        let index = 0;
        let min = Infinity;
        for (let i = 0; i < this.data.length; i++)
        {
            let priority = this.data[i].priority;
            if (Math.min(min, priority) === priority)
            {
                min = priority;
                index = i;
            }
        }
        return this.data.splice(index, 1)[0].value;
    }

    size()
    {
        return this.data.length;
    }
}

// END OF CODE FROM https://lowrey.me/priority-queue-in-es6-javascript/