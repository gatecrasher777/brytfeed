// ytzero - client video container class
// https://github.com/gatecrasher777/ytzero
// (c) 2021/2 gatecrasher777
// MIT Licenced

class ytzVideo extends ytzItem {

	// video item constructor
	constructor(item, scale) {
        super(item,scale);
        this.type = 'video';
        this.sb = undefined;
        this.sbscale = 1;
        this.pos = 0;
        this.thumbX = 0;
        this.maxgap = wapp.cfg.video.maxGap;
        this.mingap = wapp.cfg.video.minGap;
        this.gap = 1;
        this.fps = 10;
        this.playTimer = null;
        this.previewType = this.initPreview;
        this.prevPreview = this.previewType;
        this.showPreview = 'any';
        this.old = wapp.cfg.video.old;
        switch (this.item.status) {
            case 'NOK': this.color = {
                'r': wapp.cfg.video.nokRed,
                'g': wapp.cfg.video.nokGreen,
                'b': wapp.cfg.video.nokBlue
            }; break;
            case 'VIP': this.color = {
                'r': wapp.cfg.video.privateRed,
                'g': wapp.cfg.video.privateGreen,
                'b': wapp.cfg.video.privateBlue
            }; break;
            case 'VAR': this.color = {
                'r': wapp.cfg.video.restrictedRed,
                'g': wapp.cfg.video.restrictedGreen,
                'b': wapp.cfg.video.restrictedBlue
            }; break;
            case 'CTM':
            case 'VRM': this.color = {
                'r': wapp.cfg.video.removedRed,
                'g': wapp.cfg.video.removedGreen,
                'b': wapp.cfg.video.removedBlue
            }; break;
            case 'CDL':
            case 'VOL':
            case 'VDL': this.color = {
                'r': wapp.cfg.video.deletedRed,
                'g': wapp.cfg.video.deletedGreen,
                'b': wapp.cfg.video.deletedBlue
            }; break;
            default: this.color = {
                'r': wapp.cfg.video.red,
                'g': wapp.cfg.video.green,
                'b': wapp.cfg.video.blue
            }; break;
        }
        this.resize();
        this.lastPage = -1;
        this.choosing = false;
        this.sources = '';
        this.showInfo = false;
        this.videoError = false;
	}

    // initialize preview state
    get initPreview() {
        return wapp.subtype.preview === 'hybrid' ?
        this.item.duration <= wapp.cfg.client.hybridDuration ?
            'videos' :
            'storyboards' :
        wapp.subtype.preview;
    }

	// resize the video item
    resize() {
        this.height = ytzVideo.calc_height(this.scale);
    }

	// get age since published
    get age() {
        return (ut.now()-this.item.published)/1000;
    }

	// whether an action is actionable
    can(act) {
        switch (act) {
            case 'showinfo': return this.previewType !== 'info';
            case 'showimage': return this.previewType !== 'images';
            case 'playstory': return this.previewType !== 'storyboards';
            case 'playvideo': return this.previewType !== 'videos';
            case 'discard':
            case 'discarded': return (
                wapp.state !== 'entry'
                && (
                    !['download..','downloaded','discarded'].includes(this.item.state)
                    ||
                    wapp.state === 'download'
                )
            );
            case 'rotate': return this.previewType !== 'info';
            case 'video': return (!this.videoError && (ut.now()<(this.item.updated+1000*this.item.expiry)));
            case 'download':
                let exp = (ut.now()>(this.item.updated+1000*this.item.expiry));
                let dl = ( this.item.state === 'download..' || this.item.state === 'downloaded');
                return (
                    this.item.meta
                    &&
                    this.item.meta.videoStreams
                    &&
                    this.item.meta.videoStreams.length
                    &&
                    !exp
                    &&
                    !dl
                );
            case 'stopdl':  return (this.item.state === 'download');
            case 'cancel': return (this.item.state == 'download..');
            case 'queue':
                return ['result','preview','upgrade','update','noupdate','offline','discarded'].includes(this.item.state);
            case 'unqueue': return (this.item.state === 'queue');
            case 'refresh':
                return !['download','download..','downloaded'].includes(this.item.state);
            case 'erase':
            case 'export': return (this.item.state === 'downloaded');
            case 'block': return this.item.clevel !== wapp.cfg.advanced.blockLevel;
            case 'search': return this.item.clevel !== wapp.cfg.advanced.searchLevel;
            case 'scan': return this.item.clevel !== wapp.cfg.advanced.scanLevel;
            case 'update': return this.item.clevel !== wapp.cfg.advanced.updateLevel;
            case 'like': return this.item.clevel !== wapp.cfg.advanced.likeLevel;
            case 'follow': return this.item.clevel !== wapp.cfg.advanced.followLevel;
            case 'unchan': return wapp.list.chanMode;
            case 'chan': return (!wapp.list.chanMode && this.item.topic);
            case 'play': return ((this.item.meta.fn.length && this.item.state === 'downloaded') || this.item.meta.canEmbed);
            default: return false;
        }
    }

	// show video info
    get vidInfo() {
        if (this.item.state === 'result') return '';
        if (this.item.meta.videoStreams.length) {
            this.item.meta.videoStreams.sort(wapp.vsort);
            let vi = this.item.meta.videoStreams.findIndex(e => !e.failed);
            if (vi >= 0) {
                let v = this.item.meta.videoStreams[vi];
                let uc = v.container;
                let s = v.size;
                if (v.type !== 'both') {
                    if (this.item.meta.audioStreams.length) {
                        this.item.meta.audioStreams.sort(wapp.asort);
                        let asu = false;
                        this.item.meta.audioStreams.forEach( as => {
                            if (
                                (!asu)
                                &&
                                (!as.failed)
                                &&
                                (
                                    (wapp.cfg.advanced.videoContainer === 'mkv')
                                    ||
                                    (v.container == as.container)
                                )
                            ) {
                                    asu = true;
                                    s += as.size;
                                    if (v.container != as.container) uc = 'mkv';
                            }
                        });
                    }
                }
                return `${ht.br() + ht.b('format: ') + uc} - ${v.quality} - ${ut.qFmt(s, 'g')}b`;
            }
        }
        return '';
    }

	// show views string
    get viewsStr() {
        return ut.qFmt(this.item.views);
    }

	// show views
    get views() {
        return wapp.lcell(
            wapp.lcell(
                ht.a(
                    {
                        href: `${wapp.cfg.video.watchUrl}${this.item.id}`,
                        title: 'click to watch this video on YouTube',
                        target: '_blank'
                    },
                    ht.img(
                        {
                            src: '../img/views.png',
                            'class': 'eyeimg'
                        }
                    )
                ),
                wapp.cfg.video.viewsEyeField
            )
            +
            wapp.lcell(
                ht.div(
                    {
                        id: `vws_${this.item.id}`,
                        title: 'number of views received by this video (k=thousands, m=millions, b=billions)'
                    },
                    ut.qFmt(this.item.views)
                ),
                wapp.cfg.video.viewsValueField
            ),
            wapp.cfg.video.viewsField
        );
    }

	// show duration
    get duration() {
        return wapp.lcell(
            ht.div(
                {
                    id:`dur_${this.item.id}`,
                    title: 'video length in seconds, minutes:seconds, or hours:minutes:seconds'
                },
                () => {
                    if ( this.item.duration <=0 || this.item.meta.isLive ) return 'live';
                    return ut.secDur(this.item.duration);
                }
            ),
            wapp.cfg.video.durationField
        );
    }

    get sortValue() {
        return wapp.lcell(
            ht.div(
                {
                    id:`srt_${this.item.id}`,
                    title: 'Sort field and value'
                },
                `${wapp.subtype.sort}: ${wapp.markStr(wapp.mark(this.item))}`
            ),
            wapp.cfg.video.sortField
        );
    }

	// show published string
    get publishedStr() {
        return ut.tsAge(this.item.published)
    }

	// show when published
    get published() {
        return wapp.rcell(
            ht.div(
                {
                    id: `pub_${this.item.id}`,
                    title: 'time that has elapsed since this video was published'
                },
                this.publishedStr
             ),
             wapp.cfg.video.publishedField
        );
    }

	// show reviewed string
    get reviewedStr() {
        return `@ ${ut.tsAge(this.item.reviewed)}`;
    }

	// show when reviewed
    get reviewed() {
        return wapp.rcell(
            ht.div(
                {
                    id: `rev_${this.item.id}`,
                    'class': 'lcell'
                },
                this.reviewedStr
            )
        );
    }

	// show information frame
    get frame() {
        this.previewType = 'info';
        let attr = {
            id: `outer_${this.item.id}`,
            'class': 'outerdiv',
        }
        return ht.div(
            attr,
            ht.div(
                {
                    id: `inner_${this.item.id}`,
                    'class': 'innerdiv',
                    style: ht.css({
                        top: `${wapp.cfg.video.innerFrame*this.scale}px`,
                        left: `0px`,
                        right: `0px`,
                        bottom: `${wapp.cfg.video.innerFrame*this.scale}px`,
                        'pointer-events' : 'inherit',
                        cursor : 'auto'
                    }),
                },
                this.channel,
                this.cstats,
                this.text,
                this.stats,
                this.metarow
            ),
            this.divopts,
            this.prevnext
        );
    }

	// show overlay options
    get divopts() {
        if (this.embedInfo) return '';
        return ht.concat(
            this.div('chan','to filter on this channel'),
            this.div('unchan','to exit channel filter'),
            this.div('queue','queue this video'),
            this.div('unqueue','unqueue this video'),
            this.div(
                        'block',
                        'block this channel - discards existing videos and adds no new videos',
                        true,
                        'this channel is blocked'
                    ),
            ht.ifElse(
                this.item.cstatus === 'OK',
                ht.concat(
                    this.div(
                        'search',
                        'set channel level to search - only adds videos from search',
                        true,
                        'this channel is searched'
                    ),
                    this.div(
                        'scan',
                        'set channel level to scan - scans channel when new videos are discovered from search',
                        true,
                        'this channel is scanned'
                    ),
                    this.div(
                        'update',
                        'set channel to update - adds videos from search and regular channel scans',
                        true,
                        'this channel is updated'
                    ),
                    this.div(
                        'like',
                        `like this channel - adds videos from search and regular channel scans (with ${wapp.
                        cfg.advanced.likeFrequency}x frequency)`,
                        true,
                        'this channel is liked'
                    ),
                    this.div(
                        'follow',
                        `follow this channel -  adds videos from search and regular channel scans (with ${wapp.
                        cfg.advanced.followFrequency}x frequency)`,
                        true,
                        'this channel is followed'
                    ),
                )
            ),
            this.div('discard','discard this video'),
            this.div('rotate','rotate video preview 90 degrees anti-clockwise'),
            this.div('refresh','refresh this video info now'),
            this.div(
                'showinfo',
                'show information about this video',
                true,
                'showing video information'
            ),
            this.div(
                'showimage',
                'show image preview and manual storyboard for this video',
                true,
                'showing video image'
            ),
            this.div(
                'playstory',
                'play storyboard preview for this video',
                true,
                'playing storyboard preview'
            ),
            this.div(
                'playvideo',
                'play video preview for this video',
                true,
                'playing video preview'
            ),
            this.div('download','download this video'),
            this.div('stopdl','stop the pending download of this video'),
            this.div('cancel','cancel download'),
            this.div('erase','erase the downloaded video'),
            this.div('export','export the downloaded video to the export directory now'),
        );
    }

	// show whether neighbouring items belong to the same channel
    get prevnext() {
        if (this.embedInfo) return '';
        let pnStyle = this.genStyle('image', {
            width: `${(this.width*wapp.cfg.video.imageHeight/2)}px`
        });
        return ht.concat(
            ht.div(
                {
                    id: `prv_${this.item.id}`,
                    'class': 'prevdiv divdiv',
                    style: pnStyle
                },
                ht.img(
                    {
                        'class': 'pnimg',
                        src: '../img/none.png',
                        style: pnStyle
                    }
                )
            ),
            ht.div(
                {
                    id: `nxt_${this.item.id}`,
                    'class': 'nextdiv divdiv',
                    style: pnStyle
                },
                ht.img(
                    {
                        'class': 'pnimg',
                        src: '../img/none.png',
                        style: pnStyle
                    }
                )
            )
        );
    }

	// mark that previous video as belonging to the same channel
    prev(show) {
        ut.html(`#prv_${this.item.id}`, ht.img(
            {
                'class': 'pnimg',
                title: show ? 'same channel as previous item' : '',
                src: show ? '../img/prev.png' : '../img/none.png',
                style: this.genStyle('image', {
                    width: `${(this.width * wapp.cfg.video.imageHeight / 2)}px`
                })
            }
        ));
    }

	// mark that next video as belonging to the same channel
    next(show) {
        ut.html(`#nxt_${this.item.id}`, ht.img(
            {
                'class': 'pnimg',
                title: show ? 'same channel as next item' : '',
                src: show ? '../img/next.png' : '../img/none.png',
                style: this.genStyle('image', {
                    width: `${(this.width * wapp.cfg.video.imageHeight / 2)}px`
                })
            }
        ));
    }

	// show preview
    get preview() {
        let s = [];
        if (this.item.meta) s = this.item.meta.storyBoards;
        if (s.length) {
            this.sb = s[s.length-1];
            let w = this.width / this.sb.width;
            let h = this.width * wapp.cfg.video.previewHeight / this.sb.height;
            this.sbscale = Math.min(w, h);
        }
        let attr = ['images','storyboards'].includes(this.previewType) ? {
            id: `outer_${this.item.id}`,
            'class': 'outerdiv',
            onmouseenter: ht.evt('wapp.thumbenter',this.item.id),
            onmousemove: ht.evt('wapp.thumbmove',this.item.id),
            onmouseleave: ht.evt('wapp.thumbleave',this.item.id),
            onclick: ht.evt('wapp.embed',this.item.id),
            title: 'click to play'
        } : {
            id: `outer_${this.item.id}`,
            'class': 'outerdiv',
            onclick: ht.evt('wapp.embed',this.item.id),
            onmouseenter: ht.evt('wapp.thumbenter',this.item.id),
            onmouseleave: ht.evt('wapp.thumbleave',this.item.id),
            title: 'click to play'
        }
        return ht.div(
            attr,
            ht.div(
                {
                    id: `inner_${this.item.id}`,
                    'class': 'innerdiv',
                    style: ht.css({
                        top: '0px',
                        left: '0px',
                        width: `${this.width}px`,
                        height: `${(this.width)}px`
                    }),
                },
            ),
            this.divopts,
            this.prevnext,
            ht.div(
                {
                    id:`trk_${this.item.id}`,
                    'class': 'trackdiv'
                }
            )
        );
    }

	// show textual info
    get text() {
        let rp = /\\n/g;
        return ht.div(
            {
                class: 'titlediv',
                style: this.genStyle('text')
            },
            ht.b(this.item.meta.title),
            ht.br(),
            ht.b('id: '),
            this.item.id,
            ht.ifElse(
                this.item.meta.category.length,
                ht.br() + ht.b('category: ') + this.item.meta.category
            ),
            this.vidInfo,
            ht.ifElse(
                this.item.meta.description.length,
                ht.br() + ht.b('description: ') + this.item.meta.description.replace(rp,'<br>')
            ),
            ht.ifElse(
                this.item.meta.keywords.length,
                ht.br() + ht.b('keywords: ') + this.item.meta.keywords.join(', ')
            ),
            ht.ifElse(
                (this.item.meta.topic && this.item.meta.topic.length),
                ht.br() + ht.b('topic: ') + this.item.topicName
            ),
            ht.ifElse(
                (this.item.meta.query && this.item.meta.query.length),
                ht.br() + ht.b('search: ') + this.item.searchName
            )
        );
    }

	// show channel info
    get channel() {
        let rgb = this.item.cstatus === 'CTM' ? wapp.cfg.video.terminatedRGB :
            this.item.cstatus === 'CDL' ? wapp.cfg.video.deletedRGB :
            this.item.clevel === wapp.cfg.advanced.followLevel ? wapp.cfg.video.followLevelRGB :
            wapp.cfg.video.channelRGB;
        let aa = { 'background-color:': rgb }
        return ht.div(
             {
                'class':'channelrow',
                style: this.genStyle('control')
            },
            ht.table(
                aa,
                ht.tbody(
                    ht.tr(
                        ht.td(
                            ht.div(
                                {
                                    'class' : 'channeldiv',
                                    onclick: ht.evt('wapp.ytchan',this.item.id,true),
                                    title: 'click to view this channel on YouTube',
                                    style: ht.css({
                                        width: `${(this.width * wapp.cfg.video.chanHeight -
                                            wapp.cfg.channel.thumbGap)}px`,
                                        height: `${(this.width * wapp.cfg.video.chanHeight -
                                            wapp.cfg.channel.thumbGap)}px`
                                    })
                                },
                                ht.img(
                                    {
                                        'class': 'avatar',
                                        src: this.item.cmeta.thumbnail || this.item.meta.channelThumb,
                                        style: ht.css({
                                            width: `${(this.width * wapp.cfg.video.chanHeight -
                                                wapp.cfg.channel.thumbGap)}px`,
                                            height: `${(this.width * wapp.cfg.video.chanHeight -
                                                wapp.cfg.channel.thumbGap)}px`
                                        })
                                    }
                                )
                            )
                        ),
                        ht.td(
                            ht.div(
                                {
                                    class: 'authordiv'
                                },
                                ht.b(this.item.meta.author),
                                ht.br(),
                                ht.small(
                                ht.small(this.item.topicName,' - ',this.item.searchName))
                            )
                        ),
                        ht.td(
                            this.flag
                        )
                    )
                )
            )
        );
    }

	// show channel views string
    get cviewsStr() {
        return ut.qFmt(this.item.cviews);
    }

	// show when joined
    get cjoined() {
        return ht.div(
            ut.tsAge(this.item.cjoined)
        );
    }

	// show channel views
    get cviews() {
        return ht.div(
            this.cviewsStr
        );
    }

	// show channel subscribers string
    get csubsStr() {
        return ut.qFmt(this.item.csubs);
    }

	// show channel subscribers
    get csubs() {
        return ht.div(
            this.csubsStr
        );
    }

	// show channel stats
    get cstats() {
        return ht.div(
            {
                'class': 'statsrow',
                style: this.genStyle('stat')
            },
            wapp.lcell('subs:'),
            wapp.lcell(this.csubs,wapp.cfg.video.channelSubsField),
            wapp.lcell('views:',wapp.cfg.video.channelViewsLabel),
            wapp.lcell(this.cviews,wapp.cfg.video.channelViewsField),
            wapp.rcell(this.cjoined),
            wapp.rcell('joined: ')
        );
    }

	// show stats
    get stats() {
        return ht.concat(
            ht.div(
                {
                    'class': 'statsrow',
                    style:  this.genStyle('stat')
                },
                this.duration,
                this.views,
                this.published
            ),
            ht.div(
                this.sortValue,
                wapp.rcell(this.item.state)
            )
        )
    }

	// show metadata row
    get metarow() {
        return ht.div(
            {
                'class': 'metarow',
                style: this.genStyle('meta', {
                    'padding-top': `${this.padding}px`
                })
            },
            wapp.lcell(this.status),
            wapp.lcell(this.reviewed)
        )
    }

	// show body
    get body() {
        if (
            this.showPreview === 'info'
            ||
            this.embedInfo
            ||
            (
                this.showPreview === 'any'
                &&
                this.previewType === 'info'
            )
        ) return this.frame;
        return this.preview;
    }

	// show content
    get content() {
        return ht.concat(
            ht.div(
                {
                    class: 'contentdiv'
                },
                this.body
            ),
            ht.ifElse(
                (this.item.state == 'download..'),
                ht.div(
                    {
                        'id': `prg_${this.item.id}`,
                        'class': 'progressdiv',
                    }
                )
            )
        );
    }

	// determine video item height
    static calc_height(scale) {
        return  wapp.cfg.item.width * scale * wapp.cfg.video.previewHeight;
    }

	// refresh updateable video data
    refresh(p,n) {
        super.refresh();
        ut.html(`#rev_${this.item.id}`,this.reviewedStr);
        ut.html(`#vws_${this.item.id}`,this.viewsStr);
        ut.html(`#pub_${this.item.id}`,this.publishedStr);
        this.prev(p);
        this.next(n);
    }

	// show a storybord image
    showSBImage() {
        const page = Math.floor(this.pos / this.sb.page[0].frames);
        const left = this.sbscale * this.sb.width * (this.pos % this.sb.perCol);
        const top = this.sbscale * this.sb.height * (Math.floor(this.pos / this.sb.perCol) % this.sb.perRow);
        const thumb = document.getElementById(`thumb_${this.item.id}`);
        let cpage;
        let tframes;
        if (this.sb.frames<0) {
            cpage = this.sb.page[0];
            tframes = Math.floor(this.item.duration/wapp.cfg.video.liveFPS)-1;
        } else {
            cpage = this.sb.page[page];
            tframes = this.sb.frames-1
        }
        if (thumb && cpage) {
            const width = this.sbscale * cpage.width;
            const height = this.sbscale * cpage.height;
            const ofs = (height - width)/2
            if (page != this.lastPage) {
                let clink;
                if (this.sb.frames < 0) {
                    clink = cpage.link.replace('$M',page.toString());
                } else {
                    clink = cpage.link;
                }
                thumb.setAttribute('src',clink);
                thumb.className = `rotate${this.rotation}`;
                thumb.style.width = `${width}px`;
                thumb.style.height = `${height}px`;
                this.lastPage = page;
                switch (this.rotation) {
                    case 0:
                        thumb.style.right = 'auto';
                        thumb.style.bottom = 'auto';
                    break;
                    case 1:
                        thumb.style.right = 'auto';
                        thumb.style.top = 'auto';
                    break;
                    case 2:
                        thumb.style.left = 'auto';
                        thumb.style.top = 'auto';
                    break;
                    default:
                        thumb.style.left = 'auto';
                        thumb.style.bottom = 'auto';
                    break;
                }
            }
            switch (this.rotation) {
                case 0:
                    thumb.style.left = `${-left}px`;
                    thumb.style.top = `${-top}px`;
                break;
                case 1:
                    thumb.style.left = `${ofs - top}px`;
                    thumb.style.bottom = `${-left - ofs}px`;
                break;
                case 2:
                    thumb.style.right = `${-left}px`;
                    thumb.style.bottom =  `${-top}px`;
                break;
                default:
                    thumb.style.right = `${ofs - top}px`;
                    thumb.style.top = `${- left - ofs}px`;
                break;
            }
        }
        ut.css(`#trk_${this.item.id}`,{width: `${this.pos*100/tframes}%`});
        /*
        ut.html('#dur_'+this.item.id,
            ut.secDur(Math.max(0,Math.floor(this.pos*this.item.duration/tframes)))+
           '/'+
           ut.secDur(this.item.duration)
        );
        */
    }

    // thumb enter preview event
    thumbenter(event) {
        wapp.bgc(this.item.channel,'rgb(0,127,127)');
        wapp.bgi(this.item.id,'rgb(127,255,255)');
        if (this.sb) {
            if (this.previewType === 'images') {
                this.thumbX = ut.offset(`#outer_${this.item.id}`).left;
                switch(this.rotation) {
                    case 0:
                        ut.css(`#inner_${this.item.id}`,{
                            top: `${((this.width*wapp.cfg.video.previewHeight-this.sbscale*this.sb.height)/2)}px`,
                            left: `${((this.width-this.sbscale*this.sb.width)/2)}px`,
                            width : `${this.sbscale*this.sb.width}px`,
                            height : `${this.sbscale*this.sb.height}px`,
                            right: 'auto',
                            bottom: 'auto'
                        });
                    break;
                    case 1:
                        ut.css(`#inner_${this.item.id}`,{
                            top: `${((this.width*wapp.cfg.video.previewHeight-this.sbscale*this.sb.width)/2)}px`,
                            left: `${((this.width-this.sbscale*this.sb.height)/2)}px`,
                            width : `${this.sbscale*this.sb.height}px`,
                            height : `${this.sbscale*this.sb.width}px`,
                            right: 'auto',
                            bottom: 'auto'
                        });
                    break;
                    case 2:
                        ut.css(`#inner_${this.item.id}`,{
                            bottom: `${((this.width*wapp.cfg.video.previewHeight-this.sbscale*this.sb.height)/2)}px`,
                            right: `${((this.width-this.sbscale*this.sb.width)/2)}px`,
                            width: `${this.sbscale*this.sb.width}px`,
                            height: `${this.sbscale*this.sb.height}px`,
                            left: 'auto',
                            top: 'auto'
                        });
                    break;
                    default:
                        ut.css(`#inner_${this.item.id}`,{
                            bottom: `${((this.width*wapp.cfg.video.previewHeight-this.sbscale*this.sb.width)/2)}px`,
                            right: `${((this.width-this.sbscale*this.sb.height)/2)}px`,
                            width: `${this.sbscale*this.sb.height}px`,
                            height: `${this.sbscale*this.sb.width}px`,
                            left: 'auto',
                            top: 'auto'
                        });
                    break;
                }
            }
        }
    }

    // thumb move over preview event
    thumbmove(event) {
        if (this.sb) {
            if (this.previewType === 'images') {
                if (this.sb.frames<0) {
                    this.pos = Math.floor((this.item.duration/wapp.cfg.video.liveFPS-1)*(event.clientX-this.thumbX)/(this.width));
                } else {
                    this.pos = Math.floor((this.sb.frames-1)*(event.clientX-this.thumbX)/(this.width));
                }
                this.showSBImage();
            }
        }
    }

    // thumb leave preview event
    thumbleave(event) {
        wapp.rgb(this.item.channel);
        if (this.sb) {
            if (this.previewType === 'images') {
                ut.attr(`#thumb_${this.item.id}`,{
                    'class': `static${this.rotation}`,
                    src:`${wapp.cfg.video.imageUrl}/${this.item.id}/${wapp.cfg.video.defaultImage}`
                });

                if (this.rotation % 2) {
                    ut.css(`#thumb_${this.item.id}`,{
                        width: `${wapp.cfg.video.thumb0WidthX * this.width}px`,
                        height: `${this.width}px`,
                        left: `${wapp.cfg.video.thumb0Left}%`,
                        top: `${wapp.cfg.video.thumb0Top}%`,
                        right: 'auto',
                        bottom: 'auto'
                    });
                } else {
                    ut.css(`#thumb_${this.item.id}`,{
                        width: `${this.width}px`,
                        height: `${(this.width * wapp.cfg.video.thumb1WidthX)}px`,
                        left: `${wapp.cfg.video.thumb1Left}%`,
                        top: `${wapp.cfg.video.thumb1Top}%`,
                        right: 'auto',
                        bottom: 'auto'
                    });
                }

                ut.css(`#inner_${this.item.id}`,{
                    top: '0px',
                    left: '0px',
                    width: `${this.width}px`,
                    height: `${this.width}px`
                });
                //ut.html(`#dur_${this.item.id}`,ut.secDur(this.item.duration));
                this.lastPage = -1;
            }
        }
    }

    // show the static thumnail image
    get thumb() {
        return ht.ifElse(
            this.rotation % 2,
            ht.img(
                {
                    id: `thumb_${this.item.id}`,
                    'class': `static${this.rotation}`,
                    src: `${wapp.cfg.video.imageUrl}/${this.item.id}/${wapp.cfg.video.defaultImage}`,
                    style: ht.css(
                        {
                            width: `${wapp.cfg.thumb0WidthX * this.width}px`,
                            height: `${this.width}px`,
                            left: `${wapp.cfg.video.thumb0Left}%`,
                            top: `${wapp.cfg.video.thumb0Top}%`
                        }
                    )
                }
            ),
            ht.img(
                {
                    id: `thumb_${this.item.id}`,
                    'class': `static${this.rotation}`,
                    src: `${wapp.cfg.video.imageUrl}/${this.item.id}/${wapp.cfg.video.defaultImage}`,
                    style: ht.css(
                        {
                            width: `${this.width}px`,
                            height: `${(this.width * wapp.cfg.thumb1WidthX)}px`,
                            left: `${wapp.cfg.video.thumb1Left}%`,
                            top: `${wapp.cfg.video.thumb1Top}%`,
                        }
                    )
                }
            )
        );
    }

    // show thumbnail image or manual storyboard
    playImages() {
        this.previewType = 'images';
        clearInterval(this.playTimer);
        this.lastPage = -1;
        ut.html(`#inner_${this.item.id}`,this.thumb);
    }

    // play animated storyboard
    playStoryboards() {
        if (this.sb) {
            this.playImages();
            this.thumbenter(null);
            this.previewType = 'storyboards';
            if (this.sb.frames<0) {
                if (this.item.duration) {
                    this.gap = Math.min(this.maxgap,Math.max(this.mingap,Math.sqrt(this.item.duration)*1000/(this.item.duration/2-1)));
                } else {
                    this.gap = wapp.cfg.video.liveGap;
                }
            } else {
                this.gap = Math.min(this.maxgap,Math.max(this.mingap,Math.sqrt(this.item.duration)*1000/(this.sb.frames-1)));
            }
            this.pos = 0;
            this.showSBImage();
            this.playTimer = setInterval(
                ()=>{
                    this.pos++;
                    if (this.sb.frames<0) {
                        if (this.pos==Math.floor(this.item.duration/wapp.cfg.video.liveFPS)) this.pos=0;
                    } else {
                        if (this.pos==this.sb.frames) this.pos=0;
                    }
                    this.showSBImage();
                },
                this.gap
            );
        } else if (this.can('video')) {
            this.playVideos();
        } else {
            this.playImages();
        }
    }

    // play video
    playVideos() {
        if (this.can('video')) {
            this.previewType = 'videos';
            clearInterval(this.playTimer);
            if (!this.sources.length) {
                this.sources = '';
                for (let i = this.item.meta.videoStreams.length-1; i >= 0; i--) {
                    let s = this.item.meta.videoStreams[i];
                    let a = {
                        src: s.url,
                        type: `video/${s.container}`
                    }
                    if (!i) a.onerror = ht.evt('wapp.videoPreviewError',this.item.id);
                    this.sources += ht.source(a);
                }
            }
            if (this.sources.length) {
                ut.html(`#inner_${this.item.id}`,
                    ht.video(
                        {
                            id: `video_${this.item.id}`,
                            'class': `rvideo${this.rotation}`,
                            muted : wapp.cfg.video.previewMuted,
                            loop : wapp.cfg.video.previewLoop,
                            autoplay : wapp.cfg.video.previewAutoplay,
                            width: `${this.width}px`,
                            height: `${this.width*wapp.cfg.video.previewHeight}px`
                        },
                        this.sources
                    )
                );
                var vid = document.getElementById(`video_${this.item.id}`);
                vid.playbackRate = Math.min(
                    wapp.cfg.video.maxPlayback,
                    Math.max(
                        wapp.cfg.video.minPlayback,
                        Math.sqrt(
                            this.item.duration / wapp.cfg.video.divPlayback
                        )
                    )
                );
                this.playTimer = setInterval(
                    ()=>{
                        ut.css(`#trk_${this.item.id}`,{width: `${vid.currentTime*100/vid.duration}%`});
                    },
                    wapp.cfg.video.trackDelayMS
                );
            }
        } else if (this.sb) {
            this.playStoryboards();
        } else {
            this.playImages();
        }
	}

    // get current rotation 0 (0 deg) , 1 (90 deg AC), 2 (180 deg AC) or 3 (270 deg AC)
    get rotation() {
        if (!this.item.meta.rotation) this.item.meta.rotation = 0;
        return this.item.meta.rotation;
    }

    // change current rotation to value
    set rotation(value) {
        this.item.meta.rotation = value;
        (this.sb && value % 2) ? this.sbscale *= this.sb.height/this.sb.width :
            this.sbscale *= this.sb.width/this.sb.height;
        this.set();
    }

    // rotate the image/storyboard/video by 90 degrees anti-clockwise
    rotate() {
        this.rotation === 3 ? this.rotation = 0 : this.rotation++;
        this.lastPage = -1;
        this.redisplay();
    }

    // clear the video item
    clear() {
        super.clear();
        clearInterval(this.playTimer);
    }

    // reset the preview
    repreview() {
        if (this.showPreview === 'images') {
            this.playImages();
        } else if (this.showPreview === 'storyboards') {
            this.playStoryboards();
        } else if (this.showPreview === 'videos') {
            this.playVideos()
        } else if (this.showPreview === 'any') {
            if (this.previewType !== 'info') {
                if (this.item.status === 'VIP' && this.can('video')) {
                    this.playVideos();
                } else {
                    if (this.previewType === 'videos') {
                        this.playVideos();
                    } else if (this.previewType === 'storyboards') {
                        this.playStoryboards();
                    } else {
                        (this.item.status === 'OK') ? this.playImages() : this.playStoryboards();
                    }
                }
            }
        }
    }

    // redisplay the item
    redisplay() {
        if (this.showPreview === 'any') this.previewType = this.initPreview;
        ut.replaceWith(`#div_${this.item.id}`,this.html);
        this.repreview();
    }

}
