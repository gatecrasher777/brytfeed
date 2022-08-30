// ytzero - video object class - extends ytcog.Video for database integration
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const ytcog = require('ytcog');
const ut = require('../client/js/ut')();

class Video extends ytcog.Video {

	// video constructor
	constructor(channel, id, published, state, engine, session) {
		super(session,{
			id: id,
			published: published,
			path: engine.cfg.advanced.videoPath,
			container: engine.cfg.advanced.videoContainer,
			videoQuality: engine.cfg.advanced.videoQuality,
			audioQuality: engine.cfg.advanced.audioQuality,
			mediaBitrate: engine.cfg.advanced.mediaBitrate,
			filename: engine.cfg.advanced.videoFilename,
			metadata: engine.cfg.advanced.videoMetadata,
			overwrite: engine.cfg.advanced.videoOverwrite,
			subtitles: engine.cfg.advanced.videoSubtitles,
			subtitleFormat: engine.cfg.advanced.videoSubtitleFormat,
			progress: (prg)=>{}
		});
		this.engine = engine;
		this.subtype = 'result';
		if (['queue','download'].includes(state)) this.subtype = 'queue';
		if (['download..','downloaded'].includes(state)) this.subtype = 'download';
		// database item
		this.item = {
			id : id,
			channel : channel,
			duration : -1,
			expiry : 0,
			views : -1,
			reviewed: 0,
			updated: 0,
			published : published,
			discovered : ut.now(),
			downloaded: 0,
			state : state,
			status : 'OK',
			filter: {},
			meta : {
				reason : '',
				title : '',
				category : '',
				description : '',
				author : '',
				channelThumb : '',
				country : '',
				fn : '',
				url : '',
				keywords : [],
				storyBoards : [],
				videoStreams : [],
				audioStreams : [],
				rotation: 0
			}
		};
	}

	// copy item data to ytcog video object
	setItem(item) {
		this.item = item;
		this.status = item.status;
		this.reason = item.meta.reason;
		this.updated = item.updated;
		this.channelId = item.channel;
		this.duration = item.duration;
		this.expiry = item.expiry;
		this.views = item.views;
		this.published = item.published;
		this.downloaded = item.downloaded;
		this.title = item.meta.title;
		this.category = item.meta.category;
		this.author = item.meta.author;
		this.description = item.meta.description;
		if(item.meta.channelThumb.length) this.channelThumb = item.meta.channelThumb;
		this.country = item.meta.country;
		this.keywords = item.meta.keywords;
		this.fn = item.meta.fn;
		this.storyBoards = item.meta.storyBoards;
		this.videoStreams = item.meta.videoStreams;
		this.audioStreams = item.meta.audioStreams;
	}

	// copy from ytcog video object to item
	async fetchItem() {
        await super.fetch();
		this.item.status = this.status;
		this.item.meta.reason = this.reason;
		if (this.item.status == 'ERROR') {
			this.item.status = 'ERR';
			if (this.reason.includes('confirm your age')) {
				this.item.status = 'VAR';
				if (this.engine.cfg.engine.fallback.length) this.engine.fallback({
					id: this.id,
					ts: this.published,
					channel: this.channelId,
					state: this.item.state
				});
			} else if (this.item.meta.reason.includes('is a private video')) {
				this.item.status = 'VIP';
			} else if (this.item.meta.reason.includes('unavailable')) {
				this.item.status = 'VDL';
			} else if (this.item.meta.reason.includes('video has been removed')) {
				this.item.status = 'VRM';
			}
			if (this.item.state === 'queue') this.item.state = 'download';
			if (['result','preview','upgrade','update'].includes(this.item.state)) this.item.state = 'noupdate';
		} else if (this.status == 'OK') {
			let x = this.item;
			let m = this.item.meta;
			x.reviewed = x.updated = this.updated;
			let sb = (this.storyBoards.length>0);
			let hq = false;
			if (this.hasMedia) {
				let q = this.videoStreams[0].quality;
				let n = parseInt(q);
				if ((!isNaN(n)) && (n >= this.engine.cfg.advanced.highQuality)) hq = true;
			}
			let ag = x.updated-x.published;
			if (this.title.length) m.title = this.title;
			if (this.author.length) m.author = this.author;
			if (this.channelId.length) x.channel = this.channelId;
			if (this.description.length) m.description = this.description;
			if (x.views<this.views) x.views = this.views;
			if (this.duration>0) x.duration = this.duration;
			if (this.keywords.length) m.keywords = this.keywords;
			if ((!x.published) || (x.published>this.published)) x.published = this.published;
			if (this.category.length) m.category = this.category;
			let f = x.filter;
			if (x.state !== 'queue' && x.clevel < this.engine.cfg.advanced.unfilteredLevel && f) {
				if (
					this.description
					&&
					this.engine.cfg.advanced.maxDescriptionLength
					&&
					this.description.length > this.engine.cfg.advanced.maxDescriptionLength
				) x.state = 'discarded';
				if (m.category.length && f.allowCategory && !f.allowCategory.includes(m.category)) x.state = 'discarded';
				if ((f.minDur>0) && (x.duration>0) && (x.duration<f.minDur)) x.state = 'discarded';
				if ((f.maxDur>0) && (x.duration>0) && (x.duration>f.maxDur)) x.state = 'discarded';
				if ((x.duration <= 0)) x.state = 'discarded';
				if ((x.views < 0)) x.state = 'discarded';
				if (f.disallowText && f.disallowText.length) f.disallowText.split(',').forEach( e => {
					let dt = e.trim().toLowerCase();
					if (dt.length) {
						if (m.title.toLowerCase().includes(dt)) x.state = 'discarded';
						if (m.description.toLowerCase().includes(dt)) x.state = 'discarded';
						if (m.keywords.join(',').toLowerCase().includes(dt)) x.state = 'discarded';
					}
				});
			}
			if (x.state !== 'discarded') {
				if (this.storyBoards.length) m.storyBoards = this.storyBoards;
				if (this.channelThumb.length) m.channelThumb = this.channelThumb;
				if (this.videoStreams.length) m.videoStreams = this.videoStreams;
				if (this.audioStreams.length) m.audioStreams = this.audioStreams;
				if (this.expiry > 0) x.expiry = this.expiry;
				switch (x.state) {
					case 'result':
						x.state = 'preview';
						if (sb) {
							x.state = 'update';
							if (!hq && ag < ut.hours(this.engine.cfg.advanced.upgradeLimitHours)) x.state = 'upgrade';
							if (x.clevel === this.engine.cfg.advanced.followLevel) x.state = 'queue';
						}
					break;
					case 'preview':
						if (sb || ag > ut.minutes(this.engine.cfg.advanced.mediaLimitMinutes)) {
							x.state = 'update';
							if (!hq && ag < ut.hours(this.engine.cfg.advanced.upgradeLimitHours)) x.state = 'upgrade';
							if (x.clevel === this.engine.cfg.advanced.followLevel) x.state = 'queue';
						}
					break;
					case 'upgrade':
						if (hq || ag > ut.hours(this.engine.cfg.advanced.upgradeLimitHours)) x.state = 'update';
					break;
					case 'update':
						if (ag > ut.hours(this.engine.cfg.advanced.updateLimitHours)) x.state = 'noupdate';
					break;
					default: break;
				}
			}
		}
	}

}

function videoInit(channel,id,published,state,engine,session) {
	return new Video(channel,id,published,state,engine,session);
}

if (module !== undefined) {
	module.exports = videoInit;
}
