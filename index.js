const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const commands = require('./commands');
const userCommands = require('./userCommands');
const adminCommands = require('./adminCommands');
const utils = require('./utils');
const db = require('./database');

const bot = new TelegramBot(config.token, { polling: true });

// Обычные команды
bot.onText(/\/start(?:\s+(\d+))?/, (msg, match) => commands.handleStart(bot, msg, match));
bot.onText(/📋 Задания|\/tasks/, (msg) => commands.handleTasks(bot, msg));
bot.onText(/👑 Лидеры|\/leaders/, (msg) => userCommands.handleLeaders(bot, msg));
bot.onText(/👤 Профиль|\/profile/, (msg) => userCommands.handleProfile(bot, msg));
bot.onText(/💰 Вывод|\/withdraw/, (msg) => userCommands.handleWithdraw(bot, msg));
bot.onText(/🔗 Реферальная ссылка|\/referral/, (msg) => userCommands.handleReferral(bot, msg));
bot.onText(/❓ Помощь|\/help/, (msg) => userCommands.handleHelp(bot, msg));
bot.onText(/🎁 Ежедневный бонус|\/daily/, (msg) => userCommands.handleDailyBonus(bot, msg));

// Админские команды
bot.onText(/➕ Добавить задание|\/addtask/, (msg) => adminCommands.handleAddTask(bot, msg));
bot.onText(/➖ Удалить задание|\/removetask/, (msg) => adminCommands.handleRemoveTask(bot, msg));
bot.onText(/📢 Добавить канал|\/addchannel/, (msg) =>
  adminCommands.handleAddRequiredChannel(bot, msg),
);
bot.onText(/🔇 Удалить канал|\/removechannel/, (msg) =>
  adminCommands.handleRemoveRequiredChannel(bot, msg),
);
bot.onText(/📊 Статистика|\/adminstats/, (msg) => adminCommands.handleAdminStats(bot, msg));

bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data.split('_')[0];
  switch (action) {
    case 'task':
      await commands.handleTaskDetails(bot, callbackQuery);
      break;
    case 'check':
      await commands.handleCheckTask(bot, callbackQuery);
      break;
    case 'back':
      if (callbackQuery.data === 'back_to_tasks') {
        await commands.handleTasks(bot, callbackQuery.message);
      }
      break;
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (config.adminIds.includes(chatId)) {
    const adminKeyboard = utils.getAdminKeyboard();
    await bot.sendMessage(chatId, 'Выберите действие:', { reply_markup: adminKeyboard });
  } else {
    const userKeyboard = utils.getMainKeyboard();
    await bot.sendMessage(chatId, 'Выберите действие:', { reply_markup: userKeyboard });
  }
});

console.log('Бот запущен...!');
