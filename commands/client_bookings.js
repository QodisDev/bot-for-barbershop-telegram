const { bookings } = require('../utils/db');
const { Markup } = require('telegraf');
const { escapeHtml } = require('../utils/helpers');

module.exports = {
    command_name: 'mybookings',
    allowed_users: [],
    async execute(ctx, bot) {
        const userId = ctx.from.id;

        await new Promise(resolve => {
            bookings.remove({
                userId,
                date: { $lt: new Date() }
            }, { multi: true }, resolve);
        });

        const userBookings = await new Promise(resolve => {
            bookings.find({ userId })
                .sort({ date: 1 })
                .limit(3)
                .exec((err, docs) => resolve(err ? [] : docs || []));
        });

        if (!userBookings.length) {
            return ctx.replyWithHTML('📭 У вас нет активных записей\n\nℹ️ Новая запись: /book');
        }

        const message = userBookings.map((booking, index) => {
            const date = new Date(booking.date);
            return `${index + 1}. <b>${escapeHtml(booking.service)}</b>\n` +
                `📅 ${date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}\n` +
                `⏰ ${booking.time}\n` +
                `📞 ${escapeHtml(booking.phone)}`;
        }).join('\n\n');

        await ctx.replyWithHTML(
            `✨ <b>Ваши активные записи</b> (максимум 3):\n\n${message}`,
            Markup.inlineKeyboard([
                ...userBookings.map(booking => [
                    Markup.button.callback(
                        `❌ Отменить ${new Date(booking.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${booking.time}`,
                        `cancel_${booking._id}`
                    )
                ]),
                [Markup.button.callback('🔄 Обновить', 'mybookings')]
            ])
        );

        bot.action(/cancel_(.+)/, async (ctx) => {
            try {
                const bookingId = ctx.match[1];
                console.log(`Попытка отмены записи ID: ${bookingId}`);

                const numRemoved = await bookings.remove({ _id: bookingId }, { multi: false });
                console.log(`Удалено записей: ${numRemoved}`);

                if (numRemoved === 0) {
                    console.error('Запись не найдена или не удалена');
                    return ctx.answerCbQuery('❌ Запись не найдена', { show_alert: true });
                }

                await ctx.answerCbQuery('✅ Запись отменена');
                await ctx.deleteMessage();
                await this.execute(ctx, bot);
            } catch (err) {
                console.error('Ошибка при отмене записи:', err);
                await ctx.answerCbQuery('❌ Ошибка при отмене записи', { show_alert: true });
            }
        });


    }
};
