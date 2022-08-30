// ytzero - server-side search class - extends ytcog.search for database integration
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const ytcog = require('ytcog');
const Video = require('./video.js');
const ut = require('../client/js/ut.js')();

class Search extends ytcog.Search {

	// search constructor
	constructor(topic, name, query, period, level, engine, session) {
		super(session,{
			query: query,
			period: period.toLowerCase(),
			quantity: engine.cfg.advanced.maxSearchResults
		});
		this.period = period;
		this.engine = engine;
		// database item
		let nlevel = typeof level === "string" ? parseInt(level) : level;
		this.item = {
			id: 0,
			name: name,
			topic: topic,
			updatedHour: 0,
			updatedDay: 0,
			latestHour: 0,
			latestDay: 0,
			status: 'OK',
			filter: {},
			meta: {
				reason:	'',
				query: query,
				updates: 'ON',
				proxify: 'NO',
				channelLevel: level,
			}
		}
	}

	// copy item data to ytcog search object
	setItem(item) {
		this.item = item;
		this.status = item.status;
		this.reason = item.meta.reason;
		this.item.meta.channelLevel = typeof this.item.meta.channelLevel === "string" ?
			parseInt(this.item.meta.channelLevel) : this.item.meta.channelLevel;
		if (this.period) {
			this.updated = item['updated'+this.period];
			this.latest = item['latest'+this.period];
		}
	}

	// search request - copy from ytcog search object to item
	async fetchItem() {
		if (this.options.query.includes('^')) {
			let dt = new Date();
			let today = dt.getDate();
			let tomorrow = today;
			let yesterday = today;
			if (today>1) yesterday = today - 1;
			let days = new Date(dt.getFullYear(), dt.getMonth(), 0).getDate();
			if (today<days) tomorrow = today + 1;
			this.options.query = this.options.query.
				replace('^today',today.toString()).
				replace('^yesterday',yesterday.toString()).
				replace('^tomorrow',tomorrow.toString());
		}
		if (this.options.query.includes('proxy:')) this.options.query = this.options.query.replace('proxy:','');
		await super.fetch();
		this.item.status = this.status;
		this.item.meta.reason = this.reason;
		if (this.latest>this.item['latest'+this.period]) this.item['latest'+this.period] = this.latest;
		this.item['updated'+this.period] = this.updated;
		let items = [];
		this.videos.forEach(v => {  // prefilter results
			if ((this.updated-v.published) <= ut.days(1)) { //must be published within last 24 hours
				let video = Video(
					v.channelId,
					v.id,
					v.published,
					'result',
					this.engine,
					this.engine.session
				)
				let x = video.item;
				let m = x.meta;
				m.title = v.title;
				m.description = v.description;
				x.duration = v.duration;
				x.views = v.views;
				m.isLive = v.isLive;
				m.author = v.author;
				x.channel = v.channelId;
				m.channelThumb = v.channelThumb;
				x.updated = x.reviewed = x.discovered = this.updated;
				let okay = true;
				let f = this.item.filter;
				if ((f.minDur>0) && (x.duration>0) && (x.duration<f.minDur)) okay = false;
				if ((f.maxDur>0) && (x.duration>0) && (x.duration>f.maxDur)) okay = false;
				if (x.duration <= 0) okay = false;
				if (x.views < 0) okay = false;
				if (f.disallowText && f.disallowText.length) f.disallowText.split(',').forEach( e => {
					let dt = e.trim().toLowerCase();
					if (dt.length) {
						if (m.title.toLowerCase().includes(dt)) okay = false;
						if (m.description.toLowerCase().includes(dt)) okay = false;
					}
				});
				if (okay) items.push(video);
			}
		});
		this.videos = items;
	}

}

function searchInit(topic,name,query,period,level,engine,session) {
	return new Search(topic,name,query,period,level,engine,session);
}

if (module !== undefined) {
	module.exports=searchInit;
}
