// ytzero - data collection, maintenance and management
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const ut = require('../client/js/ut.js')();
const fs = require('fs');
const yaml = require('yaml');
const dx = require('deep-extend');
const SQL = require('better-sqlite3');
const ZLib = require('zlib');
const ItemDM = require('./itemdm');
const TopicDM = require('./topicdm');
const SearchDM = require('./searchdm');
const HourDM = require('./hourdm');
const DayDM = require('./daydm');
const ChannelDM = require('./channeldm');
const VideoDM = require('./videodm');

class Database {

    // database constructor
    constructor(engine) {
        this.engine = engine
        // start sql db
        this.sql = new SQL(engine.dbPath);
        // zip library
        this.zlib = ZLib;
        // create db if needed
        if (!this.exists) this.create();
        // build application configuration settings
        const test = this.cfg;
        (test === undefined) ? this.init(this.default) : this.cfg = test;
        this.verify();
        // sql settings
        this.sql.pragma('journal_mode = WAL');
        this.sql.pragma('synchronous = normal');
        this.sql.pragma('temp_store = memory');
        this.sql.pragma('mmap_size = 30000000000');
        if (this.cfg.advanced.memoryMode === 'ON') {
            let mem = this.sql.serialize();
            this.sql.close();
            this.sql = new SQL(mem);
            setTimeout(this.backup.bind(this),ut.minutes(this.cfg.memoryBackupMinutes),true);
        }
        // install custom sql functions
        this.sql.function('now', ut.now);
        this.sql.function('seconds', ut.seconds.bind(ut));
        this.sql.function('minutes', ut.minutes.bind(ut));
        this.sql.function('hours', ut.hours.bind(ut));
        this.sql.function('days', ut.days.bind(ut));
        this.sql.function('adaptive', this.adaptive.bind(this));
        this.sql.function('sqrt', Math.sqrt);
        this.sql.function('floor', Math.floor);
        this.sql.function('meta', this.meta.bind(this));
        this.sql.function('texthas', this.texthas.bind(this));
    }

    // backup data if in memory mode
    backup(cycle) {
        console.log('database backup commenced')
        let p = this.engine.dbPath;
        this.sql.backup(`${p}.bak`).then( () => {
            fs.unlinkSync(`${p}.old`);
            fs.renameSync(p,`${p}.old`);
            fs.renameSync(`${p}.bak`,p);
            console.log('database backup complete');
            if (cycle) {
                setTimeout(this.backup.bind(this), ut.minutes(this.cfg.memoryBackupMinutes), true);
            } else { // terminated
                process.exit(0);
            }
        }).catch( (err) => {
            console.log('database backup failed');
            if (cycle) {
                setTimeout(this.backup.bind(this), ut.minutes(this.cfg.memoryBackupMinutes), true);
            } else { // terminated
                process.exit(0);
            }
        });
    }

    // initiate data management modules
    initDM() {
        this.topic = this.search = this.hour = this.day = this.channel =
            this.video = new ItemDM(this.engine);
        this.topic = new TopicDM(this.engine);
        this.search = new SearchDM(this.engine);
        this.hour = new HourDM(this.engine);
        this.day = new DayDM(this.engine);
        this.channel = new ChannelDM(this.engine);
        this.video = new VideoDM(this.engine);
    }

    // default configuration
    get default() {
        let cfg = {
            engine: {
                site: 'http://127.0.0.1',
                port: 3164,
                cookie: '',
                agent: '',
                proxy: '',
                proxifyAll: "OFF",
                fallback: '',
                updates: 'ON',
                categories: [
                    'Film & Animation',
                    'Autos & Vehicles',
                    'Music',
                    'Pets & Animals',
                    'Sports',
                    'Travel & Events',
                    'Gaming',
                    'People & Blogs',
                    'Comedy',
                    'Entertainment',
                    'News & Politics',
                    'Howto & Style',
                    'Education',
                    'Science & Technology',
                    'Nonprofits & Activism'
                ],
                banText: '',
                minDur: 0,
                maxDur: 0
            },
            advanced: {
                memoryMode: "OFF",
                memoryBackupMinutes: 60,
                maxChannelResults: 900,
                maxSearchResults: 5000,
                publishedLimitDays: 1,
                searchAfterHours: 36,
                blockLevel: 0,
                searchLevel: 1,
                scanLevel: 2,
                updateLevel: 3,
                updateFrequency: 1,
                likeLevel: 4,
                likeFrequency: 2,
                followLevel: 5,
                followFrequency: 4,
                unfilteredLevel: 4,
                videoPath: './client/dl',
                videoContainer: 'any',
                videoQuality: 'highest',
                audioQuality: 'highest',
                mediaBitrate: 'highest',
                videoFilename: '${author}_${datetime}_${title}_${id}_${videoQuality}_${videoCodec}_${audioCodec}',
                videoMetadata: '',
                videoOverwrite: 'no',
                videoSubtitles: 'none',
                videoSubtitleFormat: 'srt',
                upgradeCycleMinutes: 25,
                upgradeLimitHours: 2,
                highQuality: 720,
                maxDescriptionLength: 256,
                mediaLimitMinutes: 30,
                updateLimitHours: 18.7,
                maxSearches: 100,
                hourCycleMinutes: 1,
                dayCycleMinutes: 3,
                channelCycleMinutes: 3,
                maxChannelScans: 10000,
                maxChannelDelete: 10000,
                maxVideoScans: 10000,
                maxVideoDelete: 10000,
                profileCycle: 6,
                videoCycleMinutes: 5,
                updateCycleMinutes: 325,
                autoDownloadMinutes: 25,
                popularityHours: 1,
                cycleStaggerLength: 0.9,
                cycleWaitLength: 0.5,
                videoPurgeDays: 2,
                searchPurgeDays: 5,
                scanPurgeDays: 5,
                updatePurgeDays: 5,
                likePurgeDays: 15,
                followPurgeDays: 45,
                discoveryDiscardDays: 1,
                channelFrequencyMultiplier: 1,
                minAdaptiveMinutes: 10,
                band1ElapsedHours: 1,
                band1AdaptiveMinutes: 15,
                band2ElapsedHours: 3,
                band2AdaptiveMinutes: 30,
                band3ElapsedHours: 6,
                band3AdaptiveMinutes: 45,
                band4ElapsedHours: 12,
                band4AdaptiveMinutes: 60,
                band5ElapsedHours: 24,
                band5AdaptiveMinutes: 120,
                band6ElapsedHours: 48,
                band6AdaptiveMinutes: 180,
                band7ElapsedHours: 120,
                band7AdaptiveMinutes: 360,
                band8ElapsedHours: 240,
                band8AdaptiveMinutes: 720,
                maxAdaptiveMinutes: 1440,
                searchFrequencyMultiplier: 1,
                minElapsedMinutes: 10,
                minSearchMinutes: 3,
                maxElapsedMinutes: 1440,
                maxSearchMinutes: 480,
                searchRatio: 0.3
            },
            item: ItemDM.default,
            topic: TopicDM.default,
            search: HourDM.default,
            channel: ChannelDM.default,
            video: VideoDM.default,
            state: VideoDM.defaultStates,
            client: {
                refreshCycle: 15000,
                bandwidthCycle: 5000,
                maxStatusString: 12,
                channelCodeLength: 24,
                buttonHeight: 16,
                buttonWidth: 16,
                hybridDuration: 60,
                textInputLength: 20,
                displayField: 6,
                sortField: 9,
                textLabel: 7,
                resortField: 3,
                autoField: 3,
                navField: 3,
                navHomeField: 5,
                undoField: 6,
                actionField: 4,
                actionOptionField: 8,
                scaleDownField: 4,
                scaleUpField: 4,
                previewField: 10,
                scaleFactor: 1.05,
                blockCode1: 'KeyB',
                blockCode2: 'NumpadSubtract',
                blockCode3: 'Minus',
                searchCode1: 'KeyS',
                searchCode2: 'NumpadDecimal',
                searchCode3: 'Period',
                scanCode1: 'KeyC',
                scanCode2: 'NumpadDivide',
                scanCode3: 'Slash',
                updateCode1: 'KeyU',
                updateCode2: 'NumpadEnter',
                updateCode3: 'Enter',
                likeCode1: 'keyL',
                likeCode2: 'NumpadAdd',
                likeCode3: 'Equal',
                followCode1: 'KeyF',
                followCode2: 'NumpadMultiply',
                followCode3: 'Digit8',
                displayOptions: [
                    0,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    9,
                    10,
                    12,
                    15,
                    18,
                    20,
                    24,
                    30,
                    35,
                    40,
                    60,
                    90,
                    120,
                    180,
                    240,
                    300,
                    600,
                    1000,
                    5000,
                ]
            }
        };
        return cfg;
    }

    // zip object metadata to buffer
    encode(obj) {
        return this.zlib.gzipSync(Buffer.from(ut.js(obj)),{level: this.zlib.constants.Z_BEST_SPEED});
    }

    // unzip buffer to object metadata
    decode(zip) {
        try {
            return ut.jp(this.zlib.gunzipSync(zip).toString('utf8'));
        } catch(e) {
            console.log(e);
            return {};
        }
    }

    // save configuration from db
    set cfg(value) {
        this.sql.prepare('UPDATE config SET data = ? WHERE name = ?').run(this.encode(value),'default');
    }

    // retrieve configuration from db
    get cfg() {
        let result = this.sql.prepare('SELECT data FROM config WHERE name = ?').get('default');
        if (result !== undefined) return this.decode(result.data);
        return result;
    }

    // retrieve user configuration from ytzero.yaml
    get loadYAML() {
        if (!fs.existsSync('./ytzero.yaml')) fs.writeFileSync('ytzero.yaml',yaml.stringify(this.cfg),'utf8');
        return yaml.parse(fs.readFileSync('./ytzero.yaml','utf8'));
    }

    // determine whether the database exists
    get exists() {
        let result;
        try {
            result = this.sql.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get('config');
        } catch(e) { }
        return (result !== undefined);
    }

    // build the configuration file, blank -> default -> saved -> user
    verify() {
        try {
        let yaml = this.loadYAML;
        let dbc = this.cfg;
        let def = this.default;
        let temp = dx({},def,dbc,yaml);
        for (let i = 0; i< temp.state.length; i++) {
            temp.state[i] = dx({},def.state[i],dbc.state[i],yaml.state[i]);
        }
        this.cfg = this.engine.cfg = temp;
        fs.writeFileSync('./ytzero.json',ut.jsp(this.cfg),'utf8');
        } catch(e) {
            console.log('Error reading ytzero.yaml - fix and try again.');
            console.log(e);
            process.exit();
        }
    }

    // create the sql database
    create() {
        let create = `
            CREATE TABLE "config" (
                "id" INTEGER NOT NULL,
                "name" VARCHAR(16) NOT NULL DEFAULT "default",
                "data" TEXT NOT NULL DEFAULT "{}",
                PRIMARY KEY ("id")
            );

            ${TopicDM.table}

            ${HourDM.table}

            ${ChannelDM.table}

            ${VideoDM.table}
        `;
        this.sql.exec(create);
    }

    // creates yaml file and copies default configuarion to db if they do not exist.
    init(cfg) {
        if (!fs.existsSync('./ytzero.yaml')) fs.writeFileSync('ytzero.yaml',yaml.stringify(cfg),'utf8');
        return this.sql.prepare('INSERT into config (name,data) VALUES (?,?);').run('default',this.encode(cfg));
    }

    // sql function to access metadata field values
    meta(data,field) {
        let json = this.zlib.gunzipSync(data).toString('utf8');
        let m = JSON.parse(json);
        if (m === null) return '';
        if (m[field] === undefined) return '';
        return m[field];
    }

    // sql function to access text fields
    texthas(name, data, sub) {
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
        let json = this.decode(data);
        if (json.author && (obj ==='*' || obj === 'author') && json.author.toLowerCase().includes(txt)) return 1;
        if (json.title && (obj === '*' || obj === 'title') && json.title.toLowerCase().includes(txt)) return 1;
        if (json.country && (obj === '*' || obj === 'country') && json.country.toLowerCase().includes(txt)) return 1;
        if (json.description && (obj ==='*' || obj === 'description') && json.country.toLowerCase().includes(txt)) return 1;
        if (json.category && (obj === '*' || obj === 'category') && json.category.toLowerCase().includes(txt)) return 1;
        if (json.keywords && (obj === '*' || obj === 'keywords') && json.keywords.join(',').toLowerCase().includes(txt)) return 1;
        if (json.tags && (obj === '*' || obj === 'tags') && json.tags.join(',').toLowerCase().includes(txt)) return 1;
        return 0;
    }

    // sql function used to adaptively time updates based on type, last published, channel level
    adaptive(type, last, level) {
        let elapsed = Date.now() - last;
        let c = this.engine.cfg.advanced;
        let a = 1;
        if (type === 'channel') {
            a = c.channelFrequencyMultiplier;
            let freq = level === c.followLevel ? c.followFrequency * a :
                level === c.likeLevel ? c.likeFrequency * a :
                level === c.updateLevel ? c.updateFrequency * a : 0;
            if (!freq) return ut.minutes(c.maxAdaptiveMinutes) / a;
            if (!last) return ut.minutes(c.minAdaptiveMinutes) / a;
            for (let i = 0; i <= 8; i++) {
                if (elapsed < ut.hours(c[`band${i}ElapsedHours`])) {
                    return ut.minutes(c[`band${i}AdaptiveMinutes`]) / freq;
                }
            }
            return ut.minutes(c.maxAdaptiveMinutes) / freq;
        } else { //search
            a = c.searchFrequencyMultiplier;
            if (!last) return ut.minutes(c.minSearchMinutes) / a;
            if (elapsed < ut.minutes(c.minElapsedMinutes)) {
                return ut.minutes(c.minSearchMinutes) / a;
            }
            if (elapsed < ut.minutes(c.maxElapsedMinutes)) {
                return elapsed * c.searchRatio / a;
            }
            return ut.minutes(c.maxSearchMinutes) / a;
        }
    }

    // video purge maintenance process
    autoVideoPurge () {
        let info = this.video.purge.run(
            ut.now() - ut.days(this.engine.cfg.advanced.videoPurgeDays)
        );
        console.log(`videos purged: ${info.changes}`);
        setTimeout(this.autoVideoPurge.bind(this), this.video.cycle);
    }

    // channel purge maintenance process
    autoChannelPurge () {
        let info = this.channel.purge.run(
            ut.now() - ut.days(this.engine.cfg.advanced.searchPurgeDays),
            ut.now() - ut.days(this.engine.cfg.advanced.scanPurgeDays),
            ut.now() - ut.days(this.engine.cfg.advanced.updatePurgeDays),
            ut.now() - ut.days(this.engine.cfg.advanced.likePurgeDays),
            ut.now() - ut.days(this.engine.cfg.advanced.followPurgeDays));
        console.log(`channels purged: ${info.changes}`);
        setTimeout(this.autoChannelPurge.bind(this), this.channel.cycle);
    }

    // video discard maintenance process
    autoDiscard() {
        let info = this.video.discard.run(
            ut.now() - ut.days(this.engine.cfg.advanced.discoveryDiscardDays));
        console.log(`videos discarded: ${info.changes}`);
        setTimeout(this.autoDiscard.bind(this), this.video.cycle);
    }

    // export download maintenance process
    autoExport() {
        let list = this.video.export.all(
            ut.now() - ut.days(this.engine.cfg.advanced.autoExportDays)
        );
        list.forEach( v => {
            v.meta = this.decode(v.data);
            delete v.data;
            this.engine.exportVideo(v);
        });
        console.log(`videos exported: ${list.length}`);
        setTimeout(this.autoExport.bind(this),this.video.cycle);
    }

    // Start data collection and maintenance processes
    go() {
        this.autoDiscard();
        setTimeout(this.autoExport.bind(this),this.video.cycle/3);
        setTimeout(this.autoChannelPurge.bind(this),this.channel.cycle/2);
        setTimeout(this.autoVideoPurge.bind(this),2*this.video.cycle/3);
        this.hour.run();
        this.day.run();
        this.channel.run();
        this.video.run();
    }

}

module.exports = Database;