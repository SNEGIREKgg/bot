const db = require('./database');
const config = require('./config');
const utils = require('./utils');

// Добавим очередь для обработки callback queries
const queue = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    const { bot, callbackQuery, text } = queue.shift();
    try {
        await bot.answerCallbackQuery(callbackQuery.id, { text, cache_time: 1 });
    } catch (error) {
        if (error.message.includes('query is too old')) {
            console.log('Игнорирование устаревшего callback query');
        } else {
            console.error('Ошибка при ответе на callback query:', error);
        }
    }

    isProcessing = false;
    processQueue();
}

function addToQueue(bot, callbackQuery, text) {
    queue.push({ bot, callbackQuery, text });
    processQueue();
}

async function handleStart(bot, msg, match) {
    const chatId = msg.chat.id;
    const referrerId = match[1];

    try {
        let user = await db.findUser(chatId);
        let isNewUser = false;

        if (!user) {
            user = {
                telegramId: chatId,
                username: msg.from.username,
                referredBy: referrerId ? parseInt(referrerId) : null,
                referrals: [],
                uc: 0,
                completedTasks: [],
                lastDailyBonus: null
            };
            isNewUser = true;

            if (referrerId) {
                const referrer = await db.findUser(parseInt(referrerId));
                if (referrer && !referrer.referrals.includes(chatId)) {
                    referrer.referrals.push(chatId);
                    referrer.uc += 2;
                    await db.saveUser(referrer);
                    bot.sendMessage(referrer.telegramId, `Вы получили нового реферала! 2 UC добавлено на ваш счет. Ваш баланс: ${referrer.uc} UC`);
                }
            }

            await db.saveUser(user);
        }

        const welcomeMessage = isNewUser ?
            `
🎉 Добро пожаловать!
✅ Выполните обязательные задания и получите первую награду!
            ` :
            'С возвращением! Готовы к новым заданиям?';

        const requiredChannels = await db.getRequiredChannels();
        const channelButtons = requiredChannels.map(channel => [{ text: channel.channelUrl, url: channel.channelUrl }]);

        const keyboard = {
            inline_keyboard: [
                ...channelButtons, [{ text: '✔ Проверить', callback_data: 'check_subscriptions' }]
            ]
        };

        bot.sendMessage(chatId, welcomeMessage, {
            reply_markup: keyboard
        });

    } catch (error) {
        console.error('Ошибка в команде /start:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
}

async function handleCheckSubscriptions(bot, input) {
    const chatId = input.message ? input.message.chat.id : input.chat.id;
    try {
        const requiredChannels = await db.getRequiredChannels();
        let allSubscribed = true;

        for (const channel of requiredChannels) {
            const isSubscribed = await utils.checkSubscription(bot, chatId, channel.channelId);
            if (!isSubscribed) {
                allSubscribed = false;
                break;
            }
        }

        if (allSubscribed) {
            if (input.id) {
                addToQueue(bot, input, 'Вы успешно подписались на все обязательные каналы!');
            }
            return true;
        } else {
            const keyboard = {
                inline_keyboard: [
                    ...requiredChannels.map(channel => [{ text: channel.channelUrl, url: channel.channelUrl }]), [{ text: '✔ Проверить', callback_data: 'check_subscriptions' }]
                ]
            };
            if (input.id) {
                addToQueue(bot, input, 'Вы подписались не на все каналы. Пожалуйста, подпишитесь на все каналы и попробуйте снова.');
            }
            bot.sendMessage(chatId, 'Пожалуйста, подпишитесь на все каналы и нажмите кнопку "Проверить" еще раз.', {
                reply_markup: keyboard
            });
            return false;
        }
    } catch (error) {
        console.error('Ошибка при проверке подписок:', error);
        if (input.id) {
            addToQueue(bot, input, 'Произошла ошибка при проверке подписок. Пожалуйста, попробуйте позже.');
        }
        return false;
    }
}

async function handleTasks(bot, msg) {
    const chatId = msg.chat.id;

    const mockCallbackQuery = {
        message: msg,
        id: 'mock_id'
    };

    const isSubscribed = await handleCheckSubscriptions(bot, mockCallbackQuery);
    if (!isSubscribed) {
        return;
    }

    try {
        const user = await db.findUser(chatId);
        if (!user) {
            bot.sendMessage(chatId, 'Пользователь не найден. Пожалуйста, запустите бота с помощью /start');
            return;
        }

        const tasks = await db.getTasks();
        const availableTasks = tasks.filter(task => !user.completedTasks.includes(task.id) && task.completions < task.limit);

        if (availableTasks.length > 0) {
            const message = 'Доступные задания:';
            const keyboard = [];
            const firstRow = [];

            availableTasks.forEach((task, index) => {
                if (index < 5) {
                    firstRow.push({ text: `Задание ${task.id}`, callback_data: `task_${task.id}` });
                } else {
                    keyboard.push([{ text: `Задание ${task.id}`, callback_data: `task_${task.id}` }]);
                }
            });

            if (firstRow.length > 0) {
                keyboard.unshift(firstRow);
            }

            bot.sendMessage(chatId, message, {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });
        } else {
            bot.sendMessage(chatId, 'На данный момент нет доступных заданий.');
        }
    } catch (error) {
        console.error('Ошибка в команде Задания:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
}

async function handleTaskDetails(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const isSubscribed = await handleCheckSubscriptions(bot, callbackQuery);
    if (!isSubscribed) {
        return;
    }

    const taskId = parseInt(callbackQuery.data.split('_')[1]);
    const tasks = await db.getTasks();
    const task = tasks.find(t => t.id === taskId);

    if (task) {
        const taskMessage = `
Информация о задании:

Награда: ${task.reward} UC
Осталось выполнений: ${task.limit - task.completions}

Примечание! В случае, если вы отпишетесь от канала после выполнения задания, вы можете быть оштрафованы на сумму, которая была выдана в виде награды. Баланс может уйти в минус, будьте внимательны.

Вот ваше задание
        `;
        bot.editMessageText(taskMessage, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Ссылка на канал', url: task.channelUrl }],
                    [{ text: 'Проверить', callback_data: `check_${task.id}` }],
                    [{ text: 'Назад', callback_data: 'back_to_tasks' }]
                ]
            }
        });
    }
}

async function handleCheckTask(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const isSubscribed = await handleCheckSubscriptions(bot, callbackQuery);
    if (!isSubscribed) {
        return;
    }

    const taskId = parseInt(callbackQuery.data.split('_')[1]);
    try {
        const user = await db.findUser(chatId);
        const task = (await db.getTasks()).find(t => t.id === taskId);

        if (user && task) {
            const subscriptionStatus = await utils.checkSubscription(bot, chatId, task.channelId);
            if (subscriptionStatus === 'CHAT_NOT_FOUND') {
                addToQueue(bot, callbackQuery, 'Ошибка: канал не найден. Пожалуйста, сообщите администратору.');
                return;
            }
            if (subscriptionStatus) {
                if (!user.completedTasks.includes(taskId)) {
                    if (task.completions < task.limit) {
                        user.completedTasks.push(taskId);
                        user.uc += task.reward;
                        task.completions++;
                        await db.saveUser(user);
                        await db.updateTask(task);
                        addToQueue(bot, callbackQuery, `Задание выполнено! Вы заработали ${task.reward} UC.`);
                    } else {
                        addToQueue(bot, callbackQuery, 'К сожалению, лимит выполнений для этого задания исчерпан.');
                    }
                } else {
                    addToQueue(bot, callbackQuery, 'Вы уже выполнили это задание.');
                }
            } else {
                addToQueue(bot, callbackQuery, 'Вы не подписаны на канал. Подпишитесь и попробуйте снова.');
            }
        } else {
            addToQueue(bot, callbackQuery, 'Произошла ошибка. Попробуйте позже.');
        }
    } catch (error) {
        console.error('Ошибка при проверке задания:', error);
        addToQueue(bot, callbackQuery, 'Произошла ошибка. Попробуйте позже.');
    }
}

module.exports = {
    handleStart,
    handleCheckSubscriptions,
    handleTasks,
    handleTaskDetails,
    handleCheckTask,
};