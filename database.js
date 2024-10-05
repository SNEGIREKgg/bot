const fs = require('fs').promises;
const config = require('./config');

async function readJSONFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            console.error(`Ошибка при чтении файла ${filePath}:`, error);
            return [];
        }
        throw error;
    }
}

async function writeJSONFile(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Ошибка при записи в файл ${filePath}:`, error);
        throw error;
    }
}

async function findUser(telegramId) {
    const users = await readJSONFile(config.usersFile);
    return users.find(user => user.telegramId === telegramId);
}

async function saveUser(user) {
    const users = await readJSONFile(config.usersFile);
    const index = users.findIndex(u => u.telegramId === user.telegramId);
    if (index !== -1) {
        users[index] = user;
    } else {
        users.push(user);
    }
    await writeJSONFile(config.usersFile, users);
}

async function getAllUsers() {
    return readJSONFile(config.usersFile);
}

async function getTasks() {
    return readJSONFile(config.tasksFile);
}

async function saveTask(task) {
    const tasks = await getTasks();
    const maxId = tasks.reduce((max, t) => Math.max(max, t.id || 0), 0);
    task.id = maxId + 1;
    tasks.push(task);
    await writeJSONFile(config.tasksFile, tasks);
    return task;
}

async function updateTask(task) {
    const tasks = await getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index !== -1) {
        tasks[index] = task;
        await writeJSONFile(config.tasksFile, tasks);
        return true;
    }
    return false;
}

async function removeTask(taskId) {
    const tasks = await getTasks();
    const filteredTasks = tasks.filter(task => task.id !== taskId);
    await writeJSONFile(config.tasksFile, filteredTasks);
    return tasks.length !== filteredTasks.length;
}

async function getRequiredChannels() {
    return readJSONFile(config.channelsFile);
}

async function addRequiredChannel(channel) {
    const channels = await getRequiredChannels();
    channels.push(channel);
    await writeJSONFile(config.channelsFile, channels);
}

async function removeRequiredChannel(channelUrl) {
    const channels = await getRequiredChannels();
    const filteredChannels = channels.filter(ch => ch.channelUrl !== channelUrl);
    await writeJSONFile(config.channelsFile, filteredChannels);
    return channels.length !== filteredChannels.length;
}

async function getNextAvailableTask(user) {
    const tasks = await getTasks();
    // Проверяем, существует ли пользователь и есть ли у него свойство completedTasks
    const completedTasks = user && user.completedTasks ? user.completedTasks : [];
    return tasks.find(task =>
        !completedTasks.includes(task.id) &&
        task.completions < task.limit
    );
}

async function initDatabase() {
    try {
        let users = await readJSONFile(config.usersFile);
        console.log(`Загружено ${users.length} пользователей из базы данных.`);

        // Удаление дубликатов
        const uniqueUsers = [];
        const seenIds = new Set();
        for (const user of users) {
            if (!seenIds.has(user.telegramId)) {
                uniqueUsers.push(user);
                seenIds.add(user.telegramId);
            } else {
                // Если найден дубликат, оставляем пользователя с большим UC
                const existingUser = uniqueUsers.find(u => u.telegramId === user.telegramId);
                if (user.uc > existingUser.uc) {
                    uniqueUsers[uniqueUsers.indexOf(existingUser)] = user;
                }
            }
        }

        if (uniqueUsers.length !== users.length) {
            console.log(`Удалено ${users.length - uniqueUsers.length} дубликатов.`);
            await writeJSONFile(config.usersFile, uniqueUsers);
            users = uniqueUsers;
        }

        return users;
    } catch (error) {
        console.error('Ошибка при инициализации базы данных:', error);
        return [];
    }
}

module.exports = {
    findUser,
    saveUser,
    getAllUsers,
    getTasks,
    saveTask,
    updateTask,
    removeTask,
    getRequiredChannels,
    addRequiredChannel,
    removeRequiredChannel,
    getNextAvailableTask,
    initDatabase
};