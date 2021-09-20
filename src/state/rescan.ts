import * as path from 'path'
import { FsStat } from '../fsstat'
import { State } from "."
import { FromFile} from '../pk'
import * as vvs from 'vv-shared'
import { TypeRow as Row_Data} from '../sqlite/table.data'

export function rescan(state: State, callback: (success: boolean) => void) {
    state.callback_debug(`map rescan: begin`)
    vvs.readdir(state.path_data, {mode: 'files'}, (error, raw_files) => {
        if (error) {
            state.callback_error(`map rescan: in scan dir "${error.message}"`)
            callback(false)
            return
        }
        const files = raw_files
            .map(m => {
                return {
                    pk: FromFile(path.join(m.path, m.file), state.path_data),
                    data: undefined,
                    fsstat: new FsStat(m.fsstat.mtimeMs * 10000, m.fsstat.ctimeMs * 10000, m.fsstat.birthtimeMs * 10000, m.fsstat.size)
                }
            }) as Row_Data[]
        state.callback_debug(`map rescan: find ${files.length} file(s)`)

        state.sqlite.orm.data.select(['path', 'file', 'fsstat_mtimeMs', 'fsstat_ctimeMs', 'fsstat_birthtimeMs', 'fsstat_size'], undefined, (error, maps) => {
            if (error) {
                state.callback_error(`map rescan: in scan map "${error.message}"`)
                callback(false)
                return
            }
            state.callback_debug(`map rescan: find ${maps.length} maps(s)`)

            const maps_need_delete =  maps.filter(f => files.every(ff => !f.pk.equal(ff.pk)))
            state.callback_debug(`map rescan: check for delete ${maps_need_delete.length} maps(s)`)
            const maps_need_update = files.filter(f => maps.some(ff => f.pk.equal(ff.pk) && !f.fsstat.equal(ff.fsstat)))
            state.callback_debug(`map rescan: check for update ${maps_need_update.length} maps(s)`)
            const maps_need_insert = files.filter(f => maps.every(ff => !f.pk.equal(ff.pk)))
            state.callback_debug(`map rescan: check for insert ${maps_need_insert.length} maps(s)`)

            state.sqlite.exec_data_delete(maps_need_delete.map(m => { return m.pk }), error => {
                if (error) {
                    state.callback_error(`map rescan: in delete checked map(s) "${error.message}"`)
                    callback(false)
                    return
                }
                state.callback_debug(`map rescan: checked map(s) deleted`)

                state.upsert(false, maps_need_update.map(m => { return {full_file_name: path.join(state.path_data, m.pk.path, m.pk.file), fsstat: m.fsstat} }), success => {
                    if (!success) {
                        callback(false)
                        return
                    }
                    state.callback_debug(`map rescan: checked map(s) updated`)

                    state.upsert(false, maps_need_insert.map(m => { return {full_file_name: path.join(state.path_data, m.pk.path, m.pk.file), fsstat: m.fsstat} }), success => {
                        if (!success) {
                            callback(false)
                            return
                        }
                        state.callback_debug(`map rescan: checked map(s) inserted`)
                        state.callback_debug(`map rescan: end`)
                        callback(true)
                    })
                })
            })
        })
    })
}