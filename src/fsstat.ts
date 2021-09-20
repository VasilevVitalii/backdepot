import * as vvs from 'vv-shared'

export class FsStat {
    readonly mtimeMs: number
    readonly ctimeMs: number
    readonly birthtimeMs: number
    readonly size: number

    constructor(mtimeMs: number, ctimeMs: number, birthtimeMs: number, size: number) {
        this.mtimeMs = mtimeMs
        this.ctimeMs = ctimeMs
        this.birthtimeMs = birthtimeMs
        this.size = size
    }

    equal (fsstat: FsStat): boolean {
        if (vvs.isEmpty(fsstat)) return false
        return this.mtimeMs === fsstat.mtimeMs && this.ctimeMs === fsstat.ctimeMs && this.birthtimeMs === fsstat.birthtimeMs && this.size === fsstat.size
    }
}

