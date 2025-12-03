function parseCraftCommand(args) {
    if (args.length === 0) {
        return {
            type: 'MENU',
            itemName: null,
            amount: 1
        };
    }

    if (args[0].toLowerCase() === 'history') {
        return {
            type: 'HISTORY',
            itemName: null,
            amount: 1
        };
    }

    let craftAmount = 1;
    let itemName = args.join(' ').trim();

    if (args.length > 1) {
        const lastArg = args[args.length - 1];
        const firstArg = args[0];

        if (!isNaN(lastArg)) {
            craftAmount = parseInt(lastArg);
            itemName = args.slice(0, -1).join(' ').trim();
        } else if (!isNaN(firstArg)) {
            craftAmount = parseInt(firstArg);
            itemName = args.slice(1).join(' ').trim();
        }
    }

    return {
        type: 'CRAFT',
        itemName,
        amount: craftAmount
    };
}

module.exports = {
    parseCraftCommand
};