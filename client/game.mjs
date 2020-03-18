function findShortestPath(start, finish, mapYX, dangerPoints = []) {
    console.time('PUK');
    const distanceMapYX = [];
    const queue = [start];
    const mapWidth = mapYX[0].length;
    const mapHeight = mapYX.length;

    for (let i = 0; i < mapHeight; i++) {
        distanceMapYX.push(Array(mapWidth).fill(-1));
    }

    distanceMapYX[start.y][start.x] = 0;

    while (distanceMapYX[finish.y][finish.x] === -1 && queue.length > 0) {
        let { x: pointX, y: pointY } = queue.shift();
        let distance = distanceMapYX[pointY][pointX];

        for (let x = pointX - 1; x <= pointX + 1; x++) {
            for (let y = pointY - 1; y <= pointY + 1; y++) {
                if (x === pointX && y === pointY || x !== pointX && y !== pointY) {
                    continue;
                }

                if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight && mapYX[y][x] !== '#' && distanceMapYX[y][x] === -1 && !dangerPoints.some(({x: dangerPointX, y: dangerPointY}) => x === dangerPointX && y === dangerPointY)) {
                    queue.push({ x, y });
                    distanceMapYX[y][x] = distance + 1;
                }
            }
        }
    }

    if (distanceMapYX[finish.y][finish.x] !== -1) {
        const path = [];

        let { x, y } = finish;

        while (x !== start.x || y !== start.y) {
            path.push({ x, y });

            if (x - 1 >= 0 && distanceMapYX[y][x - 1] === distanceMapYX[y][x] - 1) {
                x--;
            } else if (x + 1 < mapWidth && distanceMapYX[y][x + 1] === distanceMapYX[y][x] - 1) {
                x++;
            } else if (y - 1 >= 0 && distanceMapYX[y - 1][x] === distanceMapYX[y][x] - 1) {
                y--;
            } else if (y + 1 < mapHeight && distanceMapYX[y + 1][x] === distanceMapYX[y][x] - 1) {
                y++;
            }
        }

        path.push({ x: start.x, y: start.y });
        console.timeEnd('PUK');
        return path.reverse();
    } else {
        return null;
    }
}

function getRoutesToPorts(gameState, mapYX) {
    const routes = [];

    for (let i = 0; i < gameState.ports.length; i++) {
        routes[i] = [];

        for (let j = 0; j < gameState.ports.length; j++) {
            routes[i][j] = j === i ? null :
                j < i ? routes[j][i].slice().reverse() :
                    findShortestPath(gameState.ports[i], gameState.ports[j], mapYX);
        }
    }

    return routes;
}

function configureBestPayloadHold(tradeInfo, goods, portPrices, turnsForRoute, hold = [], freeSpace = HOLD_VOLUME, income = 0) {
    let maxAmount;
    let factAmount;
    let product;
    let newIncome;
    let newTurnsForRoute;
    let newPayload;
    let newFreeSpace;

    const { portId, ...prices } = portPrices;

    Object.entries(prices).forEach(([name, cost]) => {
        product = goods.find(product => product.name === name);

        if (product && hold.findIndex(({ name: productInHoldName }) => productInHoldName === name) === -1) {
            maxAmount = Math.floor(freeSpace / product.volume);
            factAmount = product.amount > maxAmount ? maxAmount : product.amount;

            if (factAmount > 0) {
                newTurnsForRoute = turnsForRoute + TURNS_FOR_LOAD_UNLOAD;
                newIncome = income + factAmount * cost;
                newPayload = newIncome / newTurnsForRoute;
                newFreeSpace = freeSpace - factAmount * product.volume;

                hold.push({ name, amount: factAmount });

                if (newPayload > tradeInfo.payload) {
                    tradeInfo.payload = newPayload;
                    tradeInfo.goodsToLoad = hold.slice();
                    tradeInfo.portId = portId;
                }

                if (newFreeSpace > 0) {
                    configureBestPayloadHold(tradeInfo, goods, portPrices, newTurnsForRoute, hold, newFreeSpace, newIncome);
                }

                hold.pop();
            }
        }
    });
}

function getTradeInfo(portsPrices, goods, routes, homePortId) {
    const tradeInfo = { payload: 0 };
    
    let turnsForRoute;

    portsPrices.forEach(portPrices => {
        turnsForRoute = (routes[homePortId][portPrices.portId].length - 1) * 2;

        configureBestPayloadHold(tradeInfo, goods, portPrices, turnsForRoute);
    });

    return tradeInfo;
}

function getLoadCommand({ name, amount }) {
    return `LOAD ${name} ${amount}`;
}

function getSellComand({ name, amount }) {
    return `SELL ${name} ${amount}`;
}

function getMoveCommand(pirates, routeInfo, currentPositionX, currentPositionY) {
    let { x: nextPositionX, y: nextPositionY } = routeInfo.route[routeInfo.positionOnRoute + 1];
    
    for (let i = 0; i < pirates.length; i++) {
        const { x, y } = pirates[i];
        const xDifference = Math.abs(nextPositionX - x);
        const yDifference = Math.abs(nextPositionY - y);

        if (xDifference === 1 && yDifference === 0 || xDifference === 0 && yDifference === 1) {
            return 'WAIT';
        }

        if (xDifference === 0 && yDifference === 0) {
            routeInfo.route = findShortestPath({x: currentPositionX, y: currentPositionY}, routeInfo.route[routeInfo.route.length - 1], mapYX, [{x, y}]);
            routeInfo.positionOnRoute = 0;
            return getMoveCommand(pirates, routeInfo, currentPositionX, currentPositionY);
        }
    }

    routeInfo.positionOnRoute++;

    if (currentPositionX !== nextPositionX) {
        return nextPositionX > currentPositionX ? 'E' : 'W';
    }

    if (currentPositionY !== nextPositionY) {
        return nextPositionY > currentPositionY ? 'S' : 'N';
    }
}

function getRouteInfo(currentPortId, nextPortId) {
    return { route: routes[currentPortId][nextPortId], positionOnRoute: 0 };
}

const HOLD_VOLUME = 368;
const TURNS_FOR_LOAD_UNLOAD = 2;

let mapYX;
let routes;
let homePortId;
let tradeInfo;
let currentRoute;

export function startGame(levelMap, gameState) {
    mapYX = levelMap.split('\n');
    routes = getRoutesToPorts(gameState, mapYX);
    homePortId = gameState.ports.find(port => port.isHome).portId;
    tradeInfo = null;
    currentRoute = null;
}

export function getNextCommand(gameState) {
    const { ship: { x, y, goods: goodsInShip }, prices: portsPrices, goodsInPort, pirates } = gameState;
    const currentPosition = mapYX[y][x];

    let command;

    // if (currentPosition === 'H') {
    //     if (!tradeInfo) {
    //         tradeInfo = getTradeInfo(portsPrices, goodsInPort, routes, homePortId);
    //     }

    //     if (tradeInfo.goodsToLoad.length) {
    //         command = getLoadCommand(tradeInfo.goodsToLoad.pop());
    //     } else {
    //         currentRoute = getRouteInfo(homePortId, tradeInfo.portId);
    //         command = getMoveCommand(pirates, currentRoute, x, y);
    //     }
    // } else if (currentPosition === 'O') {
    //     if (goodsInShip.length) {
    //         command = getSellComand(goodsInShip[0]);
    //     } else {
    //         currentRoute = getRouteInfo(tradeInfo.portId, homePortId);
    //         command = getMoveCommand(pirates, currentRoute, x, y);
    //         tradeInfo = null;
    //     }
    // } else {
    //     command = getMoveCommand(pirates, currentRoute, x, y);
    // }

    switch (currentPosition) {
        case 'H':
            if (!tradeInfo) {
                tradeInfo = getTradeInfo(portsPrices, goodsInPort, routes, homePortId);
            }

            if (tradeInfo.goodsToLoad.length) {
                command = getLoadCommand(tradeInfo.goodsToLoad.pop());
            } else {
                currentRoute = getRouteInfo(homePortId, tradeInfo.portId);
                command = getMoveCommand(pirates, currentRoute, x, y);
            }

            break;
        case 'O':
            if (goodsInShip.length) {
                command = getSellComand(goodsInShip[0]);
            } else {
                currentRoute = getRouteInfo(tradeInfo.portId, homePortId);
                command = getMoveCommand(pirates, currentRoute, x, y);
                tradeInfo = null;
            }

            break;
        default:
            command = getMoveCommand(pirates, currentRoute, x, y);
    }

    console.log(command);
    return command;
}
