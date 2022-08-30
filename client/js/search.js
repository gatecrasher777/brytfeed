// ytzero - client search container class
// https://github.com/gatecrasher777/ytzero
// (c) 2021/2 gatecrasher777
// MIT Licenced

class ytzSearch extends ytzItem {

    // search item constructor
	constructor(item, scale) {
        super(item,scale);
        this.item = item;
        this.type = 'search';
        this.old = wapp.cfg.search.old;
        this.color = {
            'r': wapp.cfg.search.red,
            'g': wapp.cfg.search.green,
            'b': wapp.cfg.search.blue
        };
        this.resize();
    }

    // get age since latest
    get age() {
        return (ut.now()-this.item.latest)/1000;
    }

    // resize the search item
    resize() {
        this.height = ytzSearch.calc_height(this.scale);
    }

    // save query
    set query(value) {
        if (this.item.meta.query != value) {
            this.item.meta.query = value;
            this.set();
        }
    }

    // show query
    get query() {
        return ht.div(
            {
               'class': 'queryrow',
               style: this.genStyle('query')
            },
            ht.textarea(
                {
                    id: `qry_${this.item.id}`,
                    class: 'querytext',
                    onblur: ht.cmd('wapp.queryEdit',this.item.id)
                },
                this.item.meta.query
            )
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
                wapp.lcell('new:',wapp.cfg.search.newLabel),
                wapp.lcell(this.videos,wapp.cfg.search.newField),
                wapp.rcell(this.latest),
                wapp.rcell('last:')
            ),
            ht.div(
                {
                    'class': 'statsrow',
                    style: this.genStyle('stat')
                },
                wapp.lcell('channels:',wapp.cfg.search.channelsLabel),
                wapp.lcell(this.channels,wapp.cfg.search.channelsField),
            )
        );
    }

    // show active state
    get active() {
        let attr =  {
            id: `act_${this.item.id}`,
            type: 'checkbox',
            onclick: ht.cmd('wapp.searchActive',this.item.id),
            title: `Allow/Disallow automatic search updates for ${this.item.name}`,
            style: this.genStyle('option',{
                width: `${0.8*this.width * wapp.cfg.search.optionHeight}px`
            },0.8)
        };
        if (this.item.meta.updates === 'ON') attr.checked = 'checked';
        return ht.input(attr);
    }

    // change active state
    set active(value) {
        this.item.meta.updates = (value) ? 'ON': 'OFF';
        this.set();
    }

    // show proxify state
    get proxify() {
        let attr =  {
            id: `pxy_${this.item.id}`,
            type: 'checkbox',
            onclick: ht.cmd('wapp.searchProxy',this.item.id),
            title: `Search via proxy for ${this.item.name}`,
            style: this.genStyle('option',{
                width: `${0.8*this.width * wapp.cfg.search.optionHeight}px`
            },0.8)
        };
        if (this.item.meta.proxify === 'YES') attr.checked = 'checked';
        return ht.input(attr);
    }

    // change proxify
    set proxify(value) {
        this.item.meta.proxify = (value) ? 'YES': 'NO';
        this.set();
    }

    get channel() {
        return ht.select(
            {
                id: `channelLevelSelect_${this.item.id}`,
                onchange: ht.cmd('wapp.genericSelect',this.item.id,'meta','channelLevel'),
                title: 'select update level for newly discovered channels',
                style: this.genStyle('option', {
                        'border-radius': `${this.radius}px`
                })
            },
            ht.forEach(
                wapp.cfg.channel.levels,
                (e,i,a) => {
                    let o = {value: i};
                    if (this.item.meta.channelLevel === i) o.selected = 'selected';
                    return ht.option(
                        o,
                        e
                    );
                }
            )
        )
    }
    // show options
    get options() {
        return ht.concat
        (
            ht.div(
                {
                    'class':'optionsrow',
                    style: this.genStyle('option')
                },
                wapp.lcell('topic:', wapp.cfg.search.topicLabel),
                wapp.lcell(this.topic, wapp.cfg.search.topicField),
                wapp.rcell(this.active),
                wapp.rcell('updated:')

            ),
            ht.div(
                {
                    'class':'optionsrow',
                    style: this.genStyle('option')
                },
                wapp.lcell('proxify:',wapp.cfg.search.proxyLabel),
                wapp.lcell(this.proxify,wapp.cfg.search.proxyField),
                wapp.rcell(this.channel),
                wapp.rcell('channel:')
            )
        );
    }

    // show update status
    get upstatus() {
        return ht.div(
            {
                'class': 'metarow',
                style: this.genStyle('update', {
                         'padding-top': `${this.padding}px`
                     }
                 )
            },
            wapp.lcell(this.status),
            wapp.lcell(this.updated),
            wapp.rcell(this.button('discard','discard this search'),wapp.cfg.item.buttonField),
            wapp.rcell(this.button('refresh','refresh this search now'),wapp.cfg.item.buttonField),
            //wapp.rcell(this.button('open','open this search'),wapp.cfg.item.buttonField)
        );
    }

    // show body
    get body() {
        return ht.concat(
            this.namerow,
            this.options,
            this.query,
            this.stats,
            this.upstatus
        )
    }

    // refresh updateable search data
    refresh() {
        super.refresh();
        ut.html(`#vdo_${this.item.id}`,this.videoStr);
        ut.html(`#lst_${this.item.id}`,ut.tsAge(this.item.latest));
        ut.html(`#chn_${this.item.id}`,this.channelStr);
    }

    // determine height of search item
    static calc_height(scale) {
        let h = wapp.cfg.search;
        return  wapp.cfg.item.width * scale * (
            h.textHeight +
            h.queryHeight +
            h.statHeight * 2 +
            h.optionHeight * 2 +
            h.updateHeight
        );
    }

}
