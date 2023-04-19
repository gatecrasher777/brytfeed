/* brytfeed - (c) 2023 Gatecrasher777 */
/* topic client module */

// topic item class
class Topic extends Model {

    // topic item constructor
    // item <object> topic data
    // scale <double> required size of item
    constructor(item, scale) {
        super('topic', item, scale);
        this.categories = wapp.cfg.engine.allCategories;
        this.checkShown = false;
        this.old = wapp.cfg.topic.old;
        this.color = {
            'r': wapp.cfg.topic.red,
            'g': wapp.cfg.topic.green,
            'b': wapp.cfg.topic.blue
        };
        this.durations = wapp.cfg.topic.durations;
        this.resize();
    }

    // change name
    // value <string> new topic name
    set name(value) {
        if (
            this.item.name !== value
            &&
            value.length >= wapp.cfg.topic.minNameLength
            &&
            value.length <= wapp.cfg.topic.maxNameLength
        ) {
            this.item.name = value;
            this.set('name',value);
        }
    }

    // get latest video age
    get age() {
        if (!this.item.latest) return 0;
        return (ut.now()-this.item.latest)/1000;
    }

    // resize the topic item
    resize() {
        this.height = Topic.calc_height(this.scale);
    }

    // show new videos
    get newVideos() {
        return ht.div(
            {id:`nvo_${this.item.key}`},
            this.item.newVideos
        );
    }

    get downloads() {
        return ht.div(
            {id:`dls_${this.item.downloads}`},
            this.item.newVideos
        );
    }

    // show total videos
    get videoCount() {
        return ht.div(
            {id:`vco_${this.item.key}`},
            this.item.videoCount
        );
    }

    // show total channels
    get channelCount() {
        return ht.div(
            {id:`cco_${this.item.key}`},
            this.item.channelCount
        );
    }

    // show total searches
    get searchCount() {
        return ht.div(
            {id:`sco_${this.item.key}`},
            this.item.searchCount
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
                wapp.lcell('new:'),
                wapp.lcell(this.newVideos),
                wapp.rcell(this.downloads),
                wapp.rcell('dls: '),
                wapp.rcell(this.videoCount),
                wapp.rcell('videos: '),
            ),
            ht.div(
                {
                    'class': 'statsrow',
                    style: this.genStyle('stat')
                },
                wapp.lcell('searches:'),
                wapp.lcell(this.searchCount),
                wapp.rcell(this.channelCount),
                wapp.rcell('channels: ')
            )
        );
    }

    // show category check list
    showCheckList() {
        if (this.checkShown) {
            document.onselectstart = null;
            ut.css(`#checkList_${this.item.key}`,{display:'none'});
            this.checkShown = false;
            this.set('allowCategory',this.item.allowCategory);
        } else {
            document.onselectstart = () => { return wapp.selectOK; }
            ut.css(`#checkList_${this.item.key}`,{display:'block'});
            this.checkShown = true;
        }
    }

    // category checked
    // category <string> category string
    checkListClick(category) {
        let a = this.item.allowCategory.split(',');
        let f = a.indexOf(category);
        if (f >= 0) {
            a.splice(f,1);
        } else {
            a.push(category);
        }
        this.item.allowCategory = a.join(',');
    }

    // show allowed category text
    get allowed() {
        if (this.item.allowCategory) return ht.concat(
            ht.button(
                {
                    id: `autoSelect_${this.item.key}`,
                    class: 'autoselect',
                    onclick: ht.evt('wapp.showCheckList',this.item.key),
                    title: 'click to select categories to allow in search results',
                    style: this.genStyle('category',{
                        'border-radius': `${this.radius}px`
                    })
                },
                this.item.allowCategory
            ),
            ht.div(
                {
                    id : `checkList_${this.item.key}`,
                    class: 'checklist'
                },
                ht.forEach(
                    this.categories,
                    (e,i,a) => {
                        let attr = {
                            type: 'checkbox',
                            id: `checkBox_${this.item.key}_${i}`,
                            onclick: ht.evt('wapp.checkListClick',this.item.key,e)
                        };
                        if (this.item.allowCategory.includes(e)) attr.checked='checked';
                        return ht.label(
                            {
                                for: `checkBox_${this.item.key}_${i}`,
                                class: 'checklistbox'
                            },
                            ht.input(attr),
                            e
                        )
                    }
                )
            )
        );
    }

    // save disallowed text
    // value <string> text value
    set disallow(value) {
        this.item.disallowText = value;
        this.set('disallowText',value);
    }

    // show disallowed text
    get disallow() {
        return ht.textarea(
            {
                id: `dis_${this.item.key}`,
                class: 'disallowed',
                onfocus: ht.cmd('wapp.editText',true),
                onblur: ht.cmd('wapp.disallowEdit',this.item.key),
                title: 'discard videos with this comma separated list of words or phrases',
                placeholder: 'enter words/phrases that will disallow videos if they appear in their title, description or keywords',
                style: this.genStyle('ban')
            },
            this.item.disallowText
        );
    }

    // show minimum duration
    get minDur() {
        return ht.select(
            {
                id: `minDurSelect_${this.item.key}`,
                onchange: ht.cmd('wapp.genericSelect',this.item.key,'item','minDur'),
                title: 'specify minimum allowed video duration for this topic',
                style: this.genStyle('control',{
                    'border-radius': `${this.radius}px`
                })
            },
            ht.forEach(
                this.durations,
                e => {
                    let o = { value: e.toString() };
                    if (e == this.item.minDur) o.selected = 'selected';
                    return ht.option(o,
                        ht.ifElse(
                            e,
                            ut.secDur(e),
                            'any'
                        )
                    );
                }
            )
        );
    }

    // show maximum duration
    get maxDur() {
        return ht.select(
            {
                id: `maxDurSelect_${this.item.key}`,
                onchange: ht.cmd('wapp.genericSelect',this.item.key,'item','maxDur'),
                title: 'specify maximum allowed video duration for this topic',
                style: this.genStyle('control',{
                    'border-radius': `${this.radius}px`
                })
            },
            ht.forEach(
                this.durations,
                e => {
                    let o = { value: e.toString() };
                    if (e == this.item.maxDur) o.selected = 'selected';
                    return ht.option(o,
                        ht.ifElse(
                            e,
                            ut.secDur(e),
                            'any'
                        )
                    );
                }
            )
        );
    }

    // change active updates setting
    // value <boolean> updates value
    set active(value) {
        this.item.updates = value;
        this.set('updates',value);
    }

    // show active updates setting
    get active() {
        let attr =  {
            id: `act_${this.item.key}`,
            type: 'checkbox',
            onclick: ht.cmd('wapp.topicActive',this.item.key),
            title: `Allow/Disallow automatic search/channel/video updates for ${this.item.name}`
        };
        if (this.item.updates) attr.checked = 'checked';
        return ht.input(attr);
    }

    // show topic options
    get options() {
        return ht.concat(
            ht.div(
                {
                    'class':'optionsrow',
                    style: this.genStyle('option')
                },
                wapp.lcell('min:',wapp.cfg.topic.minDurLabel),
                wapp.lcell(this.minDur,wapp.cfg.topic.minDurField),
                wapp.lcell('max:',wapp.cfg.topic.maxDurLabel),
                wapp.lcell(this.maxDur,wapp.cfg.topic.maxDurField),
                wapp.rcell(this.active),
                wapp.rcell(`act:`)
            ),
            ht.div(
                {
                    'class':'optionsrow',
                    style: this.genStyle('category')
                },
                wapp.lcell(this.allowed,wapp.cfg.topic.categoryField),
            ),
            ht.div(
                {
                    'class':'optionsrow',
                    style: this.genStyle('ban')
                },
                wapp.lcell(this.disallow,wapp.cfg.topic.banField),
            )
        );
    }

    // show topic metadata
    get metarow() {
        return ht.div(
            {
                'class': 'metarow',
                style: this.genStyle('update',{
                    'padding-top': `${this.padding}px`
                })
            },
            wapp.lcell('last:'),
            wapp.lcell(this.latest),
            this.rcell(this.item.id!=0,this.button('discard','discard this topic'),wapp.cfg.item.buttonField)
        );
    }

    // show topic body
    get body() {
        return ht.div (
            this.namerow,
            this.stats,
            this.options,
            this.metarow
        )
    }

    // refresh updateble topic data
    refresh() {
        ut.attr(`#div_${this.item.key}`,this.attrib);
        ut.html(`#sts_${this.item.key}`,this.statusStr);
        ut.attr(`#sts_${this.item.key}`,{title: this.reasonStr});
        ut.html(`#upd_${this.item.key}`,this.updatedStr);
        ut.html(`#nvo_${this.item.key}`,this.newVideos);
        ut.html(`#dls_${this.item.key}`,this.downloads);
        ut.html(`#vco_${this.item.key}`,this.videoCount);
        ut.html(`#cco_${this.item.key}`,this.channelCount);
        ut.html(`#sco_${this.item.key}`,this.searchCount);
        ut.html(`#lst_${this.item.key}`,ut.tsAge(this.item.latest));
    }

    // determine height of topic item
    // scale <double> scale to apply
    static calc_height(scale) {
        let h = wapp.cfg.topic;
        return wapp.cfg.item.width * scale * (
            h.textHeight +
            h.statHeight * 2 +
            h.optionHeight +
            h.categoryHeight +
            h.banHeight +
            h.updateHeight
        );
    }

}
