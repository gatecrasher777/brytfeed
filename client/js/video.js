/* brytfeed - (c) 2023 Gatecrasher777 */
/* video client module */

// video item class
class Video extends Model {

	// video item constructor
    // item <object> video data
    // scale <double> required size of item
	constructor(item, scale) {
        super('video',item,scale);
        this.sb = undefined;
        this.sbscale = 1;
        this.pos = 0;
        this.thumbX = 0;
        this.maxgap = wapp.cfg.video.maxGap;
        this.mingap = wapp.cfg.video.minGap;
        this.gap = 1;
        this.fps = 10;
        this.playTimer = null;
        this.vid = null;
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
        this.refreshedOnError = false;
        this.chanHL = false;
        this.lastTime = -1;
        this.loaded = false;
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
        this.height = Video.calc_height(this.scale);
    }

	// get age since published
    get age() {
        return (ut.now()-this.item.published)/1000;
    }

	// whether an action is actionable
     // act <string> action tag
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
            case 'video': return ut.now()<(this.item.updated+1000*this.item.expiry);
            case 'download':
                let exp = (ut.now()>(this.item.updated+1000*this.item.expiry));
                let dl = ( this.item.state === 'download..' || this.item.state === 'downloaded');
                return (
                    this.item.videoStreams
                    &&
                    this.item.videoStreams.length
                    &&
                    !exp
                    &&
                    !dl
                );
            case 'stopdl':  return (this.item.state === 'download');
            case 'cancel': return (this.item.state === 'download..');
            case 'queue':
                return this.item.status === 'OK'
                    &&
                    ['result','preview','upgrade','update','noupdate','offline','discarded'].includes(this.item.state)
                    && this.age<this.old;
            case 'unqueue': return (this.item.state === 'queue');
            case 'refresh':
                return !['download','download..','downloaded'].includes(this.item.state);
            case 'erase': return (this.item.state === 'downloaded');
            case 'block': return this.item.channel && this.item.channel.level !== wapp.cfg.advanced.blockLevel;
            case 'search': return this.item.channel && this.item.channel.level !== wapp.cfg.advanced.searchLevel;
            case 'scan': return this.item.channel && this.item.channel.level !== wapp.cfg.advanced.scanLevel;
            case 'update': return this.item.channel && this.item.channel.level !== wapp.cfg.advanced.updateLevel;
            case 'like': return this.item.channel && this.item.channel.level !== wapp.cfg.advanced.likeLevel;
            case 'follow': return this.item.channel && this.item.channel.level !== wapp.cfg.advanced.followLevel;
            case 'unchan': return wapp.list.chanMode;
            case 'chan': return !wapp.list.chanMode;
            case 'play': return ((this.item.fn.length && this.item.state === 'downloaded') || this.item.canEmbed);
            default: return false;
        }
    }

	// show video info
    get vidInfo() {
        if (this.item.state === 'result') return '';
        if (this.item.videoStreams.length) {
            this.item.videoStreams.sort(wapp.vsort);
            let vi = this.item.videoStreams.findIndex(e => !e.failed);
            if (vi >= 0) {
                let v = this.item.videoStreams[vi];
                let uc = v.container;
                let s = v.size;
                if (v.type !== 'both') {
                    if (this.item.audioStreams.length) {
                        this.item.audioStreams.sort(wapp.asort);
                        let asu = false;
                        this.item.audioStreams.forEach( as => {
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
                        href: `${wapp.cfg.video.watchUrl}${this.item.name}`,
                        title: 'click to watch this video on YouTube',
                        target: '_blank'
                    },
                    ht.img(
                        {
                            src: imageRes.views,
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
                        id: `vws_${this.item.key}`,
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
                    id:`dur_${this.item.key}`,
                    title: 'video length in seconds, minutes:seconds, or hours:minutes:seconds'
                },
                () => {
                    if ( this.item.duration <=0 || this.item.isLive ) return 'live';
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
                    id:`srt_${this.item.key}`,
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
                    id: `pub_${this.item.key}`,
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
                    id: `rev_${this.item.key}`,
                    'class': 'lcell'
                },
                this.reviewedStr
            )
        );
    }

	// show information frame
    get frame() {
        this.previewType = 'info';
        clearInterval(this.playTimer);
        this.vid = null;
        let attr = {
            id: `outer_${this.item.key}`,
            'class': 'outerdiv',
        }
        return ht.div(
            attr,
            ht.div(
                {
                    id: `inner_${this.item.key}`,
                    'class': 'innerdiv',
                    style: ht.css({
                        top: `${wapp.cfg.video.innerFrame*this.scale}px`,
                        left: `0px`,
                        right: `0px`,
                        bottom: `${wapp.cfg.video.innerFrame*this.scale}px`,
                        'pointer-events' : 'auto',
                        cursor : 'auto'
                    }),
                },
                this.channel,
                this.cstats,
                this.text,
                this.stats,
                this.metarow
            ),
            this.divopts
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
            //ht.ifElse(
            //    this.item.channel.status === 'OK',
            //    ht.concat(
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
                //)
            //),
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
            this.div('erase','erase the downloaded video')
        );
    }

    // redisplay overlay options without repreview
    reoption() {
        this.rediv('chan','to filter on this channel');
        this.rediv('unchan','to exit channel filter');
        this.rediv('queue','queue this video');
        this.rediv('unqueue','unqueue this video');
        this.rediv(
            'block',
            'block this channel - discards existing videos and adds no new videos',
            true,
            'this channel is blocked'
        );
        this.rediv(
            'search',
            'set channel level to search - only adds videos from search',
            this.item.channel.status === 'OK',
            'this channel is searched'
        );
        this.rediv(
            'scan',
            'set channel level to scan - scans channel when new videos are discovered from search',
            this.item.channel.status === 'OK',
            'this channel is scanned'
        );
        this.rediv(
            'update',
            'set channel to update - adds videos from search and regular channel scans',
            this.item.channel.status === 'OK',
            'this channel is updated'
        );
        this.rediv(
            'like',
            `like this channel - adds videos from search and regular channel scans (with ${wapp.
            cfg.advanced.likeFrequency}x frequency)`,
            this.item.channel.status === 'OK',
            'this channel is liked'
        );
        this.rediv(
            'follow',
            `follow this channel -  adds videos from search and regular channel scans (with ${wapp.
            cfg.advanced.followFrequency}x frequency)`,
            this.item.channel.status === 'OK',
            'this channel is followed'
        );
        this.rediv('discard','discard this video');
        this.rediv('rotate','rotate video preview 90 degrees anti-clockwise');
        this.rediv('refresh','refresh this video info now');
        this.rediv(
            'showinfo',
            'show information about this video',
            true,
            'showing video information'
        );
        this.rediv(
            'showimage',
            'show image preview and manual storyboard for this video',
            true,
            'showing video image'
        );
        this.rediv(
            'playstory',
            'play storyboard preview for this video',
            true,
            'playing storyboard preview'
        );
        this.rediv(
            'playvideo',
            'play video preview for this video',
            true,
            'playing video preview'
        );
        this.rediv('download','download this video');
        this.rediv('stopdl','stop the pending download of this video');
        this.rediv('cancel','cancel download');
        this.rediv('erase','erase the downloaded video');
    }

	// show preview
    get preview() {
        let s = this.item.storyboards;
        if (s && s.length) {
            this.sb = s[s.length-1];
            let w = this.width / this.sb.width;
            let h = this.width * wapp.cfg.video.previewHeight / this.sb.height;
            this.sbscale = Math.min(w, h);
        }
        return ht.div(
            {
                id: `outer_${this.item.key}`,
                'class': 'outerdiv',
                onmouseenter: ht.cmd('wapp.thumbenter',this.item.key),
                onmousemove: ht.evt('wapp.thumbmove',this.item.key),
                onmouseleave: ht.cmd('wapp.thumbleave',this.item.key),
                onclick: ht.evt('wapp.embed',this.item.key),
                title: 'click to play'
            },
            ht.div(
                {
                    id: `inner_${this.item.key}`,
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
                    id:`trk_${this.item.key}`,
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
            ht.b(this.item.title),
            ht.br(),
            ht.b('id: '),
            this.item.name,
            ht.ifElse(
                this.item.category.length,
                ht.br() + ht.b('category: ') + this.item.category
            ),
            this.vidInfo,
            ht.ifElse(
                this.item.description.length,
                ht.br() + ht.b('description: ') + this.item.description.replace(rp,'<br>')
            ),
            ht.ifElse(
                this.item.keywords.length,
                ht.br() + ht.b('keywords: ') + this.item.keywords.join(', ')
            ),
            ht.ifElse(
                (this.item.topic && this.item.topic.length),
                ht.br() + ht.b('topic: ') + this.item.channel.search.topic.name
            ),
            ht.ifElse(
                (this.item.query && this.item.query.length),
                ht.br() + ht.b('search: ') + this.item.channel.search.name
            )
        );
    }

	// show channel info
    get channel() {
        let rgb = this.item.channel.status === 'CTM' ? wapp.cfg.video.terminatedRGB :
            this.item.channel.status === 'CDL' ? wapp.cfg.video.deletedRGB :
            this.item.channel.level === wapp.cfg.advanced.followLevel ? wapp.cfg.video.followLevelRGB :
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
                                    onclick: ht.evt('wapp.ytchan',this.item.key,true),
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
                                        src: this.item.channel.thumbnail,
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
                                ht.b(this.item.channel.author),
                                ht.br(),
                                ht.small(
                                ht.small(this.item.channel.search.topic.name,' - ',this.item.channel.search.name,
                                ht.br(),
                                ht.ifElse(
                                    this.item.channel.gender !== 'unknown' && this.item.channel.gender !== 'none',
                                    this.item.channel.gender+' '
                                ),
                                ht.ifElse(
                                    this.item.channel.age,
                                    this.item.channel.age
                                ),
                                ))
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
        return ut.qFmt(this.item.channel.views);
    }

	// show when joined
    get cjoined() {
        let j = ut.tsAge(this.item.channel.joined);
        if (j.length) return ht.div(
            'joined: ',
            j
        );
        return '';
    }

	// show channel views
    get cviews() {
        return ht.div(
            this.cviewsStr
        );
    }

	// show channel subscribers string
    get csubsStr() {
        return ut.qFmt(this.item.channel.subscribers);
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
            wapp.rcell(this.cjoined)
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
                        'id': `prg_${this.item.key}`,
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
    refresh(p = false, n = false) {
        ut.attr('#div_'+this.item.key,this.attrib);
        if (this.previewType === 'info') {
            ut.html('#sts_'+this.item.key,this.statusStr);
            ut.attr('#sts_'+this.item.key,{title: this.reasonStr});
            ut.html('#upd_'+this.item.key,this.updatedStr);
            ut.html(`#rev_${this.item.key}`,this.reviewedStr);
            ut.html(`#vws_${this.item.key}`,this.viewsStr);
            ut.html(`#pub_${this.item.key}`,this.publishedStr);
        }
    }

	// show a storybord image
    showSBImage() {
        const page = Math.floor(this.pos / this.sb.page[0].frames);
        const left = this.sbscale * this.sb.width * (this.pos % this.sb.perCol);
        const top = this.sbscale * this.sb.height * (Math.floor(this.pos / this.sb.perCol) % this.sb.perRow);
        const thumb = document.getElementById(`thumb_${this.item.key}`);
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
        ut.css(`#trk_${this.item.key}`,{width: `${this.pos*100/tframes}%`});
        /*
        ut.html('#dur_'+this.item.key,
            ut.secDur(Math.max(0,Math.floor(this.pos*this.item.duration/tframes)))+
           '/'+
           ut.secDur(this.item.duration)
        );
        */
    }

    // thumb enter preview event
    // event <object> mouse event object
    thumbenter(event) {
        wapp.bgc(this.item.cid,'rgb(0,127,127)');
        wapp.bgi(this.item.id,'rgb(127,255,255)');
        this.chanHL = true;
        if (this.sb) {
            if (this.previewType === 'images') {
                this.thumbX = ut.offset(`#outer_${this.item.key}`).left;
                switch(this.rotation) {
                    case 0:
                        ut.css(`#inner_${this.item.key}`,{
                            top: `${((this.width*wapp.cfg.video.previewHeight-this.sbscale*this.sb.height)/2)}px`,
                            left: `${((this.width-this.sbscale*this.sb.width)/2)}px`,
                            width : `${this.sbscale*this.sb.width}px`,
                            height : `${this.sbscale*this.sb.height}px`,
                            right: 'auto',
                            bottom: 'auto'
                        });
                    break;
                    case 1:
                        ut.css(`#inner_${this.item.key}`,{
                            top: `${((this.width*wapp.cfg.video.previewHeight-this.sbscale*this.sb.width)/2)}px`,
                            left: `${((this.width-this.sbscale*this.sb.height)/2)}px`,
                            width : `${this.sbscale*this.sb.height}px`,
                            height : `${this.sbscale*this.sb.width}px`,
                            right: 'auto',
                            bottom: 'auto'
                        });
                    break;
                    case 2:
                        ut.css(`#inner_${this.item.key}`,{
                            bottom: `${((this.width*wapp.cfg.video.previewHeight-this.sbscale*this.sb.height)/2)}px`,
                            right: `${((this.width-this.sbscale*this.sb.width)/2)}px`,
                            width: `${this.sbscale*this.sb.width}px`,
                            height: `${this.sbscale*this.sb.height}px`,
                            left: 'auto',
                            top: 'auto'
                        });
                    break;
                    default:
                        ut.css(`#inner_${this.item.key}`,{
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
    // event <object> mouse event object
    thumbmove(event) {
        if (!this.chanHL) {
            wapp.bgc(this.item.cid,'rgb(0,127,127)');
            wapp.bgi(this.item.id,'rgb(127,255,255)');
            this.chanHL = true;
        }
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
    thumbleave() {
        wapp.rgb(this.item.cid);
        this.chanHL = false;
        if (this.sb) {
            if (this.previewType === 'images') {
                ut.attr(`#thumb_${this.item.key}`,{
                    'class': `static${this.rotation}`,
                    src:`${wapp.cfg.video.imageUrl}/${this.item.name}/${wapp.cfg.video.defaultImage}`
                });

                if (this.rotation % 2) {
                    ut.css(`#thumb_${this.item.key}`,{
                        width: `${wapp.cfg.video.thumb0WidthX * this.width}px`,
                        height: `${this.width}px`,
                        left: `${wapp.cfg.video.thumb0Left}%`,
                        top: `${wapp.cfg.video.thumb0Top}%`,
                        right: 'auto',
                        bottom: 'auto'
                    });
                } else {
                    ut.css(`#thumb_${this.item.key}`,{
                        width: `${this.width}px`,
                        height: `${(this.width * wapp.cfg.video.thumb1WidthX)}px`,
                        left: `${wapp.cfg.video.thumb1Left}%`,
                        top: `${wapp.cfg.video.thumb1Top}%`,
                        right: 'auto',
                        bottom: 'auto'
                    });
                }

                ut.css(`#inner_${this.item.key}`,{
                    top: '0px',
                    left: '0px',
                    width: `${this.width}px`,
                    height: `${this.width}px`
                });
                //ut.html(`#dur_${this.item.key}`,ut.secDur(this.item.duration));
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
                    id: `thumb_${this.item.key}`,
                    'class': `static${this.rotation}`,
                    src: `${wapp.cfg.video.imageUrl}/${this.item.name}/${wapp.cfg.video.defaultImage}`,
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
                    id: `thumb_${this.item.key}`,
                    'class': `static${this.rotation}`,
                    src: `${wapp.cfg.video.imageUrl}/${this.item.name}/${wapp.cfg.video.defaultImage}`,
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
        this.loaded = false;
        this.previewType = 'images';
        clearInterval(this.playTimer);
        this.vid = null;
        this.lastPage = -1;
        ut.html(`#inner_${this.item.key}`,this.thumb);
        this.loaded = true;
    }

    // play animated storyboard
    playStoryboards() {
        this.playImages();
        this.loaded = false;
        if (this.sb) {
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
        }
        this.loaded = true;
    }

    // play video
    playVideos() {
        if (this.can('video')) {
            if (!this.vid || (this.vid && this.loaded) ) { // ignore if already playing
                this.loaded = false;
                try {
                    this.previewType = 'videos';
                    clearInterval(this.playTimer);
                    //if (!this.sources.length) {
                        /*
                        this.sources = '';
                        for (let i = this.item.videoStreams.length-1; i >= 0; i--) {
                            let s = this.item.videoStreams[i];
                            let a = {
                                src: `${s.url}&range=0-${s.size}`,
                                type: `video/${s.container}`
                            }
                            a.onerror = ht.evt('wapp.videoPreviewError',this.item.key,i);
                            this.sources += ht.source(a);
                        }
                        */
                       let i = this.item.videoStreams.length-1;
                       if (i>=0) {
                        let s = this.item.videoStreams[i];
                        let a = {
                            src: `${s.url}&range=0-${s.size}`,
                            type: `video/${s.container}`
                        }
                        a.onerror = ht.evt('wapp.videoPreviewError',this.item.key,i);
                        this.sources = ht.source(a);
                       }
                    //}
                    if (this.sources.length) {
                        ut.html(`#inner_${this.item.key}`,
                            ht.video(
                                {
                                    id: `video_${this.item.key}`,
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
                        this.vid = document.getElementById(`video_${this.item.key}`);
                        this.vid.playbackRate = Math.min(
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
                                if (this.vid) ut.css(
                                    `#trk_${this.item.key}`,
                                    {width: `${this.vid.currentTime*100/this.vid.duration}%`}
                                );
                                if (this.vid.paused) this.vid.play();
                                if (this.vid.currentTime>0) this.loaded = true;
                            },
                            wapp.cfg.video.trackDelayMS
                        );
                    }
                } catch(e) {
                    console.log(e);
                }
            }
        } else {
            this.playStoryboards();
        }
	}

    // get current rotation 0 (0 deg) , 1 (90 deg AC), 2 (180 deg AC) or 3 (270 deg AC)
    get rotation() {
        return this.item.rotation;
    }

    // set preview/image/video anti-clockwise rotation
    // value <int> rotation value (0 - 0 deg, 1 - 90 deg, 2 - 180 deg, 3 - 270 deg)
    set rotation(value) {
        this.item.rotation = value;
        (this.sb && value % 2) ? this.sbscale *= this.sb.height/this.sb.width :
            this.sbscale *= this.sb.width/this.sb.height;
        this.set('rotation',value);
    }

    // rotate the image/storyboard/video by 90 degrees anti-clockwise
    rotate() {
        this.rotation === 3 ? this.rotation = 0 : this.rotation++;
        this.lastPage = -1;
        this.redisplay(true);
    }

    // clear the video item
    clear() {
        super.clear();
        clearInterval(this.playTimer);
        this.vid = null;
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
                if (this.item.status === 'VIP') {
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

    // redisplay the item if info is being shown or the current preview is suboptimal
    redisplay(force = false) {
        let doit = !this.loaded || force;
        if (this.showPreview === 'any') {
            if (this.previewType === 'storyboards') {
               if (this.initPreview === 'videos') doit = true;
            } else if (this.previewType === 'images') {
               if (this.initPreview === 'videos') doit = true;
               if (this.initPreview === 'storyboards') doit = true;
            }
            if (this.previewType === 'info') doit = true;
        }
        if (this.showPreview === 'info') doit = true;
        if (doit) {
            if (this.previewType !== 'info') this.previewType = this.initPreview;
            ut.replaceWith(`#div_${this.item.key}`,this.html);
            clearInterval(this.playTimer);
            this.vid = null;
            if (this.previewType !== 'info') this.repreview();
        }
    }

}
