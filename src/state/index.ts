import * as path from 'path'
import { FsStat } from '../fsstat'
import { TEnvState, TOptionsStateIndex, TStateRow } from "../index.env"
import { Sqlite } from '../sqlite/index'
import { Dir } from '../z'
import * as vv from 'vv-common'
import * as chokidar from 'chokidar'
import { UpsertBig, UpsertSmall } from './upsert'
import { SelectByProps, SelectByQuery } from './select'
import { TimerWatchQueue } from './timer_watch_queue'
import { TimerRemap } from './timer_remap'
import * as z from '../z'
import { TWorkInfo, WorkInfo } from './work_info'
import { TypeDataHandler } from '../typedata'

export class State {
    readonly name: string
    readonly pathData: string
    readonly pathMap: string
    readonly fileMap: string
    readonly typeData: TypeDataHandler
    readonly indexes: TOptionsStateIndex[]
    readonly sqlite: Sqlite

    workInfo: WorkInfo

    watchQueue: {action: 'add' | 'change' | 'unlink', fullFileName: string, fsstat: FsStat}[]

    callbackError: (error: string) => void
    callbackDebug: (debug: string) => void
    callbackTrace: (trace: string) => void
    callbackChangeDelete: (rows: TStateRow[]) => void
    callbackChangeInsert: (rows: TStateRow[]) => void

    constructor(
        state: TEnvState,
        callbackWorkInfo: (work_info: TWorkInfo) => void,
        callbackError: ((error: string) => void) | undefined,
        callbackDebug: ((debug: string) => void) | undefined,
        callbackTrace: ((trace: string) => void) | undefined,
        callbackChangeDelete: (rows: TStateRow[]) => void | undefined,
        callbackChangeInsert: (rows: TStateRow[]) => void | undefined,
    ) {
        this.name = state.name
        this.pathData = state.pathData
        this.pathMap = state.pathMap
        this.fileMap = this.pathMap === 'MEMORY' ? 'MEMORY' : Dir(path.join(this.pathMap, `${state.name}.map`))
        this.typeData = new TypeDataHandler(state.typeData, state.typeDataShowcase)
        this.indexes = state.indexes
        this.workInfo = new WorkInfo(callbackWorkInfo)

        this.sqlite = new Sqlite(this.fileMap, this.indexes, callbackTrace)

        this.watchQueue = []
        this.callbackError = callbackError || (() => {})
        this.callbackDebug = callbackDebug || (() => {})
        this.callbackTrace = callbackTrace || (() => {})
        this.callbackChangeDelete = callbackChangeDelete || (() => {})
        this.callbackChangeInsert = callbackChangeInsert || (() => {})
    }

    watchQueueState(): 'work' | 'pause' | 'unwanted'  {
        if (vv.isEmpty(this.workInfo.time_init)) return 'unwanted'
        if (vv.isEmpty(this.workInfo.time_watch) || vv.isEmpty(this.workInfo.time_remap)) return 'pause'
        return 'work'
    }

    init(callback: (success: boolean) => void) {
        this.callbackDebug(`map init: begin`)
        this.sqlite.execInit(error => {
            if (error) {
                this.callbackError(`map init: "${error.message}"`)
                callback(false)
                return
            }

            chokidar.watch(this.pathData, {
                awaitWriteFinish: {stabilityThreshold: 2000, pollInterval: 200}, ignoreInitial: true, usePolling: true,
            }).on('all', (event, path, fsstat) => {
                if (event !== 'add' && event !== 'change' && event !== 'unlink') {
                    return
                }
                this.watchQueue.push({
                    action: event,
                    fullFileName: z.Dir(path),
                    fsstat: fsstat ? new FsStat(fsstat.mtimeMs * 10000, fsstat.ctimeMs * 10000, fsstat.birthtimeMs * 10000, fsstat.size) : new FsStat(0,0,0,0)
                })
            })

            this.workInfo.time_init = new Date()
            setTimeout(() => {
                this.workInfo.time_watch = new Date()
            }, 3000)

            this.callbackDebug(`map init: end`)
            callback(true)

            TimerWatchQueue(this)
            TimerRemap(this)
        })
    }

    upsert(allowCallbackChangeInsert: boolean, fileRows: {fullFileName: string, fsstat: FsStat}[], callback: (success: boolean) => void) {
        if (fileRows.length <= 0) {
            callback(true)
            return
        }
        if (fileRows.length <= 10) {
            UpsertSmall(this, allowCallbackChangeInsert, fileRows, callback)
        } else {
            UpsertBig(this, allowCallbackChangeInsert, fileRows, callback)
        }
    }

    selectByProps(
        filterPath: string | undefined,
        filterFile: string | undefined,
        filterIndexString: ({index: string, value: string}[]),
        filterIndexNumber: ({index: string, value: number}[]),
        callback: (error: Error | undefined, rows: TStateRow[]) => void
    ): void {
        SelectByProps(this, filterPath, filterFile, filterIndexString, filterIndexNumber, callback)
    }

    selectByQuery(
        filterGlobal: string | undefined,
        filterIndexString: ({index: string, query: string}[]),
        filterIndexNumber: ({index: string, query: string}[]),
        callback: (error: Error | undefined, rows: TStateRow[]) => void
    ): void {
        SelectByQuery(this, filterGlobal, filterIndexString, filterIndexNumber, callback)
    }

}