const { Markup } = require('telegraf');
const config = require('../config.json');
const { escapeHtml } = require('../utils/helpers');

module.exports = {
    command_name: 'start',
    description: '🌟 Главное меню',
    allowed_users: [],
    async execute(ctx) {
        await ctx.replyWithHTML(
            `✨ <b>Добро пожаловать в ${escapeHtml(config.botName || "BarbetBot")}!</b>\n\n` +
            `🛠️ Я ваш виртуальный помощник для записи в парикмахерскую.\n\n` +
            `▫️ 📅 Записаться к нам - /book\n` +
            `▫️ 👨‍💻 Управление записями - /mybookings\n\n` +
            `👇 Выберите действие или нажмите /help`,
            Markup.keyboard([
                ['✂️ Услуги и цены', '📅 Мои записи'],
                ['👨‍💻 Связаться с мастером']
            ])
                .resize()
                .persistent()
        );
    }
};
