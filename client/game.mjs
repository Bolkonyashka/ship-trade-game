class ShipBot {
    constructor(levelMap, { ports, goodsInPort, prices, ship }) {
        this.CARGO_VOLUME = 368;
        this.TURNS_TO_LOAD_UNLOAD = 2;

        this.levelMapYX = levelMap.split('\n');
        this.mapWidth = this.levelMapYX[0].length;
        this.mapHeight = this.levelMapYX.length;
        this.homePortId = ports.find(port => port.isHome).portId;
        this.goods = goodsInPort;
        this.portsPrices = prices;
        this.shipInfo = ship;

        this.tradeRoute = null;
        this.routes = null;
        this.routeToPort = null;
        this.positionOnRoute = null;
        this.minVolume = null;

        this.hasTradeRoute = false;
    }

    prepareRoutes(gameState) {
        this.routes = [];

        for (let i = 0; i < gameState.ports.length; i++) {
            this.routes[i] = [];

            for (let j = 0; j < gameState.ports.length; j++) {
                this.routes[i][j] = j === i ? null : 
                    j < i ? this.routes[j][i].slice().reverse() : 
                        this.findShortestPath(gameState.ports[i], gameState.ports[j]);
            }
        }
    }

    setStateInfo() {
        this.goods = goodsInPort;
        this.portsPrices = prices;
        this.minVolume = Infinity;

        goodsInPort.forEach(({ volume }) => {
            if (volume < this.minVolume) {
                this.minVolume = volume;
            }
        });
    }

    configureBestPayloadHold(portPrices, turnsForRoute, hold = [], freeSpace = this.CARGO_VOLUME, income = 0) {
        let maxAmount;
        let factAmount;
        let product;
        let newIncome;
        let newTurnsForRoute;
        let newPayload;
        let newFreeSpace;

        const { portId, ...prices } = portPrices;
        
        Object.entries(prices).forEach(([name, cost]) => {
            product = this.goods.find(product => product.name === name);

            if (product && hold.findIndex(({ name: productInHoldName }) => productInHoldName === name ) === -1) {
                maxAmount = Math.floor(freeSpace / product.volume);
                factAmount = product.amount > maxAmount ? maxAmount : product.amount;
                
                if (factAmount > 0) {
                    newTurnsForRoute = turnsForRoute + this.TURNS_TO_LOAD_UNLOAD;
                    newIncome = income + factAmount * cost;
                    newPayload = newIncome / newTurnsForRoute;
                    newFreeSpace = freeSpace - factAmount * product.volume;

                    hold.push({ name, amount: factAmount });

                    if (newPayload > this.tradeRoute.payload) {
                        this.tradeRoute.payload = newPayload;
                        this.tradeRoute.hold = hold.slice();
                        this.tradeRoute.portId = portId;
                    }

                    if (newFreeSpace >= this.minVolume) {
                        this.configureBestPayloadHold(portPrices, newTurnsForRoute, hold, newFreeSpace, newIncome);
                    }

                    hold.pop();
                }
            }
        });
    }

    prepareTradeRoute() {
        let turnsForRoute;

        this.tradeRoute = { payload: 0 };

        this.portsPrices.forEach(portPrices => {
            turnsForRoute = (this.routes[this.homePortId][portPrices.portId].length - 1) * 2;
            this.configureBestPayloadHold(portPrices, turnsForRoute);
        });

        this.hasTradeRoute = true;
    }

    prepareRouteToPort(currentPortId, nextPortId) {
        this.routeToPort = this.routes[currentPortId][nextPortId];
        this.positionOnRoute = 0;
    }

    move(shipPosition) {
        this.positionOnRoute++;

        const { x, y } = shipPosition;
        const { x: nextPointX, y: nextPointY } = this.routeToPort[this.positionOnRoute];

        if (x !== nextPointX) {
            return nextPointX > x ? 'E' : 'W';
        }

        if (y !== nextPointY) {
            return nextPointY > y ? 'S' : 'N';
        }
    }

    loadGoods({ name, amount }) {
        return `LOAD ${name} ${amount}`;
    }

    sellGoods({ name, amount }) {
        return `SELL ${name} ${amount}`;
    }

    findShortestPath(start, finish) {
        const distanceMapYX = [];
        const queue = [start];

        for (let i = 0; i < this.mapHeight; i++) {
            distanceMapYX.push(Array(this.mapWidth).fill(-1));
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

                    if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight && this.levelMapYX[y][x] !== '#' && distanceMapYX[y][x] === -1) {
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
                } else if (x + 1 < this.mapWidth && distanceMapYX[y][x + 1] === distanceMapYX[y][x] - 1) {
                    x++;
                } else if (y - 1 >= 0 && distanceMapYX[y - 1][x] === distanceMapYX[y][x] - 1) {
                    y--;
                } else if (y + 1 < this.mapHeight && distanceMapYX[y + 1][x] === distanceMapYX[y][x] - 1) {
                    y++;
                }
            }

            path.push({ x: start.x, y: start.y });

            return path.reverse();
        } else {
            return null;
        }
    }
}

function findShortestPath(start, finish, mapYX) {
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

                if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight && mapYX[y][x] !== '#' && distanceMapYX[y][x] === -1) {
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
                    tradeInfo.hold = hold.slice();
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
        turnsForRoute = (routes[homePortId][portPrices.portId].length) * 2;

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

function getMoveCommand(routeInfo, currentPositionX, currentPositionY) {
    const { x: nextPositionX, y: nextPositionY } = routeInfo.route[++routeInfo.positionOnRoute];

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

let shipBot;
let mapYX;
let routes;
let homePortId;
let tradeInfo;
let currentRoute;

export function startGame(levelMap, gameState) {
    // console.time('start');

    // shipBot = new ShipBot(levelMap, gameState);
    // shipBot.prepareRoutes(gameState);

    // console.timeEnd('start');

    // console.log(gameState);
    // console.log(shipBot);
    // console.log(shipBot.levelMapYX);
    // console.log(shipBot.routes);

    mapYX = levelMap.split('\n');
    routes = getRoutesToPorts(gameState, mapYX);
    homePortId = gameState.ports.find(port => port.isHome).portId;
    tradeInfo = null;
    currentRoute = null;
}

export function getNextCommand(gameState) {
    let { x, y } = gameState.ship;
    let currentPosition = mapYX[y][x];

    let command;

    // Отключаем трейд-роутинг для карт с пиратами
    if (gameState.pirates.length) {
        return 'WAIT';
    }

    if (currentPosition === 'H') {
        if (!tradeInfo) {
            // shipBot.setStateInfo(gameState);
            // console.time('Prepare trade route');
            // shipBot.prepareTradeRoute();
            // console.timeEnd('Prepare trade route');
            // console.log(shipBot.tradeRoute);
            tradeInfo = getTradeInfo(gameState.prices, gameState.goodsInPort, routes, homePortId);
            console.log(tradeInfo);
        }

        if (tradeInfo.hold.length) {
            command = getLoadCommand(tradeInfo.hold.pop());
        } else {
            // shipBot.prepareRouteToPort(shipBot.homePortId, shipBot.tradeRoute.portId);
            currentRoute = getRouteInfo(homePortId, tradeInfo.portId);
            command = getMoveCommand(currentRoute, x, y);
        }
    } else if (currentPosition === 'O') {
        if (gameState.ship.goods.length) {
            command = getSellComand(gameState.ship.goods[0]);
        } else {
            currentRoute = getRouteInfo(tradeInfo.portId, homePortId);
            command = getMoveCommand(currentRoute, x, y);
            tradeInfo = null;
        }
    } else {
        command = getMoveCommand(currentRoute, x, y);
    }

    return command;
}
