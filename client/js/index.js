/* brytfeed - (c) 2023 Gatecrasher777 */
/* main client application */

const socket = io.connect();
const ht = htflowInit();
const ut = utInit();

// create webb application
const wapp = new Wapp();

// list of allowed responses from server
const response = [
	'updated',
	'start',
	'create',
	'bw',
	'stats',
	'topicmenu',
	'searchmenu',
	'channelmenu',
	'itemlist',
	'stop',
	'downloaded',
	'prg',
	'queue',
	'reload',
	'backfilled'
];

// activate callback on message receipt
response.forEach( e => {
	socket.on(e, function(data) {
		if (data.cb) wapp[data.cb](data);
	});
});

// add event listeners
window.onresize = wapp.resize.bind(wapp);
//document.onselectstart = () => { return wapp.selectOK; }
document.addEventListener('keydown', wapp.keyDown.bind(wapp));
document.addEventListener('keyup', wapp.keyUp.bind(wapp));