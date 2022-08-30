// ytzero - data management of day searches
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const SearchDM = require('./searchdm');
const Search = require('./search');

class DayDM extends SearchDM {

	constructor(engine) {
		super(engine,engine.cfg.advanced.dayCycleMinutes);
		this.type = 'day';
		// get list of day searches ready for updating
		this.upd = this.sql.prepare(`
			SELECT search.id
			FROM search
			LEFT JOIN topic ON search.topic = topic.id
			WHERE ? = 'ON'
			AND (topic.status = 'ON')
			AND (now() > (
				search.updatedDay +
				adaptive('search', search.latestDay,0) -
				${this.cycle} )
			)
			ORDER BY (search.updatedDay + adaptive('search', search.latestDay,0)) ASC
			LIMIT ${this.engine.cfg.advanced.maxSearches};
		`);
		// save after successful update
		this.success = this.sql.prepare(`
			UPDATE search
			SET (updatedDay, latestDay, status, data)
			= (:updatedDay, :latestDay, :status, :data)
			WHERE id = :id;
		`);

	}

	// create a day search object
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
			'Day',
			search.meta.channelLevel,
			this.engine,
			sd
		);
	}

}

module.exports = DayDM;