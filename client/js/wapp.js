// ytzero client web application object class
// repository https://github.com/gatecrasher777/ytzero
// (c) 2021/2 gatecrasher777
// MIT Licence

class Wapp {

	// Web app constructor
	constructor() {
		// global variables
		this.topicId = 'all';
		this.searchId = 'any';
		this.channelId = 'any';
		this.mode = 'video';
		this.state = 'result';
		this.wanted = 0;
		this.previewTypes = ['info','images','storyboards','hybrid','videos'];
		this.embedded = false;
		this.autoLoad = false;
		this.disabled = false;
		this.showing = 'menu1';
		this.topiclist = [];
		this.searchlist = [];
		this.channellist = [];
		this.shown = [];
		this.response = [];
		this.itemx = {};
		this.list = {
			topic : 'all',
			vstates : [],
			search : 'any',
			channel : 'any',
			video : 'any',
			type : 'video',
			chanMode: false,
			cid: ''
		},
		this.page = 0;
		this.refreshTime = null;
		this.nexttop = 0;
		this.undoData = [];
		this.cfg = {};
		this.restoreMode = 'video';
		this.restorePage = 0;
		this.restoreState = 'result';
		this.chanMode = false;
		this.chanList = [];
		this.dcb = [];
		this.filtered = 0;
		this.total = 0;
		this.editing = false;
		this.shiftPressed = false;
		this.ctrlPressed = false;
		this.selectOK = false;
		this.reembedded = false;
		this.volumeLevel = 0;
	}

	// start the client step 1
	start() {
		this.emit('start',{cb:'startcfg'});
		this.statusMsg('starting...');
	}

	// start the client step 2
	startcfg(data) {
		this.setcfg(data);
		this.volumeLevel = this.cfg.video.embedVolume;
		ut.html('#menu1',
			this.menu(['video','!topic','!search','!channel','app'],1,'')
		)
		this.nexttop = ut.prop('#menu1','offsetHeight');
		this.statusMsg('');
	}

	// send message to server
	emit(tag,data) {
		socket.emit(tag,data);
	}

	// a visible item has been updated, redisplay
	setUpdate(data) {
		let x = this.itemx[data.item.id];
		if (['hour','day'].includes(data.type)) data.type = 'search';
		if (x !== undefined && x.type === data.type) {
			x.item = data.item;
			x.redisplay();
		}
	}

	// show download progress
	dlProgress(data) {
		let v = this.itemx[data.id];
		if (v !== undefined ) {
			v.item.state = 'download..';
			if (!ut.exists(`#prg_${v.item.id}`)) v.redisplay();
			ut.css(`#prg_${v.item.id}`,{width: data.prg});
		}
	}

	// a download completed, redisplay
	dlCompleted(data) {
		let v = this.itemx[data.item.id];
		if (v !== undefined ) {
			v.item = data.item;
			ut.remove(`#prg_${v.item.id}`);
			v.redisplay();
		}
	}

	// a requested list has been received
	itemList(data) {
		if (this.showing === `${data.type}List` && data.got === this.wanted) {
			this.response = data.list;
			this.total = data.total;
			this.filtered = data.filtered;
			data.next && this.response.length ? this.next(data.type) : this.load();
		} else {
		}
	}

	// set the received configuration
	setcfg(data) {
		this.cfg = data.cfg;
		this.list.topic = this.topicId;
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
			case 'video': return ytzVideo;
			case 'search': return ytzSearch;
			case 'channel': return ytzChannel;
			case 'topic': return ytzTopic;
			default: return ytzItem;
		}
	}

	// get display items quantity limit
	get limit() {
		let t = this.subtype;
		let cl = this.itemObject;
		let dum = new cl({},t.scale);
		let cw = document.body.clientWidth;
		let ch = ut.outerHeight('#content');
		let sw = dum.padding + dum.margin;
		let iw = dum.width + 2 * sw;
		let ih = cl.calc_height(t.scale) + 2 * sw;
		let pr = Math.max(1, Math.floor((cw-sw) / iw));
		let pc = Math.max(1, Math.floor(ch / ih));
		let n = parseInt(t.display);
		let pl = '0px';
		if (!n) {
			n = pr * pc;
			pl  = `${(ch - pc * ih) / 2}px`
		}
		ut.css('#content', {
			'padding-left': `${(cw - pr * iw) / 2}px`,
			'padding-top': pl
		});
		if (!n) n = 1;
		return n;
	}

	// add an id to the "don't come back" list
	dcbAdd(id) {
		this.dcb.push(id);
	}

	// remove an id from the "don't come back" list
	dcbRemove(id) {
		let f = this.dcb.indexOf(id);
		if ( f >= 0 ) this.dcb.splice(f, 1);
	}

	// move to next channel in channel mode
	next(type) {
		let it = type === 'video'? new ytzVideo(this.response[0], 1) :
			new ytzChannel(this.response[0],1);
		this.itemx[it.item.id] = it;
		for (let i = 1; i<this.response.length; i++) {
			it = new ytzVideo(this.response[i], 1);
			this.itemx[it.item.id] = it;
		}
		this.chan(null,it.item.id);
	}

	// render a menu item
	menuItem(tag,level,prefix) {
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
				topic: this.topicId,
				search: this.searchId
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
	menu(tags,level,prefix) {
		return ht.forEach(
			tags,
			e => {
				return this.menuItem(e,level,prefix)
			}
		);
	}

	// receive list and show topic dropdown
	topicmenu(data) {
		this.topiclist = data.list;
		ut.html('#topicmenuselect',
			ht.forEach(
				this.topiclist,
				e => {
					let g = {
						value: e.id.toString()
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
	searchmenu(data) {
		this.searchlist = data.list;
		ut.html('#searchmenuselect',
			ht.forEach(
				this.searchlist,
				e => {
					let g = {
						value: e.id.toString()
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
		this.list.topic = ut.val('#topicmenuselect');
		if (this.topicId !== this.list.topic) {
			this.topicId = this.list.topic;
			this.list.search = this.searchId = 'any';
			this.searchmenu(
				{list:
					[
						{
							id:'any',
							name:'any'
						}
					]
				}
			);
			this.list.channel = this.channelId = 'any';
			this.channelmenu(
				{
					list:
					[
						{
							id:'any',
							author:'any'
						}
					]
				}
			);
			this.updcfg();
			this.emit('searchmenu',{
				cb:'searchmenu',
				topic: this.topicId,
				search: this.searchId
			});
		} else {
			this.list.search = ut.val('#searchmenuselect');
			if (this.searchId !== this.list.search) {
				this.searchId = this.list.search;
				this.list.channel = this.channelId = 'any';
				ut.val('#channelmenuselect','any');
				this.channelmenu(
					{
						list:
						[
							{
								id:'any',
								author:'any'
							}
						]
					}
				);
				this.updcfg();
				this.emit('channelmenu',{
					cb:'channelmenu',
					topic: this.topicId,
					search: this.searchId
				});
			} else {
				this.list.channel = this.channelId = ut.val('#channelmenuselect');
			}
		}
		this.refreshContent(true,true,0);
	}

	// reset the menu
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
				this.shown = [];
				this.total = this.filtered = 0;
				ut.attr('.navbut',{'disabled':'disabled'})
				this.showing = '';
				this.page = page;
				this.clearItems(false);
				ut.html('#content','');
				this.statusNav('');
			case 2:
				ut.css('#options',{'display':'none'});
				ut.css('#controls',{'display':'none'});
				break;
			default: break;
		}
	}

	// add a visual element
	nextLevel(element) {
		ut.css(element,{'display':'block','top': `${this.nexttop}px`});
		this.nexttop += ut.prop(element,'offsetHeight');
		ut.css('#content',{'top': `${this.nexttop}px`});
	}

	// hide a visual element
	prevLevel(element) {
		this.nexttop -= ut.prop(element,'offsetHeight');
		ut.css(element,{'display':'none'});
		ut.css('#content',{'top': `${this.nexttop}px`});
	}

	// clear all display items with option to save and undo
	clearItems(save) {
		if (save) this.undoData = [];
		Object.keys(this.itemx).forEach( (k)=>{
			if (save) this.undoData.push({
				type: this.itemx[k].type,
				item: ut.jp(ut.js(this.itemx[k].item))
			});
			this.itemx[k].clear();
		});
	}

	// receive and display server bandwidth
	setBandwidth(data) {
		if (this.bw !== undefined) {
			let n = data.bw;
			let o = this.bw;
			let t = n.search+n.channel+n.video+n.download-o.search-o.channel-o.video-o.download;
			let x = '0k/s';
			if (t) {
				x = `${ut.qFmt(t * 1000 / this.cfg.client.bandwidthCycle)}/s - `;
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
			}
			this.statusUpd(x);
		}
		this.bw = data.bw;
	}

	// refresh visual item list
	refreshContent(redisplay, update, page = this.page, next = false) {
		if (this.showing.length && !this.embedded) {
			this.wanted++;
			this.invalidate = true;
			clearTimeout(this.refreshTime);
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
			if (update) this.dcb = [];
			this.emit('list', data);
			if (redisplay) {
				this.clearItems(false);
				this.shown = [];
				this.statusNav('fetching data...');
			}
			this.refreshTime = setTimeout(this.refreshContent.bind(this),this.cfg.client.refreshCycle,false,true);
		}
	}

	// get the ordered value of an item in the list
	mark(item) {
		let s = this.subtype.sort;
		let i = this.cfg.video.sortList.findIndex(e=>{return s === e.tag;});
		if (i < 0) i = 0;
		let o = this.cfg.video.sortList[i];
		let z = o.field.split('.');
		if (z[0] === 'meta') {
			return item.meta[z[1]];
		} else {
			return item[z[0]];
		}
	}

	// formatted display of an ordered value
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

	// whether an item should come before an ordered value
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

	// load items (if necessary) from the list reponse
	load() {
		let t = this.subtype;
		let isch = false;
		let cl = this.itemObject;
		let lim = this.limit;
		let cur = Object.keys(this.itemx).length;
		let maxpage = Math.floor((this.filtered - 1) / lim);
		if (this.page > maxpage) this.page = Math.max(0, maxpage);
		let replace = this.autoLoad;
		while (
			this.response.length
			&&
			(cur<lim || replace)
			&& (
				this.page<maxpage
				||
				cur <= ((this.filtered - 1) % lim)
			)
		) {
			let i;
			replace ? i = this.response.pop() : i = this.response.shift();
			if (!this.itemx[i.id]) {
				let it;
				if (i.id.length === wapp.cfg.client.channelCodeLength && t !=='channel') {
					it = new ytzChannel(i, t.scale);
					isch = true;
				} else {
					it = new cl(i, t.scale);
					isch = false;
				}
				replace ? ut.prepend('#content', it.html) : ut.append('#content', it.html)
				this.itemx[it.item.id] = it;
				cur++;
				if (this.mode === 'video' && !isch) it.repreview();
				replace ? this.shown.unshift(i.id) : this.shown.push(i.id);
				while (cur > lim) {
					let kill = this.shown.pop();
					if (this.itemx[kill]) {
						this.itemx[kill].clear();
						cur--;
					}
				}
			} else {
				let it = this.itemx[i.id];
				it.item = i;
			}
		}
		for (let i = this.response.length - 1; i >= 0; i--) {
			let e = this.response[i];
			if  (this.itemx[e.id]) this.response.splice(i,1);
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
				if (!this.before(i,bottomMarker)) bottomMarker = this.mark(i);
			}
			if (this.itemx[k].type === 'video') {
				let me = i.channel;
				let nx = n < (a.length-1) ? this.itemx[a[n+1]].item.channel : '';
				this.itemx[k].refresh(me === pr, me === nx);
				pr = me;
			} else {
				this.itemx[k].refresh();
			}
		});
		this.emit('shown',this.shown);
		if (this.total) {
			this.statusNav(`${this.page * lim + 1}-${this.page * lim + cur} of ${this.filtered} of ${this.total}`)
		} else {
			this.statusNav('no items');
		}
		if (!this.filtered) {
			maxpage = this.page = 0;
		}
		this.statusMsg(`${this.markStr(topMarker)} - ${this.markStr(bottomMarker)}`);
		ut.removeAttr('.navbut','disabled');
		!this.page ? ut.attr('#homebut',{'disabled':'disabled'}) : ut.removeAttr('#homebut','disabled');
		!this.page ? ut.attr('#pgupbut',{'disabled':'disabled'}) : ut.removeAttr('#pgupbut','disabled');
		this.page === maxpage ? ut.attr('#endbut',{'disabled':'disabled'}) : ut.removeAttr('#endbut','disabled');
		this.page === maxpage ? ut.attr('#pgdnbut',{'disabled':'disabled'}) : ut.removeAttr('#pgdnbut','disabled');
	}

	// determine effective item sort method
	itemSortMethod() {
		let c = this.subtype;
		let i = this.cfg[this.mode].sortList.findIndex( e => { return e.tag === c.sort; });
		if (i < 0) i = 0;
		let y = this.cfg[this.mode].sortList[i].sql;
		if ( c.dir === 'DESC' ) {
			y = y.replace(/\bDESC\b/g,'SUB').replace(/\bASC\b/g,'DESC').replace(/\bSUB\b/g,'ASC');
		}
		return y;
	}

	// determine effective item filter method
	itemFilterMethod() {
		let c = this.subtype;
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
			x.push(`texthas(${n},${this.mode}.data,'${c.textFilter}') = 1`);
		}
		return {
			clause: x.join(' AND '),
			having: h.join(' AND ')
		};
	}

	// generic data cell markup
	cell(c,cl,pc) {
		let a = {
			'class': cl,
		}
		if (pc) a.style = ht.css({width:`${pc}%`})
		return ht.div(
			a,
			c
		);
	}

	// generic left floating markup
	lcell(c,pc) {
		return this.cell(c, 'lcell', pc);
	}

	// generic right floating markup
	rcell(c,pc) {
		return this.cell(c, 'rcell', pc);
	}

	// generic button
	button(s,h) {
		return ht.button(
			{
				onclick: ht.evt(`wapp.${s}`),
				title: `click to ${h}`
			},
			ht.img(
				{
					src: `./img/${s}.png`,
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
			this.channellistClick();
		}
	}

	// second level menu click - show channel list
	channellistClick(app = this.cfg.engine, page = this.page,next = false) {
		if (!this.disabled || this.list.chanMode) {
			this.resetMenu(1,page);
			this.itemControls();
			this.showing = 'channelList';
			this.list.topic = app.topicId;
			this.list.search = app.searchId;
			this.list.channel = app.channelId;
			this.list.vstates = [];
			this.list.type = 'channel';
			this.refreshContent(true,true,page,next);
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
	videolistClick(app = this, page = this.page, next = false) {
		if (!this.disabled || this.list.chanMode) {
			this.resetMenu(1,page);
			this.itemControls();
			this.submode = 'list';
			this.showing = 'videoList';
			this.list.topic = app.topicId;
			this.list.search = app.searchId;
			this.list.channel = app.channelId;
			this.list.video = 'any';
			this.list.vstates = this.cfg.state[this.stateIndex].videoStates;
			this.list.type = 'video';
			this.refreshContent(true,true,page,next);
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
				onchange: ht.cmd('wapp.setItemControls',true,false),
				title: 'Specify the type of preview to display'
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
				onchange: ht.cmd('wapp.actionAll',false,false),
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

	// capture text edit
	editText(b) {
		this.editing = b;
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
												src: './img/ok.png',
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
				this.emit('open',{
					type: 'topic',
					name: name,
					cb: 'topicAdded'
				});
				ut.val('#topic_input','');
			}
		}
	}

	// server response to a new topic
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
			this.list.vstates = ['result', 'preview', 'upgrade', 'update','noupdate','offline','queue'];
			this.list.topic = 'all';
			this.list.type = 'topic';
			this.refreshContent(true,true,0);
		}
	}

	// second level menu click - list filter selected
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
		if (!this.disabled && this.topicId && this.topicId !=='all') {
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
												src: './img/ok.png',
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
			if (this.topicId === 'all') {
				alert('Select a topic first');
			} else {
				let name = ut.val('#search_name_input');
				let level = parseInt(ut.val('#search_channel_level'));
				if ((name.length>=this.cfg.search.minNameLength) && (name.length<=this.cfg.search.maxNameLength)) {
					let exists = this.searchlist.findIndex( e => e.name === name);
					if (exists < 0) {
						let query = ut.val('#search_query_input');
						if (query.length) {
							this.emit('open',{
								type: 'search',
								topic: parseInt(this.topicId.toString()),
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
			}
		}
	}

	// server response to a new search
	searchAdded(data) {
		this.emit('searchmenu', {
			topic: this.topicId,
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
			this.list.topic = this.topicId;
			this.list.vstates = [];
			this.list.search = 'any';
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
	reloadcfg(data) {
		this.cfg = data.cfg;
	}

	// second level menu click - reload configuration - allows some changes to ytzero.yaml to become effective
	appreloadClick() {
		if (!this.disabled) {
			this.emit('reload',{cb:'reloadcfg'});
			this.resetMenu(1);
			this.submode = 'reload';
			ut.addClass('#reloadmenu','selected');
			ut.html('#content',
				ht.p(
					{
						style:ht.css(
							{
								'color':'white'
							}
						)
					},
					ht.concat(
						'ytzero.yaml configuration file has been reloaded. ',
						'Not all changes to ytzero.yaml will be immediately effective. ',
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
			ut.html('#content',
				ht.p(
					{
						style:ht.css(
							{
								'color':'white'
							}
						)
					},
					'some application stats will go here.'
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
			ut.html('#content',
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

	// second level menu click - show info about ytzero
	appaboutClick() {
		if (!this.disabled) {
			this.resetMenu(1);
			this.submode = 'about';
			ut.addClass('#aboutmenu','selected');
			ut.html('#content',
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
			ut.html('#content',
				ht.p(
					{
						style:ht.css(
							{
								'color':'white'
							}
						)
					},
					'the ytzero server will be stopped.'
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
	setItemControls(refresh,update) {
		let x = this.subtype;
		x.display = ut.val('#item_display');
		x.sort = ut.val('#item_sort');
		if (ut.exists('#item_text_filter')) x.textFilter = ut.val('#item_text_filter');
		if (ut.exists('#item_preview')) x.preview = ut.val('#item_preview');
		this.updcfg();
		this.refreshContent(refresh,update,update ? 0 : this.page);
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
							src: './img/pgdn.png',
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
							src: './img/pgup.png',

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
							src: './img/end.png',

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
							src: './img/home.png',

						}
					)
				),
				this.cfg.client.navHomeField
			),
			this.rcell(this.button('undo','undo your last action'),this.cfg.client.undoField),
			this.rcell(this.button('actionAll','perform chosen action on all displayed items'),this.cfg.client.actionField),
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
	autoButton () {
		return ht.button(
			{
				id: 'autobut',
				onclick: ht.evt('wapp.toggleAuto'),
				title: `click to turn automatic display updates ${this.autoLoad ? 'off' : 'on'}`
			},
			ht.img(
				{
					id: 'autoimg',
					src: `./img/${this.autoLoad ? 'automatic' : 'manual'}.png`,
					height: this.cfg.client.buttonHeight,
					width: this.cfg.client.buttonWidth
				}
			)
		);
	}

	// toggle auto load
	toggleAuto() {
		this.autoLoad = !this.autoLoad;
		ut.attr('#autobut',{title: `click to turn automatic updating ${this.autoLoad ? 'off' : 'on'}`});
		ut.prop('#autoimg',{src: `./img/${this.autoLoad ? 'automatic' : 'manual'}.png`});
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
	clearChannel(cid) {
		let keys = Object.keys(this.itemx);
		for (let i = keys.length-1; i>=0; i--) {
			let v = this.itemx[keys[i]];
			if ((v.item.channel && v.item.channel === cid) || (v.type === 'channel' && v.item.id === cid )) {
				this.dcbAdd(v.item.id);
				v.clear();
			}
		}
	}

	// cancel a download
	cancel(event,id) {
		let v = this.itemx[id];
		if (v.choosing) {
			v.unchoose();
		} else {
			this.emit('cancel',{
				id: id
			});
		}
		event.stopPropagation();
	}

	// show preview of type or toggle to previous type
	showPreview(event,id,type,active = false) {
		let x = this.itemx[id];
		if (active) {
			x.showPreview = x.previewType = x.prevPreview;
		} else {
			x.prevPreview = x.previewType;
			x.showPreview = x.previewType = type;
		}
		x.redisplay();
		event.stopPropagation();
	}

	// show info preview
	showinfo(event,id,active = false) {
		this.showPreview(event,id,'info',active);
	}

	// show image preview
	showimage(event,id,active = false) {
		this.showPreview(event,id,'images',active);
	}

	// play storyboard preview
	playstory(event,id,active = false) {
		this.showPreview(event,id,'storyboards',active);
	}

	// play video preview
	playvideo(event,id,active = false) {
		this.showPreview(event,id,'videos',active);
	}

	// undo last discard action
	undo(event) {
		this.undoData.forEach( (e) => {
			this.emit('set', {
				type: e.type,
				item: e.item
			});
			this.dcbRemove(e.item.id);
		});
		this.undoData = [];
		this.refreshContent(true,true);
		event.stopPropagation();
	}

	// apply bulk action
	actionAll(event) {
		let action = ut.val('#item_action');
		this.subtype.allAction = action;
		let act = '';
		if (['search','scan','update'].includes(action)) act = 'discarded';
		if (action === 'follow') act = 'queue';
		action === 'none' ? event.stopPropagation() : this[action+'All'](event,act);
	}

    //change channel level of id to lev. del to delete entry or remove only if statusFilter is in [rem]
	level(event,id,lev,del,rem) {
		let x = this.itemx[id];
		let cid = x.type === 'channel' ? x.item.id : x.item.channel;
		this.emit('level',{	cids: [cid], level: lev });
		Object.keys(this.itemx).forEach( k => {
			let v = this.itemx[k];
			if (v.type === 'video' && v.item.channel === cid) {
				v.item.clevel = lev;
				v.redisplay();
			}
		})
		if (del || rem.includes(this.subtype.statusFilter)) {
			this.dcbAdd(cid);
			this.clearChannel(cid);
			this.list.chanMode ? this.unchan(event,id) : this.refreshContent(false,false);
		}
		event.stopPropagation();
	}

	//change channel level of all to lev. del to delete entries or remove only if statusFilter is in [rem]
	levelAll(event,lev,del,rem,act = '') {
		let cids = [];
		Object.keys(this.itemx).forEach( k => {
			let x = this.itemx[k];
			let cid = x.type === 'channel' ? x.item.id : x.item.channel;
			if (!cids.includes(cid)) cids.push(cid);
			if (x.type === 'video' && x.item.channel === cid) {
				x.item.clevel = lev;
				if (act.length) {
					if (x.can(act)) {
						x.item.state = act;
						x.set();
					}
				}
			}
			if (del || rem.includes(this.subtype.statusFilter)) {
				x.clear();
				this.dcbAdd(x.item.id);
			} else {
				x.redisplay();
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
	block(event,id) {
		this.level(
			event,
			id,
			this.cfg.advanced.blockLevel,
			!this.subtype.videoStates.includes('discarded'),
			['not blocked','searched','searched+','scanned','scanned+','updated','updated+','liked','liked+','followed']
		);
	}

	// block all visible channels
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
	cblock(event,id,next) {
		this.block(event,id);
		this.unchan(event,id,next);
		event.stopPropagation();
	}

	// set channel to search level
	search(event,id) {
		this.level(
			event,
			id,
			this.cfg.advanced.searchLevel,
			false,
			['blocked','not searched','scanned','scanned+','updated','updated+','liked','liked+','followed']
		);
	}

	// set all visible channels to search level
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
	csearch(event,id,next) {
		this.emit('level',{cids:[id], level: this.cfg.advanced.searchLevel});
		this.emit('discardchanvids',{cid: id});
		this.unchan(event,id,next);
		event.stopPropagation();
	}

	// set channel to scan level
	scan(event,id) {
		this.level(
			event,
			id,
			this.cfg.advanced.scanLevel,
			false,
			['blocked','searched','searched-','not scanned','updated','updated+','liked','liked+','followed']
		);
	}

	// set all visible channels to scan level
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
	cscan(event,id,next) {
		this.emit('level',{cids:[id], level: this.cfg.advanced.scanLevel});
		this.emit('discardchanvids',{cid: id});
		this.unchan(event,id,next);
		event.stopPropagation();
	}

	// set channel to update level
	update(event,id) {
		this.level(
			event,
			id,
			this.cfg.advanced.updateLevel,
			false,
			['blocked','searched','searched-','scanned','scanned-','not updated','liked','liked+','followed']
		);
	}

	// set all visible channels to update level
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
	cupdate(event,id,next) {
		this.emit('level',{cids:[id], level: this.cfg.advanced.updateLevel});
		this.emit('discardchanvids',{cid: id});
		this.unchan(event,id,next);
		event.stopPropagation();
	}

	// set channel to like level
	like(event,id) {
		this.level(
			event,
			id,
			this.cfg.advanced.likeLevel,
			false,
			['blocked','searched','searched-','scanned','scanned-','updated','updated-','not liked','followed']
		);
	}

	// set all visible channels to like level
	likeAll(event,act) {
		this.levelAll(
			event,
			this.cfg.advanced.likeLevel,
			false,
			['blocked','searched','searched-','scanned','scanned-','updated','updated-','not liked','followed'],
			act
		);
	}

	// set channel to like level while in channel mode - keeps current videos
	clike(event,id,next) {
		this.emit('level',{cids:[id], level: this.cfg.advanced.likeLevel});
		this.unchan(event,id,next);
		event.stopPropagation();
	}

	// follow channel
	follow(event,id) {
		this.level(
			event,
			id,
			this.cfg.advanced.followLevel,
			false,
			['blocked','searched','searched-','scanned','scanned-','updated','updated-','liked','liked-','not followed']
		);
	}

	// follow all visible channels
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
	cfollow(event,id,next) {
		this.emit('level',{cids:[id],level: this.cfg.advanced.followLevel})
		this.emit('queuechanvids',{cid: id});
		this.unchan(event,id,next);
		event.stopPropagation();
	}

	// refresh data for all visible items
	refreshAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('refresh')) this.refresh(event,k);
		});
		event.stopPropagation();
	}

	// queue video
	queue(event,id,all) {
		let x = this.itemx[id];
		if (x.type === 'video') {
			x.item.state = 'queue';
			x.set();
			if (all || this.cfg.state[this.stateIndex].videoStates.includes('queue')) {
				x.redisplay();
			} else {
				x.clear();
				this.dcbAdd(id);
				this.refreshContent(false,false);
			}
		}
		event.stopPropagation();
	}

	// queue all visible vidoes
	queueAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('queue')) this.queue(event,k,true);
		});
		this.refreshContent(false,false);
		event.stopPropagation();
	}

	// unqueue video
	unqueue(event,id,all) {
		let x = this.itemx[id];
		if (x.type === 'video') {
			x.item.state = 'noupdate';
			x.set();
			if (all || this.cfg.state[this.stateIndex].videoStates.includes('noupdate')) {
				x.redisplay();
			} else {
				x.clear();
				this.dcbAdd(id);
				this.refreshContent(false,false);
			}
		}
		event.stopPropagation();
	}

	// unqueue all visible videos
	unqueueAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('unqueue')) this.unqueue(event,k,true);
		});
		this.refreshContent(false,false);
		event.stopPropagation();
	}

	// download a video
	download(event,id) {
		let v = this.itemx[id];
		if (v.type === 'video') {
			v.state = 'download..';
			this.emit('download', {
				item: v.item
			})
			v.redisplay();
		}
		event.stopPropagation();
	}

	// download all visible videos
	downloadAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('download')) this.download(event,k);
		});
		event.stopPropagation();
	}

	// export a video
	export(event,id) {
		let v = this.itemx[id];
		if (v.type === 'video') this.emit('export',{item: v.item});
		event.stopPropagation();
	}

	// export all visible downloads
	exportAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('export')) this.export(event,k);
		});
		event.stopPropagation();
	}

	// erase a download
	erase(event,id) {
		let v = this.itemx[id];
		if (v.type === 'video') {
			this.emit('delvid',{item: v.item});
			if (this.cfg.state[this.stateIndex].videoStates.includes('discarded')) {
				v.state = 'discarded';
			} else if (this.cfg.state[this.stateIndex].videoStates.includes('queue')) {
				v.state = 'queue';
			} else if (this.cfg.state[this.stateIndex].videoStates.includes('download')) {
				v.state = 'discarded';
			} else {
				v.state = 'noupdate';
			}
			v.redisplay();
		}
		event.stopPropagation();
	}

	// erase all visible downloads
	eraseAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('erase')) this.erase(event,k);
		});
		event.stopPropagation();
	}

	// rotate a preview
	rotate(event,id) {
		if (this.itemx[id].type === 'video') this.itemx[id].rotate();
		event.stopPropagation();
	}

	// rotate all visible previews
	rotateAll(event) {
		Object.keys(this.itemx).forEach(k => {
			if (this.itemx[k].can('rotate')) this.rotate(event,k)
		});
		event.stopPropagation();
	}

	// discard an item
	discard(event, id) {
		let x = this.itemx[id];
		let t = x.type;
		this.undoData = [{
			type: t,
			item: ut.jp(ut.js(x.item))
		}];
		let s = x.item.state;
		this.emit('delete',{
			type: t,
			ids : [id]
		});
		if (this.mode === 'video' && this.cfg.state[this.stateIndex].videoStates.includes('discarded')) {
			x.redisplay();
		} else {
			x.clear();
			this.dcbAdd(id);
			this.refreshContent(false,false);
		}
		event.stopPropagation();
	}

	// discard all visible items
	discardAll(event) {
		let ids = [];
		Object.keys(this.itemx).forEach( k => {
			let it = this.itemx[k];
			if (it.type !== 'video' || it.can('discard')) ids.push(k);
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
			ids.forEach((k)=>{
				let x = this.itemx[k];
				if (this.mode !== 'video' || this.cfg.state[this.stateIndex].videoStates.includes('discarded')) {
					x.redisplay();
				} else {
					x.clear();
					this.dcbAdd(x.item.id);
				}
				this.undoData.push({
					type: x.type,
					item: { ...x.item }
				});
			});
			this.refreshContent(true,false);
		}
		event.stopPropagation();
	}

	// entry into channel mode
	chan(event, id, next = false) {
		if (!this.list.chanMode || next) {
			let x;
			if (next) {
				x = this.chanList.shift();
			} else {
				this.chanList = [];
				Object.keys(this.itemx).forEach((k)=>{
					if (k !== id) this.chanList.push({... this.itemx[k]});
				});
				this.disabled = true;
				this.restoreMode = this.mode;
				this.restorePage = this.page;
				this.restoreState = this.state;
				this.restoreMode = this.mode;
				this.list.chanMode = true;
				this.mode = 'video';
				this.state = 'chview';
				x = this.itemx[id];
			}
			if (x.item.topic) {
				this.list.cid = (this.restoreMode === 'channel') ? x.item.id : x.item.channel
				this.videolistClick({
					topicId: x.item.topic,
					searchid: x.item.search,
					channelId: this.list.cid,
					state: 'chview'
				},0);
			}
		}
		if (event) event.stopPropagation();
	}

	// leave channel mode
	unchan(event,id,next = false) {
		if (this.list.chanMode) {
			if (next && this.chanList.length) {
				this.chan(event,this.chanList[0].item.id,next);
			} else {
				this.disabled = false;
				this.list.chanMode = false;
				this.mode = this.restoreMode;
				this.state = this.restoreState;
				(this.mode === 'channel') ?
					this.channellistClick(this,this.restorePage,next) :
					this.videolistClick(this,this.restorePage,next);
			}
		}
		event.stopPropagation();
	}

	nextchan(event,id) {
		this.unchan(event,id,true);
		event.stopPropagation();
	}

	// stop a pending download / put in the queue
	stopdl(event,id) {
		let v = this.itemx[id];
		v.item.state = 'queue';
		v.set();
		v.redisplay();
		event.stopPropagation();
	}

	// watch a video embedded in the browser
	embed(event,id,vstream = 0) {
		let v = this.itemx[id];
		if (this.ctrlPressed && v.can('like')) return this.like(event,id);
		if (this.shiftPressed && v.can('block')) return this.block(event,id);
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
					let f = v.item.meta.videoStreams.findIndex(e => { return e.type === 'both'; });
					if (f>=0) vstream = f;
				}
			}
			ut.css('#page',{display:'none'});
			ut.css('#play',{display:'block'});
			let attrib = {
				id: 'videoplayback',
				class: `embedframe rembed${v.item.meta.rotation}`,
				loop : this.cfg.video.embedLoop,
				autoplay : this.cfg.video.embedAutoplay,
				controls : this.cfg.video.embedControls,
			};
			ut.html('#play',
				ht.concat(
					ht.ifElse(
						v.item.state === 'downloaded',
						ht.video(
							attrib,
							ht.ifElse(
								v.item.videoCodec === 'vp9',
								ht.source(
									{
										src: encodeURI(v.item.meta.fn.replace('/client','')).replaceAll('#','%23'),
										type: 'video/webm'
									}
								),
								ht.source(
									{
										src: encodeURI(v.item.meta.fn.replace('/client','')).replaceAll('#','%23'),
										type: 'video/mp4'
									}
								)
							)
						),
						() => {
							if (
								v.can('download')
								||
								v.can('stopdl')
							) {
								return ht.concat(
									ht.video(
										attrib,
										ht.ifElse(
											v.item.meta.videoStreams[vstream].container === 'webm',
											ht.source(
												{
													src: v.item.meta.videoStreams[vstream].url,
													type: 'video/webm'
												}
											),
											ht.source(
												{
													src: v.item.meta.videoStreams[vstream].url,
													type: 'video/mp4'
												}
											)
										)
									),
									ht.forEach(
										v.item.meta.videoStreams,
										(e,i,a) => {
											let info = `Play ${e.type} - ${e.quality} - ${e.codec} - ${e.container}`;
											return ht.div(
												{
													'class': i === vstream ? 'codecdiv altdiv' : 'codecdiv divdiv',
													onclick: ht.evt('wapp.reembed',id,i),
													title: info,
													style: ht.css({top: `${60+21*(1+i)}px`})
												},
												ht.img(
													{
														'class': 'codecimg',
														src: `../img/${e.type}_over.png`
													}
												)
											);
										}
									)
								)
							} else {
								return ht.iframe(
									{
										class : "embedframe",
										src : `${wapp.cfg.video.embedUrl}/${id}?autoplay=${this.
											cfg.video.embedAutoplay}&mute=${this.
												cfg.video.embedMuted}&playlist=${id}&loop=${this.
													cfg.video.embedLoop}`,
										allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
										allowfullscreen : "allowfullscreen"
									}
								)
							}
						}
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
								src: '../img/discard_over.png',
							}
						)
					),
					ht.div(
						{
							'class': 'embedinfodiv divdiv',
							onmouseenter: ht.evt('wapp.embedInfo',true,id),
							onmouseleave: ht.evt('wapp.embedInfo',false,id)
						},
						ht.img(
							{
								'class': 'embedinfoimg',
								src: '../img/showinfo_over.png',
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
			}
		}
		this.reembedded = false;
		event.stopPropagation();
	}

	reembed(event,id,ndx) {
		ut.html('#play','');
		this.reembedded = true;
		this.embed(event,id,ndx);
	}

	// leave an emedded video
	unembed(event) {
		this.embedded = false;
		ut.html('#play','');
		ut.css('#play',{display:'none'});
		ut.css('#page',{display:'block'});
		event.stopPropagation();
	}

	embedInfo(event, show, id) {
		let v = this.itemx[id];
		if (show) {
			v.embedInfo = true;
			ut.replaceWith('#embedInfo',v.html);
			ut.css('#embedInfo',{display:'block'});
		} else {
			v.embedInfo = false;
			ut.css('#embedInfo',{display:'none'});
		}
	}

	// backfill request has completed, re-list/re-sort
	backfilled(data) {
		if (
			wapp.list.chanMode
			&&
			this.itemx[data.cid]
			&&
			data.cid === this.itemx[data.cid].item.id
		) {
			this.itemx[data.cid].backfilled = data.count - data.orig;
			this.itemx[data.cid].redisplay();
			//this.refreshContent(true,true,0);
		}
	}

	// collect value from generic select control
	genericSelect(id, suffix, field, ndx = -1, subfield = '') {
		let x = this.itemx[id];
		if (x) {
			let val = subfield.length ?
				ndx >=0 ? ut.val(`#${field}Select_${id}_${ndx}_${subfield}`) :
					ut.val(`#${field}Select_${id}_${subfield}`) :
				ndx >=0 ? ut.val(`#${field}Select_${id}_${ndx}`) :
					ut.val(`#${field}Select_${id}`);
			if (parseInt(val) == val) val = parseInt(val);
			if (suffix === 'item') {
				ndx >= 0 ?
					subfield.length ?
						x.item[field][ndx][subfield] = val :
						x.item[field][ndx]=val :
					x.item[field] = val;
			} else if (suffix === 'meta') {
				ndx >= 0 ?
					subfield.length ?
						x.item.meta[field][ndx][subfield] = val :
						x.item.meta[field][ndx]=val :
					x.item.meta[field] = val;
			} else {
				ndx >= 0 ?
					subfield.length ?
						x[field][ndx][subfield] = val :
						x[field][ndx]=val:
					x[field] = val;
			}
			x.set();
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
		let maxPage = Math.floor((this.filtered-1)/this.limit);
		if ((this.showing.length) && (this.page<maxPage)) {
			this.page++;
			this.refreshContent(true,false);
		}
	}

	// navigate to the top of the list
	home() {
		if (this.showing.length && this.page) this.refreshContent(true,false,0);
	}

	// navigate to the bottom of the list
	end() {
		let maxPage = Math.floor((this.filtered-1)/this.limit);
		if ((this.showing.length) && (this.page!=maxPage)) {
			this.page = maxPage
			this.refreshContent(true,false);
		}
	}

	// capture keyboard events
	keyDown(event) {
		if (!this.editing) {
			switch (event.code) {
				case 'ShiftLeft':
				case 'ShiftRight': this.shiftPressed = true; break;
				case 'ControlLeft':
				case 'ControlRight': this.ctrlPressed = true; break;
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
					this.actionAll(event);
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
	keyUp(event) {
		switch (event.key) {
			case 'Shift': this.shiftPressed = false; break;
			case 'Control': this.ctrlPressed = false; break;
			default: break;
		}
	}

	// get edited name
	nameEdit(id) {
		this.editText(false);
		let v = this.itemx[id];
		v.name = ut.val(`#nam_${id}`);
	}

	// go to channel on youtube
	ytchan(event,id) {
		let cid = id;
		if (this.itemx[id].type == 'video') cid = this.itemx[id].item.channel;
		window.open(`${wapp.cfg.channel.url}/${cid}`,'_blank');
		event.stopPropagation();
	}

	// watch a video on youtube
	views(event,id) {
		window.open(`${wapp.cfg.video.watchUrl}${id}`,'_blank');
		event.stopPropagation();
	}

	// get edited query
	queryEdit(id) {
		let v = this.itemx[id];
		v.query = ut.val(`#qry_${id}`);
	}

	// get disallowed text list
	disallowEdit(id) {
		let v = this.itemx[id];
		v.disallow = ut.val(`#dis_${id}`);
	}

	// refresh an item
	refresh(event,id) {
		let v = this.itemx[id];
		if (v !== undefined) this.emit('refresh',{
			type: v.type,
			id: v.item.id
		});
		event.stopPropagation();
	}

	// refresh/resort the item list
	resort(event) {
		this.setItemControls(true,true);
	}

	// adjust item display size
	scale(i) {
		let t = this.subtype;
		let cl = this.itemObject;
		let dum = new cl({},t.scale);
		let ch = ut.outerHeight('#content');
		let sw = dum.padding + dum.margin;
		let ih = cl.calc_height(t.scale) + 2 * sw;
		let rows = Math.floor(ch / ih);
		rows += i;
		if (rows < 1) rows = 1;
		let nh = ch / rows;
		t.scale *= nh /ih;
		//ut.html('#item_scale',this.subtype.scale.toFixed(2));
		this.setItemControls(true,false);
	}

	// sort in ascending order
	asc(event) {
		this.subtype.dir = 'DESC';
		this.updcfg();
		this.refreshContent(true,true,0);
		ut.html('#ascdesc', this.button('desc','sort in ascending (a-z) order - currently in decending (z-a) order'));
	}

	// sort in descending order
	desc(event) {
		this.subtype.dir = 'ASC';
		this.updcfg();
		this.refreshContent(true,true,0);
		ut.html('#ascdesc', this.button('asc','sort in descending (z-a) order - currently in ascending (a-z) order'));
	}

	// scale item display size down to fit one more row.
	scaledown() {
		this.scale(1);
	}

	// scale item display size up to fit one row less
	scaleup() {
		this.scale(-1);
	}

	// show topic category check list
	showCheckList(event,id) {
		let g = this.itemx[id];
		g.showCheckList();
		event.stopPropagation();
	}

	// check/uncheck a category
	checkListClick(event,id,c) {
		let g = this.itemx[id];
		g.checkListClick(c);
		event.stopPropagation();
	}

	// thumb enters preview div
	thumbenter(event,id) {
		this.itemx[id].thumbenter(event);
	}

	// thumb leaves preview div
	thumbleave(event,id) {
		this.itemx[id].thumbleave(event);
	}

	// thumb move withing preview div
	thumbmove(event,id) {
		this.itemx[id].thumbmove(event);
	}

	// client area was resized
	resize() {
		if (this.refreshTime !== null) this.refreshContent(true,false);
	}

	// server was stopped
	stop(data) {
		location.reload();
	}

	// check/uncheck active topic
	topicActive(id) {
		let v = this.itemx[id];
		v.active = ut.prop(`#act_${id}`,'checked');
		v.redisplay();
	}

	// check/uncheck active search
	searchActive(id) {
		let v = this.itemx[id];
		v.active = ut.prop(`#act_${id}`,'checked');
		v.redisplay();
	}

	// check/uncheck proxified search
	searchProxy(id) {
		let v = this.itemx[id];
		v.proxify = ut.prop(`#pxy_${id}`,'checked');
		v.redisplay();
	}

	// dermine if video preview generated an error
	videoPreviewError(event,id) {
		let v = this.itemx[id];
		v.videoError = true;
		v.redisplay();
	}

	// set background colors of video to rgb
	bgi(id, rgb) {
		ut.css(`#div_${id}`,{'background-color':rgb});
	}

	// set background colors of channel to rgb
	bgc(cid, rgb) {
		let keys = Object.keys(this.itemx);
		keys.forEach(k => {
			let v = this.itemx[k];
			if ((v.item.channel && v.item.channel === cid) && (!this.list.chanMode)) {
				this.bgi(v.item.id,rgb);
			}
		});
	}

	// return background colors channel to default
	rgb(cid) {
		let keys = Object.keys(this.itemx);
		keys.forEach(k => {
			let v = this.itemx[k];
			if (v.item.channel && v.item.channel === cid) {
				this.bgi(v.item.id,v.rgb);
			}
		});
	}
}
