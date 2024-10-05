async function checkSubscription(bot, userId, channelId) {
    try {
        const chatMember = await bot.getChatMember(channelId, userId);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
        console.error('Ошибка при проверке подписки:', error);
        if (error.response && error.response.statusCode === 400) {
            console.error('Возможно, бот не добавлен в канал или ID канала неверный:', channelId);
            return 'CHAT_NOT_FOUND';
        }
        return false;
    }
}

function getMainKeyboard() {
    return {
        keyboard: [
            ['📋 Задания', '👑 Лидеры'],
            ['👤 Профиль', '💰 Вывод'],
            ['🔗 Реферальная ссылка', '❓ Помощь'],
            ['🎁 Ежедневный бонус']
        ],
        resize_keyboard: true
    };
}

function getAdminKeyboard() {
    return {
        keyboard: [
            ['📋 Задания', '👑 Лидеры'],
            ['👤 Профиль', '💰 Вывод'],
            ['🔗 Реферальная ссылка', '❓ Помощь'],
            ['🎁 Ежедневный бонус'],
            ['➕ Добавить задание', '➖ Удалить задание'],
            ['📢 Добавить канал', '🔇 Удалить канал'],
            ['📊 Статистика']
        ],
        resize_keyboard: true
    };
}

module.exports = {
    checkSubscription,
    getMainKeyboard,
    getAdminKeyboard
};