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

Где:
1) Лимит выполнений - сколько людей может выполнить задание
2) Награда - сколько UC получит пользователь за выполнение задания
3) ID канала
4) Ссылка на канал
  `);

  bot.once('message', async (taskMsg) => {
    const [limit, reward, channelId, channelUrl] = taskMsg.text.split(' ');
    
    if (!limit || !reward || !channelId || !channelUrl) {
      return bot.sendMessage(chatId, 'Неверный формат. Пожалуйста, попробуйте еще раз.');
    }

    const newTask = {
      limit: parseInt(limit),
      reward: parseFloat(reward),
      channelId,
      channelUrl,
      completions: 0
    };

    try {
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

      let notifiedCount = 0;
      for (const user of users) {
        try {
          await bot.sendMessage(user.telegramId, notificationMessage);
          notifiedCount++;
        } catch (error) {
          console.error(`Не удалось отправить уведомление пользователю ${user.telegramId}:`, error);
        }
      }

      bot.sendMessage(chatId, `Уведомление о новом задании отправлено ${notifiedCount} из ${users.length} пользователей.`);
    } catch (error) {
      console.error('Ошибка при добавлении задания:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при добавлении задания. Попробуйте позже.');
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
-1002211473340 https://t.me/jskaaow
  `);

  bot.once('message', async (channelMsg) => {
    const [channelId, channelUrl] = channelMsg.text.split(' ');
    
    if (!channelId || !channelUrl) {
      return bot.sendMessage(chatId, 'Неверный формат. Пожалуйста, попробуйте еще раз.');
    }

    const newRequiredChannel = {
      channelId,
      channelUrl
    };

    try {
      await db.addRequiredChannel(newRequiredChannel);
      bot.sendMessage(chatId, `Обязательный канал успешно добавлен.`);
    } catch (error) {
      console.error('Ошибка при добавлении обязательного канала:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при добавлении обязательного канала. Попробуйте позже.');
    }
  });
}

async function handleBroadcast(bot, msg) {
  const chatId = msg.chat.id;
  if (!config.adminIds.includes(chatId)) {
    return bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды.');
  }

  bot.sendMessage(chatId, 'Введите сообщение для рассылки:');

  bot.once('message', async (broadcastMsg) => {
    try {
      const users = await db.getAllUsers();
      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await bot.sendMessage(user.telegramId, broadcastMsg.text);
          successCount++;
        } catch (error) {
          console.error(`Ошибка при отправке сообщения пользователю ${user.telegramId}:`, error);
          failCount++;
        }
      }

      bot.sendMessage(chatId, `Рассылка завершена.\nУспешно отправлено: ${successCount}\nОшибок: ${failCount}`);
    } catch (error) {
      console.error('Ошибка при выполнении рассылки:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при выполнении рассылки. Попробуйте позже.');
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

    const statsMessage = `
📊 Статистика бота:

👥 Всего пользователей: ${users.length}
📝 Активных заданий: ${tasks.length}
📢 Обязательных каналов: ${requiredChannels.length}
💰 Всего выдано UC: ${users.reduce((sum, user) => sum + user.uc, 0)}
    `;

    bot.sendMessage(chatId, statsMessage);
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при получении статистики. Попробуйте позже.');
  }
}

module.exports = {
  handleAddTask,
  handleAddRequiredChannel,
  handleBroadcast,
  handleAdminStats
};