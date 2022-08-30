// ytzero - data management of topic items
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const ItemDM = require('./itemdm');

class TopicDM extends ItemDM {

	constructor(engine, cycle = 0) {
		super(engine, cycle);
		this.type = 'topic';
		// add new topic sql
		this.add = this.sql.prepare(`
			INSERT OR IGNORE into topic
			(name, status, data)
			VALUES
			(:name, :status, :data);
		`);
		// save data sql
		this.set = this.sql.prepare(`
			UPDATE topic
			SET (name, status, data) = (:name, :status ,:data)
			WHERE id = :id;
		`);
		// fetch topic sql
		this.fetch = this.sql.prepare(`
			SELECT *
			FROM topic
			WHERE id = ?;
		`);
		this.menus = `
			SELECT id, name
			FROM topic
			ORDER BY name ASC;
		`;
	}

    // create list of topics for client
	async list(data) {
		try {
			let vs = (data.vstates.length) ? `AND video.state IN ('`+data.vstates.join(`','`)+`')`: ``;
			let fc = (data.filter.clause.length) ? 'AND ( '+data.filter.clause+' )' : '';
			let hc = (data.filter.having.length) ? 'HAVING ( '+data.filter.having+' )' : '';
			let wh = `${vs} ${fc}`.replace('AND','WHERE');
			let query = `
				SELECT topic.*,
					COUNT(DISTINCT search.id) AS 'searchCount',
					COUNT(DISTINCT channel.id) AS 'channelCount',
					SUM(
						CASE
							WHEN video.state IN ('result','preview','upgrade','update','noupdate','queue')
							THEN 1
							ELSE 0
						END
					) AS 'newVideos',
					COUNT(DISTINCT video.id) AS 'videoCount',
					MAX(video.published) AS 'latest'
				FROM topic
				LEFT JOIN search ON (search.topic = topic.id)
				LEFT JOIN channel ON (channel.search = search.id)
				LEFT JOIN video ON (video.channel = channel.id)
				${wh}
				GROUP BY topic.id
				${hc}
				ORDER BY ${data.sort};
			`;
			return await this.engine.asyncQuery(query);
		} catch(e) {
			console.log(e);
			return [];
		}
	}

    // delete topics and associated searches, channels and videos
	delete(data) {
		let ids = '('+data.ids.join(',')+');';
		this.sql.prepare(`
			DELETE FROM video
			SET state = 'discarded'
			WHERE channel in (
				SELECT channel.id
				FROM channel
				LEFT JOIN search
				ON channel.search = search.id
				LEFT JOIN topic
				ON search.topic = topic.id
				WHERE topic.id IN `+ids+`
			)`
		).run();
		this.sql.prepare(`
			DELETE FROM channel
			WHERE search IN (
				SELECT search.id
				FROM search
				WHERE search.topic IN `+ids+`
			)`
		).run();
		this.sql.prepare(`
			DELETE from search
			WHERE topic IN `+ids
		).run();
		return this.sql.prepare(`
			DELETE from topic
			WHERE id IN `+ids
		).run();
	};

    // create a topic
	create(topic) {
		return  {
			id: 0,
			name: topic.name,
			status: this.engine.cfg.engine.updates,
			latest: 0,
			newVideos: 0,
			videoCount: 0,
			channelCount: 0,
			searchCount: 0,
			meta: {
				minDur: this.engine.cfg.engine.minDur,
				maxDur: this.engine.cfg.engine.maxDur,
				allowCategory: this.engine.cfg.engine.categories,
				disallowText: this.engine.cfg.engine.banText
			}
		};
	}

    // sql to create topic table
	static get table() {
		return `CREATE TABLE "topic" (
			"id" INTEGER NOT NULL,
			"name" VARCHAR(16) NOT NULL DEFAULT '',
			"status" VARCHAR(3) NOT NULL DEFAULT 'ON',
			"data" BLOB DEFAULT x'',
			PRIMARY KEY ("id")
		);`
	}

	// default topic configuarion - use ytzero.yaml to override
	static get default() {
		return {
			display: 0, // wapp
			sort: 'name', // wapp
			dir: 'ASC', // wapp
			scale: 1, // wapp
			timeFilter: 'any', //wapp
			statusFilter: 'any', //wapp
			textFilter: '', //wapp
			allActions: ['none','activate','deactivate','discard'],
			allAction: 'none',
			old: 86400,
			red: 63,
			green: 0,
			blue: 127,
			durations: [
				0,
				2,
				3,
				5,
				7,
				10,
				13,
				15,
				17,
				20,
				25,
				30,
				45,
				60,
				90,
				120,
				180,
				300,
				600,
				900,
				1200,
				1800,
				2700,
				3600,
				5400,
				7200,
				10800
			],
			minNameLength: 2,
			maxNameLength: 16,
			nameLabel: 20,
			nameField: 80,
			minDurLabel: 11,
			minDurField: 27,
			maxDurLabel: 12,
			maxDurField: 27,
			categoryField: 100,
			banField: 100,
			autoLabel: 10,
			autoActionField: 40,
			autoConditionField: 50,
			maxAuto: 4,
			textHeight: 0.1000,
			statHeight: 0.0800,
			categoryHeight: 0.4300,
			banHeight: 0.2000,
			optionHeight: 0.1000,
			controlHeight: 0.0800,
			updateHeight: 0.0900,
			imageHeight: 0.0625,
			statusHint: 'topic status filter',
			statusList: [
				{
					tag: 'all',
					sql: '',
				}
			],
			timeHint: 'topic time filter',
			timeList: 	[
				{
					tag: 'any',
					sql: '',
				}
			],
			sortList: [
				{
					tag: 'name',
					sql: 'topic.name ASC',
				}
			],
		};
	}

}

module.exports = TopicDM;