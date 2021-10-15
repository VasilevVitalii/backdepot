import * as path from 'path'
import { FsStat } from '../fsstat'
import { State } from "."
import { FromFile} from '../pk'
import * as vv from 'vv-common'
import { TRow as Row_Data} from '../sqlite/table.data'

export function Rescan(state: State, callback: (success: boolean) => void) {
    state.callbackDebug(`map rescan: begin`)
    vv.dir(state.pathData, {mode: 'files'}, (error, rawFiles) => {
        if (error) {
            state.callbackError(`map rescan: in scan dir "${error.message}"`)
            callback(false)
            return
        }
        const files = rawFiles
            .map(m => {
                return {
                    pk: FromFile(path.join(m.path, m.file), state.pathData),
                    data: undefined,
                    fsstat: new FsStat(m.fsstat.mtimeMs * 10000, m.fsstat.ctimeMs * 10000, m.fsstat.birthtimeMs * 10000, m.fsstat.size)
                }
            }) as Row_Data[]
        state.callbackDebug(`map rescan: find ${files.length} file(s)`)

        state.sqlite.orm.data.select(['path', 'file', 'fsstatMtimeMs', 'fsstatCtimeMs', 'fsstatBirthtimeMs', 'fsstatSize'], undefined, (error, maps) => {
            if (error) {
                state.callbackError(`map rescan: in scan map "${error.message}"`)
                callback(false)
                return
            }
            state.callbackDebug(`map rescan: find ${maps.length} maps(s)`)

            const mapsNeedDelete =  maps.filter(f => files.every(ff => !f.pk.equal(ff.pk)))
            state.callbackDebug(`map rescan: check for delete ${mapsNeedDelete.length} maps(s)`)
            const mapsNeedUpdate = files.filter(f => maps.some(ff => f.pk.equal(ff.pk) && !f.fsstat.equal(ff.fsstat)))
            state.callbackDebug(`map rescan: check for update ${mapsNeedUpdate.length} maps(s)`)
            const mapsNeedInsert = files.filter(f => maps.every(ff => !f.pk.equal(ff.pk)))
            state.callbackDebug(`map rescan: check for insert ${mapsNeedInsert.length} maps(s)`)

            state.sqlite.execDataDelete(mapsNeedDelete.map(m => { return m.pk }), error => {
                if (error) {
                    state.callbackError(`map rescan: in delete checked map(s) "${error.message}"`)
                    callback(false)
                    return
                }
                state.callbackDebug(`map rescan: checked map(s) deleted`)

                state.upsert(false, mapsNeedUpdate.map(m => { return {fullFileName: path.join(state.pathData, m.pk.path, m.pk.file), fsstat: m.fsstat} }), isSuccess => {
                    if (!isSuccess) {
                        callback(false)
                        return
                    }
                    state.callbackDebug(`map rescan: checked map(s) updated`)

                    state.upsert(false, mapsNeedInsert.map(m => { return {fullFileName: path.join(state.pathData, m.pk.path, m.pk.file), fsstat: m.fsstat} }), isSuccess => {
                        if (!isSuccess) {
                            callback(false)
                            return
                        }
                        state.callbackDebug(`map rescan: checked map(s) inserted`)
                        state.callbackDebug(`map rescan: end`)
                        callback(true)
                    })
                })
            })
        })
    })
}