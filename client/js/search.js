/* brytfeed - (c) 2023 Gatecrasher777 */
/* search client module */

// search item class
class Search extends Model {

    // search item constructor
    // item <object> search data
    // scale <double> required size of item
	constructor(item, scale) {
        super('search', item, scale);
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
        this.height = Search.calc_height(this.scale);
    }

    // save query
    // value <string> query string
    set query(value) {
        if (this.item.query != value) {
            this.item.query = value;
            this.set('query',value);
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
                    id: `qry_${this.item.key}`,
                    class: 'querytext',
                    onfocus: ht.cmd('wapp.editText',true),
                    onblur: ht.cmd('wapp.queryEdit',this.item.key)
                },
                this.item.query
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
            id: `act_${this.item.key}`,
            type: 'checkbox',
            onclick: ht.cmd('wapp.searchActive',this.item.key),
            title: `Allow/Disallow automatic search updates for ${this.item.name}`,
            style: this.genStyle('option',{
                width: `${0.8*this.width * wapp.cfg.search.optionHeight}px`
            },0.8)
        };
        if (this.item.updates) attr.checked = 'checked';
        return ht.input(attr);
    }

    // change active state
    // value <boolean> updates value
    set active(value) {
        this.item.updates = value ? 1 : 0;
        this.set('updates', this.item.updates);
    }

    // show channel level option
    get channel() {
        return ht.select(
            {
                id: `channelLevelSelect_${this.item.key}`,
                onchange: ht.cmd('wapp.genericSelect',this.item.key,'item','channelLevel'),
                title: 'select update level for newly discovered channels',
                style: this.genStyle('option', {
                        'border-radius': `${this.radius}px`
                })
            },
            ht.forEach(
                wapp.cfg.channel.levels,
                (e,i,a) => {
                    let o = {value: i};
                    if (this.item.channelLevel === i) o.selected = 'selected';
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
                wapp.lcell('channel level:',40),
                wapp.lcell(this.channel)
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
            wapp.lcell(this.updated),
            wapp.rcell(this.button('discard','discard this search'),wapp.cfg.item.buttonField),
            wapp.rcell(this.button('refresh','refresh this search now'),wapp.cfg.item.buttonField),
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
        ut.attr('#div_'+this.item.key,this.attrib);
        ut.html('#sts_'+this.item.key,this.statusStr);
        ut.attr('#sts_'+this.item.key,{title: this.reasonStr});
        ut.html('#upd_'+this.item.key,this.updatedStr);
        ut.html(`#vdo_${this.item.key}`,this.videoStr);
        ut.html(`#lst_${this.item.key}`,ut.tsAge(this.item.latest));
        ut.html(`#chn_${this.item.key}`,this.channelStr);
    }

    // determine height of search item
    // scale <double> scale to apply
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
