class ShipBot {
    constructor({levelMap, ports}) {
        this.CARGO_VOLUME = 368;
        this.levelMapYX = levelMap.split('\n');
        this.mapWidth = this.levelMapYX[0].length;
        this.mapHeight = this.levelMapYX.length;
        this.homePortId = ports.find(port => port.isHome).portId;

        this.routes = null;
        this.tradeRoute = null;
        this.routeToPort = null;
        this.positionOnRoute = null;
        this.loadStack = [];
        this.portsToVisit = [];

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

    increasePayloadByGoods({ goods, prices }) {
        let { distance, freeSpace, payload: maxPayload, income, lastPortId, goodsNames } = this.tradeRoute; 
        let maxAmount;
        let factAmount;
        let newDistance;
        let newPayload;
        let newIncome;
        let distanceWithReturn;
        let productForTrade;
        let additionalInfo;

        goods.filter(product => goodsNames.indexOf(product.name) === -1).forEach(product => {
            maxAmount = Math.floor(freeSpace / product.volume);
            factAmount = product.amount > maxAmount ? maxAmount : product.amount;

            if (factAmount > 0) {
                prices.forEach(portPrices => {
                    let { portId } = portPrices;
                    if (portPrices[product.name]) {
                        newDistance = lastPortId === portId ? distance + 2 : distance + this.routes[lastPortId][portId].length + 2;
                        distanceWithReturn = newDistance + this.routes[portId][this.homePortId].length;
                        newIncome = portPrices[product.name] * factAmount + income;
                        newPayload = newIncome / distanceWithReturn;

                        if (newPayload > maxPayload) {
                            maxPayload = newPayload;
                            productForTrade = { portId, name: product.name, amount: factAmount };
                            additionalInfo = { payload: newPayload, distance: newDistance, income: newIncome, lastPortId: portId, freeSpace: freeSpace - factAmount * product.volume };

                            console.log(productForTrade);
                            console.log(additionalInfo);
                        }
                    }
                });
            }
        });

        if (productForTrade && additionalInfo) {
            // console.log(productForTrade);
            // console.log(additionalInfo);
            const { portId, name, amount } = productForTrade;
            const { portsToVisit, tradeList } = this.tradeRoute;

            if (tradeList[portId]) {
                tradeList[portId].push({ name, amount });
            } else {
                tradeList[portId] = [{ name, amount }];
            }

            this.loadStack.push({ name, amount });
            goodsNames.push(name);

            if (portsToVisit.length === 0 || portsToVisit[portsToVisit.length - 1] !== portId) {
                portsToVisit.push(portId);
            }

            Object.assign(this.tradeRoute, additionalInfo);
        } else {
            this.maxPayloadReached = true;
        }
    }

    prepareTradeRoute(gameState) {
        this.tradeRoute = { payload: 0, distance: 0, income: 0, tradeList: {}, freeSpace: this.CARGO_VOLUME, lastPortId: gameState.ports.find(port => port.isHome).portId, portsToVisit: [], goodsNames: [] };
        this.maxPayloadReached = false;

        while (!this.maxPayloadReached) {
            this.increasePayloadByGoods({ goods: gameState.goodsInPort, prices: gameState.prices });
        }

        this.tradeRoute.portsToVisit.push(this.homePortId);
        // this.tradeRoute.tradeList.forEach(product => {
        //     this.loadStack.push({ name: product.name, amount: product.amount });

        // });


        // this.loadStack = this.tradeRoute.tradeList.map(product => {
        //     return { name: product.name, amount: product.amount }
        // });

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
}

export function getNextCommand(gameState) {
    let { x, y } = gameState.ship;
    let currentPosition = shipBot.levelMapYX[y][x];
    let command;

    if (currentPosition === 'H') {
        if (!shipBot.hasTradeRoute) {
            shipBot.prepareTradeRoute(gameState);
        }

        if (shipBot.loaded) {
            shipBot.prepareRouteToPort(shipBot.homePortId, shipBot.tradeRoute.portsToVisit.shift());
            command = shipBot.move({ x, y });
        } else {
            command = shipBot.loadGoods();
        }
    } else if (currentPosition === 'O') {
        const portId = gameState.ports.find(port => port.x === x && port.y === y).portId;

        if (shipBot.tradeRoute.tradeList[portId].length) {
            command = shipBot.sellGoods(shipBot.tradeRoute.tradeList[portId].pop());
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
