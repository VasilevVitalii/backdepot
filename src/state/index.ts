import * as path from 'path'
import { FsStat } from '../fsstat'
import { TypeEnvState, TypeOptionsStateIndex, TypeStateRow } from "../index.env"
import { Sqlite } from '../sqlite'
import { dir } from '../z'
import * as vvs from 'vv-shared'
import * as chokidar from 'chokidar'
import { upsert_big, upsert_small } from './upsert'
import { select_by_props, select_by_query } from './select'
import { timer_watch_queue } from './timer_watch_queue'
import { timer_remap } from './timer_remap'
import * as z from '../z'
import { TypeWorkInfo, WorkInfo } from './work_info'
import { TypeDataHandler } from '../typedata'

export class State {
    readonly name: string
    readonly path_data: string
    readonly path_map: string
    readonly file_map: string
    readonly type_data: TypeDataHandler
    readonly indexes: TypeOptionsStateIndex[]
    readonly sqlite: Sqlite

    work_info: WorkInfo

    watch_queue: {action: 'add' | 'change' | 'unlink', full_file_name: string, fsstat: FsStat}[]

    callback_error: (error: string) => void
    callback_debug: (debug: string) => void
    callback_trace: (trace: string) => void
    callback_change_delete: (rows: TypeStateRow[]) => void
    callback_change_insert: (rows: TypeStateRow[]) => void

    constructor(
        state: TypeEnvState,
        callback_work_info: (work_info: TypeWorkInfo) => void,
        callback_error: ((error: string) => void) | undefined,
        callback_debug: ((debug: string) => void) | undefined,
        callback_trace: ((trace: string) => void) | undefined,
        callback_change_delete: (rows: TypeStateRow[]) => void | undefined,
        callback_change_insert: (rows: TypeStateRow[]) => void | undefined,
    ) {
        this.name = state.name
        this.path_data = state.path_data
        this.path_map = state.path_map
        this.file_map =  dir(path.join(this.path_map, `${state.name}.map`))
        this.type_data = new TypeDataHandler(state.type_data, state.type_data_showcase)
        this.indexes = state.indexes
        this.work_info = new WorkInfo(callback_work_info)

        this.sqlite = new Sqlite(this.file_map, this.indexes, callback_trace)

        this.watch_queue = []
        this.callback_error = callback_error || (() => {})
        this.callback_debug = callback_debug || (() => {})
        this.callback_trace = callback_trace || (() => {})
        this.callback_change_delete = callback_change_delete || (() => {})
        this.callback_change_insert = callback_change_insert || (() => {})
    }

    watch_queue_state(): 'work' | 'pause' | 'unwanted'  {
        if (vvs.isEmpty(this.work_info.time_init)) return 'unwanted'
        if (vvs.isEmpty(this.work_info.time_watch) || vvs.isEmpty(this.work_info.time_remap)) return 'pause'
        return 'work'
    }

    init(callback: (success: boolean) => void) {
        this.callback_debug(`map init: begin`)
        this.sqlite.exec_init(error => {
            if (error) {
                this.callback_error(`map init: "${error.message}"`)
                callback(false)
                return
            }

            chokidar.watch(this.path_data, {
                awaitWriteFinish: {stabilityThreshold: 2000, pollInterval: 200}, ignoreInitial: true, usePolling: true,
            }).on('all', (event, path, fsstat) => {
                if (event !== 'add' && event !== 'change' && event !== 'unlink') {
                    return
                }
                this.watch_queue.push({
                    action: event,
                    full_file_name: z.dir(path),
                    fsstat: fsstat ? new FsStat(fsstat.mtimeMs * 10000, fsstat.ctimeMs * 10000, fsstat.birthtimeMs * 10000, fsstat.size) : new FsStat(0,0,0,0)
                })
            })

            this.work_info.time_init = new Date()
            setTimeout(() => {
                this.work_info.time_watch = new Date()
            }, 3000)

            this.callback_debug(`map init: end`)
            callback(true)

            timer_watch_queue(this)
            timer_remap(this)
        })
    }

    upsert(allow_callback_change_insert: boolean, file_rows: {full_file_name: string, fsstat: FsStat}[], callback: (success: boolean) => void) {
        if (file_rows.length <= 0) {
            callback(true)
            return
        }
        if (file_rows.length <= 10) {
            upsert_small(this, allow_callback_change_insert, file_rows, callback)
        } else {
            upsert_big(this, allow_callback_change_insert, file_rows, callback)
        }
    }

    select_by_props(
        filter_path: string | undefined,
        filter_file: string | undefined,
        filter_index_string: ({index: string, value: string}[]),
        filter_index_number: ({index: string, value: number}[]),
        callback: (error: Error | undefined, rows: TypeStateRow[]) => void
    ): void {
        select_by_props(this, filter_path, filter_file, filter_index_string, filter_index_number, callback)
    }

    select_by_query(
        filter_global: string | undefined,
        filter_index_string: ({index: string, query: string}[]),
        filter_index_number: ({index: string, query: string}[]),
        callback: (error: Error | undefined, rows: TypeStateRow[]) => void
    ): void {
        select_by_query(this, filter_global, filter_index_string, filter_index_number, callback)
    }

}