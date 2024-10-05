const db = require('./database');
const config = require('./config');

async function handleAddTask(bot, msg) {
    const chatId = msg.chat.id;
    if (!config.adminIds.includes(chatId)) {
        return bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды.');
    }

    bot.sendMessage(chatId, `
Введите данные для нового задания в формате:
Лимит_выполнений Награда ID_канала Ссылка_на_канал

Пример:
1 2 -1002211473340 https://t.me/jskaaow
  `);

    bot.once('message', async(taskMsg) => {
        const [limit, reward, channelId, channelUrl] = taskMsg.text.split(' ');

        if (!limit || !reward || !channelId || !channelUrl) {
            return bot.sendMessage(chatId, 'Неверный формат. Пожалуйста, попробуйте еще раз.');
        }

        try {
            const newTask = {
                limit: parseInt(limit),
                reward: parseFloat(reward),
                channelId,
                channelUrl,
                completions: 0
            };
            const savedTask = await db.saveTask(newTask);
            bot.sendMessage(chatId, `Задание успешно добавлено с ID: ${savedTask.id}`);

            // Оповещаем всех пользователей о новом задании
            const users = await db.getAllUsers();
            const notificationMessage = `
🆕 Новое задание доступно!

💰 Награда: ${reward} UC
👥 Количество мест: ${limit}

Скорее приступайте к выполнению, пока есть свободные места!
Используйте /tasks, чтобы увидеть все доступные задания.
      `;

            for (const user of users) {
                try {
                    await bot.sendMessage(user.telegramId, notificationMessage);
                } catch (error) {
                    console.error(`Не удалось отправить уведомление пользователю ${user.telegramId}:`, error);
                }
            }
        } catch (error) {
            console.error('Ошибка при добавлении задания:', error);
            bot.sendMessage(chatId, 'Произошла ошибка при добавлении задания. Попробуйте позже.');
        }
    });
}

async function handleRemoveTask(bot, msg) {
    const chatId = msg.chat.id;
    if (!config.adminIds.includes(chatId)) {
        return bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды.');
    }

    bot.sendMessage(chatId, 'Введите ID задания, которое хотите удалить:');

    bot.once('message', async(taskMsg) => {
        const taskId = parseInt(taskMsg.text);

        if (isNaN(taskId)) {
            return bot.sendMessage(chatId, 'Неверный формат ID задания. Пожалуйста, введите число.');
        }

        try {
            const removed = await db.removeTask(taskId);
            if (removed) {
                bot.sendMessage(chatId, `Задание с ID ${taskId} успешно удалено.`);
            } else {
                bot.sendMessage(chatId, `Задание с ID ${taskId} не найдено.`);
            }
        } catch (error) {
            console.error('Ошибка при удалении задания:', error);
            bot.sendMessage(chatId, 'Произошла ошибка при удалении задания. Попробуйте позже.');
        }
    });
}

async function handleAddRequiredChannel(bot, msg) {
    const chatId = msg.chat.id;
    if (!config.adminIds.includes(chatId)) {
        return bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды.');
    }

    bot.sendMessage(chatId, `
Введите данные для обязательного канала в формате:
ID_канала Ссылка_на_канал

Пример:
-1001234567890 https://t.me/example_channel
  `);

    bot.once('message', async(channelMsg) => {
        const [channelId, channelUrl] = channelMsg.text.split(' ');

        if (!channelId || !channelUrl) {
            return bot.sendMessage(chatId, 'Неверный формат. Пожалуйста, попробуйте еще раз.');
        }

        try {
            await db.addRequiredChannel({ channelId, channelUrl });
            bot.sendMessage(chatId, 'Обязательный канал успешно добавлен.');
        } catch (error) {
            console.error('Ошибка при добавлении обязательного канала:', error);
            bot.sendMessage(chatId, 'Произошла ошибка при добавлении канала. Попробуйте позже.');
        }
    });
}

async function handleRemoveRequiredChannel(bot, msg) {
    const chatId = msg.chat.id;
    if (!config.adminIds.includes(chatId)) {
        return bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды.');
    }

    const channels = await db.getRequiredChannels();
    if (channels.length === 0) {
        return bot.sendMessage(chatId, 'Нет обязательных каналов для удаления.');
    }

    const keyboard = channels.map(channel => [{ text: channel.channelUrl }]);
    bot.sendMessage(chatId, 'Выберите канал для удаления:', {
        reply_markup: {
            keyboard: keyboard,
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });

    bot.once('message', async(channelMsg) => {
        const channelUrl = channelMsg.text;
        try {
            const removed = await db.removeRequiredChannel(channelUrl);
            if (removed) {
                bot.sendMessage(chatId, `Канал ${channelUrl} успешно удален из списка обязательных.`);
            } else {
                bot.sendMessage(chatId, `Канал ${channelUrl} не найден в списке обязательных.`);
            }
        } catch (error) {
            console.error('Ошибка при удалении обязательного канала:', error);
            bot.sendMessage(chatId, 'Произошла ошибка при удалении канала. Попробуйте позже.');
        }
    });
}

async function handleAdminStats(bot, msg) {
    const chatId = msg.chat.id;
    if (!config.adminIds.includes(chatId)) {
        return bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды.');
    }

    try {
        const users = await db.getAllUsers();
        const tasks = await db.getTasks();
        const requiredChannels = await db.getRequiredChannels();

        const stats = `
Статистика бота:
Всего пользователей: ${users.length}
Активных заданий: ${tasks.length}
Обязательных каналов: ${requiredChannels.length}
Всего выдано UC: ${users.reduce((sum, user) => sum + user.uc, 0)}
    `;

        bot.sendMessage(chatId, stats);
    } catch (error) {
        console.error('Ошибка при получении статистики:', error);
        bot.sendMessage(chatId, 'Произошла ошибка при получении статистики. Попробуйте позже.');
    }
}

module.exports = {
    handleAddTask,
    handleRemoveTask,
    handleAddRequiredChannel,
    handleRemoveRequiredChannel,
    handleAdminStats
};