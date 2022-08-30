// ytzero - readonly worker thread for list queries
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const { parentPort } = require('worker_threads');
const ut = require('../client/js/ut.js')();
const db = require('better-sqlite3')('./db/ytzero.db', { readonly: true});
const ZLib = require('zlib');

function decode(zip) {
	return ut.jp(ZLib.gunzipSync(zip).toString('utf8'));
}

function meta(data,field) {
	let m = decode(data);
	if (m === null) return '';
	if (m[field] === undefined) return '';
	return m[field];
}

function texthas(name, data, sub) {
	let obj = '*';
	let txt = '';
	if (sub.includes(':')) {
		let z = sub.split(':');
		obj = z[0].toLowerCase();
		txt = z[1].toLowerCase();
	} else {
		txt = sub.toLowerCase();
	}
	if ((obj === '*' || obj === 'name') && name.toLowerCase().includes(txt)) return 1;
	let json = decode(data);
	if (json.author && (obj ==='*' || obj === 'author') && json.author.toLowerCase().includes(txt)) return 1;
	if (json.title && (obj === '*' || obj === 'title') && json.title.toLowerCase().includes(txt)) return 1;
	if (json.country && (obj === '*' || obj === 'country') && json.country.toLowerCase().includes(txt)) return 1;
	if (json.description && (obj ==='*' || obj === 'description') && json.country.toLowerCase().includes(txt)) return 1;
	if (json.category && (obj === '*' || obj === 'category') && json.category.toLowerCase().includes(txt)) return 1;
	if (json.keywords && (obj === '*' || obj === 'keywords') && json.keywords.join(',').toLowerCase().includes(txt)) return 1;
	if (json.tags && (obj === '*' || obj === 'tags') && json.tags.join(',').toLowerCase().includes(txt)) return 1;
	return 0;
}

db.pragma('journal_mode = WAL');
db.pragma('temp_store = memory');
db.pragma('mmap_size = 30000000000');

db.function('now', ut.now);
db.function('seconds', ut.seconds.bind(ut));
db.function('minutes', ut.minutes.bind(ut));
db.function('hours', ut.hours.bind(ut));
db.function('days', ut.days.bind(ut));
db.function('sqrt', Math.sqrt);
db.function('floor', Math.floor);
db.function('meta', meta);
db.function('texthas', texthas);

parentPort.on('message', ({ sql, parameters }) => {
    const result = db.prepare(sql).all(parameters);
    parentPort.postMessage(result);
});