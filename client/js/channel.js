/* brytfeed - (c) 2023 Gatecrasher777 */
/* channel client module */

// channel item class
class Channel extends Model {

    // channel item constructor
    // item <object> channel data
    // scale <double> required size of item
	constructor(item, scale) {
        super('channel',item,scale);
        this.old = wapp.cfg.channel.old;
        this.backfilling = false;
        this.color = {
            'r': wapp.cfg.channel.red,
            'g': wapp.cfg.channel.green,
            'b': wapp.cfg.channel.blue
        };
        this.resize();
    }

    // get age since latest
    get age() {
        return (ut.now()-this.item.latest)/1000;
    }

    // resize the channel item
    resize() {
        this.height = Channel.calc_height(this.scale);
        if (wapp.list.chanMode) this.height = this.width;
    }

    // show flag if country known
    get flag() {
        return ht.ifElse(
            this.item.country.length,
            ht.img(
                {
                    src: `../img/flags/${coCo[this.item.country]}.png`,
                    style: ht.css({
                        padding: `${wapp.cfg.channel.flagPadding * this.scale}px`}
                    ),
                    title: this.item.country
                }
            )
        );
    }

    // small flag if country known
    get miniflag() {
        return ht.ifElse(
            this.item.country.length,
            ht.img(
                {
                    src: `../img/flags/${coCo[this.item.country]}.png`,
                    style: this.genStyle('image'),
                    title: this.item.country
                }
            )
        );
    }

    // show channel avatar
    get avatar() {
        let rp = /\\n/g;
        return wapp.lcell(
            ht.table(
                ht.tbody(
                    ht.tr(
                        ht.td(
                            ht.div(
                                {
                                    'class' : 'channeldiv',
                                    onclick: ht.evt('wapp.ytchan', this.item.key),
                                    title: 'click to view this channel on YouTube',
                                    style: ht.css({
                                        width: `${ this.width * wapp.cfg.channel.chanHeight -
                                            this.scale * wapp.cfg.channel.thumbGap}px`,
                                        height: `${ this.width * wapp.cfg.channel.chanHeight -
                                            this.scale * wapp.cfg.channel.thumbGap}px`
                                    })
                                },
                                ht.img(
                                    {
                                        'class': 'avatar',
                                        src: this.item.thumbnail,
                                        style: ht.css({
                                            width: `${this.width * wapp.cfg.channel.chanHeight -
                                                this.scale * wapp.cfg.channel.thumbGap}px`,
                                            height: `${this.width * wapp.cfg.channel.chanHeight -
                                                this.scale * wapp.cfg.channel.thumbGap}px`
                                        })
                                    }
                                ),
                            )
                        ),
                        ht.td(
                            ht.div(
                                {
                                    'class': 'titlediv',
                                    style: this.genStyle('chan')
                                },
                                ht.b(this.item.author),
                                ht.br(),
                                this.item.search.topic.name,
                                ' - ',
                                this.item.search.name,
                                ht.br(),
                                ht.b('id:'),
                                ht.small(this.item.name),
                                ht.ifElse(
                                    this.item.gender !== 'unknown' && this.item.gender !== 'none',
                                    ht.br()+ht.b('gender: ')+this.item.gender
                                ),
                                ht.ifElse(
                                    this.item.age,
                                    ht.br()+ht.b('age: ')+this.item.age
                                ),
                                ht.ifElse(
                                    this.item.description.length,
                                    ht.br()+ht.b('description: ')+this.item.description.replace(rp,'<br>')
                                ),
                                ht.ifElse(
                                    this.item.tags && this.item.tags.length,
                                    ht.br()+ht.b('tags: ')+this.item.tags.join(', ')
                                )
                            )
                        )
                    )
                )
            ),
            wapp.cfg.channel.avatarField
        );
    }

    // show channel views string
    get viewsStr() {
        return ut.qFmt(this.item.views);
    }

    // show when joined
    get joined() {
        return ht.div(
            ut.tsAge(this.item.joined)
        );
    }

    // show views
    get views() {
        return ht.div(
            this.viewsStr
        );
    }

    // show subscribers string
    get subsStr() {
        return ut.qFmt(this.item.subscribers);
    }

    // show subscribers
    get subscribers() {
        return ht.div(
            this.subsStr
        );
    }

    // show stats
    get stats() {
        return ht.concat(
            ht.div(
                {
                    'class': 'statsrow',
                    style: this.genStyle('stat')
                },
                {
                    'class': 'statsrow'
                },
                wapp.lcell('new:'),
                wapp.lcell(this.videos),
                wapp.rcell(this.latest),
                wapp.rcell('last:',wapp.cfg.channel.lastLabel),
                wapp.rcell(this.miniflag)
            ),
            ht.div(
                {
                    'class': 'statsrow',
                    style: this.genStyle('stat')
                },
                {
                    'class': 'statsrow'
                },
                wapp.lcell('subs:'),
                wapp.lcell(this.subscribers,wapp.cfg.channel.subsField),
                wapp.lcell('views:',wapp.cfg.channel.viewsLabel),
                wapp.lcell(this.views,wapp.cfg.channel.viewsField),
                wapp.rcell(this.joined),
                wapp.rcell('joined: ')
            )
        );
    }

    // show channel update level
    get level() {
        return ht.select(
            {
                id: `levelSelect_${this.item.key}`,
                onchange: ht.cmd('wapp.genericSelect',this.item.key,'item','level'),
                title: 'specify update level for this channel',
                style: this.genStyle('option', {
                    'border-radius': `${this.radius}px`
                },0.8)
            },
            ht.forEach(
                wapp.cfg.channel.levels,
                (e, i) => {
                    let o = { value: i };
                    if (i === this.item.level) o.selected = 'selected';
                    return ht.option(
                        o,
                        e
                    );
                }
            )
        );
    }

    // show channel backfill options
    get backfill() {
        return this.backfilling ? ht.div({id: `backfillSelect_${this.item.key}`},this.rcell(true,'pending...')) : ht.select(
            {
                id: `backfillSelect_${this.item.key}`,
                onchange: ht.cmd('wapp.genericSelect',this.item.key,'','backfill'),
                title: 'choose to backfill videos for this channel',
                style: this.genStyle('option', {
                        'border-radius': `${this.radius}px`
                },0.8)
            },
            ht.forEach(
                wapp.cfg.channel.backfill,
                (e, i) => {
                    let o = { value: i };
                    if (e.tag === 'none') o.selected = 'selected';
                    return ht.option(
                        o,
                        e.tag
                    );
                }
            )
        );
    }

    // send backfill request
    // value <int> index of chosen backfill option
    set backfill(value) {
        if (value) {
            this.backfilling = true;
            wapp.emit('backfill',{
                cid: this.item.id,
                key: this.item.key,
                orig: this.item.videoCount,
                days: wapp.cfg.channel.backfill[value].days,
                cb: 'backfilled'
            });
        }
    }

    // show channel options
    get options() {
        return ht.concat
        (
            ht.div(
                {
                    'class':'optionsrow',
                    style: this.genStyle('option')
                },
                wapp.lcell('channel level:'),
                wapp.rcell(this.level),
            )
        );
    }

    // show update status
    get upstatus() {
        return ht.div(
            {
                'class': 'metarow',
                style: this.genStyle('update',{
                    'padding-top': `${this.padding}px`
                })
            },
            wapp.lcell(this.status),
            wapp.lcell(this.updated),
            wapp.rcell(this.button('discard','discard this channel'),wapp.cfg.item.buttonField),
            //this.rcell(!wapp.list.chanMode && this.item.queue,this.button('block','block this channel'),wapp.cfg.item.buttonField),
            wapp.rcell(this.button('refresh','refresh this channel'),wapp.cfg.item.buttonField),
            this.rcell(wapp.list.chanMode,this.button('unchan','exit channel filter mode'),wapp.cfg.item.buttonField),
            this.rcell(!wapp.list.chanMode,this.button('chan','open this channel'),wapp.cfg.item.buttonField),
            this.rcell(wapp.list.chanMode,this.button('nextchan','move to next channel without taking action'),wapp.cfg.item.buttonField),
        );
    }

    // show additional options while in channel mode
    get chanmode() {
        if (!wapp.list.chanMode) return '';
        return ht.concat
        (
            ht.div(
                {
                    'class':'metarow',
                    style: this.genStyle('update',{},wapp.cfg.item.button2Scale)
                },
                wapp.lcell(this.button2('cblock','discard videos - block channel - move to next channel'),wapp.cfg.item.button2Field),
                wapp.lcell(this.button2('csearch','discard videos - set to search level - move to next channel'),wapp.cfg.item.button2Field),
                wapp.lcell(this.button2('cscan','discard videos - set to scan level - move to next channel'),wapp.cfg.item.button2Field),
                wapp.lcell(this.button2('cupdate','discard videos - set to update level - move to next channel'),wapp.cfg.item.button2Field),
                wapp.lcell(this.button2('clike','download pending, retain videos - like this channel - move to next channel'),wapp.cfg.item.button2Field),
                wapp.lcell(this.button2('cfollow','download pending, queue videos - follow this channel - move to next channel'),wapp.cfg.item.button2Field),
            ),
            ht.div(
                {
                    'class':'optionsrow',
                    style: this.genStyle('option')
                },
                wapp.lcell('backfill request:'),
                wapp.rcell(this.backfill),
            )
        );
    }

    // show body
    get body() {
        return ht.concat (
            this.avatar,
            this.stats,
            this.options,
            this.upstatus,
            this.chanmode
        );
    }

    // refresh updateable channel data
    refresh() {
        ut.attr('#div_'+this.item.key,this.attrib);
        ut.html('#sts_'+this.item.key,this.statusStr);
        ut.attr('#sts_'+this.item.key,{title: this.reasonStr});
        ut.html('#upd_'+this.item.key,this.updatedStr);
        ut.html(`#vdo_${this.item.key}`,this.videoStr);
        ut.html(`#lst_${this.item.key}`,ut.tsAge(this.item.latest));
    }

    // determine height of channel item
    // scale <double> scale to apply
    static calc_height(scale) {
        let h = wapp.cfg.channel;
        return wapp.cfg.item.width * scale * (
            h.chanHeight +
            h.statHeight * 2 +
            h.optionHeight +
            h.updateHeight
        );
    }

}
