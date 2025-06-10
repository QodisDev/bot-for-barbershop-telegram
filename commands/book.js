const { bookings } = require('../utils/db');
const { Markup } = require('telegraf');

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

module.exports = {
    command_name: 'book',
    allowed_users: [],
    async execute(ctx, bot) {
        const services = ['Стрижка', 'Окрашивание', 'Бритьё', 'Укладка', 'Маникюр'];

        if (ctx.message?.text === '/book') {
            await ctx.reply(
                '✂️ Выберите услугу:',
                Markup.inlineKeyboard(services.map(service =>
                    [Markup.button.callback(service, `service_${service}`)]
                ))
            );
        }

        bot.action(/service_(.+)/, async (ctx) => {
            const service = ctx.match[1];
            ctx.session.booking = { service };

            const dates = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                dates.push(date.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }));
            }

            await ctx.editMessageText(
                `📅 Выберите дату для "${service}":`,
                Markup.inlineKeyboard(dates.map(date =>
                    [Markup.button.callback(date, `date_${date}`)]
                ))
            );
        });

        bot.action(/date_(.+)/, async (ctx) => {
            ctx.session.booking.date = ctx.match[1];
            await ctx.editMessageText('⏰ Введите время визита в формате ЧЧ:ММ (например, 14:30):');
        });

        bot.on('text', async (ctx) => {
            if (!ctx.session?.booking) return;
            if (ctx.message.text.startsWith('/')) return;

            if (!ctx.session.booking.time) {
                if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(ctx.message.text)) {
                    return ctx.reply('❌ Неверный формат времени. Используйте ЧЧ:ММ (например, 14:30).');
                }
                ctx.session.booking.time = ctx.message.text;
                return ctx.reply('👤 Введите ваше имя:');
            }

            if (!ctx.session.booking.name) {
                if (ctx.message.text.length < 2) {
                    return ctx.reply('❌ Имя слишком короткое');
                }
                ctx.session.booking.name = ctx.message.text;
                return ctx.reply('📞 Введите ваш номер телефона:');
            }

            if (!ctx.session.booking.phone) {
                if (!/^[\d\s\+\-\(\)]{7,15}$/.test(ctx.message.text)) {
                    return ctx.reply('❌ Неверный формат телефона');
                }
                ctx.session.booking.phone = ctx.message.text;
                ctx.session.booking.userId = ctx.from.id;

                const { service, date, time, name, phone } = ctx.session.booking;
                await ctx.replyWithHTML(
                    `<pre>┌──────────────────────────┐\n` +
                    `│   📝 <b>ПОДТВЕРДИТЕ ЗАПИСЬ</b>   │\n` +
                    `├──────────────────────────┤\n` +
                    `│ ✦ <b>Услуга</b>: ${escapeHtml(service)}\n` +
                    `│ ✦ <b>Дата</b>: ${escapeHtml(date)}\n` +
                    `│ ✦ <b>Время</b>: ${escapeHtml(time)}\n` +
                    `│ ✦ <b>Имя</b>: ${escapeHtml(name)}\n` +
                    `│ ✦ <b>Тел.</b>: ${escapeHtml(phone)}\n` +
                    `└──────────────────────────┘</pre>`,
                    Markup.inlineKeyboard([
                        [Markup.button.callback('✅ Подтвердить', 'confirm_booking')],
                        [Markup.button.callback('✏️ Изменить', 'restart_booking')]
                    ])
                );
            }
        });

        bot.action('confirm_booking', async (ctx) => {
            try {
                const booking = ctx.session.booking;
                if (!booking) {
                    return ctx.answerCbQuery('❌ Сессия устарела', { show_alert: true });
                }

                if (!booking.service || !booking.date || !booking.time || !booking.name || !booking.phone) {
                    return ctx.answerCbQuery('❌ Заполните все поля!', { show_alert: true });
                }

                const [day, month, year] = booking.date.split('.');
                const bookingDate = new Date(`${year}-${month}-${day}T${booking.time}:00`);

                if (bookingDate < new Date()) {
                    return ctx.answerCbQuery('❌ Нельзя записаться на прошедшую дату', { show_alert: true });
                }

                const userBookings = await new Promise((resolve, reject) => {
                    bookings.find({
                        userId: ctx.from.id,
                        deleted: { $ne: true }
                    }).exec((err, docs) => {
                        if (err) reject(err);
                        else resolve(docs || []);
                    });
                });

                const hasConflict = userBookings.some(b => {
                    const existingTime = new Date(b.date).getTime();
                    const newTime = bookingDate.getTime();
                    return Math.abs(existingTime - newTime) < 3600000;
                });

                if (hasConflict) {
                    return ctx.answerCbQuery('❌ У вас уже есть запись на эту дату', { show_alert: true });
                }

                if (parseInt(booking.time.split(':')[0]) < 9 || parseInt(booking.time.split(':')[0]) > 21) {
                    return ctx.answerCbQuery('❌ Мы работаем с 9:00 до 21:00', { show_alert: true });
                }

                if (userBookings.filter(b => new Date(b.date) >= new Date()).length >= 3) {
                    return ctx.answerCbQuery('❌ Лимит активных записей (3) исчерпан', { show_alert: true });
                }

                await new Promise((resolve, reject) => {
                    bookings.insert({
                        userId: ctx.from.id,
                        service: booking.service,
                        date: bookingDate,
                        time: booking.time,
                        name: booking.name,
                        phone: booking.phone,
                        deleted: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, (err, doc) => {
                        if (err) reject(err);
                        else resolve(doc);
                    });
                });

                await ctx.editMessageText(
                    `✅ Запись успешно создана!\n\n` +
                    `📅 Дата: ${bookingDate.toLocaleDateString('ru-RU')}\n` +
                    `⏰ Время: ${booking.time}\n` +
                    `✂️ Услуга: ${booking.service}\n\n` +
                    'ℹ️ Управление записями: /mybookings'
                );
                delete ctx.session.booking;

            } catch (err) {
                console.error('Ошибка подтверждения:', err);
                ctx.answerCbQuery('❌ Ошибка: ' + (err.message || 'Попробуйте позже'), { show_alert: true });
            }
        });


        bot.action('restart_booking', async (ctx) => {
            delete ctx.session.booking;
            await ctx.editMessageText(
                '🔄 Начинаем заново. Выберите услугу:',
                Markup.inlineKeyboard(services.map(service =>
                    [Markup.button.callback(service, `service_${service}`)]
                ))
            );
        });

        bot.action(/call_(.+)/, async (ctx) => {
            const phone = ctx.match[1];
            await ctx.replyWithHTML(
                `📞 Телефон клиента: <code>${phone}</code>\n` +
                `👤 Имя: ${ctx.session.booking?.name || 'не указано'}`
            );
        });
    }
};
