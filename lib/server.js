// ytzero - Web and socket server
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const Express = require('express');
const HTTP =  require('http');
const IO = require('socket.io');

class Server {

	// server constructor
	constructor(engine) {
		this.engine = engine;
		// web server
		this.express = Express;
		this.web = this.express();
		this.svr = HTTP.createServer(this.web);
		// socket server
		this.io = IO(this.svr);
		// web routing
		this.web.get('/', (req, res) => {
			res.end(this.engine.html());
		});
		this.web.use(this.express.json());
		this.web.post('/',function(req,res) {
			this.engine.takeup(res,req.body);
		});
		this.web.use(this.express.static('client'));
		// socket routing
		this.io.on('connection', async socket => {
			this.engine.commands.forEach((e)=>{
				socket.on(e, (data) => {
					//console.log('Receive');
					//console.log(e);
					this.engine[e](data,socket);
					//this.engine.emit(socket,e,data);
				});
			});
			this.engine.sockets = await this.io.fetchSockets();
		});
		// start listening
		this.svr.listen(this.engine.cfg.engine.port);
		console.log(`ytzero - waiting for client connection on ${this.
			engine.cfg.engine.site}:${this.engine.cfg.engine.port}`);
	}

}

module.exports = Server;