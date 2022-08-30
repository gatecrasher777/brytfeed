// ytzero - server-side executable
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const fs = require('fs');
const Engine = require('./lib/engine')
const engine = new Engine('./db/ytzero.db');

// copy or update client-side npm modules
let code = fs.readFileSync('./node_modules/htflow/htflow.js','utf8');
fs.writeFileSync('./client/js/htflow.js',code,'utf8');
code = fs.readFileSync('./node_modules/socket.io/client-dist/socket.io.js','utf8');
fs.writeFileSync('./client/js/socket.io.js',code,'utf8');
code = fs.readFileSync('./node_modules/socket.io/client-dist/socket.io.js.map','utf8');
fs.writeFileSync('./client/js/socket.io.js.map',code,'utf8');

// tell client that server has stopped
process.on ('exit', () => {
    engine.emitAll('stop',{cb:'stop'});
    if (engine.cfg.advanced.memoryMode === 'ON') {
        engine.db.backup(false);
    } else {
        engine.db.sql.close();
    }
});

process.on('SIGHUP', () => process.exit(0));

process.on('SIGINT', () => process.exit(0));

process.on('SIGTERM', () => process.exit(0));

// start the engine
engine.start();