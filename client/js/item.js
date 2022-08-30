// ytzero - client item container class
// https://github.com/gatecrasher777/ytzero
// (c) 2021/2 gatecrasher777
// MIT Licenced

class ytzItem {

    // generic item constructor
    constructor(item, scale) {
        this.type = 'item';
        this.item = item;
        this.scale = scale;
        this.embedInfo = false;
        this.width = wapp.cfg.item.width * this.scale;
        this.padding = wapp.cfg.item.padding * this.scale;
        this.margin = wapp.cfg.item.margin * this.scale;
        this.radius = wapp.cfg.item.radius * this.scale;
        this.controlHeight = wapp.cfg.item.controlHeight * this.scale;
        this.buttonWidth = wapp.cfg.item.buttonWidth * this.scale;

    }

    // send changed values to server
    set() {
        wapp.emit('set', {
            type: this.type,
            item: this.item
        });
    }

    // whether actions are actionable
    can(act) {
        return true;
    }

    // show new/total videow
    get videoStr() {
        return this.item.newVideos+' of '+this.item.videoCount;
    }

    get channelStr() {
        return this.item.channelCount;
    }

    // show item state
    get state() {
        return ' '+this.item.state;
    }

    // change state
    set state(value) {
        this.item.state = value;
        this.set();
    }

    // calculate a color
    hue(c,a) {
        return Math.floor(this.color[c] - a * (this.color[c]-31));
    }

    // compose background
    get rgb() {
        let a = Math.sqrt(this.age/this.old);
        if (isNaN(a)) a=1;
        if (a>1) a=1;
        if (this.item.state == 'download') return wapp.cfg.item.pendingRGB;
        if (this.item.state == 'download..') return wapp.cfg.item.downloadRGB;
        return 'rgb('+this.hue('r',a)+','+this.hue('g',a)+','+this.hue('b',a)+')';
    }

    // use attributes
    get attrib() {
        let id = 'div_'+this.item.id;
        if (this.embedInfo) id = 'embedInfo';
        return {
            id: id,
            'class': this.type,
            style: ht.css(
                {
                    padding: `${this.padding}px`,
                    margin: `${this.margin}px`,
                    'border-radius': `${this.radius}px`,
                    height: `${this.height}px`,
                    width: `${this.width}px`,
                    'font-size': `${this.scale * 100}%`,
                    'background-color': this.rgb
                }
            )
        };
    }

    // show topic control
    get topic() {
        return ht.select(
            {
                id: 'topicSelect_'+this.item.id,
                onchange: ht.cmd('wapp.genericSelect',this.item.id,'item','topic'),
                title: 'select the topic to which this '+this.type+' belongs',
                style: this.genStyle('option',{
                    'border-radius': `${this.radius}px`
                })
            },
            ht.forEach(
                wapp.topiclist.slice(1),
                (g, i, arr) => {
                    let a = {value: g.id};
                    if (this.item.topic == g.id) a.selected='selected';
                    if ((this.type != 'topic') || (g.id != this.item.id)) {
                        return ht.option(
                            a,
                            g.name
                        );
                    }
                }
            )
        );
    }

    // show name row
    get namerow() {
        let c = wapp.cfg[this.type];
        return ht.div(
            {
               'class': 'namerow',
               style: this.genStyle('text')
            },
            wapp.lcell('name:',c.nameLabel),
            wapp.lcell(
                ht.ifElse(
                    (this.item.id === 0),
                    ht.div(`all (and new ${this.type} defaults)`),
                    ht.input(
                        {
                            id: `nam_${this.item.id}`,
                            class: `${this.type}name`,
                            type: 'text',
                            length: c.maxNameLength,
                            value: this.item.name,
                            onfocus: ht.cmd('wapp.editText',true),
                            onblur: ht.cmd('wapp.nameEdit',this.item.id),
                            title: `specify name of ${this.type} (${c.minNameLength}-${c.maxNameLength} characters)`,
                            style: this.genStyle('text',{
                                'border-radius': `${this.radius}px`
                            },0.8)
                        }
                    )
                ),
                c.nameField
            )
        );
    }

    // show channel country flag if known
    get flag() {
        if (
            this.item.meta.country
            &&
            this.item.meta.country.length
        ) return ht.img(
            {
                src: '../img/flags/'+coCo[this.item.meta.country]+'.png',
                title: this.item.meta.country
            }
        );
        return '';
    }

    // get last updated string
    get updatedStr() {
        return '@ '+ut.tsAge(this.item.updated)
    }

    // show when updated
    get updated() {
        return ht.div(
            {
                id: 'upd_'+this.item.id,
                title: 'time elapsed since this '+this.type+' was updated/reviewed'
            },
            this.updatedStr
        );
    }

    // show reason for status
    get reasonStr() {
        if (this.item.meta.reason.length) return this.item.meta.reason
        return 'status is ok'
    }

    // get status string
    get statusStr() {
        return this.item.status;
    }

    // show item status
    get status() {
        return ht.div(
            {
                id: 'sts_'+this.item.id,
                title: this.reasonStr
            },
            this.statusStr
        );
    }

    // generic overlay image
    div(s,h,a,j) {
        if (this.can(s)) {
            return ht.div(
                {
                    'class': s+'div divdiv',
                    onclick: ht.evt('wapp.'+s,this.item.id),
                    title: 'click to '+h,
                    style: ht.css({
                        width: `${(this.width*wapp.cfg[this.type].imageWidth)}px`,
                        height: `${(this.width*wapp.cfg[this.type].imageHeight)}px`
                    })
                },
                ht.img(
                    {
                        'class': s+'img',
                        src: '../img/'+s+'_over.png',
                        style: ht.css({
                            width: `${(this.width*wapp.cfg[this.type].imageWidth)}px`,
                            height: `${(this.width*wapp.cfg[this.type].imageHeight)}px`
                        })
                    }
                )
            );
        } else if (a) {
            return ht.div(
                {
                    'class': s+'div altdiv',
                    onclick: ht.evt('wapp.'+s,this.item.id,true),
                    title: j,
                    style: ht.css({
                        width: `${(this.width*wapp.cfg[this.type].imageWidth)}px`,
                        height: `${(this.width*wapp.cfg[this.type].imageHeight)}px`
                    })
                },
                ht.img(
                    {
                        'class': s+'img',
                        src: '../img/'+s+'_alt.png',
                        style: ht.css({
                            width: `${(this.width*wapp.cfg[this.type].imageWidth)}px`,
                            height: `${(this.width*wapp.cfg[this.type].imageHeight)}px`
                        })
                    }
                )
            );
        }
        return '';
    }

    // generic left float markup
    lcell(t,c,pc) {
        if (t) return wapp.lcell(c,pc);
        return '';
    }

    // generic right float markup
    rcell(t,c,pc) {
        if (t) return wapp.rcell(c,pc);
        return '';
    }

    // show latest
    get latest() {
        let s = ut.tsAge(this.item.latest)
        if (!this.item.latest || isNaN(this.item.latest) || this.item.latest === null) s = 'n/a';
        return ht.div(
            {
                id: 'lst_'+this.item.id
            },
            s
        );
    }

    //standardized icon button
    button(s,h) {
        return ht.button(
            {
                'class': s.replace('_over','')+'but',
                onclick: ht.evt('wapp.'+s.replace('_over',''),this.item.id,false),
                title: 'click to '+h,
                style: ht.css(
                    {
                        height: `${this.controlHeight}px`,
                        width: `${this.buttonWidth}px`,
                        'border-radius': `${this.radius}px`,
                    }
                )
            },
            ht.img(
                {
                    'class': s.replace('_over','')+'img',
                    src: '../img/'+s+'.png',
                    style: ht.css({
                        width: `${this.width*wapp.cfg[this.type].imageHeight}px`,
                        height: `${this.width*wapp.cfg[this.type].imageHeight}px`
                    })
                }
            )
        );
    }

    //double sized icon button
    button2(s,h) {
        return ht.button(
            {
                'class': s.replace('_over','')+'but',
                onclick: ht.evt('wapp.'+s.replace('_over',''),this.item.id,true),
                title: 'click to '+h,
                style: ht.css(
                    {
                        height: `${this.controlHeight * wapp.cfg.item.button2Scale}px`,
                        width: `${this.buttonWidth * wapp.cfg.item.button2Scale}px`,
                        'border-radius': `${this.radius * wapp.cfg.item.button2Scale}px`,
                    }
                )
            },
            ht.img(
                {
                    'class': s.replace('_over','')+'img',
                    src: '../img/'+s+'.png',
                    style: ht.css({
                        width: `${this.width * wapp.cfg[this.type].imageHeight * wapp.cfg.item.button2Scale}px`,
                        height: `${this.width * wapp.cfg[this.type].imageHeight * wapp.cfg.item.button2Scale}px`
                    })
                }
            )
        );
    }

    // show video string
    get videos() {
        return ht.div(
            {
                class: 'vdo_'+this.item.id
            },
            this.videoStr
        );
    }

    // show channels string
    get channels() {
        return ht.div(
            {
                class: 'chn_'+this.item.id
            },
            this.channelStr
        );
    }

    // get item body
    get body() {
        return ht.div()
    }

    // get item content
    get content() {
        return this.body
    }

    // get item markup
    get html() {
        return ht.div(
            this.attrib,
            this.content
        );
    }

    // refresh updateable elements
    refresh() {
        ut.attr('#div_'+this.item.id,this.attrib);
        if (this.type !== 'topic') {
            ut.html('#sts_'+this.item.id,this.statusStr);
            ut.attr('#sts_'+this.item.id,{title: this.reasonStr});
            ut.html('#upd_'+this.item.id,this.updatedStr);
        }
    }

    // clear the item
    clear() {
        ut.remove('#div_'+this.item.id);
        delete wapp.itemx[this.item.id];
    }

    // redisplay the item
    redisplay() {
        ut.replaceWith('#div_'+this.item.id,this.html);
    }

    // generic element style string
    genStyle(s, x = {}, m = 1) {
        x.height = `${(m * this.width * wapp.cfg[this.type][`${s}Height`])}px`;
        return ht.css(x);
    }

}
