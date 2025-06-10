const { Markup } = require('telegraf');

module.exports = {
    command_name: 'help',
    allowed_users: [],
    async execute(ctx) {
        await ctx.replyWithHTML(
            `🛠 <b>Справочный центр</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📌 <b>Основные команды:</b>\n` +
            `├ /start - Приветственное сообщение\n` +
            `├ /book - Новая запись\n` +
            `├ /mybookings - Управление записями\n` +
            `└ /help - Эта справка\n\n` +
            `🔍 <b>Для администраторов:</b>\n` +
            `└ /allbookings - Все записи\n\n` +
            `📱 <i>На мобильных устройствах используйте меню внизу экрана.</i>`,
            Markup.inlineKeyboard([
                [
                    Markup.button.url('📞 Контакты', 'https://example.com'),
                    Markup.button.url('📍 Адрес', 'https://maps.example.com')
                ],
                [Markup.button.callback('🔄 Обновить', 'refresh_help')]
            ])
        );
    }
};
