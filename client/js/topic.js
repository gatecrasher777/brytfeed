// ytzero - client search container class
// https://github.com/gatecrasher777/ytzero
// (c) 2021/2 gatecrasher777
// MIT Licenced

class ytzTopic extends ytzItem {

    // topic item constructor
    constructor(item, scale) {
        super(item,scale);
        this.type = 'topic';
        this.categories = wapp.cfg.engine.categories;
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
    set name(value) {
        if (
            this.item.name !== value
            &&
            value.length >= wapp.cfg.topic.minNameLength
            &&
            value.length <= wapp.cfg.topic.maxNameLength
        ) {
            this.item.name = value;
            this.set();
        }
    }

    // get age since latest
    get age() {
        if (!this.item.latest) return 0;
        return (ut.now()-this.item.latest)/1000;
    }

    // resize the topic item
    resize() {
        this.height = ytzTopic.calc_height(this.scale);
    }

    // show new videos
    get newVideos() {
        return ht.div(
            {id:`nvo_${this.item.id}`},
            this.item.newVideos
        );
    }

    // show total videos
    get videoCount() {
        return ht.div(
            {id:`vco_${this.item.id}`},
            this.item.videoCount
        );
    }

    // show total channels
    get channelCount() {
        return ht.div(
            {id:`cco_${this.item.id}`},
            this.item.channelCount
        );
    }

    // show total searches
    get searchCount() {
        return ht.div(
            {id:`sco_${this.item.id}`},
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
            ut.css(`#checkList_${this.item.id}`,{display:'none'});
            this.checkShown = false;
            this.redisplay();
        } else {
            ut.css(`#checkList_${this.item.id}`,{display:'block'});
            this.checkShown = true;
        }
    }

    // category checked
    checkListClick(c) {
        let f = this.item.meta.allowCategory.indexOf(c);
        if (f>=0) {
            this.item.meta.allowCategory.splice(f,1);
        } else {
            this.item.meta.allowCategory.push(c);
        }
        this.set();
    }

    // show allowed category text
    get allowed() {
        if (this.item.meta.allowCategory) return ht.concat(
            ht.button(
                {
                    id: `autoSelect_${this.item.id}`,
                    class: 'autoselect',
                    onclick: ht.evt('wapp.showCheckList',this.item.id),
                    title: 'click to select categories to allow in search results',
                    style: this.genStyle('category',{
                        'border-radius': `${this.radius}px`
                    })
                },
                this.item.meta.allowCategory.join(', ')
            ),
            ht.div(
                {
                    id : `checkList_${this.item.id}`,
                    class: 'checklist'
                },
                ht.forEach(
                    this.categories,
                    (e,i,a) => {
                        let attr = {
                            type: 'checkbox',
                            id: `checkBox_${this.item.id}_${i}`,
                            onclick: ht.evt('wapp.checkListClick',this.item.id,e)
                        };
                        if (this.item.meta.allowCategory.includes(e)) attr.checked='checked';
                        return ht.label(
                            {
                                for: `checkBox_${this.item.id}_${i}`,
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
    set disallow(value) {
        this.item.meta.disallowText = value;
        this.set();
    }

    // show disallowed text
    get disallow() {
        return ht.textarea(
            {
                id: `dis_${this.item.id}`,
                class: 'disallowed',
                onblur: ht.cmd('wapp.disallowEdit',this.item.id),
                title: 'discard videos with this comma separated list of words or phrases',
                placeholder: 'enter words/phrases that will disallow videos if they appear in their title, description or keywords',
                style: this.genStyle('ban')
            },
            this.item.meta.disallowText
        );
    }

    // show minimum duration
    get minDur() {
        return ht.select(
            {
                id: `minDurSelect_${this.item.id}`,
                onchange: ht.cmd('wapp.genericSelect',this.item.id,'meta','minDur'),
                title: 'specify minimum allowed video duration for this topic',
                style: this.genStyle('control',{
                    'border-radius': `${this.radius}px`
                })
            },
            ht.forEach(
                this.durations,
                e => {
                    let o = { value: e.toString() };
                    if (e == this.item.meta.minDur) o.selected = 'selected';
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
                id: `maxDurSelect_${this.item.id}`,
                onchange: ht.cmd('wapp.genericSelect',this.item.id,'meta','maxDur'),
                title: 'specify maximum allowed video duration for this topic',
                style: this.genStyle('control',{
                    'border-radius': `${this.radius}px`
                })
            },
            ht.forEach(
                this.durations,
                e => {
                    let o = { value: e.toString() };
                    if (e == this.item.meta.maxDur) o.selected = 'selected';
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

    // change active setting
    set active(value) {
        this.item.status = (value) ? 'ON': 'OFF';
        this.set();
    }

    // show active setting
    get active() {
        let attr =  {
            id: `act_${this.item.id}`,
            type: 'checkbox',
            onclick: ht.cmd('wapp.topicActive',this.item.id),
            title: `Allow/Disallow automatic search/channel/video updates for ${this.item.name}`
        };
        if (this.item.status === 'ON') attr.checked = 'checked';
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
                wapp.rcell(`${this.item.status}:`)
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
        super.refresh();
        ut.html(`#nvo_${this.item.id}`,this.newVideos);
        ut.html(`#vco_${this.item.id}`,this.videoCount);
        ut.html(`#cco_${this.item.id}`,this.channelCount);
        ut.html(`#sco_${this.item.id}`,this.searchCount);
        ut.html(`#lst_${this.item.id}`,ut.tsAge(this.item.latest));
    }

    // determine height of topic item
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
