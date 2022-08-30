// ytzero - data management of videos
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const Video = require('./video');
const ut = require('../client/js/ut')();
const ItemDM = require('./itemdm');
const vm = require('vm2');

class VideoDM extends ItemDM {

	// video data manager constructor
	constructor(engine) {
		super(engine,engine.cfg.advanced.videoCycleMinutes);
		this.type = 'video';
		// get list of videos ready for updating
		this.upd = this.sql.prepare(`
			SELECT video.id
			FROM video
			LEFT JOIN channel ON video.channel = channel.id
			LEFT JOIN search ON channel.search = search.id
			LEFT JOIN topic ON search.topic = topic.id
			WHERE
			(
				? = 'ON'
				AND
				topic.status = 'ON'
				AND
				(
					video.state IN ('result','preview')
					OR
					(
						video.state = 'upgrade'
						AND
						(
							now() > ( video.updated + ${ut.minutes(engine.cfg.advanced.upgradeCycleMinutes)})
						)
					)
					OR
					(
						video.state IN ('update','queue')
						AND
						(
							now() > ( video.updated + ${ut.minutes(engine.cfg.advanced.updateCycleMinutes)})
						)
					)
					OR
					(
						video.state IN ('result','preview','upgrade','update','noupdate','queue')
						AND
						video.status IN ('VOL','VDL','VRM','VIP','VAR')
					)
				)
			)
			OR
			(
				video.state = 'download'
			)
			ORDER BY channel.level DESC, video.updated ASC
			LIMIT ${engine.cfg.advanced.maxVideoScans};
		`);
		// add a new video
		this.add = this.sql.prepare(`
			INSERT OR IGNORE into video
			(id, channel, duration, expiry,
			views, reviewed, updated, published,
			discovered, downloaded, state, status, data)
			VALUES
			(:id, :channel, :duration, :expiry,
			:views, :reviewed, :updated, :published,
			:discovered, :downloaded, :state, :status, :data);
		`);
		// save video
		this.set = this.sql.prepare(`
			UPDATE video
			SET (downloaded, state, status, data)
			= (:downloaded, :state, :status, :data)
			WHERE id = :id;
		`);
		// fetch video data
		this.fetchs = `
			SELECT video.*,
			channel.views AS 'cviews',
			channel.subscribers AS 'csubs',
			channel.joined AS 'cjoined',
			channel.latest AS 'clatest',
			channel.updated AS 'cupdated',
			channel.level AS 'clevel',
			channel.status AS 'cstatus',
			channel.data AS 'cdata',
			search.id AS 'search',
			search.name AS 'searchName',
			topic.name AS 'topicName',
			topic.id AS 'topic',
			topic.status AS 'updating',
			topic.data AS 'fdata',
			video.views/( ( now() - video.published ) /
			${ut.hours(engine.cfg.advanced.popularityHours)} ) AS 'popularity',
			video.updated + ( video.expiry * 1000 ) AS 'expires'
			FROM video
			LEFT JOIN channel ON video.channel = channel.id
			LEFT JOIN search ON channel.search = search.id
			LEFT JOIN topic ON search.topic = topic.id
		`;
		this.fetch = this.sql.prepare(`
			${this.fetchs}
			WHERE video.id = ?;
		`);
		// update reviewed timestamp
		this.review = this.sql.prepare(`
			UPDATE video
			SET (reviewed, views)
			= (:reviewed, :views)
			WHERE id = :id
		`);
		// save data after succesful update
		this.success = this.sql.prepare(`
			UPDATE video
			SET (channel, duration, expiry, views,
			reviewed, updated, published, downloaded,
			state, status, data)
			= (:channel, :duration, :expiry, :views,
			:reviewed, :updated, :published, :downloaded,
			:state, :status, :data)
			WHERE id = :id;
		`);
		// set the status of a channel's videos
		this.chanstatus = this.sql.prepare(`
			UPDATE video
			SET status = ?
			WHERE state IN ('result','preview','upgrade','update','noupdate','offline','queue')
			AND channel = ?
		`);
		// purge discarded videos ( after published )
		this.purge = this.sql.prepare(`
			DELETE FROM video
			WHERE state = 'discarded'
			AND (published < ?)
			ORDER BY discovered ASC
			LIMIT ${engine.cfg.advanced.maxVideoDelete}
		`);
		// discard videos ( after discovered )
		this.discard = this.sql.prepare(`
			UPDATE video
			SET state = 'discarded'
			WHERE state IN ('result','preview','upgrade','update','noupdate','offline')
			AND (discovered < ?)
		`);
		// export videos ( after downloaded )
		this.export = this.sql.prepare(`
			SELECT *
			FROM video
			WHERE state = 'downloaded'
			AND (downloaded < ?)
		`);
		// discard all videos of a channel
		this.discardChan = this.sql.prepare(`
			UPDATE video
			SET state = 'discarded'
			WHERE channel = :cid
			AND state in ('result','preview','upgrade','update','noupdate','offline')
		`);
		// queue all videos of a channel
		this.queueChan = this.sql.prepare(`
			UPDATE video
			SET state = 'queue'
			WHERE channel = :cid
			AND state in ('result','preview','upgrade','update','noupdate','offline')
		`);
		this.context = new vm.VM();
		this.initAuto();
	}

	// initilize dynamic functions for video auto states
	initAuto() {
		this.autoFunctions = [];
		for (const action of this.engine.cfg.video.autoAction) {
			let script = new vm.VMScript(`
				(
					function(video) {
						return ${action.condition};
					}
				)`).compile();
			let auto = {
				fn : this.context.run(script),
				state : action.state
			};
			this.autoFunctions.push(auto);
		}
	}

	// mark channel's videos offline if not found in channel list
	offline(cid,ids) {
		return this.sql.prepare(`
			UPDATE video
			SET status = 'VOL'
			WHERE channel = '${cid}'
			AND state IN ('result','preview','upgrade','update','noupdate','offline','queue')
			AND status = 'OK'
			AND published > (now() - ${ut.days(this.engine.cfg.advanced.publishedLimitDays)})
			AND id NOT IN ('${ids.join(`','`)}')
		`).run();
	}

	// create list of videos for client on worker thread
	async list(data) {
		try {
			data.topic = data.topic === 'all' ? 0 : parseInt(data.topic);
			data.search = data.search === 'any' ? 0 : parseInt(data.search);
			data.channel = data.channel === 'any' ? '' : data.channel;
			let vs = (data.vstates.length) ? `AND video.state IN ('`+data.vstates.join(`','`)+`')`: ``;
			let fc = (data.filter.clause.length) ? 'AND ( '+data.filter.clause+' )' : '';
			let hc = (data.filter.having.length) ? 'HAVING ( '+data.filter.having+' )' : '';
			let st = (data.topic) ? `AND search.topic = ${data.topic}`: '';
			let cs = (data.search) ? `AND channel.search = ${data.search}`: '';
			let vc = (data.channel && data.channel.length) ? `AND video.channel = '${data.channel}'` : '';
			if (hc) hc = 'GROUP BY video.id '+hc;
			let wh = `${st} ${cs} ${vc} ${vs} ${fc}`.replace('AND','WHERE');
			let query = `
				SELECT video.id,
					video.channel,
					video.views/
					((now()-video.published)/
					${ut.hours(this.engine.cfg.advanced.popularityHours)}) AS 'popularity',
					video.updated + ( video.expiry * 1000 ) AS 'expires'
				FROM video
				LEFT JOIN channel ON channel.id = video.channel
				LEFT JOIN search ON channel.search = search.id
				${wh}
				${hc}
				ORDER BY ${data.sort}
			`;
			return await this.engine.asyncQuery(query);
		} catch(e) {
			console.log(e);
			return [];
		}
	}

	// discard videos
	delete(data) {
		let ids = "('"+data.ids.join("','")+"');";
		return this.sql.prepare(`
			UPDATE video
			SET state = 'discarded'
			WHERE id IN `+ids
		).run();
	}

	// test video auto action conditions & corresponding channel auto action conditions
	auto(video, channel = {}) {
		for (const action of this.autoFunctions) {
			if (action.fn(video.item) && video.item.state !== action.state) {
				video.item.state = action.state;
				this.engine.update(this, video.item);
			}
		};
		if (!channel || !channel.item) {
			let citem = this.engine.db.channel.load(video.item.channel)
			channel = this.engine.db.channel.create(citem);
			channel.setItem(citem);
		}
		this.engine.db.channel.auto(channel, video);
	}

	// create or load a video
	open(video, review, channel = {}) {
		let info = this.new(video.item);
		video.setItem(this.load(video.item.id));
		if (!info.changes) {
			if (review !== undefined && review.views >= video.item.views) {
				this.review.run(review);
				video.item.reviewed = review.reviewed;
				video.item.views = review.views;
				this.auto(video, channel);
				this.engine.update(this,video.item);
			}
		} else {
			this.todo++;
			this.update(video,false,channel);
		}
		return info;
	}

	// video information request
	async info(video, channel) {
		await video.fetchItem();
		this.auto(video, channel);
		this.engine.bandwidth.video += video.transferred;
	}

	// whether video streams have expired
	expired(video) {
		let exp = video.item.expiry * 1000 + video.item.updated - ut.now();
		return (exp <= 0);
	}

	// whether video should be downloaded now
	downloadNow(video) {
		let exp = video.item.expiry * 1000 + video.item.updated - ut.now();
		return (
			video.item.state === 'download'
			&&
			exp > 0
			&&
			exp < ut.minutes(this.engine.cfg.advanced.autoDownloadMinutes)
		);
	}

	// whether the video information should be updated now
	updateNow(video) {
		let hq = (
			video.item.meta.videoStreams.length
			&&
			parseInt(video.item.meta.videoStreams[0].quality) >= this.engine.cfg.advanced.highQuality
		);
		return (
			video.item.status === 'VOL'
			||
			['result','preview'].includes(video.item.state)
			||
			(
				video.item.state === 'upgrade'
				&&
				ut.now() > (video.item.updated + ut.minutes(this.engine.cfg.advanced.upgradeCycleMinutes))
			)
			||
			(
				video.item.state === 'queue'
				&&
				ut.now() > (video.item.updated + ut.minutes(this.engine.cfg.advanced.upgradeCycleMinutes))
				&&
				ut.now() < (video.item.published + ut.hours(this.engine.cfg.advanced.upgradeLimitHours))
				&&
				!hq
			)
			||
			(
				['update','queue'].includes(video.item.state)
				&&
				(ut.now() - video.updated) > ut.minutes(this.engine.cfg.advanced.updateCycleMinutes)
			)
		);
	}

	// process video update request
	async update(video, refresh = false, channel = {}) {
		try {
			if (video.item.updating === 'ON' && this.engine.cfg.engine.updates === 'ON') {
				if (refresh) {
					await this.info(video, channel);
					if (this.downloadNow(video)) this.engine.dl(video);
					this.engine.update(this,video.item);
					this.check();
				} else {
					switch (video.item.state) {
						case 'result':
						case 'preview':
							await this.info(video, channel);
							if (this.downloadNow(video)) this.engine.dl(video);
						break;
						case 'upgrade':
						case 'update':
						case 'queue':
						case 'noupdate':
							if (this.updateNow(video)) {
								await this.info(video, channel);
							} else {
								this.auto(video, channel);
							}
							if (this.downloadNow(video)) this.engine.dl(video);
						break;
						case 'download':
							if (!video.item.expiry) {
								await this.info(video, channel);
								if (this.downloadNow(video)) {
									this.engine.dl(video);
								} else if (this.expired(video)) {
									video.item.state = 'queue';
								}
							} else {
								if (this.downloadNow(video)) {
									this.engine.dl(video);
								} else if (this.expired(video) && video.item.status === 'OK') {
									await this.info(video, channel);
									if (this.downloadNow(video)) {
										this.engine.dl(video);
									} else if (this.expired(video)) {
										video.item.state = 'queue';
									}
								} else if (this.expired(video)) {
									video.item.state = 'queue';
								}
							}
						break;
						default: break;
					}
					if (
						['VDL','VRM','VIP','VAR'].includes(video.item.status)
						&&
						['result','preview','upgrade','update','noupdate'].includes(video.item.state)
					) video.item.state = 'offline';
					this.engine.update(this, video.item);
				}
			}
			this.check();
		} catch(e) {
			console.log(e);
		}
	}

	//  create a video object
	create (video) {
		return Video(
			video.channel,
			video.id,
			video.published,
			video.state,
			this.engine,
			this.engine.session
		);
	}

	// video table creation sql
	static get table() {
		return `CREATE TABLE "video" (
			"id" VARCHAR(11) NOT NULL DEFAULT '',
			"channel" VARCHAR(24) NOT NULL DEFAULT '',
			"duration" INTEGER NOT NULL DEFAULT 0,
			"expiry" INTEGER NOT NULL DEFAULT 0,
			"views" BIGINT NOT NULL DEFAULT 0,
			"rating" REAL NOT NULL DEFAULT 0,
			"reviewed" INTEGER NOT NULL DEFAULT 0,
			"updated" INTEGER NOT NULL DEFAULT 0,
			"published" INTEGER NOT NULL DEFAULT 0,
			"discovered" INTEGER NOT NULL DEFAULT 0,
			"downloaded" INTEGER NOT NULL DEFAULT 0,
			"state" VARCHAR(10) NOT NULL DEFAULT 'result',
			"status" VARCHAR(3) NOT NULL DEFAULT 'new',
			"data" BLOB DEFAULT x'',
			PRIMARY KEY ("id")
		);

		CREATE INDEX idx_video_channel ON "video" ("channel");`;
	}

	// video configuration defaults - use ytzero.yaml to override
	static get default() {
		return {
			old: 86400,
			red: 93,
			green: 93,
			blue: 93,
			nokRed: 191,
			nokGreen: 191,
			nokBlue: 127,
			privateRed: 191,
			privateGreen: 127,
			privateBlue: 191,
			restrictedRed: 127,
			restrictedGreen: 191,
			restrictedBlue: 191,
			removedRed: 191,
			removedGreen: 63,
			removedBlue: 63,
			deletedRed: 191,
			deletedGreen: 127,
			deletedBlue: 127,
			channelRGB: 'rgb(0,0,0)',
			followLevelRGB: 'rgb(63,31,127)',
			terminatedRGB: 'rgb(127,31,63)',
			deletedRGB: 'rgb(191,127,127)',
			minGap: 10,
			maxGap: 200,
			liveGap: 125,
			liveFPS: 2,
			trackDelayMS: 500,
			maxPlayback: 10,
			minPlayback: 2,
			divPlayback: 5,
			maxPlayback: 10,
			minPlayback: 2,
			thumb0Left: -16.667,
			thumb0Top: -38.889,
			thumb0WidthX: 1.333,
			thumb1Left: 0,
			thumb1Top: 12.5,
			thumb1WidthX: 0.75,
			defaultImage: 'hqdefault.jpg',
			imageUrl: 'https://i.ytimg.com/vi',
			watchUrl: 'https://www.youtube.com/watch?v=',
			embedUrl: 'https://www.youtube.com/embed',
			previewMuted: 1,
			previewLoop: 1,
			previewAutoplay: 1,
			previewHeight: 1,
			textHeight: 0.2275,
			statHeight: 0.0700,
			chanHeight: 0.2560,
			metaHeight: 0.0850,
			imageHeight: 0.0625,
			innerFrame: 16,
			embedBorder: 24,
			embedLoop: 1,
			embedMuted: 0,
			embedBoth: 1,
			embedVolume: 0.5,
			embedAutoplay: 1,
			embedControls: 1,
			viewsEyeField: 30,
			viewsValueField: 70,
			viewsField: 30,
			durationField: 35,
			publishedField: 35,
			channelSubsField: 20,
			channelViewsLabel: 15,
			predefinedStates: 6,
			statusHint:	'video status filter',
			statusList: [
				{
					tag: 'any',
					sql: '',
				}
			],
			timeHint: 'video time filter',
			timeList: [
				{
					tag: 'any',
					sql: '',
				}
			],
			viewHint: 'video view filter',
			viewList: [
				{
					tag: 'any',
					sql: '',
				}
			],
			lengthHint: 'video length filter',
			lengthList: [
				{
					tag: 'any',
					sql: '',
				}
			],
			sortList: [
				{
					tag: 'published',
					sql: 'video.published ASC',
				}
			],
			autoAction: [],
		};
	}

	// video states configuration array defaults - use ytzero to override
	static get defaultStates() {
		let s = [
			{
				tag: 'chview',
				videoStates: [
					'result',
					'preview',
					'update',
					'upgrade',
					'noupdate',
					'offline',
					'queue',
					'download..',
					'download',
					'downloaded',
					'discarded'
				],
				sort: 'published',
				dir: 'DESC',
				allActions: [
					'none',
					'refresh',
					'queue',
					'download',
					'export',
					'erase',
					'rotate',
					'discard'
				],
			},
			{
				tag: 'result',
				videoStates: [
					'result',
					'preview',
					'update',
					'upgrade',
					'noupdate',
					'offline',
				],
				sort: 'published',
				dir: 'DESC',
				allActions: [
					'none',
					'block',
					'search',
					'scan',
					'update',
					'like',
					'follow',
					'refresh',
					'queue',
					'download',
					'export',
					'erase',
					'rotate',
					'discard'
				],
			},
			{
				tag: 'entry',
				videoStates: [
					'result',
					'preview',
					'update',
					'upgrade',
					'noupdate',
					'offline',
					'queue',
					'download..',
					'download',
					'downloaded',
					'discarded'
				],
				sort: 'published',
				dir: 'DESC',
				allActions: [
					'none',
					'block',
					'search',
					'scan',
					'update',
					'like',
					'follow',
					'refresh',
					'queue',
					'unqueue',
					'download',
					'export',
					'erase',
					'rotate',
					'discard'
				],
			},
			{
				tag: 'queue',
				videoStates: [
					'queue',
					'download..',
					'download',
				],
				sort: 'published',
				dir: 'DESC',
				allActions: [
					'none',
					'block',
					'search',
					'scan',
					'update',
					'like',
					'follow',
					'refresh',
					'unqueue',
					'download',
					'export',
					'erase',
					'rotate',
					'discard'
				],
			},
			{
				tag: 'pending',
				videoStates: [
					'download..',
					'download',
				],
				sort: 'expiry',
				dir: 'ASC',
				allActions: [
					'none',
					'block',
					'search',
					'scan',
					'update',
					'like',
					'follow',
					'refresh',
					'download',
					'export',
					'erase',
					'rotate',
					'discard'
				],
			},
			{
				tag: 'download',
				videoStates: [
					'downloaded'
				],
				sort: 'downloaded',
				dir: 'DESC',
				allActions: [
					'none',
					'block',
					'search',
					'scan',
					'update',
					'like',
					'follow',
					'export',
					'erase',
					'rotate',
					'discard'
				],
			},
			{},
			{},
			{},
			{},
			{},
			{},
			{},
			{},
			{},
			{},
		];
		for (let i = 0; i<s.length; i++) {
            s[i].display = 0;
            s[i].scale = 1;
            s[i].preview = 'hybrid';
            s[i].timeFilter = 'any';
            s[i].lengthFilter = 'any';
            s[i].viewFilter = 'any';
            s[i].statusFilter = 'any';
            s[i].textFilter = '';
            s[i].allAction = 'none';
		};
		for (let i = VideoDM.default.predefinedStates; i<s.length; i++) {
            s[i].tag = `custom ${i-6}`;
            s[i].videoStates = [
                'result',
                'preview',
                'update',
                'upgrade',
                'noupdate',
				'offline',
            ];
            s[i].sort = 'published';
            s[i].dir = 'DESC';
            s[i].allActions = [
                'none',
                'block',
                'search',
                'scan',
                'update',
                'like',
                'follow',
                'refresh',
                'queue',
                'download',
                'export',
                'erase',
                'rotate',
                'discard'
            ];
        }
		return s;
	}

}

module.exports = VideoDM;