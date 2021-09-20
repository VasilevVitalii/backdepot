import { State } from "."
import { FsStat } from '../fsstat'
import { readfiles } from '../z'
import { FromFile } from '../pk'
import { TypeRow as Row_Data} from '../sqlite/table.data'

export function upsert_small(state: State, allow_callback_change_insert: boolean, file_rows: {full_file_name: string, fsstat: FsStat}[], callback: (success: boolean) => void): void {
    const rows = file_rows.map(m => { return {...m, data: undefined as string | undefined, pk: FromFile(m.full_file_name, state.path_data) }})
    readfiles(rows, 0, error => {
        if (error) {
            state.callback_error(`queue upsert small: read files "${error.message}"`)
            callback(false)
            return
        }
        state.sqlite.exec_data_upsert_index(rows, error => {
            if (error) {
                state.callback_error(`queue upsert small: upsert index "${error.message}"`)
                callback(false)
                return
            }
            state.sqlite.orm.data.upsert(rows, error => {
                if (error) {
                    state.callback_error(`queue upsert small: upsert data "${error.message}"`)
                    callback(false)
                    return
                }
                if (allow_callback_change_insert) {
                    state.callback_change_insert(rows.map(m => { return {path: m.pk.path, file: m.pk.file, data: m.data} }))
                }
                file_rows.forEach(item => {
                    state.callback_debug(`queue upsert small: upsert file ${item.full_file_name}`)
                })
                callback(true)
            })
        })
    })
}

export function upsert_big(state: State, allow_callback_change_insert: boolean, file_rows: {full_file_name: string, fsstat: FsStat}[], callback: (success: boolean) => void): void {
    let read_files_thread_count = 2
    let upsert_data_timeout = 500

    if (file_rows.length > 1000) {
        read_files_thread_count = 20
        upsert_data_timeout = 3000
    } else if (file_rows.length > 100) {
        read_files_thread_count = 10
        upsert_data_timeout = 2000
    } else if (file_rows.length > 50) {
        read_files_thread_count = 5
        upsert_data_timeout = 1000
    }
    const read_files_files_in_thread = Math.ceil(file_rows.length / read_files_thread_count)
    const process_state = {
        has_error: false,
        read_files_rows: [] as Row_Data[],
        read_files_thread_count: read_files_thread_count,
        read_files_count_for_message: 0,
        upsert_maps_count_for_message: 0,
        upsert_queries_count_for_message: 0
    }

    state.callback_error(`queue upsert big: start ${read_files_thread_count} threads for read files`)
    for (let thread_idx = 0; thread_idx < read_files_thread_count; thread_idx++) {
        const read_files_thread = (
                thread_idx + 1 === read_files_thread_count ?
                file_rows.slice(thread_idx * read_files_files_in_thread) :
                file_rows.slice(thread_idx * read_files_files_in_thread, (thread_idx + 1) * read_files_files_in_thread)
            )
        let read_files_timer = setTimeout(function tick() {
            if (process_state.has_error) {
                process_state.read_files_thread_count--
                return
            }
            if (process_state.read_files_rows.length > 500) {
                read_files_timer = setTimeout(tick, upsert_data_timeout)
                return
            }
            const read_files_chunk = read_files_thread.splice(0, 5).map(m => { return {...m, data: undefined as string | undefined, pk: FromFile(m.full_file_name, state.path_data) }})
            if (read_files_chunk.length <= 0) {
                process_state.read_files_thread_count--
                return
            }
            readfiles(read_files_chunk, 0, error => {
                if (error) {
                    process_state.has_error = true
                    state.callback_error(`queue upsert big: read files "${error.message}"`)
                    process_state.read_files_thread_count--
                    return
                }

                process_state.read_files_rows.push(...read_files_chunk)
                process_state.read_files_thread_count = process_state.read_files_thread_count + read_files_chunk.length
                if (process_state.read_files_thread_count > 1000 ) {
                    state.callback_debug (`queue upsert big: read portion files "${process_state.read_files_thread_count}" `)
                    process_state.read_files_thread_count = 0
                }

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                read_files_timer = setTimeout(tick, 0)
            })
        }, 0)
    }

    let upload_timer = setTimeout(function tick() {
        if (process_state.has_error) {
            callback(false)
            return
        }
        const upload_rows = process_state.read_files_rows.splice(0, process_state.read_files_rows.length)
        if (upload_rows.length <= 0) {
            if (process_state.read_files_thread_count <= 0) {
                callback(!process_state.has_error)
            } else {
                upload_timer = setTimeout(tick, upsert_data_timeout)
            }
            return
        }
        state.sqlite.exec_data_upsert_index(upload_rows, error => {
            if (error) {
                state.callback_error(`queue upsert big: upsert index "${error.message}"`)
                process_state.has_error = true
                callback(false)
                return
            }
            state.sqlite.orm.data.upsert(upload_rows, error => {
                if (error) {
                    state.callback_error(`queue upsert big: upsert data "${error.message}"`)
                    process_state.has_error = true
                    callback(false)
                    return
                }
                process_state.upsert_queries_count_for_message++
                process_state.upsert_maps_count_for_message = process_state.upsert_maps_count_for_message + upload_rows.length
                if (process_state.upsert_maps_count_for_message > 1000 ) {
                    state.callback_debug(`queue upsert big: upsert portion maps "${process_state.upsert_maps_count_for_message}" (${process_state.upsert_queries_count_for_message} queries) `)
                    process_state.upsert_maps_count_for_message = 0
                    process_state.upsert_queries_count_for_message = 0
                }
                if (allow_callback_change_insert) {
                    state.callback_change_insert(upload_rows.map(m => { return {path: m.pk.path, file: m.pk.file, data: m.data} }))
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                upload_timer = setTimeout(tick, upsert_data_timeout)
            })
        })
    })
}