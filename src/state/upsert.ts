import { State } from "./index"
import { FsStat } from '../fsstat'
import { ReadFiles } from '../z'
import { FromFile } from '../pk'
import { TRow as Row_Data} from '../sqlite/table.data'

export function UpsertSmall(state: State, allowCallbackChangeInsert: boolean, fileRows: {fullFileName: string, fsstat: FsStat}[], callback: (success: boolean) => void): void {
    const rows = fileRows.map(m => { return {...m, data: undefined as string | undefined, pk: FromFile(m.fullFileName, state.pathData) }})
    ReadFiles(rows, 0, error => {
        if (error) {
            state.callbackError(`queue upsert small: read files "${error.message}"`)
            callback(false)
            return
        }
        state.sqlite.execDataUpsertIndex(rows, error => {
            if (error) {
                state.callbackError(`queue upsert small: upsert index "${error.message}"`)
                callback(false)
                return
            }
            state.sqlite.orm.data.upsert(rows, error => {
                if (error) {
                    state.callbackError(`queue upsert small: upsert data "${error.message}"`)
                    callback(false)
                    return
                }
                if (allowCallbackChangeInsert) {
                    state.callbackChangeInsert(rows.map(m => { return {path: m.pk.path, file: m.pk.file, data: m.data} }))
                }
                fileRows.forEach(item => {
                    state.callbackDebug(`queue upsert small: upsert file ${item.fullFileName}`)
                })
                callback(true)
            })
        })
    })
}

export function UpsertBig(state: State, allowCallbackChangeInsert: boolean, fileRows: {fullFileName: string, fsstat: FsStat}[], callback: (success: boolean) => void): void {
    let readFilesThreadCount = 2
    let upsertDataTimeout = 500

    if (fileRows.length > 1000) {
        readFilesThreadCount = 20
        upsertDataTimeout = 3000
    } else if (fileRows.length > 100) {
        readFilesThreadCount = 10
        upsertDataTimeout = 2000
    } else if (fileRows.length > 50) {
        readFilesThreadCount = 5
        upsertDataTimeout = 1000
    }
    const readFilesFilesInThread = Math.ceil(fileRows.length / readFilesThreadCount)
    const processState = {
        hasError: false,
        readFilesRows: [] as Row_Data[],
        readFilesThreadCount: readFilesThreadCount,
        readFilesCountForMessage: 0,
        upsertMapsCountForMessage: 0,
        upsertQueriesCountForMessage: 0
    }

    state.callbackError(`queue upsert big: start ${readFilesThreadCount} threads for read files`)
    for (let threadIdx = 0; threadIdx < readFilesThreadCount; threadIdx++) {
        const readFilesThread = (
                threadIdx + 1 === readFilesThreadCount ?
                fileRows.slice(threadIdx * readFilesFilesInThread) :
                fileRows.slice(threadIdx * readFilesFilesInThread, (threadIdx + 1) * readFilesFilesInThread)
            )
        let readFilesTimer = setTimeout(function tick() {
            if (processState.hasError) {
                processState.readFilesThreadCount--
                return
            }
            if (processState.readFilesRows.length > 500) {
                readFilesTimer = setTimeout(tick, upsertDataTimeout)
                return
            }
            const readFilesChunk = readFilesThread.splice(0, 5).map(m => { return {...m, data: undefined as string | undefined, pk: FromFile(m.fullFileName, state.pathData) }})
            if (readFilesChunk.length <= 0) {
                processState.readFilesThreadCount--
                return
            }
            ReadFiles(readFilesChunk, 0, error => {
                if (error) {
                    processState.hasError = true
                    state.callbackError(`queue upsert big: read files "${error.message}"`)
                    processState.readFilesThreadCount--
                    return
                }

                processState.readFilesRows.push(...readFilesChunk)
                processState.readFilesThreadCount = processState.readFilesThreadCount + readFilesChunk.length
                if (processState.readFilesThreadCount > 1000 ) {
                    state.callbackDebug (`queue upsert big: read portion files "${processState.readFilesThreadCount}" `)
                    processState.readFilesThreadCount = 0
                }

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                readFilesTimer = setTimeout(tick, 0)
            })
        }, 0)
    }

    let uploadTimer = setTimeout(function tick() {
        if (processState.hasError) {
            callback(false)
            return
        }
        const uploadRows = processState.readFilesRows.splice(0, processState.readFilesRows.length)
        if (uploadRows.length <= 0) {
            if (processState.readFilesThreadCount <= 0) {
                callback(!processState.hasError)
            } else {
                uploadTimer = setTimeout(tick, upsertDataTimeout)
            }
            return
        }
        state.sqlite.execDataUpsertIndex(uploadRows, error => {
            if (error) {
                state.callbackError(`queue upsert big: upsert index "${error.message}"`)
                processState.hasError = true
                callback(false)
                return
            }
            state.sqlite.orm.data.upsert(uploadRows, error => {
                if (error) {
                    state.callbackError(`queue upsert big: upsert data "${error.message}"`)
                    processState.hasError = true
                    callback(false)
                    return
                }
                processState.upsertQueriesCountForMessage++
                processState.upsertMapsCountForMessage = processState.upsertMapsCountForMessage + uploadRows.length
                if (processState.upsertMapsCountForMessage > 1000 ) {
                    state.callbackDebug(`queue upsert big: upsert portion maps "${processState.upsertMapsCountForMessage}" (${processState.upsertQueriesCountForMessage} queries) `)
                    processState.upsertMapsCountForMessage = 0
                    processState.upsertQueriesCountForMessage = 0
                }
                if (allowCallbackChangeInsert) {
                    state.callbackChangeInsert(uploadRows.map(m => { return {path: m.pk.path, file: m.pk.file, data: m.data} }))
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                uploadTimer = setTimeout(tick, upsertDataTimeout)
            })
        })
    })
}