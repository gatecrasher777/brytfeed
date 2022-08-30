// ytzero - data management of channels
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const ItemDM = require('./itemdm');
const ut = require('../client/js/ut')();
const Channel = require('./channel');
const vm = require('vm2');

class ChannelDM extends ItemDM {

	// channel data manager constructor
	constructor(engine) {
		super(engine,engine.cfg.advanced.channelCycleMinutes);
		this.type = 'channel';
		// get list of channels ready for updating
		this.upd = this.sql.prepare(`
			SELECT channel.id
			FROM channel
			LEFT JOIN search ON channel.search = search.id
			LEFT JOIN topic ON search.topic = topic.id
			WHERE ? = 'ON'
			AND topic.status = 'ON'
			AND channel.status IN ('OK','NOK','CNA')
			AND channel.level > ${engine.cfg.advanced.scanLevel}
			AND (now() > (
				channel.updated +
				adaptive('channel', channel.latest, channel.level) -
				${this.cycle} )
			)
			ORDER BY channel.level DESC, ( channel.updated + adaptive('channel', channel.latest, channel.level) ) ASC
			LIMIT ${engine.cfg.advanced.maxChannelScans};
		`);
		// add a new channel
		this.add = this.sql.prepare(`
			INSERT OR IGNORE into channel
			(id, search, views, subscribers, joined, updated, latest, level, status, data)
			VALUES
			(:id, :search, :views, :subscribers, :joined, :updated, :latest, :level, :status, :data);
		`);
		// save channel
		this.set = this.sql.prepare(`
			UPDATE channel
			SET (status, level, data)
			= (:status, :level, :data)
			WHERE id = :id;
		`);
		// set latest video timestamp
		this.latest = this.sql.prepare(`
			UPDATE channel
			SET (latest, status)
			= (:latest, :status)
			WHERE id = :id
		`);
		// fetch channel data
		this.fetchs = `
			SELECT channel.*,
				search.topic,
				topic.name AS 'topicName',
				search.name AS 'searchName',
				topic.status AS 'updating',
				topic.data AS 'fdata',
				SUM(
					CASE
						WHEN video.state IN ('result','preview','upgrade','update','noupdate','offline','queue')
						THEN 1
						ELSE 0
					END
				) AS 'newVideos',
				COUNT(DISTINCT video.id) AS 'videoCount'
			FROM channel
			LEFT JOIN search ON channel.search = search.id
			LEFT JOIN topic ON search.topic = topic.id
			LEFT JOIN video ON channel.id = video.channel
		`;
		this.fetch = this.sql.prepare(`
			${this.fetchs}
			WHERE channel.id = ?;
		`);
		// save data after successful update
		this.success = this.sql.prepare(`
			UPDATE channel
			SET (views,subscribers,joined,updated, latest, level, status, data) =
			(:views,:subscribers,:joined,:updated,:latest,:level, :status,:data)
			WHERE id = :id;
		`);
		// purge inactive channels
		this.purge = this.sql.prepare(`
			DELETE FROM channel
			WHERE latest != 0 AND level != ${engine.cfg.advanced.blockLevel} AND (
				(
					level = ${engine.cfg.advanced.searchLevel}
					AND
					latest < ?
				) OR (
					level = ${engine.cfg.advanced.scanLevel}
					AND
					latest < ?
				) OR (
					level = ${engine.cfg.advanced.updateLevel}
					AND
					latest < ?
					AND
					updated + minutes(${engine.cfg.advanced.maxAdaptiveMinutes}) > now()
				) OR (
					level = ${engine.cfg.advanced.likeLevel}
					AND
					latest < ?
					AND
					updated + minutes(${engine.cfg.advanced.maxAdaptiveMinutes}) > now()
				) OR (
					level = ${engine.cfg.advanced.followLevel}
					AND
					latest < ?
					AND
					updated + minutes(${engine.cfg.advanced.maxAdaptiveMinutes}) > now()
				)
			)
			LIMIT ${engine.cfg.advanced.maxChannelDelete}
		`);
		this.menus = `
			SELECT id, meta(data,'author') AS author
			FROM channel
			WHERE channel.search = :search
			ORDER BY author ASC;
		`;
		this.context = new vm.VM();
		this.initAuto();
	}

	// create auto channel functions
	initAuto() {
		this.autoFunctions = [];
		for (const action of this.engine.cfg.channel.autoAction) {
			let script = new vm.VMScript(`
				(
					function(channel, video) {
						return ${action.condition};
					}
				)`).compile();
			let auto = {
				fn : this.context.run(script),
				level : action.level,
			};
			this.autoFunctions.push(auto);
		}
	}

	// create list of channels for client on worker thread
	async list(data) {
		try {
			data.topic = data.topic === 'all' ? 0 : parseInt(data.topic);
			data.search = data.search === 'any' ? 0 : parseInt(data.search);
			let vs = (data.vstates.length) ? `AND video.state IN ('`+data.vstates.join(`','`)+`')`: ``;
			let fc = (data.filter.clause.length) ? 'AND ( '+data.filter.clause+' )' : '';
			let hc = (data.filter.having.length) ? 'HAVING ( '+data.filter.having+' )' : '';
			let st = (data.topic) ? `AND search.topic = ${data.topic}`: '';
			let cs = (data.search) ? `AND channel.search = ${data.search}`: '';
			let wh = `${st} ${cs} ${vs} ${fc}`.replace('AND','WHERE');
			let query = `
				${this.fetchs}
				${wh}
				GROUP BY channel.id
				${hc}
				ORDER BY ${data.sort}
			`;
			return await this.engine.asyncQuery(query);
		} catch(e) {
			console.log(e);
			return [];
		}
	}

    // delete channels and associated videos
	delete(data) {
		let ids = "('"+data.ids.join("','")+"');";
		this.sql.prepare(`
			DELETE FROM video
			WHERE channel IN `+ids
		).run();
		return this.prepare(`
			DELETE FROM channel
			WHERE id in `+ids
		).run();
	}

	block(cid) {
        let result = this.sql.prepare(`
			UPDATE video
			SET state = 'discarded'
			WHERE channel = ?
        `).run(cid);
        result = this.sql.prepare(`
            UPDATE channel
            SET level = ${this.engine.cfg.advanced.blockLevel}
            WHERE id = ?
        `).run(cid);
	}

    // test auto channel actions
	auto(channel, video) {
		if (channel && channel.item) {
			for (const action of this.autoFunctions) {
				let level = this.engine.cfg.advanced[action.level+'Level'];
				if (video && video.item) {
					if (action.fn(channel.item, video.item) && channel.item.level !== level ) {
						channel.item.level = level;
						this.engine.update(this, channel.item);
					}
				} else {
					if (action.fn(channel.item) && channel.item.level !== level ) {
						channel.item.level = level;
						this.engine.update(this, channel.item);
					}
				}
			}
		}
	}

	// create or load a channel
	open(channel,video) {
		let info;
		try {
			info = this.new(channel.item);
			let item = this.load(channel.item.id);
			if (item.state !== 'absent') channel.setItem(item);
			if (info.changes) { //new
				this.todo++;
				this.update(channel);
			} else {
				if (
					video
					&&
					video.item.published>channel.item.latest
				) this.latest.run({
					id: channel.item.id,
					status: 'OK',
					latest: video.item.published
				});
			}
		} catch(e) {
			console.log(e);
		}
		return info;
	}

	// process video results from update/backfill
	processVideos(channel) {
		this.engine.bandwidth.channel += channel.transferred;
		let ids = [];
		channel.videos.forEach( (video) => {
			if (video.item) {
				ids.push(video.item.id);
				this.engine.db.video.open(video ,{...video.item}, channel);
			}
		});
		this.engine.update(this, channel.item);
		if (channel.item.status === 'OK' && ids.length) {
			this.engine.db.video.offline(channel.item.id,ids);
		} else if (channel.item.status === 'CTM') {
			this.engine.db.video.chanstatus.run('VRM',channel.item.id);
		} else if (channel.item.status === 'CDL') {
			this.engine.db.video.chanstatus.run('VDL',channel.item.id);
		}
	}

    // channel update request
	async update(channel) {
		try {
			if (
				channel.item.updating === 'ON'
				&&
				this.engine.cfg.engine.updates === 'ON'
			) {
				if (
					channel.item.meta.cycle === this.engine.cfg.advanced.profileCycle
					||
					channel.item.level < this.engine.cfg.advanced.updateLevel
				) {
					await this.profile(channel);
				}
				if (channel.item.level >= this.engine.cfg.advanced.scanLevel) {
					channel.search();
					await channel.fetchItem();
					this.processVideos(channel);
				}
			}
			this.check();
		} catch(e) {
			console.log(e);
		}
	}

    // channel profile update request
	async profile(channel) {
		try {
			channel.profile();
			await channel.fetchItem();
			this.auto(channel);
			this.engine.bandwidth.channel += channel.transferred;
			this.engine.update(this,channel.item);
		} catch(e) {
			console.log(e);
		}
	}

	// channel backfill request
	async backfill(channel, days) {
		try {
			channel.search(days);
			await channel.fetchItem(days);
			this.processVideos(channel);
		} catch(e) {
			console.log(e);
		}
	}

	// create a channel object
	create(channel) {
		return Channel(
			channel.search,
			channel.id,
			channel.level,
			channel.latest,
			this.engine,
			this.engine.session
		);
	}

	// channel table creation sql
	static get table() {
		return `CREATE TABLE "channel" (
			"id" VARCHAR(24) NOT NULL DEFAULT '',
			"search" INTEGER NOT NULL DEFAULT 0,
			"views" INTEGER NOT NULL DEFAULT 0,
			"subscribers" INTEGER NOT NULL DEFAULT 0,
			"joined" INTEGER NOT NULL DEFAULT 0,
			"updated" INTEGER NOT NULL DEFAULT 0,
			"latest" INTEGER NOT NULL DEFAULT 0,
			"level" INTEGER NOT NULL DEFAULT 0,
			"status" VARCHAR(3) NOT NULL DEFAULT 'OK',
			"data" BLOB DEFAULT x'',
			PRIMARY KEY ("id")
		);

		CREATE INDEX idx_channel_search ON "channel" ("search");`;
	}

	// default channel configuration - use ytzero.yaml to override
	static get default() {
		return {
			display: 0, //wapp
			sort: 'author', //wapp
			dir: 'ASC', //wapp
			scale: 1, //wapp
			timeFilter: 'any', //wapp
			statusFilter: 'any', //wapp
			viewFilter: 'any', //wapp
			textFilter: '', //wapp
			allActions: [
				'none',
				'refresh',
				'block',
				'search',
				'scan',
				'update',
				'like',
				'follow',
				'discard'
			],
			allAction: 'none',
			old: 259200,
			red: 0,
			green: 127,
			blue: 63,
			statHeight: 0.0700,
			chanHeight: 0.28125,
			optionHeight: 0.1,
			updateHeight: 0.1,
			imageHeight: 0.0625,
			flagPadding: 2,
			thumbGap: 4,
			avatarField: 100,
			lastLabel: 20,
			subsField: 20,
			viewsLabel: 15,
			viewsField: 15,
			url: 'https://www.youtube.com/channel',
			levels: [
				'block',
				'search',
				'scan',
				'update',
				'like',
				'follow'
			],
			backfill: [
				{
					tag: 'none',
					days: 0,
				}
			],
			statusHint: 'channel status filter',
			statusList: [
				{
					tag: 'any',
					sql: '',
				}
			],
			timeHint: 'channel time filter',
			timeList: [
				{
					tag: 'any',
					sql: '',
				}
			],
			viewHint: 'channel view filter',
			viewList: [
				{
					tag: 'any',
					sql: '',
				}
			],
			sortList: [
				{
					tag: 'author',
					sql: "meta(channel.data,'author') ASC"
				}
			],
			autoAction: [],
		}
	}
}

module.exports = ChannelDM;
