const { Telegraf } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const fs = require('fs');
const path = require('path');
const { bookings } = require('./utils/db');
const config = require('./config.json');
const { scheduleJob } = require('node-schedule');
const { escapeHtml } = require('./utils/helpers.js');

const bot = new Telegraf('TOKEN_BOT');

const sessions = new LocalSession({ database: 'session_db.json' });
bot.use(sessions.middleware());

fs.readdirSync(path.join(__dirname, 'commands')).forEach(file => {
    const command = require(`./commands/${file}`);
    bot.command(command.command_name, (ctx) => {
        if (command.allowed_users.length > 0 && !command.allowed_users.includes(ctx.from.id)) {
            return ctx.reply('🚫 У вас нет доступа к этой команде.');
        }
        command.execute(ctx, bot);
    });
});

bot.hears('👨‍💻 Связаться с мастером', async (ctx) => {
    await ctx.replyWithHTML(
        `💈 <b>${escapeHtml(config.botName || "Контакты мастера: ")}</b>\n\n` +
        '📱 <a href="https://t.me/nickname_parik">Тг: @nickname_parik</a>\n' +
        '⏱ Часы работы: 9:00-21:00\n' +
        '📞 Телефон: +7 (XXX) XXX-XX-XX',
        {
            disable_web_page_preview: true,
            reply_markup: { remove_keyboard: true }
        }
    );
});

bot.action(/barber_cancel_(.+)/, async (ctx) => {
    try {
        const bookingId = ctx.match[1];

        if (!config.barbers.includes(ctx.from.id)) {
            return await ctx.answerCbQuery('🚫 Нет прав');
        }
        const numRemoved = await new Promise((resolve, reject) => {
            bookings.remove(
                { _id: bookingId },
                {},
                (err, numRemoved) => err ? reject(err) : resolve(numRemoved)
            )
        });

        if (numRemoved === 0) {
            return await ctx.answerCbQuery('⚠️ Запись не найдена');
        }
        await new Promise(resolve => bookings.loadDatabase(resolve));

        await ctx.answerCbQuery('✅ Запись удалена');
        await require('./commands/barber_bookings.js').execute(ctx, bot);

    } catch (err) {
        console.error('Ошибка удаления:', err);
        await ctx.answerCbQuery('⚠️ Ошибка удаления');
    }
});


bot.action('bookings_prev', async (ctx) => {
    ctx.session.bookingPage = Math.max(1, (ctx.session.bookingPage || 1) - 1);
    await require('./commands/barber_bookings.js').execute(ctx, bot);
});
bot.action('bookings_next', async (ctx) => {
    ctx.session.bookingPage = (ctx.session.bookingPage || 1) + 1;
    await require('./commands/barber_bookings.js').execute(ctx, bot);
});
bot.action('noop', async (ctx) => {
    await ctx.answerCbQuery();
});

async function cleanupOldBookings() {
    const allBookings = await bookings.find({});
    const now = new Date();

    for (const booking of allBookings) {
        const bookingDate = new Date(`${booking.date} ${booking.time}`);
        if (bookingDate < now) {
            await bookings.remove({ _id: booking._id });
            console.log(`Удалена устаревшая запись ID: ${booking._id}`);
        }
    }
}

bot.launch().then(async () => {
    console.log('Бот запущен!');
    await cleanupOldBookings();

    scheduleJob('0 3 * * *', cleanupOldBookings);
});


