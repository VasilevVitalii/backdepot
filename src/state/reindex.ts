import { State } from "."

export function reindex(state: State, callback: (success: boolean) => void) {
    state.callback_debug(`map reindex: begin`)
    state.sqlite.exec_data_reindex(error => {
        if (error) {
            state.callback_error(`map reindex: "${error.message}"`)
            callback(false)
        } else {
            state.callback_debug(`map reindex: end`)
            callback(true)
        }
    })
}