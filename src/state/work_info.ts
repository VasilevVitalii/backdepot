export type TypeWorkInfo = {
    time_init: Date | undefined
    time_watch: Date | undefined
    time_remap: Date | undefined
}

export class WorkInfo {
    private _work_info: TypeWorkInfo
    private callback: (work_info: TypeWorkInfo) => void

    constructor(callback: (work_info: TypeWorkInfo) => void) {
        this._work_info = {
            time_init: undefined,
            time_watch: undefined,
            time_remap: undefined
        }
        this.callback = callback
        this.send()
    }

    private send() {
        this.callback(this._work_info)
    }

    get time_init(): Date | undefined {
        return this._work_info.time_init
    }
    set time_init(value: Date | undefined) {
        this._work_info.time_init = value
        this.send()
    }

    get time_watch(): Date | undefined {
        return this._work_info.time_watch
    }
    set time_watch(value: Date | undefined) {
        this._work_info.time_watch = value
        this.send()
    }

    get time_remap(): Date | undefined {
        return this._work_info.time_remap
    }
    set time_remap(value: Date | undefined) {
        this._work_info.time_remap = value
        this.send()
    }
}