// ytzero - engine interface
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const ht = require('htflow')();
const ytcog = require('ytcog');
const path = require('path');
const fs = require('fs');
const mv = require('mv');
const request = require('request');
const Database = require('./database');
const Server = require('../lib/server');
const { Worker } = require('worker_threads');
const os = require('os');

class Engine {

    // engine constructor
    constructor(dbPath) {
        // global variables
        this.dbPath = dbPath;
        this.session = null;
        this.proxySession = null;
        this.workers = [];
        this.queue = [];
        this.sockets = [];
        this.result = [];
        this.unfiltered = 0;
        this.cancelled = [];
        this.times = 0;
        this.dlCount = 0;
        this.started = false;
        this.closing = false;
        this.bandwidth = {
            search: 0,
            channel: 0,
            video: 0,
            download: 0
        }
        this.cfg = {}
        // start the database
        this.db = new Database(this);
        // initiate worker threads, 1 per cpu
        for (let i=0; i<os.cpus().length; i++) this.spawn();
        // initiate data management
        this.db.initDM();
        // allowable socket requests
        this.commands =   [
            'start',
            'open',
            'cancel',
            'set',
            'topicmenu',
            'searchmenu',
            'channelmenu',
            'list',
            'delete',
            'setcfg',
            'refresh',
            'download',
            'export',
            'delvid',
            'stop',
            'shown',
            'disconnect',
            'level',
            'discardchanvids',
            'queuechanvids',
            'reload',
            'stop',
            'backfill'
        ];
        // start the server
        this.svr = new Server(this);
    }

    // initial client html
    html() {
        return ht.doc(
            ht.html(
                ht.head(
                    ht.meta(
                        {
                            charset:'utf8'
                        }
                    ),
                    ht.link(
                        {
                            rel: 'stylesheet',
                            href: 'css/wapp.css'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/socket.io.js'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/htflow.js'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/ut.js'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/item.js'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/topic.js'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/search.js'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/channel.js'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/video.js'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/wapp.js'
                        }
                    ),
                    ht.script(
                        {
                            src: './js/index.js'
                        }
                    ),
                    ht.title(
                        'ytzero'
                    )
                ),
                ht.body(
                    {
                        onload: ht.cmd('wapp.start')
                    },
                    ht.div(
                        {
                            id: 'page'
                        },
                        ht.div(
                            {
                                id: 'menu1',
                                'class': 'sectiondiv'
                            }
                        ),
                        ht.div(
                            {
                                id: 'menu2',
                                'class': 'sectiondiv'
                            }
                        ),
                        ht.div(
                            {
                                id: 'launch',
                                'class': 'sectiondiv'
                            }
                        ),
                        ht.div(
                            {
                                id: 'options',
                                'class': 'sectiondiv'
                            }
                        ),
                        ht.div(
                            {
                                id: 'controls',
                                'class': 'sectiondiv'
                            }
                        ),
                        ht.div(
                            {
                                id: 'content',
                                'class': 'sectiondiv'
                            }
                        ),
                        ht.div(
                            {
                                id: 'status',
                                'class': 'sectiondiv'
                            },
                            ht.div(
                                {
                                    id: 'status_msg',
                                    'class': 'statusdiv',
                                    title: 'menu crumb or the sort field value range (lists)'
                                }
                            ),
                            ht.div(
                                {
                                    id: 'status_nav',
                                    'class': 'statusdiv',
                                    title:'(first-last items) of (filtered items) of (all items)'
                                }
                            ),
                            ht.div(
                                {
                                    id: 'status_upd',
                                    'class': 'statusdiv',
                                    title:'estimated update bandwith, and % for (s)earches, (c)hannels, (v)ideos & (d)ownloads)'
                                }
                            )
                        )
                    ),
                    ht.div(
                        {
                            id: 'play'
                        },

                    ),
                    ht.div(
                        {
                            id : 'embedInfo'
                        }
                    )
                )
            )
        );
    }

    // spawn worker threads
    spawn() {
        const worker = new Worker('./lib/worker.js');
        let job = null;
        let error = null;
        let eng = this;

        function takeWork() {
          if (!job && eng.queue.length) {
            job = eng.queue.shift();
            worker.postMessage(job.message);
          }
        }

        worker.on('online', () => {
            this.workers.push({ takeWork });
            takeWork();
        });

        worker.on('message', (result) => {
            job.resolve(result);
            job = null;
            takeWork();
        });

        worker.on('error', (err) => {
            console.error(err);
            error = err;
        });

        worker.on('exit', (code) => {
            this.workers = this.workers.filter(w => w.takeWork !== takeWork);
            if (job) {
                job.reject(error || new Error('worker died'));
            }
            if (code !== 0) {
                console.error(`worker exited with code ${code}`);
                this.spawn(); // Worker died, so spawn a new one
            }
        });
    }

    // drain worker thread queue
    drainQueue() {
        for (const worker of this.workers) {
            worker.takeWork();
        }
    }

    // utilize worker threads for readonly database queries
    asyncQuery(sql, parameters = {}) {
        return new Promise((resolve, reject) => {
            this.queue.push({
            resolve,
            reject,
            message: { sql, parameters },
            });
            this.drainQueue();
        });
    };

    // visually update shown items
    emitShown(tag, id, data) {
        this.sockets.forEach( socket => {
            if (
                socket.data
                &&
                socket.data.showing
                &&
                socket.data.showing.includes(id)
            ) {
                this.emit(socket, tag, data);
            }
        });
    }

    // update db and show changes
    update(dm, item) {
        dm.succeed(item);
        this.emitShown('updated', item.id, {
            type: dm.type,
            item: item,
            cb: 'setUpdate',
        });
    }

    // download video (client or automated)
    async dl(video) {
        while (this.dlCount >= 10) {
            await new Promise(r => setTimeout(r, 30000));
        }
        this.dlCount++;
        video.item.state = 'download..';
        this.update(this.db.video,video.item);
        let pprg = -1;
        let progress = (prg,siz) => {
            if (!isNaN(siz)) this.bandwidth.download += siz;
            let p = Math.floor(Math.min(99,prg));
            if (p != pprg) {
                this.emitShown('prg',video.item.id,{
                    id: video.item.id,
                    prg: p.toString()+'%',
                    cb:'dlProgress'
                });
                pprg = p;
            }
            if (this.cancelled.includes(video.item.id)) video.cancel();
        };
        let opts = {
            progress: progress.bind(this)
        }
        await video.download(opts);
        video.item.downloaded = video.downloaded;
        this.dlCount --;
        if (video.downloaded) {
            video.item.meta.fn = video.fn;
            video.item.meta.url = this.cfg.engine.site+':'+this.cfg.engine.port+'/dl/'+path.basename(video.fn);
            this.emitShown('prg',video.item.id,{
                id: video.item.id,
                prg: '100%',
                cb:'dlProgress'
            });
            video.item.state = 'downloaded';
            this.emitShown(video.item.state,video.item.id, {
                type:'video',
                item: video.item,
                cb: 'dlCompleted'
            });
            this.update(this.db.video,video.item);
            if (this.cancelled.includes(video.item.id)) this.cancelled.splice(this.cancelled.indexOf(video.item.id),1);
        } else {
            video.item.state = 'queue';
            this.emitShown(video.item.state,video.item.id, {
                type:'video',
                item: video.item,
                cb: 'dlCompleted'
            });
            this.update(this.db.video,video.item);
            if (this.cancelled.includes(video.item.id)) this.cancelled.splice(this.cancelled.indexOf(video.item.id),1);
        }
    }

    // export downloaded video (client or automated)
    exportVideo(video) {
        let op = path.parse(video.meta.fn);
        let np = path.parse('./export'+path.sep+'name.ext');
        np.name = op.name;
        np.ext = op.ext;
        np.base = op.base;
        let nfn = path.format(np);
        mv(video.meta.fn,nfn,(err)=>{
            if (!err) {
                video.item.state = 'discarded';
                this.update(this.db.video,video.item);
            }
        });
    }

    // message to client
    emit(socket, tag, data) {
        if (data.cb !== undefined && socket !== null) {
            //console.log('Send');
            //console.log(tag);
            socket.emit(tag, data);
        }
    }

    //message to all clients
    emitAll(tag, data) {
        if ((data.cb !== undefined) && (this.svr.io !== null)) {
            this.svr.io.emit(tag, data);
        }
    }

    // report engine bandwidth usage
    bw() {
        let data = {
            bw: this.bandwidth,
            cb: 'setBandwidth'
        };
        this.emitAll('bw', data);
        setTimeout(this.bw.bind(this),this.cfg.client.bandwidthCycle);
    }

    // start the engine
    async go() {
        if (this.proxySession) {
            console.log('proxy session... ');
            await this.proxySession.fetch();
            if (this.proxySession.status === 'OK') {
                console.log('proxy session succeeded...');
            } else {
                console.log('proxy session failed...');
                console.log('status: '+this.proxySession.status);
                console.log('reason: '+this.proxySession.reason);
            }
        }
        console.log('main session... ')
        await this.session.fetch();
        if (this.session.status === 'OK') {
            console.log('main session succeeded');
            this.db.go();
            setTimeout(this.bw.bind(this),this.cfg.client.bandwidthCycle);
        } else {
            console.log('session failed...');
            console.log('status: '+this.session.status);
            console.log('reason: '+this.session.reason);
        }
    }

    // determine if start is required
    start(data = {}, socket = undefined) {
        if (this.started && socket) {
            data.cfg = this.cfg;
            data.cb = 'startcfg';
            this.emit(socket,'start',data);
        } else {
            this.started = true;
            this.session = new ytcog.Session(this.cfg.engine.cookie,this.cfg.engine.agent);
            if (this.cfg.engine.proxy.length) this.proxySession = new ytcog.Session('','',this.cfg.engine.proxy);
            this.go();
        }
    }

    // open an item
    open(data, socket) {
        socket.data.showing = [0];
        switch(data.type) {
            case 'topic':
                let topic = this.db.topic.create(data);
                data.info = this.db.topic.open(topic);
            break;
            case 'search':
                data.meta = {
                    query: data.query,
                    channelLevel: data.level
                };
                let search = this.db.hour.create(data);
                data.info = this.db.hour.open(search);
            break;
            case 'channel': //must provide data.searchId
                let channel
                let citem = this.db.channel.load(data.id);
                if (citem.state === 'absent') {
                    channel = this.db.channel.create(data);
                } else {
                    citem.search = data.search;
                    channel = this.db.channel.create(citem);
                    channel.setItem(citem);
                }
                socket.data.showing = [channel.item.id];
                data.info = this.db.channel.open(channel);
            break;
            case 'video':
                let video;
                let vitem = this.db.video.load(data.id);
                if (vitem.state === 'absent') {
                    video = this.db.video.create(data);
                } else {
                    video = this.db.video.create(vitem);
                    video.setItem(vitem);
                }
                socket.data.showing = [video.item.id];
                data.info = this.db.video.open(video,video.item);
            break;
            default: break;
        }
        if (data.cb) this.emit(socket,'open',data);
    }

    // receive a remote video info request (logged in)
    async takeup(res,data) {
        let video;
        let vitem = this.db.video.load(data.id);
        if (vitem.state === 'absent') {
            video = this.db.video.create(data);
        } else {
            video = this.db.video.create(vitem);
            video.setItem(vitem);
        }
        data.info = this.db.video.open(video,video.item);
        await this.db.video.info(video);
        res.json({item:video.item});
    }

    // send remote video info request (not logged in)
    fallback(data) {
        const options = {
            url: this.cfg.engine.fallback,
            headers: {'content-type' : 'application/json'},
            json: true,
            body: data
        };
        request.post(options, (err, res, body) => {
            if (err) {
                console.log(err);
            } else {
                console.log('fallback on '+data.id);
                let video = this.db.video.create(body.item);
                if (video.item.id === data.id) this.update(this.db.video,video.item);
            }
        });
    }

    // cancel a download
    cancel(data) {
        if (!this.cancelled.includes(data.id)) this.cancelled.push(data.id);
    }

    // return list of topics
    async topicmenu(data, socket) {
        data.list = await this.asyncQuery(this.db.topic.menus);
        data.list.unshift({
            id:'all',
            name:'all'
        });
        this.emit(socket,'topicmenu',data);
    }

    // return list of searches, given the topic
    async searchmenu(data, socket) {
        data.topic = data.topic === 'all' ? 0 : parseInt(data.topic);
        data.list = await this.asyncQuery(this.db.hour.menus, data);
        data.list.unshift({
            id:'any',
            name:'any'
        });
        this.emit(socket, 'searchmenu', data);
    }

    // return list of channels, given the search
    async channelmenu(data, socket) {
        data.search = data.search === 'any' ? 0 : parseInt(data.search);
        let query =
        data.list = await this.asyncQuery(this.db.channel.menus, data);
        data.list.unshift({
            id:'any',
            author:'any'
        });
        this.emit(socket, 'channelmenu', data);
    }

    // populate a list of items from the result cache.
    async populate(data) {
        try {
            if (this.result.length) {
                if (this.result[0].channel !== undefined) {
                    if (data.dcb.length) this.result = this.result.filter((e) => {
                        return !((data.dcb.includes(e.id)) || (data.dcb.includes(e.channel)));
                    });
                } else {
                    if (data.dcb.length) this.result = this.result.filter((e) => {
                        return !data.dcb.includes(e.id);
                    });
                }
            }
            data.filtered = this.result.length;
            data.total = data.filtered + this.unfiltered;
            let maxpage = Math.floor((data.filtered-1)/data.limit);
            if (data.page>maxpage) data.page = Math.max(0,maxpage);
            data.list = this.result.slice(data.limit*data.page,data.limit*data.page+data.limit);
            if (data.type === 'video') {
                let ids = "";
                let join = "'";
                let map = {}
                data.list.forEach((e,i,a) => {
                    if (e.id.length === 24) {
                        if (e.data) e = this.db.channel.clean(e);
                    } else {
                        map[e.id] = i;
                        ids += join + e.id;
                        join = "','";
                        //a[i] = this.db.video.load(e.id);
                    }
                });
                if (ids.length) {
                    ids += "'";
                    let query =  `
                        ${this.db.video.fetchs}
                        WHERE video.id IN (${ids});
                    `;
                    let subresult = await this.asyncQuery(query);
                    subresult.forEach(e => {
                        data.list[map[e.id]] = this.db.video.clean(e);
                    });
                }
            } else {
                data.list.forEach((e) => {
                    if (e.data) e = this.db[data.type].clean(e);
                });
            }
        } catch(e) {
            console.log(e);
        }
    }

    // return a list of items, create cache on update
    async list(data, socket) {
        try {
            if ((!data.update) && (this.result.length)) {
                await this.populate(data);
            } else {
                this.result = [];
                this.unfiltered = data.total = data.filtered = 0;
                this.result = await this.db[data.type].list(data);
                if (data.type === 'topic') {
                    let all = this.db.topic.create({name: 'all'});
                    this.result.forEach( (e, i, a) => {
                        all.newVideos += e.newVideos;
                        all.videoCount += e.videoCount;
                        all.searchCount += e.searchCount;
                        all.channelCount += e.channelCount;
                        if (e.latest>all.latest) all.latest = e.latest;
                    });
                    this.result.unshift(all);
                } else if (data.type === 'video' && data.chanMode) {
                    let chanItem = this.db.channel.fetch.get(data.cid);
                    this.result.unshift(chanItem);
                }
                await this.populate(data);
            }
            data.cb = 'itemList';
            this.emit(socket,'itemlist',data);
        } catch(e) {
           console.log(e);
        }
    }

    // delete item(s)
    delete(data) {
        data.info = this.db[data.type].delete(data);
    }

    // discard videos of a channel
    discardchanvids(data) {
        data.info = this.db.video.discardChan.run(data);
    }

    // send all of a channels video to the inbox queue
    queuechanvids(data) {
        data.info = this.db.video.queueChan.run(data);
    }

    // save configuration changes
    setcfg(data) {
        this.db.cfg = this.cfg = data.cfg;
    }

    // refresh an item
    async refresh(data) {
        try {
            let x = this.db[data.type].load(data.id);
            if (x.state === 'discarded') x.state = 'update';
            switch (data.type) {
                case 'video':
                    let video = this.db.video.create(x);
                    video.setItem(x);
                    await this.db.video.update(video,true);
                break;
                case 'channel':
                    let channel = this.db.channel.create(x);
                    channel.setItem(x);
                    await this.db.channel.profile(channel);
                    await this.db.channel.update(channel);
                break;
                default:
                    let search = this.db.hour.create(x);
                    search.setItem(x);
                    await this.db.hour.update(search);
                    await this.db.day.update(search);
                break;
            }
        } catch(e) {
            console.log(e);
        }
    }

    // backfill channel data
    async backfill(data) {
        try {
            let x = this.db.channel.load(data.cid);
            let channel = this.db.channel.create(x);
            channel.setItem(x);
            await this.db.channel.backfill(channel, data.days);
            data.count = channel.videos.length;
            this.emitShown('backfilled', data.cid, data);
        } catch(e) {
            console.log(e);
        }
    }

    // set channel level
    level(data) {
        data.cids.forEach(cid => {
            if (data.level === this.cfg.advanced.blockLevel) {
                this.db.channel.block(cid);
            } else {
                data.type = 'channel';
                data.item = this.db.channel.load(cid);
                data.item.level = data.level;
                //console.log(data);
                this.set(data);
            }
        });
    }

    // save item changes to db
    set(data) {
        if (data.type === 'topic' && data.item.id === 0) {
            this.cfg.engine.minDur = data.item.meta.minDur;
            this.cfg.engine.maxDur = data.item.meta.maxDur;
            this.cfg.engine.categories = data.item.meta.allowCategory;
            this.cfg.engine.banText = data.item.meta.disallowText;
            this.cfg.engine.updates = data.item.status;
            data.info = this.db.cfg = this.cfg;
        } else {
            let f = this.result.findIndex(e=>{return e.id === data.item.id;});
            if (f>0) {
                this.result[f] = data.item;
            }
            data.item.data = this.db.encode(data.item.meta);
            data.info = this.db[data.type].set.run(data.item);
            delete data.item.data;
        }
    }

    // client download request
    async download(data) {
        let video = this.db.video.create(data.item);
        video.setItem(data.item);
        await video.fetchItem();
        this.bandwidth.video += video.transferred;
        this.dl(video);
    }

    // client export request
    export(data) {
        video = this.db.video.create(data.item);
        this.exportVideo(video);
    }

    // delete downloaded video (if exists) update state to discard
    delvid(data) {
        let video = this.db.video.create(data.item);
        fs.unlink(video.item.meta.fn, (err) => {
            if (!err) {
                video.item.state = 'discarded';
                this.update(this.db.video,video.item);
            }
        });
    }

    // client requests reload of configuration file ytzero.yaml
    reload(data) {
        this.db.verify();
        data.cfg = this.cfg;
        this.emitAll('reload', data);
    }

    // client stops server
    stop(data) {
        this.svr.close(err => {
            this.closing = true;
        });
    }

    // client updates shown items.
    shown(data, socket) {
        socket.data.showing = data;
    }

    // client disconnects - engine continues, active sockets updated
    async disconnect() {
        console.log('client disconnected');
        this.sockets = await this.svr.io.fetchSockets();
    }

}

module.exports = Engine;