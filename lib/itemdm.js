// ytzero - generic data management of items
// (c) 2021/2 gatecrasher777
// https://github.com/gatecrasher777/ytzero
// MIT Licenced

const ut = require('../client/js/ut')();

class ItemDM {

	constructor(engine, cycle) {
		this.engine = engine;
		this.sql = engine.db.sql;
		this.type = 'item';
        // process control variables
		this.cycle = ut.minutes(cycle);
		this.todo = 0;
		this.done = 0;
		this.wait = 0;
        this.poll = null;
	}

	// inserts new item or loads existing
	open(item) {
		let info = this.new(item);
		if (info.changes) item.id = info.lastInsertRowid;
		item = this.load(item.id);
		return info;
	}

	// insert new item
	new(item) {
        item.data = this.engine.db.encode(item.meta);
        let info = this.add.run(item);
        delete item.data;
        return info;
    }

	// saves changes to an existing item
    save(item) {
        item.data = this.engine.db.encode(item.meta);
        let info = this.set.run(item);
        delete item.data;
        return info;
    }

	// loads item by id
    load(id) {
        let item = this.fetch.get(id);
        if (item === undefined) return {id:id,state:'absent'};
        return this.clean(item);
    }

    // decode zipped data
    clean(item) {
        item.meta = this.engine.db.decode(item.data);
        if (item.fdata) {
            item.filter = this.engine.db.decode(item.fdata);
            delete item.fdata;
        }
        if (item.cdata) {
            item.cmeta = this.engine.db.decode(item.cdata);
            delete item.cdata;
        }
        delete item.data;
        return item;
    }

	// run successful update process
    succeed(item) {
        item.data = this.engine.db.encode(item.meta);
        let info = this.success.run(item);
        delete item.data;
        return info;
    }

	// reduce completed update counter
    check() {
        this.done++;
    }

	// process to update item's data from YouTube
    process(id) {
        let item = this.load(id);
        if (item.state === 'absent') {
            this.check();
        } else {
            let generic = this.create(item);
            generic.setItem(item);
            this.update(generic);
        }
    }

	// creates a staggered delays for update requests based on index in a quantity of items
    stagger(index, quantity) {
        if (!index) return 0;
        let gap = (this.engine.cfg.advanced.cycleStaggerLength * this.cycle) / quantity;
        return Math.floor(index * gap);
    }

	// batch processing of automated update loops
    run() {
        console.log(`${this.type} done ${this.done}/${this.todo}`);
        if (
            this.todo <= this.done
            ||
            this.wait >= this.cycle * this.engine.cfg.advanced.cycleWaitLength
        ) {
            this.wait = 0;
            this.poll = setTimeout(this.run.bind(this),this.cycle);
            let result = this.upd.all(this.engine.cfg.engine.updates);
            console.log('updating '+result.length+' '+this.type);
            this.todo = result.length;
            this.done = 0;
            result.forEach((e,i,a) => {
                setTimeout(this.process.bind(this),this.stagger(i,a.length),e.id);
            });
        } else {
            let extra = 1000 + this.cycle * ( 1 - this.done / this.todo);
            this.poll = setTimeout(this.run.bind(this),extra);
            this.wait += extra;
        }
    }

	// default item configuration - use ytzero.yaml to override
	static get default() {
		return {
			padding: 3,
			margin: 2,
			radius: 8,
			space: 2,
			controlHeight: 22,
			buttonWidth: 32,
			width: 256,
			pendingRGB: 'rgb(0,0,127)',
			downloadRGB: 'rgb(63,63,0)',
			buttonField: 13,
			button2Field: 16.6666,
			button2Scale: 1.3333
		};
	}

}

module.exports = ItemDM;