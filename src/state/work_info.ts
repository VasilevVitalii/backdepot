export type TWorkInfo = {
    timeInit: Date | undefined
    timeWatch: Date | undefined
    timeRemap: Date | undefined
}

export class WorkInfo {
    private _workInfo: TWorkInfo
    private _callback: (workInfo: TWorkInfo) => void

    constructor(callback: (workInfo: TWorkInfo) => void) {
        this._workInfo = {
            timeInit: undefined,
            timeWatch: undefined,
            timeRemap: undefined
        }
        this._callback = callback
        this._send()
    }

    private _send() {
        this._callback(this._workInfo)
    }

    get time_init(): Date | undefined {
        return this._workInfo.timeInit
    }
    set time_init(value: Date | undefined) {
        this._workInfo.timeInit = value
        this._send()
    }

    get time_watch(): Date | undefined {
        return this._workInfo.timeWatch
    }
    set time_watch(value: Date | undefined) {
        this._workInfo.timeWatch = value
        this._send()
    }

    get time_remap(): Date | undefined {
        return this._workInfo.timeRemap
    }
    set time_remap(value: Date | undefined) {
        this._workInfo.timeRemap = value
        this._send()
    }
}