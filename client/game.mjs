class ShipBot {
    constructor({levelMap, ports}) {
        this.CARGO_VOLUME = 368;
        this.levelMapYX = levelMap.split('\n');
        this.mapWidth = this.levelMapYX[0].length;
        this.mapHeight = this.levelMapYX.length;
        this.homePortId = ports.find(port => port.isHome).portId;
        this.tradeInfo = { hold: [], payload: 0 }

        this.routes = null;
        this.tradeRoute = null;
        this.routeToPort = null;
        this.positionOnRoute = null;
        this.loadStack = [];
        this.portsToVisit = [];
        this.results = [];

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



    // configureHold(incomeData) {
    //     let freeSpace = this.CARGO_VOLUME;
    //     const result = [];
        
    //     let { turnsForTravel, incomeList } = incomeData;
    //     let incomeByTurn = 0;
    //     let maxIncomeByTurn = 0;
    //     let income = 0;

    //     incomeList.sort((a, b) => b.incomeByVolumeUnit - a.incomeByVolumeUnit).forEach((product, index) => {
    //         const factVolume = Math.min(product.amount * product.volume, freeSpace - freeSpace % product.volume);
    //         const productIncome = factVolume * product.incomeByVolumeUnit;
            
    //         incomeByTurn = (income + productIncome) / turnsForTravel + 2;

    //         if (incomeByTurn > maxIncomeByTurn) {
    //             turnsForTravel += 2;
    //             maxIncomeByTurn = incomeByTurn;
    //             income += productIncome;
    //             freeSpace -= factVolume;
    //             result.push({ portId: product.portId, name: product.name, amount: factVolume / product.volume, productIncome });
    //         }
    //     }); 

    //     return result;
    // }

    // getOneUnitOfVolumeIncomeLists({ goods, prices }) {
    //     const results = {};

    //     prices.forEach(portPrices => {
    //         const incomeList = [];
    //         const turnsForTravel = (this.routes[this.homePortId][portPrices.portId].length - 1) * 2;

    //         Object.entries(portPrices).filter(([key]) => key !== 'portId').forEach(([name, price]) => {
    //             const product = goods.find(product => product.name === name);

    //             if (product) {
    //                 const { volume } = product;
    //                 const incomeByVolumeUnit = price / volume;
    //                 // const incomeByVolumeUnitByTurn =  incomeByVolumeUnit / turnsForTravel
    //                 incomeList.push({ portId: portPrices.portId, incomeByVolumeUnit, ...product });
    //             }
    //         });

    //         results[portPrices.portId] = {turnsForTravel, incomeList};
    //     });

    //     return results;
    // }

    // configureHold(hold, freeSpace, goods, prices, lastPortId, turnsForRoute, minVolume, income) {
    //     let maxAmount;
    //     let factAmount;
    //     let newIncome;
    //     let newTurnsForRoute;
    //     let turnsWithReturn;
    //     let newPayload;
    //     let holdGoods;
    //     let bestConfig;

    //     let maxPayload = hold.payload;

    //     goods.filter(product => !hold.goodsList.some(productInHold => productInHold.name === product.name))
    //         .forEach(product => {
    //             maxAmount = Math.floor(freeSpace / product.volume);
    //             factAmount = product.amount > maxAmount ? maxAmount : product.amount;

    //             if (factAmount > 0) {
    //                 prices.forEach(portPrices => {
    //                     if (portPrices[product.name]) {
    //                         newIncome = income + factAmount * portPrices[product.name];
    //                         newTurnsForRoute = (lastPortId === portPrices.portId ? turnsForRoute : turnsForRoute + this.routes[lastPortId][portPrices.portId].length - 1) + 2;
    //                         turnsWithReturn = newTurnsForRoute + this.routes[portPrices.portId][this.homePortId].length - 1;
    //                         newPayload = newIncome / turnsWithReturn;
    //                         holdGoods = {
    //                             payload: newPayload,
    //                             goodsList: hold.goodsList.concat([{ portId: portPrices.portId, name: product.name, amount: factAmount }]),
    //                             turnsWithReturn,
    //                             newIncome
    //                         };

    //                         this.results.push(holdGoods);

    //                         if (freeSpace - factAmount * product.volume >= minVolume) {
    //                             holdGoods = this.configureHold(holdGoods, freeSpace - factAmount * product.volume, goods, prices, portPrices.portId, newTurnsForRoute, minVolume, newIncome);
    //                         }

    //                         if (holdGoods.payload > maxPayload) {
    //                             maxPayload = holdGoods.payload;
    //                             bestConfig = holdGoods;
    //                         }
    //                     }
    //                 });
    //             }
    //         });

    //     if (bestConfig) {
    //         hold = bestConfig;
    //     }

    //     return hold;
    // }

    configureHold(hold, goodsCount, freeSpace, goods, prices, lastPortId, turnsForRoute, minVolume, income) {
        let maxAmount;
        let factAmount;
        let newIncome;
        let newTurnsForRoute;
        let turnsWithReturn;
        let newPayload;
        //let holdGoods;
        //let bestConfig;

        // hold = hold.slice(0, goodsCount);

        //let maxPayload = hold.payload;

        goods.filter(product => !hold.some(productInHold => productInHold.name === product.name))
            .forEach(product => {
                maxAmount = Math.floor(freeSpace / product.volume);
                factAmount = product.amount > maxAmount ? maxAmount : product.amount;

                if (factAmount > 0) {
                    prices.forEach(portPrices => {
                        if (portPrices[product.name]) {
                            newIncome = income + factAmount * portPrices[product.name];
                            newTurnsForRoute = (lastPortId === portPrices.portId ? turnsForRoute : turnsForRoute + this.routes[lastPortId][portPrices.portId].length - 1) + 2;
                            turnsWithReturn = newTurnsForRoute + this.routes[portPrices.portId][this.homePortId].length - 1;
                            newPayload = newIncome / turnsWithReturn;
                            // holdGoods = {
                            //     payload: newPayload,
                            //     goodsList: hold.goodsList.concat([{ portId: portPrices.portId, name: product.name, amount: factAmount }]),
                            //     turnsWithReturn,
                            //     newIncome
                            // };

                            // this.results.push(holdGoods);
                            
                            hold.push({ portId: portPrices.portId, name: product.name, amount: factAmount });
                            
                            // if (this.tradeInfo.hold[0] && this.tradeInfo.hold[0].name === 'gold') {
                            //     console.log(this.tradeInfo.hold);
                            //     console.log(newPayload);
                            // }
                            if (newPayload > this.tradeInfo.payload) {
                                this.tradeInfo.payload = newPayload;
                                this.tradeInfo.hold = hold.slice();
                            }
                            if (freeSpace - factAmount * product.volume >= minVolume) {
                                this.configureHold(hold, goodsCount + 1, freeSpace - factAmount * product.volume, goods, prices, portPrices.portId, newTurnsForRoute, minVolume, newIncome );
                            }
                            hold.pop();
                            
                            
                        }
                    });
                }
            });

        // if (bestConfig) {
        //     hold = bestConfig;
        // }

        //return hold;
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
        // this.tradeRoute = { payload: 0, distance: 0, income: 0, tradeList: {}, freeSpace: this.CARGO_VOLUME, lastPortId: gameState.ports.find(port => port.isHome).portId, portsToVisit: [], goodsNames: [] };
        // this.maxPayloadReached = false;

        // while (!this.maxPayloadReached) {
        //     this.increasePayloadByGoods({ goods: gameState.goodsInPort, prices: gameState.prices });
        // }

        // this.tradeRoute.portsToVisit.push(this.homePortId);
        // // this.tradeRoute.tradeList.forEach(product => {
        // //     this.loadStack.push({ name: product.name, amount: product.amount });

        // // });


        // // this.loadStack = this.tradeRoute.tradeList.map(product => {
        // //     return { name: product.name, amount: product.amount }
        // // });

        // this.hasTradeRoute = true;
        //this.tradeRoute = { portsVisitOrder = [],  }
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
    console.time('bugaga');
    shipBot.configureHold([], 0, shipBot.CARGO_VOLUME, gameState.goodsInPort, gameState.prices, shipBot.homePortId, 0, 1, 0);
    console.timeEnd('bugaga');

    console.log(shipBot.tradeInfo);
    //console.log(shipBot.results.sort((a, b) => b.payload - a.payload));
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
