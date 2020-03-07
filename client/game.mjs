class ShipBot {
    constructor({levelMap, ports}) {
        this.CARGO_VOLUME = 368;
        this.TURNS_TO_LOAD_UNLOAD = 2;

        this.levelMapYX = levelMap.split('\n');
        this.mapWidth = this.levelMapYX[0].length;
        this.mapHeight = this.levelMapYX.length;
        this.homePortId = ports.find(port => port.isHome).portId;
        this.tradeRoute;

        this.routes = null;
        this.routeToPort = null;
        this.positionOnRoute = null;
        this.goods = null;
        this.portsPrices = null;
        this.minVolume = null;
        this.loadStack = [];

        this.maxPayloadReached = false;
        this.hasTradeRoute = false;
        this.loaded = false;
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

    setStateInfo({ goodsInPort, prices }) {
        this.goods = goodsInPort;
        this.portsPrices = prices;
        this.minVolume = Infinity;

        goodsInPort.forEach(({ volume }) => {
            if (volume < this.minVolume) {
                this.minVolume = volume;
            }
        });
    }

    configureHold(tradeList = [], freeSpace = this.CARGO_VOLUME, lastPortId = this.homePortId, turnsForRoute = 0, income = 0) {
        let maxAmount;
        let factAmount;
        let newIncome;
        let newTurnsForRoute;
        let turnsWithReturn;
        let newPayload;
        let newFreeSpace;
        let isSamePort;

        this.goods.filter(product => !tradeList.some(productInHold => productInHold.name === product.name))
            .forEach(({ name, amount, volume }) => {
                maxAmount = Math.floor(freeSpace / volume);
                factAmount = amount > maxAmount ? maxAmount : amount;

                if (factAmount > 0) {
                    this.portsPrices.forEach(({ portId, ...prices }) => {
                        isSamePort = portId === lastPortId;

                        if (prices[name] && (isSamePort || !tradeList.some(product => product.portId === portId))) {
                            newIncome = income + factAmount * prices[name];
                            newTurnsForRoute = turnsForRoute + this.TURNS_TO_LOAD_UNLOAD + (isSamePort ? 0 : this.routes[lastPortId][portId].length - 1);
                            turnsWithReturn = newTurnsForRoute + this.routes[portId][this.homePortId].length - 1;
                            newPayload = newIncome / turnsWithReturn;
                            newFreeSpace = freeSpace - factAmount * volume;
                            
                            tradeList.push({ portId, name, amount: factAmount });
                            
                            if (newPayload > this.tradeRoute.payload) {
                                this.tradeRoute.payload = newPayload;
                                this.tradeRoute.tradeList = tradeList.slice();
                            }

                            if (newFreeSpace >= this.minVolume) {
                                this.configureHold(tradeList, newFreeSpace, portId, newTurnsForRoute, newIncome );
                            }

                            tradeList.pop();
                        }
                    });
                }
            });
    }

    prepareTradeRoute() {
        this.tradeRoute = { tradeList: [], payload: 0, portsToVisit: [] };
        
        this.configureHold();

        this.tradeRoute.tradeList.forEach(({ portId, name, amount }) => {
            this.loadStack.push({ name, amount });

            if (this.tradeRoute.portsToVisit.indexOf(portId) === -1) {
                this.tradeRoute.portsToVisit.push(portId);
            }
        });

        this.tradeRoute.portsToVisit.push(this.homePortId);
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

    loadGoods() {
        const { name, amount } = this.loadStack.pop();

        if (this.loadStack.length === 0) {
            this.loaded = true;
        }

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

let shipBot;

export function startGame(levelMap, gameState) {
    console.time('start');

    shipBot = new ShipBot({levelMap, ports: gameState.ports});
    shipBot.prepareRoutes(gameState);
    // shipBot.prepareTradeRoute(gameState);

    console.timeEnd('start');

    console.log(gameState);
    console.log(shipBot);
    console.log(shipBot.levelMapYX);
    console.log(shipBot.routes);
    // console.log(shipBot.tradeRoute);
    // shipBot.setStateInfo(gameState);
    // console.time('bugaga');
    // shipBot.configureHold();
    // console.timeEnd('bugaga');

    // console.log(shipBot.tradeInfo);
    //console.log(shipBot.results.sort((a, b) => b.payload - a.payload));
}

export function getNextCommand(gameState) {
    let { x, y } = gameState.ship;
    let currentPosition = shipBot.levelMapYX[y][x];
    let command;

    if (currentPosition === 'H') {
        if (!shipBot.hasTradeRoute) {
            shipBot.setStateInfo(gameState);
            console.time('Prepare trade route');
            shipBot.prepareTradeRoute();
            console.timeEnd('Prepare trade route');
            console.log(shipBot.tradeRoute);
        }

        if (shipBot.loaded) {
            shipBot.prepareRouteToPort(shipBot.homePortId, shipBot.tradeRoute.portsToVisit.shift());
            command = shipBot.move({ x, y });
        } else {
            command = shipBot.loadGoods();
        }
    } else if (currentPosition === 'O') {
        const portId = gameState.ports.find(port => port.x === x && port.y === y).portId;

        if (shipBot.tradeRoute.tradeList.length && shipBot.tradeRoute.tradeList[0].portId === portId) {
            command = shipBot.sellGoods(shipBot.tradeRoute.tradeList.shift());
        } else {
            const nextPortId = shipBot.tradeRoute.portsToVisit.shift();

            if (nextPortId === shipBot.homePortId) {
                shipBot.hasTradeRoute = false;
                shipBot.loaded = false;
            }

            shipBot.prepareRouteToPort(portId, nextPortId);
            command = shipBot.move({ x, y });
        }
    } else {
        command = shipBot.move({ x, y });
    }

    return command;
}
