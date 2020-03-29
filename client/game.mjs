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
        const { x: pointX, y: pointY } = queue.shift();
        const distance = distanceMapYX[pointY][pointX];

        for (let x = pointX - 1; x <= pointX + 1; x++) {
            for (let y = pointY - 1; y <= pointY + 1; y++) {
                const isSamePoint = x === pointX && y === pointY;
                const isDiagonalPoint = x !== pointX && y !== pointY;

                if (isSamePoint || isDiagonalPoint) {
                    continue;
                }

                const isCorrectPoint = x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;

                if (isCorrectPoint) {
                    const isPossiblePoint = mapYX[y][x] !== '#';
                    const isNotVisitedPoint = distanceMapYX[y][x] === -1;
                    const isSafePoint = !dangerPoints.some(({ x: dangerPointX, y: dangerPointY }) => x === dangerPointX && y === dangerPointY);

                    if (isPossiblePoint && isSafePoint && isNotVisitedPoint) {
                        queue.push({ x, y });
                        distanceMapYX[y][x] = distance + 1;
                    }
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

function getRoutesToPorts(homePort, ports, mapYX) {
    const routeList = {};

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

    portsPrices.forEach(portPrices => {
        if (routeList[portPrices.portId]) {
            const turnsForRoute = (routeList[portPrices.portId].length - 1) * 2;

            configureBestPayloadHold(tradeInfo, goodsInPort, portPrices, turnsForRoute);
        }
    });

    return tradeInfo;
}

function getRoute(routeList, port, options) {
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
let homePort;
let tradeInfo;
let currentRoute;

export function startGame(levelMap, gameState) {
    mapYX = levelMap.split('\n');
    homePort = gameState.ports.find(port => port.isHome);
    routeList = getRoutesToPorts(homePort, gameState.ports, mapYX);
    tradeInfo = null;
    currentRoute = null;
}

export function getNextCommand(gameState) {
    const { ship: { x, y, goods: goodsInShip }, prices: portsPrices, goodsInPort, pirates } = gameState;
    const currentPosition = mapYX[y][x];

    switch (currentPosition) {
        case 'H':
            if (!tradeInfo && goodsInShip.length) {
                return formUnloadCommand(goodsInShip[0]);
            }

            if (!tradeInfo) {
                tradeInfo = getTradeInfo(portsPrices, goodsInPort, routeList);
            }

            if (tradeInfo.goodsToLoad.length) {
                return formLoadCommand(tradeInfo.goodsToLoad.pop());
            } else {
                currentRoute = getRoute(routeList, tradeInfo.portId);
            }

            break;
        case 'O':
            if (goodsInShip.length) {
                return formSellComand(goodsInShip[0]);
            } else {
                currentRoute = getRoute(routeList, tradeInfo.portId, { isToHome: true });
                tradeInfo = null;
            }

            break;
        case '~':
            if (!currentRoute) {
                currentRoute = findShortestPath({ x, y }, homePort, mapYX);
            }
    }

    const { x: nextPositionX, y: nextPositionY } = currentRoute[currentRoute.length - 1];

    let needToWait = false;
    let needToManeuver = false;

    pirates.forEach(({ x: pirateShipX, y: pirateShipY }) => {
        const xDifference = Math.abs(nextPositionX - pirateShipX);
        const yDifference = Math.abs(nextPositionY - pirateShipY);

        if (xDifference === 1 && yDifference === 0 || xDifference === 0 && yDifference === 1) {
            needToWait = true;
        }

        if (xDifference === 0 && yDifference === 0) {
            needToManeuver = true;
        }
    });

    if (needToManeuver) {
        currentRoute = findShortestPath({ x, y }, currentRoute[0], mapYX, { dangerPoints: pirates });
    } else if (needToWait) {
        return formWaitCommand();
    }

    return formMoveCommand({ x, y }, currentRoute.pop());
}