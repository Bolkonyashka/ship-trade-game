function findShortestPath(start, finish, mapYX, options) {
    const distanceMapYX = [];
    const queue = [start];
    const mapWidth = mapYX[0].length;
    const mapHeight = mapYX.length;
    const dangerPoints = options && options.dangerPoints || [];

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

        if (options && options.addStartPoint) {
            path.push({ x: start.x, y: start.y });
        }
        
        return path;
    } else {
        return null;
    }
}

function getRoutesToPorts(ports, mapYX) {
    const routeList = {};
    const homePort = ports.find(port => port.isHome);

    ports.forEach(port => {
        if (!port.isHome) {
            routeList[port.portId] = findShortestPath(homePort, port, mapYX, { addStartPoint: true });
        }
    });

    return routeList;
}

function configureBestPayloadHold(tradeInfo, goodsInPort, portPrices, turnsForRoute, hold = [], freeSpace = HOLD_VOLUME, income = 0) {
    const { portId, ...prices } = portPrices;

    Object.entries(prices).forEach(([name, cost]) => {
        const product = goodsInPort.find(product => product.name === name);

        if (product && !hold.some(({ name: productInHoldName }) => productInHoldName === name)) {
            const maxAmount = Math.floor(freeSpace / product.volume);
            const factAmount = product.amount > maxAmount ? maxAmount : product.amount;

            if (factAmount > 0) {
                const newTurnsForRoute = turnsForRoute + TURNS_FOR_LOAD_AND_SELL;
                const newIncome = income + factAmount * cost;
                const newPayload = newIncome / newTurnsForRoute;
                const newFreeSpace = freeSpace - factAmount * product.volume;

                hold.push({ name, amount: factAmount });

                if (newPayload > tradeInfo.payload) {
                    tradeInfo.payload = newPayload;
                    tradeInfo.goodsToLoad = hold.slice();
                    tradeInfo.portId = portId;
                }

                if (newFreeSpace > 0) {
                    configureBestPayloadHold(tradeInfo, goodsInPort, portPrices, newTurnsForRoute, hold, newFreeSpace, newIncome);
                }

                hold.pop();
            }
        }
    });
}

function getTradeInfo(portsPrices, goodsInPort, routeList) {
    const tradeInfo = { payload: 0 };

    portsPrices.filter(({ portId }) => routeList[portId]).forEach(portPrices => {
        const turnsForRoute = (routeList[portPrices.portId].length - 1) * 2;

        configureBestPayloadHold(tradeInfo, goodsInPort, portPrices, turnsForRoute);
    });

    return tradeInfo;
}

function getRouteInfo(routeList, port, options) {
    const result = routeList[port].slice();

    if (options && options.isToHome) {
        result.reverse();
    }

    result.pop();

    return result;
}

function formLoadCommand({ name, amount }) {
    return `LOAD ${name} ${amount}`;
}

function formSellComand({ name, amount }) {
    return `SELL ${name} ${amount}`;
}

function formUnloadCommand({ name, amount }) {
    return `UNLOAD ${name} ${amount}`;
}

function formWaitCommand() {
    return 'WAIT';
}

function formMoveCommand({ x: currentPositionX, y: currentPositionY }, { x: nextPositionX, y: nextPositionY }) {
    if (currentPositionX !== nextPositionX) {
        return nextPositionX > currentPositionX ? 'E' : 'W';
    }

    if (currentPositionY !== nextPositionY) {
        return nextPositionY > currentPositionY ? 'S' : 'N';
    }
}

const HOLD_VOLUME = 368;
const TURNS_FOR_LOAD_AND_SELL = 2;

let mapYX;
let routeList;
let homePortId;
let tradeInfo;
let currentRoute;

export function startGame(levelMap, gameState) {
    mapYX = levelMap.split('\n');
    routeList = getRoutesToPorts(gameState.ports, mapYX);
    homePortId = gameState.ports.find(port => port.isHome).portId;
    tradeInfo = null;
    currentRoute = null;
    console.log(gameState);
}

export function getNextCommand(gameState) {
    const { ship: { x, y, goods: goodsInShip }, prices: portsPrices, goodsInPort, pirates, ports } = gameState;
    const currentPosition = mapYX[y][x];

    if (currentPosition === 'H') {
        if (!tradeInfo && goodsInShip.length) {
            return formUnloadCommand(goodsInShip[0]);
        }

        if (!tradeInfo) {
            tradeInfo = getTradeInfo(portsPrices, goodsInPort, routeList);
        }

        if (tradeInfo.goodsToLoad.length) {
            return formLoadCommand(tradeInfo.goodsToLoad.pop());
        } else {
            currentRoute = getRouteInfo(routeList, tradeInfo.portId);
        }
    } else if (currentPosition === 'O') {
        if (goodsInShip.length) {
            return formSellComand(goodsInShip[0]);
        } else {
            currentRoute = getRouteInfo(routeList, tradeInfo.portId, { isToHome: true });
            tradeInfo = null;
        }
    } else if (currentPosition === '~' && !currentRoute) {
        currentRoute = findShortestPath({ x, y }, ports.find(port => port.isHome), mapYX);
    }

    const { x: nextPositionX, y: nextPositionY } = currentRoute[currentRoute.length - 1];

    for (let i = 0; i < pirates.length; i++) {
        const { x: pirateShipX, y: pirateShipY } = pirates[i];
        const xDifference = Math.abs(nextPositionX - pirateShipX);
        const yDifference = Math.abs(nextPositionY - pirateShipY);

        if (xDifference === 1 && yDifference === 0 || xDifference === 0 && yDifference === 1) {
            return formWaitCommand();
        }

        if (xDifference === 0 && yDifference === 0) {
            currentRoute = findShortestPath({ x, y }, currentRoute[0], mapYX, { dangerPoints: [{ x: pirateShipX, y: pirateShipY }] });

            break;
        }
    }

    return formMoveCommand({ x, y }, currentRoute.pop());
}