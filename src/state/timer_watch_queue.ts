import { State } from "."
import { FromFile } from '../pk'

export function timer_watch_queue (state: State) {

    let timer = setTimeout(function tick() {
        const watch_queue_state = state.watch_queue_state()

        if (watch_queue_state === 'unwanted') {
            const watch_queue = state.watch_queue.splice(0, state.watch_queue.length)
            if (watch_queue.length > 0) {
                state.callback_debug (`timer watch queue: watch_queue_state = "unwanted", ignore ${watch_queue.length} change(s)`)
            }
            timer = setTimeout(tick, 1000)
            return
        }

        if (watch_queue_state === 'pause') {
            timer = setTimeout(tick, 500)
            return
        }

        if (watch_queue_state === 'work') {
            const watch_queue = state.watch_queue.splice(0, state.watch_queue.length)
            if (watch_queue.length <= 0) {
                timer = setTimeout(tick, 500)
                return
            }

            const for_delete = watch_queue.filter(f => f.action === 'unlink')
            const for_delete_pk = for_delete.map(m => { return FromFile(m.full_file_name, state.path_data) })
            state.sqlite.exec_data_delete(for_delete_pk, error => {
                if (error) {
                    state.callback_error(`queue delete: delete map(s) "${error.message}"`)
                } else if (for_delete_pk.length > 0) {
                    state.callback_change_delete(for_delete_pk)
                }
                if (for_delete.length > 10) {
                    state.callback_debug(`queue delete: delete ${for_delete.length} files`)
                } else {
                    for_delete.forEach(item => {
                        state.callback_debug(`queue delete: delete file ${item.full_file_name}`)
                    })
                }
                const for_upsert = watch_queue.filter(f => f.action === 'add' || f.action === 'change')
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                state.upsert(true, for_upsert, success => {
                    timer = setTimeout(tick, 500)
                })
            })
            return
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        timer = setTimeout(tick, 500)
    })

}