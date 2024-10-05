const db = require('./database');
const config = require('./config');
const { handleCheckSubscriptions } = require('./commands');

async function handleProfile(bot, msg) {
    const chatId = msg.chat.id;
    const isSubscribed = await handleCheckSubscriptions(bot, { message: msg, id: 'mock_id' });
    if (!isSubscribed) return;

    try {
        const user = await db.findUser(chatId);
        if (user) {
            const profileText = `
Ваш профиль:
UC: ${user.uc}
Рефералы: ${user.referrals.length}
Выполненные задания: ${user.completedTasks.length}
            `;
            bot.sendMessage(chatId, profileText);
        } else {
            bot.sendMessage(chatId, 'Профиль не найден. Пожалуйста, запустите бота с помощью /start');
        }
    } catch (error) {
        console.error('Ошибка в команде Профиль:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
}

async function handleReferral(bot, msg) {
    const chatId = msg.chat.id;
    const isSubscribed = await handleCheckSubscriptions(bot, { message: msg, id: 'mock_id' });
    if (!isSubscribed) return;

    try {
        const user = await db.findUser(chatId);
        if (user) {
            const referralLink = `https://t.me/${config.botUsername}?start=${chatId}`;
            const referralMessage = `
Ваша реферальная ссылка: ${referralLink}
Количество рефералов: ${user.referrals.length}

Поделитесь этой ссылкой с друзьями и получайте 3 UC за каждого приглашенного пользователя!
            `;
            bot.sendMessage(chatId, referralMessage);
        } else {
            bot.sendMessage(chatId, 'Пользователь не найден. Пожалуйста, запустите бота с помощью /start');
        }
    } catch (error) {
        console.error('Ошибка в команде Реферальная ссылка:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
}

async function handleLeaders(bot, msg) {
    const chatId = msg.chat.id;
    const isSubscribed = await handleCheckSubscriptions(bot, { message: msg, id: 'mock_id' });
    if (!isSubscribed) return;

    try {
        const users = await db.getAllUsers();
        const sortedUsers = users.sort((a, b) => b.uc - a.uc).slice(0, 10);

        let leaderboardMessage = '🏆 Топ-10 лидеров по UC:\n\n';
        sortedUsers.forEach((user, index) => {
            leaderboardMessage += `${index + 1}. ${user.username || 'Анонимный пользователь'}: ${user.uc} UC\n`;
        });

        bot.sendMessage(chatId, leaderboardMessage);
    } catch (error) {
        console.error('Ошибка в команде Лидеры:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
}

async function handleWithdraw(bot, msg) {
    const chatId = msg.chat.id;
    const isSubscribed = await handleCheckSubscriptions(bot, { message: msg, id: 'mock_id' });
    if (!isSubscribed) return;

    try {
        const user = await db.findUser(chatId);
        if (user) {
            if (user.uc >= 60) {
                user.uc -= 60; // Вычитаем 60 UC из баланса пользователя
                await db.saveUser(user); // Сохраняем обновленный баланс пользователя
                bot.sendMessage(chatId, 'Запрос на вывод отправлен. С вашего баланса списано 60 UC. Администратор обработает его в ближайшее время.');
                config.adminIds.forEach(adminId => {
                    bot.sendMessage(adminId, `Запрос на вывод от пользователя ${user.username} (${user.telegramId}) на сумму 60 UC`);
                });
            } else {
                bot.sendMessage(chatId, `Для вывода необходимо минимум 60 UC. Ваш текущий баланс: ${user.uc} UC`);
            }
        } else {
            bot.sendMessage(chatId, 'Пользователь не найден. Пожалуйста, запустите бота с помощью /start');
        }
    } catch (error) {
        console.error('Ошибка в команде Вывод:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
}

async function handleDailyBonus(bot, msg) {
    const chatId = msg.chat.id;
    const isSubscribed = await handleCheckSubscriptions(bot, { message: msg, id: 'mock_id' });
    if (!isSubscribed) return;

    try {
        const user = await db.findUser(chatId);
        if (user) {
            const today = new Date().toISOString().split('T')[0];
            if (user.lastDailyBonus !== today) {
                user.uc += 0.25;
                user.lastDailyBonus = today;
                await db.saveUser(user);
                bot.sendMessage(chatId, 'Вы получили ежедневный бонус 0.25 UC! 🎁');
            } else {
                bot.sendMessage(chatId, 'Вы уже получили сегодняшний бонус. Приходите завтра! 😊');
            }
        } else {
            bot.sendMessage(chatId, 'Пользователь не найден. Пожалуйста, запустите бота с помощью /start');
        }
    } catch (error) {
        console.error('Ошибка при начислении ежедневного бонуса:', error);
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
}

async function handleTasks(bot, msg) {
    const chatId = msg.chat.id;
    const isSubscribed = await handleCheckSubscriptions(bot, { message: msg, id: 'mock_id' });
    if (!isSubscribed) return;

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

function handleHelp(bot, msg) {
    const chatId = msg.chat.id;
    const helpMessage = `
Вот доступные команды:

/start - Начать работу с ботом
/tasks - Посмотреть доступные задания
/profile - Посмотреть ваш профиль и заработок
/withdraw - Запросить вывод средств (минимум 60 UC)
/referral - Получить вашу реферальную ссылку
/leaders - Посмотреть таблицу лидеров
/daily - Получить ежедневный бонус
/help - Показать это сообщение

Если у вас есть вопросы или проблемы, пожалуйста, свяжитесь с нашей поддержкой.
    `;
    bot.sendMessage(chatId, helpMessage);
}

module.exports = {
    handleProfile,
    handleReferral,
    handleLeaders,
    handleWithdraw,
    handleDailyBonus,
    handleTasks,
    handleHelp
};