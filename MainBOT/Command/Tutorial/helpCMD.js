const tutorialCommands = {
  tutorial: [
    { name: '.starter', value: 'Kickstart your journey! Claim your starter pack of coins and gems if you have W luck.' },
    { name: '.daily || .d', value: 'Daily treasures await! Claim your daily bonus of coins and gems if you have W luck.' },
    { name: '.library || .li', value: 'Show the fumo you have discovered.' },
    { name: '.inform || .in (NameOfFumo+rarity)', value: 'Want to learn more about a fumo? Use this command.' },
    { name: '.sell || .s', value: 'Need some space? Sell fumos from your inventory (Cruel).' },
    { name: '.code', value: 'Enter your code here!' },
    { name: '.quest || .qu', value: 'Show the quest...' },
    { name: '.claim || .cl', value: 'Claim the quest...' },
  ],
  information: [
    { name: '.storage || .st', value: 'What kind of fumo you have?' },
    { name: '.balance || .b (@user/id)', value: 'How rich are you? Check your coin/gems balance, and much more (You`re not).' },
    { name: '.items || .i', value: 'What\'s in your bag? Naku weed? 10 Starrail Golden Pass? A glock?' },
    { name: '.itemInfo || .it', value: 'Show more detail of an item you wanted to know.' },
    { name: '.use || .u', value: 'Use an item from your item inventory.' },
    { name: '.boost || .bst', value: 'Show your current boost from those item you used.' },
    { name: '.craft || .c', value: 'Show you the way to craft stuff.' },
  ],
  gamble: [
    { name: '.crategacha || .cg', value: 'You`re better off gambling at the event crate.' },
    { name: '.eventgacha || .eg (status)', value: 'You`re better off gambling at the normal crate.' },
    { name: '.pray || .p', value: 'Did you pray today?' },
    { name: '.slot || .sl', value: '99% gambler quit before hitting triple 7, are you the one of that 99%? Let\'s find out!' },
    { name: '.gamble || .g', value: 'I\'m sure you are not winning with this gamble lol.' },
    { name: '.flip || .f (leaderboard)', value: '50/50 time, win or lose.' },
    { name: '.mysteryCrate || .mc', value: 'Guess what prize or penalty is in the crate.' }
  ],
  shop: [
    { name: '.shop || .sh', value: 'I\'m betting 10 bucks that the shop is always broken, and the items are mid as hell.' },
    { name: '.market || .m', value: 'Golden ain\'t selling the good stuff to you.' },
    { name: '.exchange || .e coins/gems', value: 'Desperate to change the currency?' },
    { name: '.eggshop || .es', value: 'The egg shop, go ahead and buy it.' },
  ],
  capitalism: [
    { name: '.addfarm || .af', value: 'Add a fumo to the Wheatfield, we\'re going back to the 1800s with this one 🔥.' },
    { name: '.farmcheck || .fc', value: 'Your fumo caught slacking? Whip them, always make sure to check the farm.' },
    { name: '.endfarm || .ef', value: 'End a fumo\'s suffering.' },
    { name: '.addbest || .ab', value: 'Add all of your best fumo.' },
    { name: '.farminfo || .fi', value: 'All of the farm info.' },
    { name: '.usefragment || .uf', value: 'Use fragment to increase the slot to farm (Why add this?).' },
    { name: '.egginventory || .ei', value: 'Show your current egg and pet and pet equipped yea.' },
    { name: '.eggcheck || .ec', value: 'Check how long your egg will be done hatching, which will never as I delay the update more.' },
    { name: '.useegg || .ue', value: 'Use egg to make it into a fried egg.' },
    { name: '.equippet || .ep', value: 'Equip a pet that will def boost nothing trust.' },
  ],
  misc: [
    { name: '.leaderboard || .le', value: 'Show the top 3 players that haven\'t showered.' },
    { name: '.report', value: 'Report something that I will let slide.' },
    { name: '.credit || .cr', value: 'Detail about this bot/Credit' },
    { name: '.otherCMD', value: 'Show the other command.' },
  ],
};

module.exports = tutorialCommands;