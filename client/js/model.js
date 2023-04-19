/* brytfeed - (c) 2023 Gatecrasher777 */
/* abstract client model module */

//abstract item model
class Model {

    // model constructor
    // type <string> item type, ie topic, search, etc
    // item <object> item data
    // scale <double> required size of item
    constructor(type, item, scale) {
        this.type = type;
        this.item = item;
        this.scale = scale;
        this.embedInfo = false;
        this.width = wapp.cfg.item.width * this.scale;
        this.padding = wapp.cfg.item.padding * this.scale;
        this.margin = wapp.cfg.item.margin * this.scale;
        this.radius = wapp.cfg.item.radius * this.scale;
        this.controlHeight = wapp.cfg.item.controlHeight * this.scale;
        this.buttonWidth = wapp.cfg.item.buttonWidth * this.scale;
        this.loaded = true;
    }

    // send changed values to server
    // field <string> item field to set
    // value <var> value to set
    set(field,value) {
        wapp.emit('set', {
            type: this.type,
            id: this.item.id,
            field: field,
            value: value,
        });
    }

    // whether actions are actionable
    // act <string> action tag
    can(act) {
        return true;
    }

    // show new/total videow
    get videoStr() {
        return `${this.item.newVideos} of ${this.item.videoCount} (${this.item.downloads})`;
    }

    // show number of channels
    get channelStr() {
        return this.item.channelCount;
    }

    // show item state
    get state() {
        return ' '+this.item.state;
    }

    // change state
    // value <string> new state value
    set state(value) {
        this.item.state = value;
        this.set('state',value);
    }

    // calculate a color
    // color <string> "r"ed,"g"reen or "b"lue
    // age <double> 0 .. 1
    hue(color,age) {
        return Math.floor(this.color[color] - age * (this.color[color]-31));
    }

    // compose background
    get rgb() {
        let a = Math.sqrt(this.age/this.old);
        if (isNaN(a)) a=1;
        if (a>1) a=1;
        if (this.item.state == 'download') {
            if (this.item.status === 'VDL') return wapp.cfg.item.deletedRGB;
            return wapp.cfg.item.pendingRGB;
        }
        if (this.item.state == 'download..') return wapp.cfg.item.downloadRGB;
        return 'rgb('+this.hue('r',a)+','+this.hue('g',a)+','+this.hue('b',a)+')';
    }

    // use attributes
    get attrib() {
        let id = 'div_'+this.item.key;
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
                id: 'topicSelect_'+this.item.key,
                onchange: ht.cmd('wapp.genericSelect',this.item.key,'item','tid'),
                title: 'select the topic to which this '+this.type+' belongs',
                style: this.genStyle('option',{
                    'border-radius': `${this.radius}px`
                })
            },
            ht.forEach(
                wapp.topiclist.slice(1),
                (g, i, arr) => {
                    let a = {value: g.id};
                    if (this.item.tid == g.id) a.selected='selected';
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
                            id: `nam_${this.item.key}`,
                            class: `${this.type}name`,
                            type: 'text',
                            length: c.maxNameLength,
                            value: this.item.name,
                            onfocus: ht.cmd('wapp.editText',true),
                            onblur: ht.cmd('wapp.nameEdit',this.item.key),
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
            this.item.country
            &&
            this.item.country.length
        ) return ht.img(
            {
                src: '../img/flags/'+coCo[this.item.country]+'.png',
                title: this.item.country
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
                id: 'upd_'+this.item.key,
                title: 'time elapsed since this '+this.type+' was updated/reviewed'
            },
            this.updatedStr
        );
    }

    // show reason for status
    get reasonStr() {
        if (this.item.reason && this.item.reason.length) return this.item.reason
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
                id: 'sts_'+this.item.key,
                title: this.reasonStr
            },
            this.statusStr
        );
    }

    // generic overlay image
    div(action, hint, alt, altHint) {
        if (this.can(action)) {
            return ht.div(
                {
                    'id': `${action}_oli_${this.item.key}`,
                    'class': `${action}div divdiv`,
                    onclick: ht.evt(`wapp.${action}`,this.item.key),
                    title: `click to ${hint}`,
                    style: ht.css({
                        width: `${this.width*wapp.cfg[this.type].imageWidth}px`,
                        height: `${this.width*wapp.cfg[this.type].imageHeight}px`
                    })
                },
                ht.img(
                    {
                        'class': `${action}img`,
                        src: imageRes[`${action}_over`],  //`../img/${action}_over.png`,
                        style: ht.css({
                            width: `${this.width*wapp.cfg[this.type].imageWidth}px`,
                            height: `${this.width*wapp.cfg[this.type].imageHeight}px`
                        })
                    }
                )
            );
        } else if (alt) {
            return ht.div(
                {
                    'id': `${action}_oli_${this.item.key}`,
                    'class': `${action}div altdiv`,
                    onclick: ht.evt(`wapp.${action}`,this.item.key,true),
                    title: altHint,
                    style: ht.css({
                        width: `${this.width*wapp.cfg[this.type].imageWidth}px`,
                        height: `${this.width*wapp.cfg[this.type].imageHeight}px`
                    })
                },
                ht.img(
                    {
                        'class': `${action}img`,
                        src: imageRes[`${action}_alt`], //`../img/${action}_alt.png`,
                        style: ht.css({
                            width: `${this.width*wapp.cfg[this.type].imageWidth}px`,
                            height: `${this.width*wapp.cfg[this.type].imageHeight}px`
                        })
                    }
                )
            );
        }
        return '';
    }

    // redisplay generic overlay image
    // action <string> action tag
    // hint <string> hint for user
    // alt <string> alternative action tag (if can(action) is false)
    // altHint <string> alternative hint for user
    rediv(action, hint, alt, altHint) {
        ut.replaceWith(`#${action}_oli_${this.item.key}`,this.div(action, hint, alt, altHint));
    }

    // generic left float markup
    // condition <boolean> whether to return markup or ""
    // content <string> html content
    // pcWidth <double> the width of the content as a percentage of total width
    lcell(condition, content, pcWidth) {
        return condition ? wapp.lcell(content, pcWidth) : '';
    }

    // generic right float markup
    // condition <boolean> whether to return markup or ""
    // content <string> html content
    // pcWidth <double> the width of the content as a percentage of total width
    rcell(condition, content, pcWidth) {
        return condition ? wapp.rcell(content, pcWidth) : '';
    }

    // show latest
    get latest() {
        let s = ut.tsAge(this.item.latest)
        if (!this.item.latest || isNaN(this.item.latest) || this.item.latest === null) s = 'n/a';
        return ht.div(
            {
                id: 'lst_'+this.item.key
            },
            s
        );
    }

    // standardized icon button
    // action <string> action tage
    // hint <string> hint for user
    button(action,hint) {
        return ht.button(
            {
                'class': action.replace('_over','')+'but',
                onclick: ht.evt('wapp.'+action.replace('_over',''),this.item.key,false),
                title: `click to ${hint}`,
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
                    'class': action.replace('_over','')+'img',
                    src: imageRes[action], //'../img/'+action+'.png',
                    style: ht.css({
                        width: `${this.width*wapp.cfg[this.type].imageHeight}px`,
                        height: `${this.width*wapp.cfg[this.type].imageHeight}px`
                    })
                }
            )
        );
    }

    // larger icon button
    // action <string> action tage
    // hint <string> hint for user
    button2(action,hint) {
        return ht.button(
            {
                'class': action.replace('_over','')+'but',
                onclick: ht.evt('wapp.'+action.replace('_over',''),this.item.key,true),
                title: `click to ${hint}`,
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
                    'class': action.replace('_over','')+'img',
                    src: imageRes[action], //'../img/'+action+'.png',
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
                class: 'vdo_'+this.item.key
            },
            this.videoStr
        );
    }

    // show channels string
    get channels() {
        return ht.div(
            {
                class: 'chn_'+this.item.key
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
    }

    // clear the item
    clear() {
        ut.remove('#div_'+this.item.key);
        delete wapp.itemx[this.item.key];
    }

    // redisplay the item
    redisplay() {
        ut.replaceWith('#div_'+this.item.key,this.html);
    }

    // generic element style string
    // section <string> section tag
    // css <object> css key/value pairs
    // multi <double> scaling multiple
    genStyle(section, css = {}, multi = 1) {
        css.height = `${(multi * this.width * wapp.cfg[this.type][`${section}Height`])}px`;
        return ht.css(css);
    }

}
