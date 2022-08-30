// ytzero - channel object class - extends ytcog.Channel for database integration
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const ytcog = require('ytcog');
const Video = require('./video.js');
const ut = require('../client/js/ut.js')();

class Channel extends ytcog.Channel {

	// channel constructor
	constructor(search, id, level, latest, engine, session) {
		super(session,{
			id: id,
			items: 'search',
			order: 'new',
			quantity: engine.cfg.advanced.maxChannelResults,
			query: ''
		});
		this.engine = engine;
		// database item
		this.item = {
			id: id,
			search: search,
			views: 0,
			joined: 0,
			subscribers: 0,
			updated: 0,
			latest: latest,
			level: level,
			status: 'OK',
			filter: {},
			meta: {
				reason: '',
				author: '',
				description: '',
				thumbnail: '',
				country: '',
				tags: [],
				cycle: 0
			}
		}
	}

	// configure profile request
	profile() {
		this.options.items = 'about';
		this.item.meta.cycle = 0;
	}

	// configure for results over past searchAfterHours unless backfill days requested
	search(days = 0) {
		this.options.items = 'search';
		let period = days ? ut.days(days+0.5) : ut.hours(this.engine.cfg.advanced.searchAfterHours);
		this.options.query = 'after:'+ new Date(ut.now()-period).toISOString().substring(0,10);
		if (!days) this.item.meta.cycle++;
	}

	// copy item data to ytcog channel object
	setItem(item) {
		this.item = item;
		this.status = item.status;
		this.reason = item.meta.reason;
		this.views = item.views;
		this.subscribers = item.subscribers;
		this.joined = item.joined;
		this.updated = item.updated;
		if (item.latest>this.latest) this.latest = item.latest;
		this.author = item.meta.author;
		this.description = item.meta.description;
		this.thumbnail = item.meta.thumbnail;
		this.country = item.meta.country;
		this.tags = item.meta.tags;
	}

	// channel request - backfills if days are provided - copy ytcog to database item
	async fetchItem(days = 0) {
		await super.fetch();
		this.item.status = this.status;
		this.item.meta.reason = this.reason;
		if (this.item.status === 'ERROR') {
			this.item.status = 'NOK';
			if (this.reason.includes('has been terminated')) this.item.status = 'CTM';
			if (this.reason.includes('does not exist')) this.item.status = 'CDL';
			if (this.reason.includes('is not available')) {
				this.item.status = 'CNA';
				this.item.updated = ut.now();
			}
		} else {
			if (this.views>this.item.views) this.item.views = this.views;
			if (this.subscribers) this.item.subscribers = this.subscribers;
			if (this.joined) this.item.joined = this.joined;
			this.item.updated = this.updated;
			if (this.author.length) this.item.meta.author = this.author;
			if (this.description.length) this.item.meta.description = this.description;
			if (this.thumbnail.length) this.item.meta.thumbnail = this.thumbnail;
			if (this.country.length) this.item.meta.country = this.country;
			if (this.tags.length) this.item.meta.tags = this.tags;
			if (this.status == 'OK') {
				if (this.latest > this.item.latest) this.item.latest = this.latest;
				let items = [];
				this.videos.forEach(v => {
					if (
						(this.updated - v.published) <= ut.days(this.engine.cfg.advanced.publishedLimitDays)
						||
						days
					) {
						let video = Video(
							this.id,
							v.id,
							v.published,
							'result',
							this.engine,
							this.engine.session
						)
						let x = video.item;
						let m = x.meta;
						m.title = v.title;
						x.duration = v.duration;
						x.views = v.views;
						m.author = v.author;
						x.channel = v.channelId;
						m.channelThumb = v.channelThumb;
						m.country = v.country;
						x.updated = x.reviewed = x.discovered = this.updated;
						let okay = true;
						if (x.duration <= 0) okay = false;
						if (x.views < 0) okay = false;
						let f = this.item.filter;
						if (this.item.level<this.engine.cfg.advanced.unfilteredLevel && f) {
							if ((f.minDur>0) && (x.duration>0) && (x.duration<f.minDur)) okay = false;
							if ((f.maxDur>0) && (x.duration>0) && (x.duration>f.maxDur)) okay = false;
							if (x.duration <= 0) okay = false;
							if (x.views < 0) okay = false;
							if (f.disallowText && f.disallowText.length) f.disallowText.split(',').forEach( e => {
								let dt = e.trim().toLowerCase();
								if (dt.length) {
									if (m.title.toLowerCase().includes(dt)) okay = false;
									if (this.description.toLowerCase().includes(dt)) okay = false;
								}
							});
						}
						if (okay) items.push(video);
					}
				});
				this.videos = items;
			}
		}
	}

}

function channelInit(search,id,level,latest,engine,session) {
	return new Channel(search,id,level,latest,engine,session);
}

if (module !== undefined) {
	module.exports = channelInit;
}
