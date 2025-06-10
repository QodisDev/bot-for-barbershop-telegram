const Datastore = require('nedb');
const path = require('path');

const bookings = new Datastore({
    filename: path.join(__dirname, '../db/bookings.db'),
    autoload: true,
});
console.log('Путь к БД:', path.resolve(__dirname, '../db/bookings.db'));
bookings.loadDatabase((err) => {
    if (err) console.error('Ошибка загрузки БД:', err);
    else console.log('БД успешно загружена');
});

bookings.remove({ date: { $lt: new Date() } }, { multi: true }, (err) => {
    if (err) console.error('Ошибка очистки старых записей:', err);
});

module.exports = { bookings };
