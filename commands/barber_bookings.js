const { bookings } = require('../utils/db');
const { Markup } = require('telegraf');
const config = require('../config.json');
const { escapeHtml, formatRussianDate } = require('../utils/helpers');

module.exports = {
    command_name: 'allbookings',
    allowed_users: config.barbers,
    async execute(ctx, bot) {
        try {

            if (!bookings || typeof bookings.find !== 'function') {
                console.error('Некорректное подключение к БД');
                return ctx.replyWithHTML('⚠️ <b>Ошибка конфигурации базы данных</b>');
            }

            const page = Math.max(1, ctx.session.bookingPage || 1);
            const perPage = 5;
            const now = new Date();

            const allDocs = await new Promise(resolve => {
                bookings.find({})
                    .sort({ date: 1 })
                    .exec((err, docs) => resolve(err ? [] : docs || []));
            });

            const validBookings = allDocs.filter(doc => {
                if (doc.deleted || doc.$$deleted) return false;
                const bookingDate = doc.date instanceof Date ? doc.date : new Date(doc.date);
                return bookingDate > now;
            });

            const totalPages = Math.max(1, Math.ceil(validBookings.length / perPage));
            const currentPage = Math.min(page, totalPages);
            const currentBookings = validBookings.slice(
                (currentPage - 1) * perPage,
                currentPage * perPage
            );

            const formatBooking = (booking) => {
                const bookingDate = new Date(booking.date);
                return [
                    `📅 <b>${formatRussianDate(bookingDate)}</b> в ${escapeHtml(booking.time)}`,
                    `✂️ ${escapeHtml(booking.service)}`,
                    `👤 ${escapeHtml(booking.name)} │ 📞 <code>${escapeHtml(booking.phone)}</code>`,
                    '────────────────────────'
                ].join('\n');
            };

            const message = [
                `📊 <b>Активные записи</b> (${validBookings.length} всего, стр. ${currentPage}/${totalPages}):`,
                ...currentBookings.map(formatBooking)
            ].join('\n\n');

            const keyboard = [
                ...currentBookings.map(booking => [
                    Markup.button.callback(
                        `❌ Отменить ${formatRussianDate(new Date(booking.date), true)} ${escapeHtml(booking.time)}`,
                        `barber_cancel_${escapeHtml(booking._id.toString())}`
                    )
                ]),
                [
                    Markup.button.callback(
                        '◀️ Назад',
                        currentPage > 1 ? 'bookings_prev' : 'noop',
                        currentPage <= 1
                    ),
                    Markup.button.callback(
                        `${currentPage}/${totalPages}`,
                        'noop'
                    ),
                    Markup.button.callback(
                        'Вперёд ▶️',
                        currentPage < totalPages ? 'bookings_next' : 'noop',
                        currentPage >= totalPages
                    )
                ]
            ];

            const replyOptions = {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard },
                disable_web_page_preview: true,
                disable_notification: true
            };

            if (ctx.callbackQuery) {
                await ctx.editMessageText(message, replyOptions);
                await ctx.answerCbQuery();
            } else {
                await ctx.replyWithHTML(message, replyOptions);
            }

            ctx.session.bookingPage = currentPage;

        } catch (err) {
            console.error('Ошибка в allbookings:', err);
            const errorMessage = ctx.callbackQuery
                ? '⚠️ Ошибка при обновлении записей'
                : '⚠️ Произошла ошибка при загрузке записей';
            await (ctx.callbackQuery ? ctx.answerCbQuery : ctx.replyWithHTML).call(ctx, errorMessage);
        }
    }
};
