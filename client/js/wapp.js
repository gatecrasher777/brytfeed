/* brytfeed - (c) 2023 Gatecrasher777 */
/* client web application module */

class Wapp {

	// Web app constructor
	constructor() {
		// global variables
		this.topicId = 0;
		this.searchId = 0;
		this.channelId = 0;
		this.mode = 'video';
		this.state = 'pending';
		this.wanted = 0;
		this.previewTypes = ['info','images','storyboards','hybrid','videos'];
		this.embedded = false;
		this.disabled = false;
		this.showing = 'menu1';
		this.topiclist = [];
		this.searchlist = [];
		this.channellist = [];
		this.shown = [];
		this.response = [];
		this.nextResponse = [];
		this.nextChanResponse = [];
		this.chanResponseItem = {};
		this.nextChanResponseItem = {};
		this.itemx = {};
		this.list = {
			tid : 0,
			vstates : [],
			sid : 0,
			cid : 0,
			video : 0,
			type : 'video',
			chanMode: false
		},
		this.page = 0;
		this.refreshTime = null;
		this.nexttop = 0;
		this.undoData = [];
		this.cfg = {};
		this.restoreMode = 'video';
		this.restorePage = 0;
		this.restoreState = 'result';
		this.chanList = [];
		this.dcb = [];
		this.filtered = 0;
		this.nextChanFiltered = 0;
		this.total = 0;
		this.editing = false;
		this.shiftPressed = false;
		this.ctrlPressed = false;
		this.altPressed = false;
		this.selectOK = false;
		this.reembedded = false;
		this.volumeLevel = 0;
		this.stats = {};
		this.lastData = {};
		this.content = '#content';
	//	this.linkTimer = null;
	}

	// start the client step 1
	start() {
		this.emit('start',{cb:'startcfg'});
		this.statusMsg('starting...');
	}

	// start the client step 2
	// data <object> cfg data
	startcfg(data) {
		this.setcfg(data);
		this.volumeLevel = this.cfg.video.embedVolume;
		ut.html('#menu1',
			this.menu(['video','!topic','!search','!channel','app'],1,'')
		)
		this.nexttop = ut.prop('#menu1','offsetHeight');
		this.statusMsg('');
	}

	// send request to server
	// tag <string> request tag
	// data <object> request data
	emit(tag,data) {
		socket.emit(tag,data);
	}

	// a visible item has been updated, redisplay is shown
	// data <object> item update data
	setUpdate(data) {
		let x = this.itemx[data.item.key];
		if (x && x.type === data.type) {
			x.item = data.item;
			x.redisplay();
		} else if (this.nextResponse.length) {
			let i = 0;
			let done = false;
			while (!done) {
				if (data.item.key === this.nextResponse[i].key) {
					done = true;
					this.nextResponse[i] = data.item;
				}
				i++;
				if ( i >= this.nextResponse.length ) done = true;
			}
		} else if (this.nextChanResponse.length) {
			if (data.item.key = this.nextChanResponseItem.key) {
				this.nextChanResponseItem = data.item;
			} else {
				let i = 0;
				let done = false;
				while (!done) {
					if (data.item.key === this.nextChanResponse[i].key) {
						done = true;
						this.nextChanResponse[i] = data.item;
					}
					i++;
					if ( i >= this.nextChanResponse.length ) done = true;
				}
			}
		}
	}

	// a visible item has been reveiwed, update reviewables & redisplay if shown
	// data <object> item review data
	setReview(data) {
		let x = this.itemx[data.item.key];
		if (x && x.type === data.type) {
			Object.keys(data.item).forEach(k => {
				x.item[k] = data.item[k];
			});
			x.redisplay();
		} else if (this.nextResponse.length) {
			let i = 0;
			let done = false;
			while (!done) {
				let item = this.nextResponse[i];
				if (data.item.key === item.key) {
					done = true;
					Object.keys(data.item).forEach(k => {
						item[k] = data.item[k];
					});
				}
				i++;
				if ( i >= this.nextResponse.length ) done = true;
			}
		} else if (this.nextChanResponse.length) {
			if (data.item.key = this.nextChanResponseItem.key) {
				Object.keys(data.item).forEach(k => {
					this.nextChanResponseItem[k] = data.item[k];
				});
			} else {
				let i = 0;
				let done = false;
				while (!done) {
					let item = this.nextChanResponse[i];
					if (data.item.key === item.key) {
						done = true;
						Object.keys(data.item).forEach(k => {
							item[k] = data.item[k];
						});
					}
					i++;
					if ( i >= this.nextChanResponse.length ) done = true;
				}
			}
		}
	}

	// show download progress
	// data <object> download progress data
	dlProgress(data) {
		let v = this.itemx[data.key];
		if (v) {
			v.item.state = 'download..';
			if (!ut.exists(`#prg_${data.key}`)) v.redisplay(true);
			ut.css(`#prg_${data.key}`,{width: data.prg});
		}
	}

	// a download completed, redisplay
	// data <object> downloaded data
	dlCompleted(data) {
		let v = this.itemx[data.key];
		if (v) {
			v.item = data.item;
			ut.remove(`#prg_${data.key}`);
			v.redisplay(true);
		}
	}

	// a requested list has been received
	// data <object> item list data
	itemList(data) {
		if (this.showing === `${data.type}List` && data.got === this.wanted) {
			if (data.content === 'prechan') {
				this.nextChanResponse = structuredClone(data.list);
				this.nextChanResponseItem = data.chanItem;
				this.nextChanFiltered = data.filtered;
				ut.removeAttr('#pgdnbut','disabled');
				this.lastData = data;
			} else if (data.content === 'prefetch') {
				this.nextResponse = structuredClone(data.list);
				ut.removeAttr('#pgdnbut','disabled');
				this.lastData = data;
			} else {
				this.response = structuredClone(data.list);
				this.chanResponseItem = data.chanItem;
				this.filtered = data.filtered;
				data.next && this.response.length ? this.next(data.type) : this.load(data);
			}
		}
	}

	// set the received configuration
	// data <object> condifiguration data
	setcfg(data) {
		this.cfg = data.cfg;
		this.list.tid = this.topicId;
		this.disabled = false;
	}

	// send changes to configuration
	updcfg() {
		this.emit('setcfg',{cfg:this.cfg});
	}

	get stateIndex() {
		let i = this.cfg.state.findIndex(s => {
			return s.tag === this.state;
		});
		if (i<0) return 1;
		return i;
	}

    // determine effective visual state
	get subtype() {
		if (this.mode === 'video') {
			return this.cfg.state[this.stateIndex];
		}
		return this.cfg[this.mode];
	}

	// determine effective item object class
	get itemObject() {
		switch(this.mode) {
			case 'video': return Video;
			case 'search': return Search;
			case 'channel': return Channel;
			case 'topic': return Topic;
			default: return Item;
		}
	}

	// get display items quantity limit
	get limit() {
		this.scale(0);
		let t = this.subtype;
		let cl = this.itemObject;
		let dum = new cl({},t.scale);
		let cw = document.body.clientWidth;
		let sw = dum.padding + dum.margin;
		let iw = dum.width + 2 * sw;
		let pr = Math.max(1, Math.floor((cw-sw) / iw));
		let pc = t.rows;
		let n = parseInt(t.display);
		if (!n) n = pr * pc;
		ut.css(this.content, {
			'padding-left': `${(cw - pr * iw) / 2}px`,
			'padding-top': '0px'
		});
		if (!n) n = 1;
		return n;
	}

	// add a key to the "don't come back" list
	// key <string> item key
	dcbAdd(key) {
		this.dcb.push(key);
	}

	// remove a key from the "don't come back" list
	// key <string> item key
	dcbRemove(key) {
		let f = this.dcb.indexOf(key);
		if ( f >= 0 ) this.dcb.splice(f, 1);
	}

	// move to next channel in channel mode
	// type <string> item type, video or channel
	next(type) {
		let it = type === 'video'? new Video(this.response[0], 1) :
			new Channel(this.response[0],1);
		this.itemx[it.item.key] = it;
		for (let i = 1; i<this.response.length; i++) {
			it = new Video(this.response[i], 1);
			this.itemx[it.item.key] = it;
		}
		this.chan(null,it.item.key);
	}

	// render a menu item
	// tag <string> menu tag
	// level <int> menu level
	// prefix <string> parent menu tag
	menuItem(tag, level, prefix) {
		let state = (tag[0] === '$');
		let items = (tag[0] === '!');
		let filter = (tag[0] === '*');
		let attr = {};
		let html = '';
		if (items) {
			tag = tag.substr(1);
			attr = {
				id: `${tag}menu`,
				'class':`menu${level}idiv`
			};
			html = ht.concat(
				ht.div(
					{
						onclick: ht.cmd(`wapp.${prefix}${tag}Click`),
						title: `click for ${tag}`,
						class: 'menutagdiv'
					},
					`${tag}: `
				),
				ht.select(
					{
						id: `${tag}menuselect`,
						onchange: ht.cmd('wapp.selectTSC'),
						class: 'menuselect'
					},
					ht.option(
						{
							value: 0,
							selected: 'selected'
						},
						'any'
					)
				)
			);
			this.emit(`${tag}menu`,{
				cb:`${tag}menu`,
				tid: this.topicId,
				sid: this.searchId
			});
		} else if (state) {
			tag = tag.substr(1);
			attr = {
				id: `${tag}menu`,
				'class':`menu${level}fdiv`
			};
			let hint = 'video state';
			html = ht.concat(
				ht.div(
					{
						class: 'filterdiv'
					},
					`${tag}: `
				),
				ht.select(
					{
						id: 'videostateselect',
						class: 'filtermenu',
						onchange: ht.cmd('wapp.videostateClick'),
						title: hint
					},
					ht.forEach(
						this.cfg.state,
						(e,i,a) => {
							let g = {value: e.tag}
							if (e.tag === this.state) g.selected='selected';
							if (i) {
								return ht.option(
									g,
									e.tag
								)
							} else {
								return '';
							}
						}
					)
				)
			);
		} else if (filter) {
			tag = tag.substr(1);
			attr = {
				id: `${tag}menu`,
				'class':`menu${level}fdiv`
			};
			let list = this.cfg[prefix][`${tag}List`];
			let hint = this.cfg[prefix][`${tag}Hint`];
			html = ht.concat(
				ht.div(
					{
						class: 'filterdiv'
					},
					`${tag}: `
				),
				ht.select(
					{
						id: `${prefix + tag}select`,
						class: 'filtermenu',
						onchange: ht.cmd('wapp.filterClick',prefix,tag),
						title: hint
					},
					ht.forEach(
						list,
						e => {
							let g = {value: e.tag}
							if (e.tag === this.subtype[`${tag}Filter`]) g.selected='selected';
							return ht.option(
								g,
								e.tag
							)
						}
					)
				)
			);
		} else {
			attr = {
				id: `${tag}menu`,
				'class': `menu${level}div`,
				onclick: ht.cmd(`wapp.${prefix}${tag}Click`)
			};
			html = tag;
		}
		return ht.div(
			attr,
			html
		);
	}

	// render the menu
	// tags <string array> submenu tags
	// level <int> menu level
	// prefix <string> parent menu tag
	menu(tags,level,prefix) {
		return ht.forEach(
			tags,
			e => {
				return this.menuItem(e,level,prefix)
			}
		);
	}

	// receive list and show topic dropdown
	// data <object> topic menu list
	topicmenu(data) {
		this.topiclist = data.list;
		ut.html('#topicmenuselect',
			ht.forEach(
				this.topiclist,
				e => {
					let g = {
						value: e.id
					};
					if (e.id === this.topicId) g.selected = 'selected';
					return ht.option(
						g,
						e.name
					);
				}
			)
		);
	}

	// receive list and show search dropdown
	// data <object> search menu list
	searchmenu(data) {
		this.searchlist = data.list;
		ut.html('#searchmenuselect',
			ht.forEach(
				this.searchlist,
				e => {
					let g = {
						value: e.id
					};
					if (e.id === this.searchId) g.selected = 'selected';
					return ht.option(
						g,
						e.name
					);
				}
			)
		);
	}

	// receive list and show channel dropdown
	// data <object> channel menu list
	channelmenu(data) {
		this.channellist = data.list;
		ut.html('#channelmenuselect',
			ht.forEach(
				this.channellist,
				e => {
					let g = {
						value: e.id
					};
					if (e.id === this.channelId) g.selected = 'selected';
					return ht.option(
						g,
						e.author.substr(0,15)
					);
				}
			)
		);
	}

	// repond to topic/search/channel dropdown choices.
	selectTSC() {
		this.list.tid = ut.val('#topicmenuselect');
		if (this.topicId !== this.list.tid) {
			this.topicId = this.list.tid;
			this.list.sid = this.searchId = 0;
			this.searchmenu(
				{list:
					[
						{
							id: 0,
							name: 'any'
						}
					]
				}
			);
			this.list.cid = this.channelId = 0;
			this.channelmenu(
				{
					list:
					[
						{
							id: 0,
							author: 'any'
						}
					]
				}
			);
			this.updcfg();
			this.emit('searchmenu',{
				cb:'searchmenu',
				tid: this.topicId,
				sid: this.searchId
			});
		} else {
			this.list.sid = ut.val('#searchmenuselect');
			if (this.searchId !== this.list.sid) {
				this.searchId = this.list.sid;
				this.list.cid = this.channelId = 0;
				ut.val('#channelmenuselect',0);
				this.channelmenu(
					{
						list:
						[
							{
								id: 0,
								author: 'any'
							}
						]
					}
				);
				this.updcfg();
				this.emit('channelmenu',{
					cb:'channelmenu',
					tid: this.topicId,
					sid: this.searchId
				});
			} else {
				this.list.cid = this.channelId = ut.val('#channelmenuselect');
			}
		}
		this.refreshContent(true,true,0);
	}

	// reset the menu
	// level <int> menu level
	// page <int> list page number, zero based
	resetMenu(level, page = 0) {
		clearTimeout(this.refreshTime);
		this.refreshTime = null;
		switch(level) {
			case 0:
				this.mode = '';
				this.submode = '';
				this.nexttop = 0;
				this.nextLevel('#menu1');
				ut.removeClass('.menu1div','selected');
				ut.removeClass('.menu1idiv','selected');
				ut.css('menu2',{'display':'none'});
			case 1:
				if (level == 1) {
					this.submode = '';
					this.nexttop = 0;
					this.list.chanMode ? ut.css('#menu1',{display:'none'}) : this.nextLevel('#menu1');
					this.list.chanMode ? ut.css('#menu2',{display:'none'}) : this.nextLevel('#menu2');
				}
				ut.removeClass('.menu2div','selected');
				ut.removeClass('.menu2fdiv','selected');
				ut.css('#launch',{'display':'none'});
				ut.css('#options',{'display':'none'});
				ut.css('#controls',{'display':'none'});
				this.response = [];
				this.chanResponseItem = {};
				this.shown = [];
				this.filtered = 0;
				ut.attr('.navbut',{'disabled':'disabled'})
				this.showing = '';
				this.page = page;
				this.clearItems();
				ut.html(this.content,'');
				this.statusNav('');
			case 2:
				ut.css('#options',{'display':'none'});
				ut.css('#controls',{'display':'none'});
				break;
			default: break;
		}
	}

	// add a visual element to contents
	// element <string> html element descripter
	nextLevel(element) {
		ut.css(element,{'display':'block','top': `${this.nexttop}px`});
		this.nexttop += ut.prop(element,'offsetHeight');
		ut.css(this.content,{'top': `${this.nexttop}px`});
	}

	// hide a visual element from contents
	// element <string> html element descripter
	prevLevel(element) {
		this.nexttop -= ut.prop(element,'offsetHeight');
		ut.css(element,{'display':'none'});
		ut.css(this.content,{'top': `${this.nexttop}px`});
	}

	// clear all display items
	clearItems() {
		Object.keys(this.itemx).forEach( (k)=>{
			this.itemx[k].clear();
		});
		//ut.remove(`.preloadvideo`);
	}

	// receive and display server bandwidth
	// data <object> bandwidth data
	setBandwidth(data) {
		let x ='';
		if (data.wl !== undefined && !isNaN(data.wl)) {
			x = 'L'+data.wl.toFixed(2)+' - ';
		}
		if (this.bw !== undefined) {
			let n = data.bw;
			let o = this.bw;
			let t = n.search+n.channel+n.video+n.download-o.search-o.channel-o.video-o.download;
			if (t) {
				x += `${ut.qFmt(t * 1000 / this.cfg.client.bandwidthCycle)}/s - `;
				let xx = {};
				let tt = 0;
				Object.keys(data.bw).forEach((k)=>{
					if (n[k]-o[k]) {
						xx[k] = Math.floor((n[k]-o[k])*100/t);
						tt+=xx[k];
					}
				});
				tt = 100 - tt;
				let aloc = false;
				Object.keys(data.bw).forEach((k)=>{
					if (n[k]-o[k]) {
						if (!aloc) xx[k]+=tt;
						aloc = true;
						x += xx[k].toString()+k[0]+' ';
					}
				});
			} else {
				x += '0k/s';
			}
			this.statusUpd(x);
		}
		this.bw = data.bw;
	}

	// receive database stats
	// data <object> statistics data
	setStatistics(data) {
		this.statistics = data.stats;
	}

	// refresh visual item list
	// redisplay <boolean> redisplay list elements if true
	// update <boolean> update the list if true
	// page <int> show page number
	// next <boolean> move to next item in channel mode
	refreshContent(redisplay, update, page = this.page, next = false) {
		if (this.showing.length && !this.embedded) {
			this.wanted++;
			clearTimeout(this.refreshTime);
			//clearTimeout(this.linkTimer);
			let data = this.list;
			data.got = this.wanted;
			data.sort = this.itemSortMethod();
			data.filter = this.itemFilterMethod();
			data.showing = this.showing;
			this.page = data.page = page;
			data.limit = this.limit;
			data.update = update;
			data.dcb = this.dcb;
			data.next = next;
			data.content = 'content';
			data.ids = [];
			this.response = data.list = [];
			if (update) this.dcb = [];
			this.emit('list', data);
			if (redisplay) {
				this.clearItems();
				this.shown = [];
				this.statusNav('fetching data...');
			}
			if (this.subtype.autoLoad) {
				this.refreshTime = setTimeout(this.refreshContent.bind(this),this.cfg.client.refreshCycle,false,true);
			}
		}
	}

	// prefetch next page
	prefetchContent(data) {
		if (this.showing.length && !this.embedded) {
			this.wanted++;
			data.page ++;
			data.update = false;
			data.next = false;
			data.got = this.wanted;
			data.content = 'prefetch';
			this.nextResponse = data.list = [];
			this.emit('list', data);
		}
	}

	// prefetch next page
	preChanContent(data) {
		if (this.showing.length && !this.embedded) {
			this.wanted++;
			data.page = 0;
			data.update = true;
			//data.next = false;
			data.sort =  this.itemSortMethod(0);
			data.filter = this.itemFilterMethod(0);
			data.showing = this.showing;
			data.chanMode = true;
			data.got = this.wanted;
			data.content = 'prechan';
			this.nextChanResponse = data.list = [];
			this.emit('list', data);
		}
	}

	// get the ordered value of an item in the list
	// item <object> item data
	mark(item) {
		let s = this.subtype.sort;
		let i = this.cfg.video.sortList.findIndex(e=>{return s === e.tag;});
		if (i < 0) i = 0;
		let o = this.cfg.video.sortList[i];
		let z = o.field.split('.');
		let v = item;
		for (let j = 0; j< z.length; j++) {
			v = v[z[j]];
		}
		return v;
	}

	// formatted display of an ordered value
	// mark <var> value to format
	markStr(mark) {
		if (mark === null) return '';
		let s = this.subtype.sort;
		let i = this.cfg.video.sortList.findIndex(e=>{return s === e.tag;});
		if (i < 0) i = 0;
		let o = this.cfg.video.sortList[i];
		switch (o.format) {
			case 'age': return ut.tsAge(mark);
			case 'length': return ut.secDur(mark);
			case 'quantity': return ut.qFmt(mark);
			default:
				if (o.format === 'none') return mark;
				let n = parseInt(o.format);
				if (n) return mark.substring(0,n);
				return o.format;
		}
	}

	// whether an item's order should come before a comparable value
	// item <object> item data
	// mark <var> value to compare
	before(item, mark) {
		if (mark === null) return false;
		let d = this.subtype.dir;
		let v = this.mark(item);
		if (d === 'asc') {
			return (v < mark);
		} else {
			return (v > mark);
		}
	}
/*
	link() {
		this.nextResponse.forEach(e => {
			let type = this.subtype.preview === 'hybrid' ?
							e.duration <= this.cfg.client.hybridDuration ?
								'videos' :
								'storyboards' :
							this.subtype.preview;
			if (type === 'videos')	{
				let vs = e.videoStreams;
				if (vs && vs.length) {
					let s = vs[vs.length-1];
					let html = ht.video(
						{
							id: `preload_video_${e.id}`,
							'class': 'preloadvideo',
							muted : '1',
							autoplay : '1',
						},
						ht.source({
							src: `${e.url}&range=0-${e.size}`,
							type: e.type,
						})
					)
					ut.append(this.content,html);
				}
			}
		});
	}

	linkReady() {
		let okay = this.mode === 'video' && this.nextResponse.length;
		let keys = Object.keys(this.itemx);
		let i = 0;
		while (okay && i < keys.length) {
			if (!this.itemx[keys[i]].loaded) okay = false;
			i++;
		}
		okay ? this.link() : this.linkTimer = setTimeout(this.linkReady.bind(this),1000);
	}
*/
	// load items (if necessary) from the list reponse
	load(data) {
		this.lastData = data;
		let t = this.subtype;
		let isch = false;
		let cl = this.itemObject;
		let lim = this.limit;
		let plim = this.list.chanMode ? lim - 1 : lim;
		let llim = (this.filtered - 1) % plim;
		let cur = Object.keys(this.itemx).length;
		let maxpage = Math.floor((this.filtered - 1) / plim);
		if (this.page > maxpage) this.page = Math.max(0, maxpage);
		let replace = t.autoLoad;
		if (this.page < maxpage && !t.autoLoad) {
			this.prefetchContent(data);
		} else {
			if (this.mode === 'video' && this.page === maxpage && data.ids.length) {
				this.emit('vidseen',{ids: data.ids});
			}
			this.nextResponse = [];
		}
		if (this.list.chanMode) {
			if (!this.itemx[this.chanResponseItem.key]) {
				let it = new Channel(this.chanResponseItem, t.scale);
				ut.append(this.content, it.html);
				this.itemx[it.item.key] = it;
				this.shown.push(this.chanResponseItem.key);
			} else {
				let it = this.itemx[this.chanResponseItem.key];
				it.item = this.chanResponseItem;
			}
		}
		while (
			this.response.length
			&&
			(cur < plim || replace)
			&& (
				this.page < maxpage
				||
				cur <= llim
			)
		) {
			let i;
			replace ? i = this.response.pop() : i = this.response.shift();
			if (!this.itemx[i.key]) {
				let it;
				if (i.type === 'channel' && t !=='channel') {
					it = new Channel(i, t.scale);
					isch = true;
				} else {
					it = new cl(i, t.scale);
					isch = false;
				}
				replace ? ut.prepend(this.content, it.html) : ut.append(this.content, it.html)
				this.itemx[it.item.key] = it;
				cur++;
				if (this.mode === 'video' && !isch) it.repreview();
				replace ? this.shown.unshift(i.key) : this.shown.push(i.key);
				while (cur > lim) {
					let kill = this.shown.pop();
					if (this.itemx[kill]) {
						this.itemx[kill].clear();
						cur--;
					}
				}
			} else {
				let it = this.itemx[i.key];
				it.item = i;
			}
		}
		for (let i = this.response.length - 1; i >= 0; i--) {
			let e = this.response[i];
			if  (this.itemx[e.key]) this.response.splice(i,1);
		}
		let topMarker = null;
		let bottomMarker = null;
		let pr = '';
		Object.keys(this.itemx).forEach((k,n,a)=>{
			let i = this.itemx[k].item
			if (this.mode === this.itemx[k].type) {
				if (topMarker === null) {
					topMarker = this.mark(i);
				} else if (this.before(i,topMarker)) {
					topMarker = this.mark(i);
				}
				if (bottomMarker == null) {
					bottomMarker = this.mark(i);
				} else if (!this.before(i,bottomMarker)) {
					bottomMarker = this.mark(i);
				}
			}
			if (this.itemx[k].type === 'video') {
				let me = i.cid;
				let nx = n < (a.length-1) ? this.itemx[a[n+1]].item.cid : '';
				this.itemx[k].refresh(me === pr, me === nx);
				pr = me;
			} else {
				this.itemx[k].refresh();
			}
		});
		this.emit('shown',this.shown);
		if (this.filtered) {
			this.statusNav(`${this.page * plim + 1}-${this.page * plim + cur} of ${this.filtered} of ${this.statistics.totals[this.mode+'Total']}`)
		} else {
			this.statusNav(`no items of ${this.statistics.totals[this.mode+'Total']}`);
		}
		if (!this.filtered) {
			maxpage = this.page = 0;
		}
		this.statusMsg(`${this.markStr(topMarker)} - ${this.markStr(bottomMarker)}`);
		ut.removeAttr('.navbut','disabled');
		!this.page ? ut.attr('#homebut',{'disabled':'disabled'}) : ut.removeAttr('#homebut','disabled');
		!this.page ? ut.attr('#pgupbut',{'disabled':'disabled'}) : ut.removeAttr('#pgupbut','disabled');
		this.page === maxpage ? ut.attr('#endbut',{'disabled':'disabled'}) : ut.removeAttr('#endbut','disabled');
		this.page === maxpage ? ut.attr('#pgdnbut',{'disabled':'disabled'}) : replace ?
			ut.removeAttr('#endbut','disabled') : ut.attr('#pgdnbut',{'disabled':'disabled'});
		//this.linkReady();
	}

	// determine effective item sort method
	itemSortMethod(index = -1) {
		let c = (index >= 0) ? this.cfg.state[index] : this.subtype;
		let i = this.cfg[this.mode].sortList.findIndex( e => { return e.tag === c.sort; });
		if (i < 0) i = 0;
		let y = this.cfg[this.mode].sortList[i].sql;
		if ( c.dir === 'DESC' ) {
			y = y.replace(/\bDESC\b/g,'SUB').replace(/\bASC\b/g,'DESC').replace(/\bSUB\b/g,'ASC');
		}
		return y;
	}

	// determine effective item filter method
	itemFilterMethod(index = -1) {
		let c = (index >= 0) ? this.cfg.state[index] : this.subtype;
		let h = [];
		let x = [];
		const add = type => {
			let i = this.cfg[this.mode][`${type}List`].findIndex( e => { return e.tag === c[`${type}Filter`]; });
			if (i < 0) i = 0;
			let y = this.cfg[this.mode][`${type}List`][i].sql;
			(y.length && y.substring(0,7) === 'having.') ? h.push(y.substring(7)) : x.push(y);
		}
		if (c.statusFilter !== 'any') add('status');
		if (c.timeFilter && c.timeFilter !== 'any') add('time');
		if (c.viewFilter && c.viewFilter !== 'any') add('view');
		if (c.lengthFilter && c.lengthFilter !== 'any') add('length');
		if (c.textFilter.length) {
			let n = "''";
			if (['topic','search'].includes(this.mode)) n = "'name'";
			x.push(`hasText(${n},${this.mode}.data,'${c.textFilter}') = 1`);
		}
		return {
			clause: x.join(' AND '),
			having: h.join(' AND ')
		};
	}

	// generic data cell markup
	// content <string> html content
	// className <string> class name for cell
    // pcWidth <double> the width of the content as a percentage of total width
	cell(content, className, pcWidth) {
		let a = {
			'class': className,
		}
		if (pcWidth) a.style = ht.css({width:`${pcWidth}%`})
		return ht.div(
			a,
			content
		);
	}

	// generic left floating markup
	// content <string> html content
    // pcWidth <double> the width of the content as a percentage of total width
	lcell(content, pcWidth) {
		return this.cell(content, 'lcell', pcWidth);
	}

	// generic right floating markup
	// content <string> html content
    // pcWidth <double> the width of the content as a percentage of total width
	rcell(content, pcWidth) {
		return this.cell(content, 'rcell', pcWidth);
	}

	// generic button
	// action <string> action tage
    // hint <string> hint for user
	button(action, hint) {
		return ht.button(
			{
				onclick: ht.evt(`wapp.${action}`),
				title: `click to ${hint}`
			},
			ht.img(
				{
					src: imageRes[action],
					height: wapp.cfg.client.buttonHeight,
					width: wapp.cfg.client.buttonWidth
				}
			)
		)
	}

	// status message
	statusMsg(msg) {
		ut.html('#status_msg',msg);
	}

	// status list navigation message
	statusNav(msg) {
		ut.html('#status_nav',msg);
	}

	// status bandwidth message
	statusUpd(msg) {
		ut.html('#status_upd',msg);
	}

	// top level menu click - topic options
	topicClick() {
		if (!this.disabled) {
			this.resetMenu(0);
			this.mode = 'topic';
			ut.addClass('#topicmenu','selected');
			ut.html('#menu2',
				this.menu(['new','list','*status','*time'],2,'topic')
			);
			this.nextLevel('#menu2');
		}
	}

    // top level menu click - search options
	searchClick() {
		if (!this.disabled) {
			this.resetMenu(0);
			this.mode = 'search';
			ut.addClass('#searchmenu','selected');
			ut.html('#menu2',
				this.menu(['new','list','*status','*time'],2,'search')
			);
			this.nextLevel('#menu2');
		}
	}

	// top level menu click - channel options
	channelClick() {
		if (!this.disabled) {
			this.resetMenu(0);
			this.mode = 'channel';
			ut.addClass('#channelmenu','selected');
			ut.html('#menu2',
				this.menu(['*status','*time','*view'],2,'channel')
			);
			this.nextLevel('#menu2');
			this.channellistClick(this,0);
		}
	}

	// second level menu click - show channel list
	// app <object> web application
	// page <int> list page number
	// update <boolean> whether to update the channel list
	// next <boolesn> whether to move to the next channel in channel mode
	channellistClick(app = this.cfg.engine, page = this.page, update = true, next = false) {
		if (!this.disabled || this.list.chanMode) {
			this.resetMenu(1,page);
			this.itemControls();
			this.showing = 'channelList';
			this.list.tid = app.topicId;
			this.list.sid = app.searchId;
			this.list.cid = app.channelId;
			this.list.vstates = [];
			this.list.type = 'channel';
			this.refreshContent(true,update,page,next);
		}
	}

	// top level menu click - show video options and auto list
	videoClick() {
		if (!this.disabled) {
			this.resetMenu(0);
			this.mode = 'video';
			ut.addClass('#videomenu','selected');
			ut.html('#menu2',
				this.menu(['$state','*status','*time','*view','*length'],2,'video')
			);
			this.nextLevel('#menu2');
			this.videolistClick(this,0);
		}
	}

	// second level menu click - show video list
	// app <object> web application
	// page <int> list page number
	// update <boolean> whether to update the channel list
	// next <boolesn> whether to move to the next channel in channel mode
	videolistClick(app = this, page = this.page, update = true, next = false) {
		if (!this.disabled || this.list.chanMode) {
			this.resetMenu(1,page);
			this.itemControls();
			this.submode = 'list';
			this.showing = 'videoList';
			this.list.tid = app.topicId;
			this.list.sid = app.searchId;
			this.list.cid = app.channelId;
			this.list.vstates = this.cfg.state[this.stateIndex].videoStates;
			this.list.type = 'video';
			this.refreshContent(true,update,page,next);
		}
	}

	// top level menu click - application options
	appClick() {
		if (!this.disabled) {
			this.resetMenu(0);
			this.mode = 'app';
			ut.addClass('#appmenu','selected');
			ut.html('#menu2',
				this.menu(['reload','stats','help','about','stop'],2,'app')
			);
			this.nextLevel('#menu2');
		}
	}

	// show sort control
	itemSort() {
		return ht.select(
			{
				id: 'item_sort',
				onchange: ht.cmd('wapp.setItemControls',true,true),
				title: 'sort items in specific order.'
			},
			ht.forEach(
				this.cfg[this.mode].sortList,
				e => {
					let g = {value:e.tag};
					if (e.tag == this.subtype.sort) g.selected = 'selected';
					return ht.option(g,e.tag);
				}
			)
		);
	}

	// show display control
	itemDisplay() {
		return ht.select(
			{
				id: 'item_display',
				onchange: ht.cmd('wapp.setItemControls',true,false),
				title: 'Specify the maximum number of items to display'
			},
			ht.forEach(
				this.cfg.client.displayOptions,
				(e,i,a) => {
					let g = {value:e.toString()};
					if (e == this.subtype.display) g.selected = 'selected';
					return ht.option(
						g,
						ht.ifElse(
							e,
							e.toString(),
							'auto'
						)
					);
				}
			)
		);
	}

	// show preview control
	itemPreview() {
		return ht.select(
			{
				id: 'item_preview',
				onchange: ht.cmd('wapp.setItemPreview'),
				title: 'Specify the type of previews to display'
			},
			ht.forEach(
				this.previewTypes,
				(e,i,a) => {
					let g = {value:e.toString()};
					if (e === this.subtype.preview) g.selected = 'selected';
					return ht.option(
						g,
						e
					);
				}
			)
		);
	}

	// show bulk action control
	itemAction() {
		return ht.select(
			{
				id: 'item_action',
				onchange: ht.evt('wapp.actionall'),
				title: 'select an action to perform on all displayed items'
			},
			ht.forEach(
				this.subtype.allActions,
				e => {
					let g = {value:e};
					if (e === this.subtype.allAction) g.selected = 'selected';
					return ht.option(g,e);
				}
			)
		);
	}

	// turn text edit on/off
	// on <boolean> text editing on = true, off = false
	editText(on) {
		this.editing = on;
	}

	// second level menu click - new topic launcher
	topicnewClick() {
		if (!this.disabled) {
			this.resetMenu(1);
			this.submode = 'new';
			ut.addClass('#newmenu','selected');
			ut.html('#launch',
				ht.div(
					{
						id: 'launchdiv'
					},
					ht.table(
						ht.tbody(
							ht.tr(
								ht.td(
									ht.label(
										{
											style: ht.css(
												{
													'padding-left':'2px'
												}
											)
										},
										' topic:'
									)
								),
								ht.td(
									ht.input(
										{
											id: 'topic_input',
											type: 'text',
											size: this.cfg.topic.maxNameLength,
											placeholder: `topic name (${this.cfg.topic.
												minNameLength}-${this.cfg.topic.maxNameLength})`,
											onfocus: ht.cmd('wapp.editText',true),
											onblur: ht.cmd('wapp.editText',false)
										}
									)
								),
								ht.td(
									ht.button(
										{
											id: 'topic_button',
											onclick: ht.cmd('wapp.acceptTopic'),
											title: 'create new topic'
										},
										ht.img(
											{
												src: imageRes.ok,
												width: this.cfg.client.buttonWidth,
												height: this.cfg.client.buttonHeight,
											}
										)
									)
								)
							)
						)
					)
				)
			);
			this.nextLevel('#launch');
		}
	}

	// accept (or reject) new topic
	acceptTopic() {
		let name = ut.val('#topic_input');
		if ((name.length >= this.cfg.topic.minNameLength) && (name.length <= this.cfg.topic.maxNameLength)) {
			let exists = this.topiclist.findIndex( e => e.name === name);
			if (exists < 0) {
				this.emit('create',{
					type: 'topic',
					name: name,
					cb: 'topicAdded'
				});
				ut.val('#topic_input','');
			}
		}
	}

	// server response to a new topic
	// data <object> not used
	topicAdded(data) {
		this.emit('topicmenu', {cb:'topicmenu'});
	}

	// second level menu click - show topic list
	topiclistClick() {
		if (!this.disabled) {
			this.resetMenu(1);
			this.submode = 'list';
			ut.addClass('#listmenu','selected');
			this.itemControls();
			this.showing = 'topicList';
			this.list.vstates = [];
			this.list.tid = 0;
			this.list.type = 'topic';
			this.refreshContent(true,true,0);
		}
	}

	// second level menu click - list filter selected
	// type <string> mode type
	// ftype <string> filter type
	filterClick(type,ftype) {
		if (!this.disabled) {
			let filter = ut.val(`#${type}${ftype}select`);
			if (this.subtype[`${ftype}Filter`] !== filter) {
				this.subtype[`${ftype}Filter`] = filter;
				this.updcfg();
				this.refreshContent(true,true,0);
			}
		}
	}

	// second level menu click - new search launcher
	searchnewClick() { //launch a new search
		if (!this.disabled && this.topicId) {
			this.resetMenu(1);
			this.submode ='new';
			ut.addClass('#new','selected');
			ut.html('#launch',
				ht.div(
					{
						id: 'launchdiv'
					},
					ht.table(
						ht.tbody(
							ht.tr(
								ht.td(
									ht.label(
										{
											style: ht.css(
												{
													'padding-left':'2px'
												}
											)
										},
										'name:'
									)
								),
								ht.td(
									ht.input(
										{
											id:'search_name_input',
											type:'text',
											size: this.cfg.search.maxNameLength,
											placeholder:`search name (${this.cfg.topic.
												minNameLength}-${this.cfg.topic.maxNameLength})`,
											onfocus: ht.cmd('wapp.editText',true),
											onblur: ht.cmd('wapp.editText',false)
										}
									)
								),
								ht.td(
									'query:'
								),
								ht.td(
									ht.input(
										{
											id:'search_query_input',
											type:'text',
											size: this.cfg.search.queryInputLength,
											placeholder:'enter search term',
											onfocus: ht.cmd('wapp.editText',true),
											onblur: ht.cmd('wapp.editText',false)
										}
									)
								),
								ht.td(
									'channel level:'
								),
								ht.td(
									ht.select(
										{
											id: 'search_channel_level',
											// onchange: ht.cmd('wapp.setSearchAuto'),
											title: 'Specify the default level for new channels found by this church'
										},
										ht.forEach(
											this.cfg.channel.levels,
											(e, i, a) => {
												let o = { value: i};
												if (e === this.cfg.search.defaultChannelLevel) o.selected = 'selected';
												return ht.option(
													o,
													e
												);
											}
										)
									)
								),
								ht.td(
									ht.button(
										{
											onclick: ht.cmd('wapp.acceptSearch',true),
											title: 'create new search'
										},
										ht.img(
											{
												src: imageRes.ok,
												width: this.cfg.client.buttonWidth,
												height: this.cfg.client.buttonHeight,
											}
										)
									)
								)
							)
						)
					)
				)
			);
			this.nextLevel('#launch');
		} else {
			alert('Select a topic first');
		}
	}

	// accept (or reject) new search
	acceptSearch() {
		if (this.topicId) {
				let name = ut.val('#search_name_input');
				let level = parseInt(ut.val('#search_channel_level'));
				if ((name.length>=this.cfg.search.minNameLength) && (name.length<=this.cfg.search.maxNameLength)) {
					let exists = this.searchlist.findIndex( e => e.name === name);
					if (exists < 0) {
						let query = ut.val('#search_query_input');
						if (query.length) {
							this.emit('create',{
								type: 'search',
								tid: this.topicId,
								name: name,
								query: query,
								level: level,
								cb: 'searchAdded'
							});
							ut.val('#search_name_input','');
							ut.val('#search_query_input','');
						}
					}
				}
		} else {
			alert('Select a topic first');
		}
	}

	// server response to a new search
	// data <object> not used
	searchAdded(data) {
		this.emit('searchmenu', {
			tid: this.topicId,
			cb:'searchmenu'
		});
	}

	// second level menu click - show topic list
	searchlistClick() {
		if (!this.disabled) {
			this.resetMenu(1);
			this.submode = 'list';
			ut.addClass('#listmenu','selected');
			this.itemControls();
			this.showing = 'searchList';
			this.list.tid = this.topicId;
			this.list.vstates = [];
			this.list.sid = 0;
			this.list.type = 'search';
			this.refreshContent(true,true,0);
		}
	}

	// second level menu click - change video state
	videostateClick() {
		if (!this.disabled) {
			let state = ut.val('#videostateselect');
			if (this.state !== state) {
				this.state = state;
				ut.val('#videostatusselect',this.subtype.statusFilter);
				ut.val('#videotimeselect',this.subtype.timeFilter);
				ut.val('#videolengthselect',this.subtype.lengthFilter);
				ut.val('#videoviewselect',this.subtype.viewFilter);
				//this.updcfg();
				this.videolistClick(this,0);
			}
		}
	}

	// server response to reloaded cfg
	// data <object> configuration data
	reloadcfg(data) {
		this.cfg = data.cfg;
	}

	// second level menu click - reload configuration - allows some changes to index.yaml to become effective
	appreloadClick() {
		if (!this.disabled) {
			this.emit('reload',{cb:'reloadcfg'});
			this.resetMenu(1);
			this.submode = 'reload';
			ut.addClass('#reloadmenu','selected');
			ut.html(this.content,
				ht.p(
					{
						style:ht.css(
							{
								'color':'white'
							}
						)
					},
					ht.concat(
						'index.yaml configuration file has been reloaded. ',
						'Not all changes to index.yaml will be immediately effective. ',
						'Some changes may require restarting the server.'
					)
				)
			);
		}
	}

	// second level menu click - show application stats
	appstatsClick() {
		if (!this.disabled) {
			this.resetMenu(1);
			this.submode = 'stats';
			ut.addClass('#statsmenu','selected');
			let c = [];
			let v = [];
			this.cfg.channel.levels.forEach(level => {
				let curr = {
					level: level,
					count: 0
				};
				this.statistics.channels.forEach(row => {
					if (row.level === this.cfg.advanced[level+'Level']) {
						curr.count = row.channelCount;
					}
				});
				c.push(curr);
			});
			this.cfg.video.states.forEach(state => {
				let curr = {
					state: state,
					count: 0
				};
				this.statistics.videos.forEach(row => {
					if (row.state === state) {
						curr.count = row.videoCount;
					}
				});
				v.push(curr);
			});
			ut.html(this.content,
				ht.p(
					{
						style:ht.css(
							{
								'color':'white'
							}
						)
					},
					ht.table(
						{class:'statisticstable'},
						ht.tbody(
							ht.tr(
								{class:'statisticsrow'},
								ht.td(
									{align:'left'},
									'topics'
								),
								ht.td(),
								ht.td(
									{align:'right'},
									this.statistics.totals['topicTotal']
								)
							),
							ht.tr(
								{class:'statisticsrow'},
								ht.td(
									{align:'left'},
									'searches'
								),
								ht.td(),
								ht.td(
									{align:'right'},
									this.statistics.totals['searchTotal']

								)
							),
							ht.tr(
								{class:'statisticsrow'},
								ht.td(
									{align:'left'},
									'channels'
								),
								ht.td(),
								ht.td(
									{align:'right'},
									this.statistics.totals['channelTotal']
								)
							),
							ht.forEach(
								c,
								e => {
									return ht.tr(
										{class:'substatsrow'},
										ht.td(
											{align:'left'},
											' - '+e.level
										),
										ht.td(
											{align:'right'},
											e.count
										),
										ht.td()
									)
								}
							),
							ht.tr(
								{class:'statisticsrow'},
								ht.td(
									{align:'left'},
									'videos'
								),
								ht.td(),
								ht.td(
									{align:'right'},
									this.statistics.totals['videoTotal']
								)
							),
							ht.forEach(
								v,
								e => {
									return ht.tr(
										{class:'substatsrow'},
										ht.td(
											{align:'left'},
											' - '+e.state
										),
										ht.td(
											{align:'right'},
											e.count
										),
										ht.td()
									)
								}
							)
						)
					)
				)
			);
		}
	}

	// second level menu click - show application help (hyper lisk to project wiki)
	apphelpClick() {
		if (!this.disabled) {
			this.resetMenu(1);
			this.submode = 'help';
			ut.addClass('#helpmenu','selected');
			ut.html(this.content,
				ht.p(
					{
						style:ht.css(
							{
								'color':'white'
							}
						)
					},
					'some help documentation will go here.'
				)
			);
		}
	}

	// second level menu click - show info about app
	appaboutClick() {
		if (!this.disabled) {
			this.resetMenu(1);
			this.submode = 'about';
			ut.addClass('#aboutmenu','selected');
			ut.html(this.content,
				ht.p(
					{
						style:ht.css(
							{
								'color':'white'
							}
						)
					},
					'some development info will go here.'
				)
			);
		}
	}

	// second level menu click - stop the server
	appstopClick() {
		if (!this.disabled) {
			this.resetMenu(1);
			this.submode = 'stop';
			ut.addClass('#stopmenu','selected');
			ut.html(this.content,
				ht.p(
					{
						style:ht.css(
							{
								'color':'white'
							}
						)
					},
					'the application server will be stopped when you close this tab.'
				)
			);
			this.emit('stop',{});
		}

	}

	// show text filter
	itemTextFilter() {
		let v = this.subtype.textFilter;
		if (!v) v = '';
		return ht.input(
			{
				id: 'item_text_filter',
				type: 'text',
				value: v,
				size: this.cfg.client.textInputLength,
				onfocus: ht.cmd('wapp.editText',true),
				onblur: ht.cmd('wapp.editText',false),
				title: 'enter item text filter'
			}
		);
	}

	// respond to list controls
	// refresh <boolean> whether to redisplay
	// update <boolean> whether to update the list
	setItemControls(refresh, update) {
		let x = this.subtype;
		x.display = ut.val('#item_display');
		x.sort = ut.val('#item_sort');
		if (ut.exists('#item_text_filter')) x.textFilter = ut.val('#item_text_filter');
		this.updcfg();
		this.refreshContent(refresh, update, update ? 0 : this.page);
	}

	// repond to preview type change
	setItemPreview() {
		let x = this.subtype;
		let y = ut.val('#item_preview');
		if (x.preview !== y) {
			x.preview = y;
			Object.keys(this.itemx).forEach( k => {
				this.itemx[k].previewType = y;
				this.itemx[k].redisplay(true);
			});
		}
	}

	// show list controls
	itemControlRow() {
		let x = this.subtype;
		return ht.concat(
			this.lcell(this.itemDisplay(),this.cfg.client.displayField),
			this.lcell(this.itemSort(),this.cfg.client.sortField),
			ht.div(
				{
					id: 'ascdesc',
					'class': 'lcell'
				},
				ht.ifElse(
					x.dir === 'ASC',
					this.button('asc','sort in descending (z-a) order - currently in ascending (a-z) order'),
					this.button('desc','sort in ascending (a-z) order - currently in decending (z-a) order')
				)
			),
			this.lcell('text filter: ',this.cfg.client.textLabel),
			this.lcell(this.itemTextFilter()),
			this.lcell(this.button('resort','resort/refilter displayed items'),this.cfg.client.resortField),
			this.lcell(this.autoButton(),this.cfg.client.autoField),
			this.rcell(
				ht.button(
					{
						onclick: ht.cmd('wapp.pageDown'),
						'class': 'navbut',
						id: 'pgdnbut',
						title: 'click to view next page (or use your page down key)'
					},
					ht.img(
						{
							src: imageRes.pgdn,
						}
					)
				)
				,this.cfg.client.navField
			),
			this.rcell(
				ht.button(
					{
						onclick: ht.cmd('wapp.pageUp'),
						'class': 'navbut',
						id: 'pgupbut',
						title: 'click to view previous page (or use your page up key)'
					},
					ht.img(
						{
							src: imageRes.pgup,
						}
					)
				),
				this.cfg.client.navField
			),
			this.rcell(
				ht.button(
					{
						onclick: ht.cmd('wapp.end'),
						'class': 'navbut',
						id: 'endbut',
						title: 'click to view last page (or use your end key)'
					},
					ht.img(
						{
							src: imageRes.end,

						}
					)
				),
				this.cfg.client.navField
			),
			this.rcell(
				ht.button(
					{
						onclick: ht.cmd('wapp.home'),
						'class': 'navbut',
						id: 'homebut',
						title: 'click to view first page (or use your home key)'
					},
					ht.img(
						{
							src: imageRes.home,

						}
					)
				),
				this.cfg.client.navHomeField
			),
			ht.ifElse(
				this.undoData.length,
				this.rcell(this.button('undo',`undo your last discard/level action`),this.cfg.client.undoField),
			),
			this.rcell(this.button('actionall',`perform chosen action (${x.allAction}) on all displayed items`),this.cfg.client.actionField),
			this.rcell(this.itemAction(),this.cfg.client.actionOptionField),
			this.rcell(this.button('scaledown','scale down item box sizes'),this.cfg.client.scaleDownField),
			this.rcell(this.button('scaleup','scale up item box sizes'),this.cfg.client.scaleUpField),
			ht.ifElse(
				this.mode === 'video',
				this.rcell(this.itemPreview(),this.cfg.client.previewField)
			)
		);
	}

	// show auto load button
	autoButton() {
		let t = this.subtype;
		return ht.button(
			{
				id: 'autobut',
				onclick: ht.evt('wapp.toggleAuto'),
				title: `click to turn automatic display updates ${t.autoLoad ? 'off' : 'on'}`
			},
			ht.img(
				{
					id: 'autoimg',
					src: imageRes[t.autoLoad ? 'automatic' : 'manual'],
					height: this.cfg.client.buttonHeight,
					width: this.cfg.client.buttonWidth
				}
			)
		);
	}

	// toggle auto load
	toggleAuto() {
		let t = this.subtype;
		t.autoLoad = !t.autoLoad;
		this.updcfg();
		ut.attr('#autobut',{title: `click to turn automatic updating ${t.autoLoad ? 'off' : 'on'}`});
		ut.attr('#autoimg',{src: imageRes[t.autoLoad ? 'automatic' : 'manual']});
	}

	// show item control section
	itemControls() {
		ut.html('#controls',
			ht.div(
				{
					id: 'controldiv'
				},
				this.itemControlRow()
			)
		);
		this.nextLevel('#controls');
	}

	// clear all videos of a channel
	// cid <int> channel id
	clearChannel(cid) {
		let keys = Object.keys(this.itemx);
		for (let i = keys.length-1; i>=0; i--) {
			let v = this.itemx[keys[i]];
			if ((v.item.cid && v.item.cid === cid) || (v.type === 'channel' && v.item.id === cid )) {
				this.dcbAdd(v.item.key);
				v.clear();
			}
		}
	}

	// cancel a download
	// event <object> mouse event
	// key <string> item key
	cancel(event,key) {
		this.emit('cancel',{
			id: this.itemx[key].item.id
		});
		event.stopPropagation();
	}

	// show preview of type or toggle to previous type
	// event <object> mouse event
	// key <string> item key
	// type <string> preview type
	// active <boolean> whether choice is active (reverts to previous)
	showPreview(event,key,type,active = false) {
		let x = this.itemx[key];
		if (active) {
			x.showPreview = x.previewType = x.prevPreview;
		} else {
			x.prevPreview = x.previewType;
			x.showPreview = x.previewType = type;
		}
		x.redisplay(true);
		event.stopPropagation();
	}

	// show info preview
	// event <object> mouse event
	// key <string> item key
	// active <boolean> whether choice is active (reverts to previous)
	showinfo(event,key,active = false) {
		this.showPreview(event,key,'info',active);
	}

	// show image preview
	// event <object> mouse event
	// key <string> item key
	// active <boolean> whether choice is active (reverts to previous)
	showimage(event,key,active = false) {
		this.showPreview(event,key,'images',active);
	}

	// play storyboard preview
	// event <object> mouse event
	// key <string> item key
	// active <boolean> whether choice is active (reverts to previous)
	playstory(event,key,active = false) {
		this.showPreview(event,key,'storyboards',active);
	}

	// play video preview
	// event <object> mouse event
	// key <string> item key
	// active <boolean> whether choice is active (reverts to previous)
	playvideo(event,key,active = false) {
		this.showPreview(event,key,'videos',active);
	}

	// undo last discard/block/level change action
	// event <object> mouse event
	undo(event) {
		this.undoData.forEach( (e) => {
			this.emit('undo', {
				type: e.type,
				item: e.item
			});
			this.dcbRemove(e.item.key);
		});
		this.undoData = [];
		this.refreshContent(true,true);
		event.stopPropagation();
	}

	// discard a single item
	// event <object> mouse event
	// key <string> item key
	discard(event, key) {
		let x = this.itemx[key];
		let t = x.type;
		let st = this.subtype;
		let isch = false;
		let cl = this.itemObject;
		this.undoData = [{
			type: t,
			item: structuredClone(x.item),
		}];
		this.emit('delete',{
			type: t,
			ids : [x.item.id]
		});
		if (this.mode === 'video' && this.cfg.state[this.stateIndex].videoStates.includes('discarded')) {
			x.item.state = 'discarded';
			x.redisplay(true);
		} else {
			x.clear();
			this.dcbAdd(key);
			let looking = this.nextResponse.length;
			while (looking) {
				let i = this.nextResponse.shift();
				if (!this.itemx[i.key]) {
					let it;
					if (i.type === 'channel' && st !=='channel') {
						it = new Channel(i, st.scale);
						isch = true;
					} else {
						it = new cl(i, st.scale);
						isch = false;
					}
					ut.append(this.content, it.html)
					this.itemx[it.item.key] = it;
					if (this.mode === 'video' && !isch) it.repreview();
					looking = false;
				} else {
					looking = this.nextResponse.length;
				}
			}
			this.refreshContent(false,false);
		}
		event.stopPropagation();
	}

	// discard all visible items
	// event <object> mouse event
	discardAll(event) {
		let ids = [];
		Object.keys(this.itemx).forEach( k => {
			let it = this.itemx[k];
			if (it.type !== 'video' || it.can('discard')) ids.push(it.item.id);
		});
		this.undoData = [];
		if (this.list.chanMode && ids.length) ids.shift();
		if (ids.length) {
			this.emit('delete',
				{
					type: this.mode,
					ids: ids
				}
			);
			ids.forEach((i)=>{
				let x = this.itemx[`${this.mode}_${i}`];
				if (this.mode !== 'video' || this.cfg.state[this.stateIndex].videoStates.includes('discarded')) {
					this.type === 'video' ? x.reoption() : x.redisplay(true);
				} else {
					x.clear();
					this.dcbAdd(x.item.key);
				}
				this.undoData.push({
					type: x.type,
					item: structuredClone(x.item),
				});
			});
			this.refreshContent(true,false);
		}
		event.stopPropagation();
	}

	// apply bulk action
	// event <object> mouse event
	actionall(event) {
		let action = ut.val('#item_action');
		this.subtype.allAction = action;
		let act = '';
		if (['search','scan','update'].includes(action)) act = 'discarded';
		if (action === 'follow') act = 'queue';
		action === 'none' ? event.stopPropagation() : this[action+'All'](event, act);
	}

    //change channel level of key to lev. del to delete entry or remove only if statusFilter is in [rem]
	// event <object> mouse event
	// key <string> item key
	// lev <int> chosen channel level
	// del <boolean> whether affected items should be deleted from display
	// rem <string array> status list of items that should be removed from display
	level(event,key,lev,del,rem,act = 0) {
		let x = this.itemx[key];
		let cid = x.type === 'channel' ? x.item.id : x.item.cid;
		this.undoData = [];
		this.emit('level',{	cids: [cid], level: lev });
		if (act === 1) this.emit('discardchanvids',{cid: cid});
		if (act === 2) this.emit('downloadchanvids',{cid: cid});
		if (act === 3) {
			this.emit('downloadchanvids',{cid: cid});
			this.emit('queuechanvids',{cid: cid});
		}
		Object.keys(this.itemx).forEach( k => {
			let v = this.itemx[k];
			if (v.type === 'video' && v.item.cid === cid) {
				v.item.channel.level = lev;
				v.reoption();
			}
			this.undoData.push({
				type: x.type,
				item: structuredClone(x.item),
			});
		})
		if (del || rem.includes(this.subtype.statusFilter)) {
			this.dcbAdd(`channel_${cid}`);
			this.clearChannel(cid);
			this.list.chanMode ? this.unchan(event,key) : this.refreshContent(false,false);
		}
		event.stopPropagation();
	}

	//change channel level of all to lev. del to delete entries or remove only if statusFilter is in [rem]
	// event <object> mouse event
	// lev <int> chosen channel level
	// del <boolean> whether affected items should be deleted from display
	// rem <string array> status list of items that should be removed from display
	// act <string> new state for items (optional)
	levelAll(event,lev,del,rem,act = '') {
		let cids = [];
		this.undoData = [];
		Object.keys(this.itemx).forEach( k => {
			let x = this.itemx[k];
			let cid = x.type === 'channel' ? x.item.id : x.item.cid;
			this.undoData.push({
				type: x.type,
				item: structuredClone(x.item),
			});
			if (!cids.includes(cid)) cids.push(cid);
			if (x.type === 'video' && x.item.channel === cid) {
				x.item.clevel = lev;
				if (act.length && x.can(act)) x.state = act;
			}
			if (del || rem.includes(this.subtype.statusFilter)) {
				x.clear();
				this.dcbAdd(x.item.key);
			} else {
				x.reoption();
			}
		});
		this.emit('level',{
			cids: cids,
			level: lev
		});
		this.refreshContent(true,true);
		event.stopPropagation();
	}

	// block a channel
	// event <object> mouse event
	// key <string> item key
	block(event,key) {
		this.level(
			event,
			key,
			this.cfg.advanced.blockLevel,
			!this.subtype.videoStates.includes('discarded'),
			['not blocked','searched','searched+','scanned','scanned+','updated','updated+','liked','liked+','followed']
		);
	}

	// block all visible channels
	// event <object> mouse event
	// act <string> new state for items (optional)
	blockAll(event, act = '') {
		this.levelAll(
			event,
			this.cfg.advanced.blockLevel,
			!this.subtype.videoStates.includes('discarded'),
			['not blocked','searched','searched+','scanned','scanned+','updated','updated+','liked','liked+','followed'],
			act
		);
	}

	// block channel while in channel mode
	// event <object> mouse event
	// key <string> item key
	cblock(event,key,next) {
		this.block(event,key);
		this.unchan(event,key,next);
		event.stopPropagation();
	}

	// set channel to search level
	// event <object> mouse event
	// key <string> item key
	search(event,key) {
		let act = 0;
		if (this.ctrlPressed) act = 1;
		this.level(
			event,
			key,
			this.cfg.advanced.searchLevel,
			this.ctrlPressed,
			['blocked','not searched','scanned','scanned+','updated','updated+','liked','liked+','followed'],
			act
		);
	}

	// set all visible channels to search level
	// act <string> new state for items (optional)
	searchAll(event,act = '') {
		this.levelAll(
			event,
			this.cfg.advanced.searchLevel,
			false,
			['blocked','not searched','scanned','scanned+','updated','updated+','liked','liked+','followed'],
			act
		);
	}

	// set channel to search level while in channel mode - discards current videos
	// event <object> mouse event
	// key <string> item key
	// next <boolean> whether to move to next channel
	csearch(event,key,next) {
		let cid = this.itemx[key].item.id;
		this.emit('level',{cids:[cid], level: this.cfg.advanced.searchLevel});
		this.emit('discardchanvids',{cid: cid});
		this.unchan(event,key,next);
		event.stopPropagation();
	}

	// set channel to scan level
	// event <object> mouse event
	// key <string> item key
	scan(event,key) {
		let act = 0;
		if (this.ctrlPressed) act = 1;
		this.level(
			event,
			key,
			this.cfg.advanced.scanLevel,
			this.ctrlPressed,
			['blocked','searched','searched-','not scanned','updated','updated+','liked','liked+','followed'],
			act
		);
	}

	// set all visible channels to scan level
	// event <object> mouse event
	// act <string> new state for items (optional)
	scanAll(event,act = '') {
		this.levelAll(
			event,
			this.cfg.advanced.scanLevel,
			false,
			['blocked','searched','searched-','not scanned','updated','updated+','liked','liked+','followed'],
			act
		);
	}

	// set channel to scan level while in channel mode - discards current videos
	// event <object> mouse event
	// key <string> item key
	// next <boolean> whether to move to next channel
	cscan(event,key,next) {
		let cid = this.itemx[key].item.id;
		this.emit('level',{cids:[cid], level: this.cfg.advanced.scanLevel});
		this.emit('discardchanvids',{cid: cid});
		this.unchan(event,key,next);
		event.stopPropagation();
	}

	// set channel to update level
	// event <object> mouse event
	// key <string> item key
	update(event,key) {
		let act = 0;
		if (this.ctrlPressed) act = 1;
		this.level(
			event,
			key,
			this.cfg.advanced.updateLevel,
			this.ctrlPressed,
			['blocked','searched','searched-','scanned','scanned-','not updated','liked','liked+','followed'],
			act
		);
	}

	// set all visible channels to update level
	// event <object> mouse event
	// act <string> new state for items (optional)
	updateAll(event,act = '') {
		this.levelAll(
			event,
			this.cfg.advanced.updateLevel,
			false,
			['blocked','searched','searched-','scanned','scanned-','not updated','liked','liked+','followed'],
			act
		);
	}

	// set channel to update level while in channel mode - discards current videos
	// event <object> mouse event
	// key <string> item key
	// next <boolean> whether to move to next channel
	cupdate(event,key,next) {
		let cid = this.itemx[key].item.id;
		this.emit('level',{cids:[cid], level: this.cfg.advanced.updateLevel});
		this.emit('discardchanvids',{cid: cid});
		this.unchan(event,key,next);
		event.stopPropagation();
	}

	// set channel to like level
	// event <object> mouse event
	// key <string> item key
	like(event,key) {
		let act = 0;
		if (this.ctrlPressed) act = 2;
		this.level(
			event,
			key,
			this.cfg.advanced.likeLevel,
			false,
			['blocked','searched','searched-','scanned','scanned-','updated','updated-','not liked','followed'],
			act
		);
	}

	// set all visible channels to like level
	// event <object> mouse event
	// act <string> new state for items (optional)
	likeAll(event,act = '') {
		this.levelAll(
			event,
			this.cfg.advanced.likeLevel,
			false,
			['blocked','searched','searched-','scanned','scanned-','updated','updated-','not liked','followed'],
			act
		);
	}

	// set channel to like level while in channel mode - keeps current videos
	// event <object> mouse event
	// key <string> item key
	// next <boolean> whether to move to next channel
	clike(event,key,next) {
		let cid = this.itemx[key].item.id;
		this.emit('level',{cids:[cid], level: this.cfg.advanced.likeLevel});
		this.emit('downloadchanvids',{cid: cid});
		if (this.subtype.videoStates.includes('download')) this.dcbAdd(`channel_${cid}`);
		this.unchan(event,key,next);
		event.stopPropagation();
	}

	// follow channel
	// event <object> mouse event
	// key <string> item key
	follow(event,key) {
		let act = 0;
		if (this.ctrlPressed) act = 3;
		if (this.ctrlPressed) {
			let cid = this.itemx[key].item.id;
			this.emit('downloadchanvids',{cid: cid});
		}
		this.level(
			event,
			key,
			this.cfg.advanced.followLevel,
			false,
			['blocked','searched','searched-','scanned','scanned-','updated','updated-','liked','liked-','not followed']
		);
	}

	// follow all visible channels
	// event <object> mouse event
	// act <string> new state for items (optional)
	followAll(event, act) {
		this.levelAll(
			event,
			this.cfg.advanced.followLevel,
			false,
			['blocked','searched','searched-','scanned','scanned-','updated','updated-','liked','liked-','not followed'],
			act
		);
	}

	// set channel to follow level while in channel mode - queues current videos
	// event <object> mouse event
	// key <string> item key
	// next <boolean> whether to move to next channel
	cfollow(event,key,next) {
		let cid = this.itemx[key].item.id;
		this.emit('level',{cids:[cid],level: this.cfg.advanced.followLevel})
		this.emit('queuechanvids',{cid: cid});
		if (!this.subtype.videoStates.includes('queue')) this.dcbAdd(`channel_${cid}`);
		this.emit('downloadchanvids',{cid: cid});
		if (this.subtype.videoStates.includes('download')) this.dcbAdd(`channel_${cid}`);
		this.unchan(event,key,next);
		event.stopPropagation();
	}

	// refresh data for all visible items
	// event <object> mouse event
	refreshAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('refresh')) this.refresh(event,k);
		});
		event.stopPropagation();
	}

	// queue video
	// event <object> mouse event
	// key <string> item key
	// all <boolean> whether all displayed items are being queued
	queue(event,key,all=false) {
		let x = this.itemx[key];
		let st = this.subtype;
		let cl = this.itemObject;
		if (x.type === 'video') {
			if (!all) this.undoData = [{
				type: x.type,
				item: structuredClone(x.item)
			}];
			x.state = 'queue';
			if (all || this.cfg.state[this.stateIndex].videoStates.includes('queue')) {
				x.redisplay(true);
			} else {
				x.clear();
				this.dcbAdd(key);
				let looking = this.nextResponse.length;
				while (looking) {
					let i = this.nextResponse.shift();
					if (!this.itemx[i.key]) {
						let it = new cl(i, st.scale);
						ut.append(this.content, it.html)
						this.itemx[it.item.key] = it;
						it.repreview();
						looking = false;
					} else {
						looking = this.nextResponse.length;
					}
				}
				this.refreshContent(false,false);
			}
		}
		event.stopPropagation();
	}

	// queue all visible vidoes
	// event <object> mouse event
	queueAll(event) {
		this.undoData = [];
		Object.keys(this.itemx).forEach(k => {
			let it = this.itemx[k];
			if (it.can('queue')) {
				this.undoData.push({
					type: 'video',
					item: structuredClone(it.item),
				});
				this.queue(event,k,true);
			}
		});
		this.refreshContent(false,false);
		event.stopPropagation();
	}

	// unqueue video
	// event <object> mouse event
	// key <string> item key
	// all <boolean> whether all displayed items are being unqueued
	unqueue(event,key,all) {
		let x = this.itemx[key];
		if (x.type === 'video') {
			if (!all) this.undoData = [{
				type: x.type,
				item: structuredClone(x.item),
			}];
			x.state = 'noupdate';
			if (all || this.cfg.state[this.stateIndex].videoStates.includes('noupdate')) {
				x.redisplay(true);
			} else {
				x.clear();
				this.dcbAdd(key);
				this.refreshContent(false,false);
			}
		}
		event.stopPropagation();
	}

	// unqueue all visible videos
	// event <object> mouse event
	unqueueAll(event) {
		this.undoData = [];
		Object.keys(this.itemx).forEach(k => {
			let it = this.itemx[k];
			if (it.can('unqueue')) {
				this.undoData.push({
					type: 'video',
					item: structuredClone(it.item),
				});
				this.unqueue(event,k,true);
			}
		});
		this.refreshContent(false,false);
		event.stopPropagation();
	}

	// download a video
	// event <object> mouse event
	// key <string> item key
	download(event,key) {
		let v = this.itemx[key];
		if (v.type === 'video') {
			v.state = 'download..';
			this.emit('download', {
				id: v.item.id
			});
			v.reoption();
		}
		event.stopPropagation();
	}

	// download all visible videos
	// event <object> mouse event
	downloadAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('download')) this.download(event,k);
		});
		event.stopPropagation();
	}

	// erase a download
	// event <object> mouse event
	// key <string> item key
	erase(event,key) {
		this.emit('delvid',{
			id: this.itemx[key].item.id
		});
		event.stopPropagation();
	}

	// erase all visible downloads
	// event <object> mouse event
	eraseAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('erase')) this.erase(event,k);
		});
		event.stopPropagation();
	}

	// rotate a preview
	// event <object> mouse event
	// key <string> item key
	rotate(event,key) {
		if (this.itemx[key].type === 'video') this.itemx[key].rotate();
		event.stopPropagation();
	}

	// rotate all visible previews
	// event <object> mouse event
	rotateAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('rotate')) this.rotate(event,k)
		});
		event.stopPropagation();
	}

	// entry into channel mode
	// event <object> mouse event
	// key <string> item key
	// next <boolean> whether to move to next channel
	chan(event, key, next = false) {
		if (!this.list.chanMode || next) {
			let x;
			if (next) {
				x = this.chanList.shift();
			} else {
				this.chanList = [];
				Object.keys(this.itemx).forEach((k)=>{
					let add = true;
					if (this.itemx[k].type === 'channel') {
						if (k === key) add = false;
						if (this.chanList.findIndex(e => { return k === e.item.key;}) >= 0) add = false;
					} else {
						if (this.itemx[k].item.cid === this.itemx[key].item.cid) add = false;
						if (this.chanList.findIndex(e => { return this.itemx[k].item.cid === e.item.cid;}) >= 0) add = false;
					}
					if (add) this.chanList.push(this.itemx[k]);
				});
				this.disabled = true;
				this.restoreMode = this.mode;
				this.restorePage = this.page;
				this.restoreState = this.state;
				this.list.chanMode = true;
				this.mode = 'video';
				this.state = 'chview';
				x = this.itemx[key];
			}
			this.list.cid = this.restoreMode === 'channel' ? x.item.id : x.item.cid
			this.videolistClick({
				topicId: 0,
				searchid: 0,
				channelId: this.list.cid,
				state: 'chview'
			},0);
		}
		if (event) event.stopPropagation();
	}

	// single step through channel list. return true if next channel key matches key
	// key <string> item key
	advchan(key) {
		if (!this.chanList.length) return false;
		let x = this.chanList[0];
		if (x.type === 'channel') {
			if (key === x.item.key) return true;
		} else {
			if (key === x.item.channel.key) return true;
		}
		return false;
	}

	// leave channel mode
	// event <object> mouse event
	// key <string> item key
	// next <boolean> whether to move to next channel
	unchan(event,key,next = false) {
		if (this.list.chanMode) {
			while (this.advchan(key)) this.chanList.shift();
			if (next && this.chanList.length) {
				this.chan(event,this.chanList[0].item.key,next);
			} else {
				// reached the end of the list
				this.disabled = false;
				this.list.chanMode = false;
				this.mode = this.restoreMode;
				this.state = this.restoreState;
				(this.mode === 'channel') ?
					this.channellistClick(this,this.restorePage,false,next) :
					this.videolistClick(this,this.restorePage,false,next);
			}
		}
		event.stopPropagation();
	}

	// move to the next channel in channel mode
	// event <object> mouse event
	// key <string> item key
	nextchan(event,key) {
		this.unchan(event,key,true);
		event.stopPropagation();
	}

	// stop a pending download / put in the queue
	// event <object> mouse event
	// key <string> item key
	stopdl(event,key) {
		let v = this.itemx[key];
		v.state = 'queue';
		v.reoption();
		event.stopPropagation();
	}

	// watch a video embedded in the browser
	// event <object> mouse event
	// key <string> item key
	// vstream <int> video stream index, defaults to best video, or best video with audio (if embedBoth is true)
	embed(event,key,vstream = 0) {
		let v = this.itemx[key];
		if (this.ctrlPressed && v.can(this.cfg.video.ctrlClick)) return this[this.cfg.video.ctrlClick](event,key);
		if (this.shiftPressed && v.can(this.cfg.video.shiftClick)) return this[this.cfg.video.shiftClick](event,key);
		if (this.altPressed && v.can(this.cfg.video.altClick)) return this[this.cfg.video.altClick](event,key);
		if (
			this.reembedded
			||
			(
				event.offsetY > this.cfg.video.embedBorder * v.scale
				&&
				event.offsetY<(v.height - this.cfg.video.embedBorder * v.scale)
			)
		) {
			this.embedded = true;
			if (!this.reembedded) {
				if (this.cfg.video.embedBoth) {
					let f = v.item.videoStreams.findIndex(e => { return e.type === 'both'; });
					if (f>=0) vstream = f;
				}
			}
			ut.css('#page',{display:'none'});
			ut.css('#play',{display:'block'});
			let attrib = {
				id: 'videoplayback',
				class: `embedframe rembed${v.item.rotation}`,
				loop : this.cfg.video.embedLoop,
				autoplay : this.cfg.video.embedAutoplay,
				controls : this.cfg.video.embedControls,
			};
			ut.html('#play',
				ht.concat(
					ht.video(
						attrib,
						ht.concat(
							ht.ifElse(
								v.item.state === 'downloaded',
								ht.ifElse(
									v.item.videoCodec === 'vp9',
									ht.source(
										{
											src: encodeURI(v.item.fn.replace('/client','')).replaceAll('#','%23'),
											type: 'video/webm'
										}
									),
									ht.source(
										{
											src: encodeURI(v.item.fn.replace('/client','')).replaceAll('#','%23'),
											type: 'video/mp4'
										}
									)
								)
							),
							ht.ifElse(
								v.can('video'),
								ht.concat(
									ht.ifElse(
										v.item.videoStreams[vstream].container === 'webm',
										ht.source(
											{
												src: `${v.item.videoStreams[vstream].url}&range=0-${v.item.videoStreams[vstream].size}`,
												type: 'video/webm'
											}
										),
										ht.source(
											{
												src: `${v.item.videoStreams[vstream].url}&range=0-${v.item.videoStreams[vstream].size}`,
												type: 'video/mp4'
											}
										)
									),
								)
							)
						)
					),
					ht.ifElse(
						v.can('video'),
						ht.forEach(
							v.item.videoStreams,
							(e,i,a) => {
								let info = `Play ${e.type} - ${e.quality} - ${e.codec} - ${e.container}`;
								return ht.div(
									{
										'class': i === vstream ? 'codecdiv altdiv' : 'codecdiv divdiv',
										onclick: ht.evt('wapp.reembed',key,i),
										title: info,
										style: ht.css({top: `${60+21*(1+i)}px`})
									},
									ht.img(
										{
											'class': 'codecimg',
											src: imageRes[`${e.type}_over`],
										}
									)
								);
							}
						)
					),
					ht.div(
						{
							'class': 'exitplaydiv divdiv',
							onclick: ht.evt('wapp.unembed'),
							title: 'click to exit video player'
						},
						ht.img(
							{
								'class': 'exitplayimg',
								src: imageRes.discard_over,
							}
						)
					),
					ht.div(
						{
							'class': 'embedinfodiv divdiv',
							onmouseenter: ht.cmd('wapp.embedInfo',true,false,key),
							onmouseleave: ht.cmd('wapp.embedInfo',false,false,key),
							onmousedown: ht.cmd('wapp.embedInfo',false,true,key),
							onmouseup: ht.cmd('wapp.embedInfo',false,false,key),
						},
						ht.img(
							{
								'class': 'embedinfoimg',
								src: imageRes.showinfo_over,
							}
						)
					)
				)
			);
			let vid = document.getElementById('videoplayback');
			if (vid) {
				this.cfg.video.embedMuted ? vid.muted = 1 : vid.volume = this.volumeLevel;
				vid.onvolumechange = function() {
					wapp.volumeLevel = vid.volume;
				};
				vid.onplay = function() {
					let ar = vid.videoWidth/vid.videoHeight;
					let scale = v.item.rotation % 2 ? 1/ar : 1;
					ut.css('#videoplayback',{ scale : scale});
				}
			}
		}
		this.reembedded = false;
		event.stopPropagation();
	}

	// redisplay embedded video with specified stream
	// event <object> mouse event
	// key <string> item key
	// vstream <int> video stream index
	reembed(event,key,vstream) {
		ut.html('#play','');
		this.reembedded = true;
		this.embed(event,key,vstream);
	}

	// leave an emedded video playback
	// event <object> mouse event
	unembed(event) {
		this.embedded = false;
		ut.html('#play','');
		ut.css('#play',{display:'none'});
		ut.css('#page',{display:'block'});
		event.stopPropagation();
	}

	// show/unshow video info for embedded playback
	// show <boolean> whether to show video info
	// key <string> item key
	embedInfo(show, invert, key) {
		let v = this.itemx[key];
		if (show) {
			v.embedInfo = true;
			ut.replaceWith('#embedInfo',v.html);
			ut.css('#embedInfo',{display:'block'});
		} else {
			v.embedInfo = false;
			ut.css('#embedInfo',{display:'none'});
		}
		if (invert) {
			ut.addClass('#videoplayback','inverted');
		} else {
			ut.removeClass('#videoplayback','inverted');
		}
	}

	// backfill request has completed, re-list/re-sort
	// data <object> requested data
	backfilled(data) {
		if (
			this.list.chanMode
			&&
			this.itemx[data.key]
		) {
			ut.replaceWith(`#backfillSelect_${data.key}`,ht.div({id: `backfillSelect_${data.key}`},this.rcell(`found: ${data.count - data.orig}`)));
			this.itemx[data.key].backfilling = false;
			clearTimeout(this.refreshTime);
			this.refreshTime = setTimeout(this.refreshContent.bind(this),2500,true,true,0);
		}
	}

	// collect value from generic select control
	// key <string> item key
	// suffix <string> parent object ('' or 'item')
	// field <string> object field
	// ndx <int> field index if field is an array
	genericSelect(key, suffix, field, ndx = -1,) {
		let x = this.itemx[key];
		if (x) {
			let val = ndx >=0 ?
				ut.val(`#${field}Select_${key}_${ndx}`) :
				ut.val(`#${field}Select_${key}`);
			if (parseInt(val) == val) val = parseInt(val);
			if (suffix === 'item') {
				ndx >= 0 ?
					x.item[field][ndx] = val :
					x.item[field] = val;
				x.set(field,x.item[field]);
			} else {
				ndx >= 0 ?
					x[field][ndx] = val:
					x[field] = val;
				x.set(field,x[field]);
			}

		}
	}

	// page up the list
	pageUp() {
		if ((this.showing.length) && (this.page>0)) {
			this.page--;
			this.refreshContent(true,false);
		}
	}

	// page down the list
	pageDown() {
		let lim = this.limit;
		if (this.list.chanMode) lim--;
		let maxPage = Math.floor((this.filtered-1)/lim);
		if (this.showing.length && this.page < maxPage) {
			this.page++;
			if (this.nextResponse.length) {
				clearTimeout(this.refreshTime);
				this.clearItems();
				this.shown = [];
				this.statusNav('fetching data...');
				this.response = structuredClone(this.nextResponse);
				this.lastData.content = 'content';
				this.load(this.lastData);
			} else {
				this.refreshContent(true,false);
			}
		}
	}

	// navigate to the top of the list
	home() {
		if (this.showing.length && this.page) this.refreshContent(true,false,0);
	}

	// navigate to the bottom of the list
	end() {
		let lim = this.limit;
		if (this.list.chanMode) lim--;
		let maxPage = Math.floor((this.filtered-1)/lim);
		if (this.showing.length && this.page !== maxPage) {
			this.page = maxPage
			this.refreshContent(true,false);
		}
	}

	// capture keyboard events
	// event <object> mouse event
	keyDown(event) {
		if (!this.editing) {
			switch (event.code) {
				case 'ShiftLeft':
				case 'ShiftRight': this.shiftPressed = true; break;
				case 'ControlLeft':
				case 'ControlRight': this.ctrlPressed = true; break;
				case 'AltLeft':
				case 'AltRight': this.altPressed = true; break;
				case 'ArrowRight': if (this.list.chanMode) this.nextchan(event, this.list.cid); break;
				case this.cfg.client.blockCode1:
				case this.cfg.client.blockCode2:
				case this.cfg.client.blockCode3:
					if (this.list.chanMode) {
						this.cblock(event,this.list.cid,true);
					} else if ([video,channel].includes(this.mode)) {
						this.blockAll(event);
					}
					event.preventDefault();
				break;
				case this.cfg.client.searchCode1:
				case this.cfg.client.searchCode2:
				case this.cfg.client.searchCode3:
					if (this.list.chanMode) {
						this.csearch(event,this.list.cid,true);
					}  else if ([video,channel].includes(this.mode)) {
						this.searchAll(event,'discarded');
					}
					event.preventDefault();
				break;
				case this.cfg.client.scanCode1:
				case this.cfg.client.scanCode2:
				case this.cfg.client.scanCode3:
					if (this.list.chanMode) {
						this.cscan(event,this.list.cid,true);
					}  else if ([video,channel].includes(this.mode)) {
						this.scanAll(event,'discarded');
					}
					event.preventDefault();
				break;
				case this.cfg.client.updateCode1:
				case this.cfg.client.updateCode2:
				case this.cfg.client.updateCode3:
					if (this.list.chanMode) {
						this.cupdate(event,this.list.cid,true);
					}  else if ([video,channel].includes(this.mode)) {
						this.updateAll(event,'discarded');
					}
					event.preventDefault();
				break;
				case this.cfg.client.likeCode1:
				case this.cfg.client.likeCode2:
				case this.cfg.client.likeCode3:
					if (this.list.chanMode) {
						this.clike(event,this.list.cid,true);
					} else if ([video,channel].includes(this.mode)) {
						this.likeAll(event);
					}
					event.preventDefault();
				break;
				case this.cfg.client.followCode1:
				case this.cfg.client.followCode2:
				case this.cfg.client.followCode3:
					if (this.list.chanMode) {
						this.cfollow(event,this.list.cid,true);
					} else if ([video,channel].includes(this.mode)) {
						this.followAll(event,'queue');
					}
					event.preventDefault();
				break;
				case 'Delete':
					this.discardAll(event);
					event.preventDefault();
				break;
				case 'Space':
					this.actionall(event);
					event.preventDefault();
				break;
				case 'Home':
					this.home();
					event.preventDefault();
				break;
				case 'PageUp':
					this.pageUp();
					event.preventDefault();
				break;
				case 'PageDown':
					this.pageDown();
					event.preventDefault();
				break;
				case 'End':
					this.end();
					event.preventDefault();
				break;
				case 'Backspace':
					if (this.list.chanMode) this.unchan(event);
					if (this.list.embedded) this.unembed(event);
					event.preventDefault();
				break;
				default: break;
			}
		}
	}

	// capture key up events
	// event <object> mouse event
	keyUp(event) {
		switch (event.key) {
			case 'Shift': this.shiftPressed = false; break;
			case 'Control': this.ctrlPressed = false; break;
			case 'Alt': this.altPressed = false; break;
			default: break;
		}
	}

	// get edited name
	// key <string> item key
	nameEdit(key) {
		this.editText(false);
		let v = this.itemx[key];
		v.name = ut.val(`#nam_${key}`);
	}

	// go to channel on youtube
	// event <object> mouse event
	// key <string> item key
	ytchan(event,key) {
		let x = this.itemx[key];
		let name = x.type === 'video' ? x.item.channel.name : x.item.name;
		window.open(`${this.cfg.channel.url}/${name}`,'_blank');
		event.stopPropagation();
	}

	// watch a video on youtube
	// event <object> mouse event
	// key <string> item key
	views(event,key) {
		let name = this.itemx[key].item.name;
		window.open(`${this.cfg.video.watchUrl}${name}`,'_blank');
		event.stopPropagation();
	}

	// get edited query
	// key <string> item key
	queryEdit(key) {
		this.editText(false);
		let v = this.itemx[key];
		v.query = ut.val(`#qry_${key}`);
	}

	// get disallowed text list
	// key <string> item key
	disallowEdit(key) {
		this.editText(false);
		let v = this.itemx[key];
		v.disallow = ut.val(`#dis_${key}`);
	}

	// refresh an item
	// event <object> mouse event
	// key <string> item key
	refresh(event, key) {
		let v = this.itemx[key];
		if (v) this.emit('refresh',{
			type: v.type,
			id: v.item.id
		});
		event.stopPropagation();
	}

	// refresh/resort the item list
	// event <object> mouse event
	resort(event) {
		this.setItemControls(true,true);
	}

	// calculate or adjust item display size
	// increment <int> added to number of item rows
	scale(increment = 0) {
		let t = this.subtype;
		let cl = this.itemObject;
		let orows = t.rows;
		let oscale = t.scale;
		if (!t.rows) t.rows = 2;
		t.rows += increment;
		if (t.row<1) t.rows = 1;
		let dum = new cl({},1);
		let ch = ut.outerHeight(this.content);
		let ih = cl.calc_height(1) + 2 * (dum.padding + dum.margin);
		t.scale = ch/ih/t.rows;
		if (t.rows !== orows || t.scale !== oscale) this.updcfg();
	}

	// sort in ascending order
	// event <object> mouse event unused
	asc(event) {
		this.subtype.dir = 'DESC';
		this.updcfg();
		this.refreshContent(true,true,0);
		ut.html('#ascdesc', this.button('desc','sort in ascending (a-z) order - currently in decending (z-a) order'));
	}

	// sort in descending order
	// event <object> mouse event unused
	desc(event) {
		this.subtype.dir = 'ASC';
		this.updcfg();
		this.refreshContent(true,true,0);
		ut.html('#ascdesc', this.button('asc','sort in descending (z-a) order - currently in ascending (a-z) order'));
	}

	// scale item display size down to fit one more row.
	scaledown() {
		this.scale(1);
		this.setItemControls(true,false);
	}

	// scale item display size up to fit one row less
	scaleup() {
		this.scale(-1);
		this.setItemControls(true,false);
	}

	// show topic category check list
	// event <object> mouse event
	// key <string> item key
	showCheckList(event,key) {
		let g = this.itemx[key];
		g.showCheckList();
		event.stopPropagation();
	}

	// check/uncheck a category
	// event <object> mouse event
	// key <string> item key
	// category <string> category clicked
	checkListClick(event,key,category) {
		let g = this.itemx[key];
		g.checkListClick(category);
		event.stopPropagation();
	}

	// thumb enters preview div
	// key <string> item key
	thumbenter(key) {
		this.itemx[key].thumbenter();
	}

	// thumb leaves preview div
	// key <string> item key
	thumbleave(key) {
		this.itemx[key].thumbleave();
	}

	// thumb move withing preview div
	// event <object> mouse event
	// key <string> item key
	thumbmove(event,key) {
		this.itemx[key].thumbmove(event);
	}

	// client area was resized
	resize() {
		if (this.refreshTime !== null) this.refreshContent(true,false);
	}

	// server was stopped
	// data <object> unused
	stop(data) {
		location.reload();
	}

	// check/uncheck active topic
	// key <string> item key
	topicActive(key) {
		let v = this.itemx[key];
		v.active = ut.prop(`#act_${key}`,'checked');
		v.redisplay();
	}

	// check/uncheck active search
	// key <string> item key
	searchActive(key) {
		let v = this.itemx[key];
		v.active = ut.prop(`#act_${key}`,'checked');
		v.redisplay();
	}

	// check/uncheck proxified search
	// key <string> item key
	searchProxy(key) {
		let v = this.itemx[key];
		v.proxify = ut.prop(`#pxy_${key}`,'checked');
		v.redisplay();
	}

	// dermine if video preview generated an error
	// event <object> mouse event unused
	// key <string> item key
	videoPreviewError(event,key,ndx) {
		let v = this.itemx[key];
		if (v.refreshedOnError) {
			this.playstory(event,key);
		} else {
			this.refresh(event,key);
			v.refreshedOnError = true;
			this.playstory(event,key);
		}
	}

	// set background colors of video to rgb
	// key <string> item key
	// rgb <object> color for bacground
	bgi(key, rgb) {
		ut.css(`#div_${key}`,{'background-color':rgb});
	}

	// set background colors of channel videos to rgb
	// cid <int> channel id
	// rgb <object> color for bacground
	bgc(cid, rgb) {
		Object.keys(this.itemx).forEach(k => {
			let v = this.itemx[k];
			if ((v.item.cid && v.item.cid === cid) && (!this.list.chanMode)) {
				this.bgi(v.item.key,rgb);
			}
		});
	}

	// return background colors channel video to default
	// cid <int> channel id
	rgb(cid) {
		Object.keys(this.itemx).forEach(k => {
			let v = this.itemx[k];
			if (v.item.cid && v.item.cid === cid) {
				this.bgi(v.item.key,v.rgb);
			}
		});
	}
}
