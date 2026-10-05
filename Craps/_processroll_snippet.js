        function wageredKeys() {
            return Object.keys(bets).filter(k => !k.includes('_lastChip'));
        }

        function wageredTotal() {
            return wageredKeys().reduce((sum, k) => sum + bets[k], 0);
        }

        function clearBet(betId) {
            delete bets[betId];
            delete bets[betId + '_lastChip'];
        }

        function payBet(betId, odds, logMessage) {
            const amount = bets[betId];
            if (!amount) return 0;
            const returned = amount + (amount * odds);
            addLogEntry(logMessage, 'win');
            clearBet(betId);
            return returned;
        }

        function loseBet(betId, logMessage) {
            if (!bets[betId]) return;
            addLogEntry(logMessage, 'loss');
            clearBet(betId);
        }

        function resolveOneRollBets(die1, die2) {
            const total = die1 + die2;
            let paid = 0;

            if (bets['field']) {
                if ([2, 3, 4, 9, 10, 11, 12].includes(total)) {
                    const odds = (total === 2 || total === 12) ? 2 : 1;
                    paid += payBet('field', odds, `🎰 Field wins on ${total} (${odds}:1). Net win: $${bets['field'] * odds}`);
                } else {
                    loseBet('field', `❌ Field lost on ${total} (Field wins on 2, 3, 4, 9, 10, 11, 12)`);
                }
            }

            if (bets['any-craps-7-to-1']) {
                if ([2, 3, 12].includes(total)) {
                    const amount = bets['any-craps-7-to-1'];
                    paid += payBet('any-craps-7-to-1', 7, `🎰 Any Craps wins on ${total} (7:1). Net win: $${amount * 7}`);
                } else {
                    loseBet('any-craps-7-to-1', `❌ Any Craps lost on ${total} (wins only on 2, 3, or 12)`);
                }
            }

            ['seven-4-to-1', '7-cs', '7-es'].forEach(id => {
                if (!bets[id]) return;
                if (total === 7) {
                    const amount = bets[id];
                    paid += payBet(id, 4, `🎰 ${formatBetName(id)} wins on 7 (4:1). Net win: $${amount * 4}`);
                } else {
                    loseBet(id, `❌ ${formatBetName(id)} lost on ${total} (wins only on 7)`);
                }
            });

            if (bets['15-to-1']) {
                if (total === 3 || total === 11) {
                    const amount = bets['15-to-1'];
                    paid += payBet('15-to-1', 15, `🎰 3 or 11 (15:1) wins on ${total}. Net win: $${amount * 15}`);
                } else {
                    loseBet('15-to-1', `❌ 3 or 11 (15:1) lost on ${total}`);
                }
            }

            if (bets['30-to-1']) {
                if (total === 2 || total === 12) {
                    const amount = bets['30-to-1'];
                    paid += payBet('30-to-1', 30, `🎰 2 or 12 (30:1) wins on ${total}. Net win: $${amount * 30}`);
                } else {
                    loseBet('30-to-1', `❌ 2 or 12 (30:1) lost on ${total}`);
                }
            }

            const hard4 = die1 === 2 && die2 === 2;
            const hard10 = die1 === 5 && die2 === 5;
            if (bets['10-to-1']) {
                if (hard4 || hard10) {
                    const amount = bets['10-to-1'];
                    paid += payBet('10-to-1', 10, `🎰 Hard 4/10 wins (${die1}+${die2}). Net win: $${amount * 10}`);
                } else if (total === 7 || total === 4 || total === 10) {
                    loseBet('10-to-1', `❌ Hard 4/10 lost on ${die1}+${die2}=${total}`);
                }
            }

            const hard6 = die1 === 3 && die2 === 3;
            const hard8 = die1 === 4 && die2 === 4;
            if (bets['8-to-1']) {
                if (hard6 || hard8) {
                    const amount = bets['8-to-1'];
                    paid += payBet('8-to-1', 8, `🎰 Hard 6/8 wins (${die1}+${die2}). Net win: $${amount * 8}`);
                } else if (total === 7 || total === 6 || total === 8) {
                    loseBet('8-to-1', `❌ Hard 6/8 lost on ${die1}+${die2}=${total}`);
                }
            }

            return paid;
        }

        function resolveLineBetsComeOut(total) {
            let paid = 0;
            let message = '';
            const passIds = ['pass-line', 'come'];
            const dontIds = ["don't-pass-bar", 'dont-come-bar'];

            if (total === 7 || total === 11) {
                const hadPass = passIds.some(id => bets[id]);
                const hadDont = dontIds.some(id => bets[id]);
                message = total === 11
                    ? 'Natural 11! Pass Line / Come win. 11 is a winner on the come-out, not a losing roll.'
                    : 'Natural 7! Pass Line / Come win.';
                passIds.forEach(id => {
                    if (!bets[id]) return;
                    const amount = bets[id];
                    paid += payBet(id, 1, `🎉 NATURAL ${total}! ${formatBetName(id)} wins even money. Net win: $${amount}`);
                });
                dontIds.forEach(id => {
                    loseBet(id, `❌ ${formatBetName(id)} lost on Natural ${total} (Don't Pass/Come lose on 7 or 11 come-out)`);
                });
                if (!hadPass && !hadDont) {
                    addLogEntry(`🎲 Natural ${total} on the come-out. Pass Line would have won.`, 'info');
                }
            } else if (total === 2 || total === 3) {
                message = `Craps ${total}! Pass Line / Come lose on 2 or 3 on the come-out.`;
                passIds.forEach(id => {
                    loseBet(id, `❌ ${formatBetName(id)} lost on Craps ${total} (come-out 2 or 3 is craps)`);
                });
                dontIds.forEach(id => {
                    if (!bets[id]) return;
                    const amount = bets[id];
                    paid += payBet(id, 1, `🎉 CRAPS ${total}! ${formatBetName(id)} wins. Net win: $${amount}`);
                });
            } else if (total === 12) {
                const hadPass = passIds.some(id => bets[id]);
                const hadDont = dontIds.some(id => bets[id]);
                message = 'Craps 12 (boxcars)! Pass Line / Come lose on 12 on the come-out.';
                passIds.forEach(id => {
                    loseBet(id, `❌ ${formatBetName(id)} lost on Craps 12 (boxcars). On the come-out, 2, 3, and 12 are craps — Pass Line loses.`);
                });
                dontIds.forEach(id => {
                    if (!bets[id]) return;
                    const amount = bets[id];
                    paid += amount;
                    addLogEntry(`🔄 CRAPS 12! ${formatBetName(id)} pushes (12 is barred). Bet returned: $${amount}`, 'info');
                    clearBet(id);
                });
                if (!hadPass && !hadDont) {
                    addLogEntry('🎲 Craps 12 (boxcars) on the come-out. Pass Line would have lost.', 'info');
                }
            }

            return { paid, message, establishedPoint: total === 4 || total === 5 || total === 6 || total === 8 || total === 9 || total === 10 };
        }

        function processRoll(die1, die2) {
            const total = die1 + die2;
            let winnings = 0;
            let message = '';
            let roundOver = false;

            winnings += resolveOneRollBets(die1, die2);

            const placeBetMap = { 4: '4', 5: '5', 6: 'six', 8: '8', 9: 'nine', 10: '10' };

            if (!isPointPhase) {
                const line = resolveLineBetsComeOut(total);
                winnings += line.paid;
                message = line.message;

                if (placeBetMap[total] && bets[placeBetMap[total]]) {
                    const amount = bets[placeBetMap[total]];
                    winnings += payBet(placeBetMap[total], 1, `🎰 Place bet on ${total} wins. Net win: $${amount}`);
                }

                if (bets['big-6-8'] && (total === 6 || total === 8)) {
                    const amount = bets['big-6-8'];
                    winnings += payBet('big-6-8', 1, `🎰 Big 6 & 8 wins on ${total}. Net win: $${amount}`);
                }

                if (line.establishedPoint) {
                    point = total;
                    isPointPhase = true;
                    message = `Point is ${point}. Roll that number again before a 7.`;
                    addLogEntry(`🎯 POINT ESTABLISHED: ${point}`, 'point');
                    addLogEntry(`Pass Line wins if you hit ${point} first. A 7 before ${point} is seven-out (Pass Line loses).`, 'info');
                    rollBtn.textContent = 'Roll Again';
                    if (winnings > 0) {
                        balance += winnings;
                        addLogEntry(`💰 Won $${winnings} this roll. New balance: $${balance}`, 'win');
                    }
                    updateBalance();
                    syncBalanceToParent();
                    renderTableChips();
                    diceResultEl.textContent += ` - ${message}`;
                    return;
                }

                roundOver = true;
                rollBtn.textContent = 'Roll Dice';
            } else {
                if (total === point) {
                    message = `Point ${point} made! Pass Line wins.`;
                    if (bets['pass-line']) {
                        const amount = bets['pass-line'];
                        winnings += payBet('pass-line', 1, `🎉 POINT MADE! You hit ${point}. Pass Line wins even money. Net win: $${amount}`);
                    } else {
                        addLogEntry(`🎯 Point made! You hit ${point}.`, 'info');
                    }
                    loseBet("don't-pass-bar", `❌ Don't Pass lost because the point ${point} was made`);
                    if (bets['come']) {
                        addLogEntry(`Come bet stays working (come point not tracked).`, 'info');
                    }
                    if (placeBetMap[point] && bets[placeBetMap[point]]) {
                        const amount = bets[placeBetMap[point]];
                        winnings += payBet(placeBetMap[point], 1, `🎰 Place bet on ${point} wins. Net win: $${amount}`);
                    }
                    isPointPhase = false;
                    point = null;
                    roundOver = true;
                    rollBtn.textContent = 'Roll Dice';
                } else if (total === 7) {
                    message = 'Seven-out! Pass Line loses because a 7 was rolled before the point.';
                    loseBet('pass-line', `❌ Pass Line lost on seven-out (7 before point ${point})`);
                    if (bets["don't-pass-bar"]) {
                        const amount = bets["don't-pass-bar"];
                        winnings += payBet("don't-pass-bar", 1, `🎉 SEVEN OUT! Don't Pass wins. Net win: $${amount}`);
                    } else {
                        addLogEntry('💀 SEVEN OUT! 7 was rolled before the point.', 'loss');
                    }
                    if (bets['come']) {
                        const amount = bets['come'];
                        winnings += payBet('come', 1, `🎉 Come wins on 7 during the point phase (treated as a come-out). Net win: $${amount}`);
                    }
                    loseBet('dont-come-bar', `❌ Don't Come lost on 7 during the point phase`);
                    ['4', '5', 'six', '8', 'nine', '10'].forEach(betId => {
                        loseBet(betId, `❌ Place bet on ${formatBetName(betId)} lost on seven-out`);
                    });
                    loseBet('big-6-8', '❌ Big 6 & 8 lost on seven-out');
                    isPointPhase = false;
                    point = null;
                    roundOver = true;
                    rollBtn.textContent = 'Roll Dice';
                } else {
                    if (placeBetMap[total] && bets[placeBetMap[total]]) {
                        const amount = bets[placeBetMap[total]];
                        winnings += payBet(placeBetMap[total], 1, `🎰 Place bet on ${total} wins. Net win: $${amount}`);
                    }
                    if (bets['big-6-8'] && (total === 6 || total === 8)) {
                        const amount = bets['big-6-8'];
                        winnings += payBet('big-6-8', 1, `🎰 Big 6 & 8 wins on ${total}. Net win: $${amount}`);
                    }
                    if (total === 7 || total === 11) {
                        if (bets['come']) {
                            const amount = bets['come'];
                            winnings += payBet('come', 1, `🎉 Come wins on Natural ${total}. Net win: $${amount}`);
                        }
                        loseBet('dont-come-bar', `❌ Don't Come lost on Natural ${total}`);
                    } else if (total === 2 || total === 3) {
                        loseBet('come', `❌ Come lost on Craps ${total}`);
                        if (bets['dont-come-bar']) {
                            const amount = bets['dont-come-bar'];
                            winnings += payBet('dont-come-bar', 1, `🎉 Don't Come wins on Craps ${total}. Net win: $${amount}`);
                        }
                    } else if (total === 12) {
                        loseBet('come', '❌ Come lost on Craps 12 (boxcars)');
                        if (bets['dont-come-bar']) {
                            const amount = bets['dont-come-bar'];
                            winnings += amount;
                            addLogEntry(`🔄 CRAPS 12! Don't Come pushes. Bet returned: $${amount}`, 'info');
                            clearBet('dont-come-bar');
                        }
                    }

                    if (winnings > 0) {
                        balance += winnings;
                        addLogEntry(`💰 Won $${winnings} this roll. New balance: $${balance}`, 'win');
                    }
                    message = `Point is still ${point}. Roll again.`;
                    addLogEntry(`🎲 No line resolution. Point is still ${point}.`, 'info');
                    updateBalance();
                    syncBalanceToParent();
                    renderTableChips();
                    diceResultEl.textContent += ` - ${message}`;
                    return;
                }
            }

            const remainingWager = wageredTotal();
            balance += winnings;
            updateBalance();
            syncBalanceToParent();
            renderTableChips();

            if (winnings > 0) {
                addLogEntry(`💰 Returned $${winnings}. New balance: $${balance}`, 'win');
                diceResultEl.textContent += ` - ${message || 'You win!'}`;
            } else if (roundOver && remainingWager === 0) {
                addLogEntry(`💸 ${message || 'Those bets lost.'} New balance: $${balance}`, 'loss');
                diceResultEl.textContent += ` - ${message || 'House wins'}`;
            } else if (wageredKeys().length === 0 && winnings === 0) {
                addLogEntry(`No bets placed. New balance: $${balance}`, 'info');
                diceResultEl.textContent += ` - No bets`;
            } else if (message) {
                diceResultEl.textContent += ` - ${message}`;
            }
        }
