// ytzero - data management of searches
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const Search = require('./search');
const Channel = require('./channel');
const ItemDM = require('./itemdm');

class SearchDM extends ItemDM {

	// search data manager constructor
	constructor(engine, cycle = 0) {
		super(engine, cycle);
		this.type = 'search';
		// add a new search search sql
		this.add = this.sql.prepare(`
			INSERT into search
			(name, topic, updatedHour, updatedDay, latestHour, updatedDay, status, data)
			VALUES
			(:name, :topic, :updatedHour, :updatedDay, :latestHour, :latestDay, :status, :data);
		`);
		this.fetchs = `
			SELECT search.*,
				topic.name AS 'topicName',
				topic.status AS 'updating',
				topic.data AS 'fdata',
				COUNT(DISTINCT channel.id) AS 'channelCount',
				SUM(
					CASE
						WHEN video.state IN ('result','preview','upgrade','update','noupdate')
						THEN 1
						ELSE 0
					END
				) AS 'newVideos',
				COUNT(DISTINCT video.id) AS 'videoCount',
				CASE
					WHEN search.latestHour > search.latestDay
					THEN search.latestHour
					ELSE search.latestDay
				END AS 'latest',
				CASE
					WHEN search.updatedHour > search.updatedDay
					THEN search.updatedHour
					ELSE search.updatedDay
				END AS 'updated'
			FROM search
			LEFT JOIN channel ON channel.search = search.id
			LEFT JOIN topic ON search.topic = topic.id
			LEFT JOIN video ON video.channel = channel.id
		`;
		// fetch a search sql
		this.fetch = this.sql.prepare(`
			${this.fetchs}
			WHERE search.id = ?;
		`);
		// save a search sql
		this.set = this.sql.prepare(`
			UPDATE search
			SET (topic, status, data)
			= (:topic,:status,:data)
			WHERE id = :id
		`);
		this.menus = `
			SELECT id, name
			FROM search
			WHERE search.topic = :topic
			ORDER BY name ASC;
		`;
	}

	// create list of searches for client on worker thread
	async list(data) {
		try {
			data.topic = data.topic === 'all' ? 0 : parseInt(data.topic);
			let vs = (data.vstates.length) ? `AND video.state IN ('`+data.vstates.join(`','`)+`')`: ``;
			let fc = (data.filter.clause.length) ? 'AND ( '+data.filter.clause+' )' : '';
			let hc = (data.filter.having.length) ? 'HAVING ( '+data.filter.having+' )' : '';
			let st = (data.topic) ? `AND search.topic = ${data.topic}`: '';
			let wh = `${st} ${vs} ${fc}`.replace('AND','WHERE');
			let query = `
				${this.fetchs}
				${wh}
				GROUP BY search.id
				${hc}
				ORDER BY ${data.sort};
			`;
			return await this.engine.asyncQuery(query);
		} catch(e) {
			console.log(e);
			return [];
		}
	};

	// delete searches and assciated channels and videos
	delete(data) {
		let ids = '('+data.ids.join(',')+');';
		this.sql.prepare(`
			DELETE FROM video
			WHERE channel in (
				SELECT channel.id
				FROM channel
				LEFT JOIN search
				ON channel.search = search.id
				WHERE search.id IN `+ids+`
			)`
		).run();
		this.sql.prepare(`
			DELETE FROM channel
			WHERE search IN `+ids
		).run();
		return this.sql.prepare(`
			DELETE from search
			WHERE id IN `+ids
		).run();
	}

    // inserts new search or loads existing
	open(search) {
		let info = this.new(search.item);
		if (info.changes) search.item.id = info.lastInsertRowid;
		search.setItem(this.load(search.item.id));
		if (info.changes) {
			this.engine.db.hour.update(search);
			this.engine.db.day.update(search);
		}
		return info;
	}

	// search update request
	async update(search) {
		try {
			if (this.engine.cfg.engine.updates === 'ON'
				&&
				search.item.updating === 'ON'
				&&
				search.item.meta.updates === 'ON'
			) {
				await search.fetchItem();
				this.engine.bandwidth.search += search.transferred;
				for (let i = 0; i < search.videos.length; i++) {
					let video = search.videos[i];
					if (video.item) {
						let channel = Channel(
							search.item.id,
							video.item.channel || video.channelId,
							search.item.meta.channelLevel,
							video.item.published,
							this.engine,
							this.engine.session
						);
						this.engine.db.channel.open(channel,video);
						if (channel.item.level !== this.engine.cfg.advanced.blockLevel) {
							let info = this.engine.db.video.open(video,{...video.item});
							if (info.changes) { //a new video was added from search
								if (channel.item.level >= this.engine.cfg.advanced.scanLevel) {
									this.engine.db.channel.todo++;
									this.engine.db.channel.update(channel);
								}
							}
						}
					}
				}
				search.item.updated = search.item.updatedHour > search.item.updatedDay ?
					search.item.updatedHour :
					search.item.updatedHour;
				search.item.latest = search.item.latestHour > search.item.latestDay ?
					search.item.latestHour :
					search.item.latestHour;
				let current = this.load(search.item.id);
				search.item.meta.query = current.meta.query;
				search.item.meta.updates = current.meta.updates;
				search.item.meta.proxify = current.meta.proxify;
				search.item.meta.channelLevel = current.meta.channelLevel;
				this.engine.update(this,search.item);
			}
			this.check();
		} catch(e) {
			console.log(e);
		}
	}

	// create a search object
	create(search) {
		let sd = this.engine.session;
		if (
			this.engine.cfg.engine.proxySession
			&&
			search.meta.query.includes('proxy:')
		) sd = this.engine.cfg.engine.proxySession;
		return Search(
			search.topic,
			search.name,
			search.meta.query,
			'Hour',
			search.meta.channelLevel,
			this.engine,
			sd
		);
	}

	// search table creation sql
	static get table() {
		return `CREATE TABLE "search" (
			"id" INTEGER NOT NULL,
			"name" VARCHAR(16) NOT NULL DEFAULT '',
			"topic" INTEGER NOT NULL DEFAULT 0,
			"updatedHour" INTEGER NOT NULL DEFAULT 0,
			"updatedDay" INTEGER NOT NULL DEFAULT 0,
			"latestHour" INTEGER NOT NULL DEFAULT 0,
			"latestDay" INTEGER NOT NULL DEFAULT 0,
			"status" VARCHAR(3) NOT NULL DEFAULT 'OK',
			"data" BLOB DEFAULT x'',
			PRIMARY KEY ("id")
		);

		CREATE INDEX idx_search_topic ON "search" ("topic");`
	}

	// default search configuration - use ytzero.yaml to override
	static get default() {
		return {
			display: 0, // wapp
			sort: 'name', // wapp
			dir: 'ASC',// wapp
			scale: 1,// wapp
			timeFilter: 'any',// wapp
			statusFilter: 'any',// wapp
			textFilter: '',// wapp
			allActions: ['none','activate','deactivate','proxify','deproxify','discard'],
			allAction: 'none',
			old: 86400,
			red: 0,
			green: 63,
			blue: 127,
			textHeight: 0.1000,
			queryHeight: 0.1600,
			statHeight: 0.0850,
			optionHeight: 0.090,
			updateHeight: 0.090,
			imageHeight: 0.0625,
			newLabel: 15,
			newField: 40,
			nameLabel: 20,
			nameField: 80,
			proxyLabel: 20,
			proxyField: 27,
			topicLabel: 15,
			topicField: 50,
			minNameLength: 2,
			maxNameLength: 16,
			queryInputLength: 40,
			statusHint: 'search status filter',
			statusList: [
				{
					tag: 'any',
					sql: '',
				}
			],
			timeHint: 'search time filter',
			timeList: [
				{
					tag: 'any',
					sql: '',
				}
			],
			sortList: [
				{
					tag: 'name',
					sql: 'search.name ASC',
				},
			],
			defaultChannelLevel: 'update'
		};
	}

}

module.exports = SearchDM;