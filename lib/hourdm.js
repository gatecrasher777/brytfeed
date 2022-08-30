// ytzero - data management of hour searches
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const SearchDM = require('./searchdm');

class HourDM extends SearchDM {

	// hour search constructor
	constructor(engine) {
		super(engine,engine.cfg.advanced.hourCycleMinutes);
		this.type = 'hour';
		// get list of hour searches ready for updating
		this.upd = this.sql.prepare(`
			SELECT search.id
			FROM search
			LEFT JOIN topic ON search.topic = topic.id
			WHERE ? = 'ON'
			AND (topic.status = 'ON')
			AND (now() > (
				search.updatedHour +
				adaptive('search',search.latestHour,0) -
				${this.cycle} )
			)
			ORDER BY (search.updatedHour + adaptive('search',search.latestHour,0)) ASC
			LIMIT ${engine.cfg.advanced.maxSearches};
		`);
		// save after successful update
		this.success = this.sql.prepare(`
			UPDATE search
			SET (updatedHour, latestHour, status, data)
			= (:updatedHour, :latestHour, :status, :data)
			WHERE id = :id;
		`);
	}

}

module.exports = HourDM;