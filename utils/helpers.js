function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatRussianDate(date, short = false) {
    if (!(date instanceof Date)) {
        date = new Date(date.$$date || date);
    }

    const options = short ? {
        day: 'numeric',
        month: 'short'
    } : {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };

    return date.toLocaleDateString('ru-RU', options);
}

module.exports = { escapeHtml, formatRussianDate };
