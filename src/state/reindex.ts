import { State } from "."

export function Reindex(state: State, callback: (success: boolean) => void) {
    state.callbackDebug(`map reindex: begin`)
    state.sqlite.execDataReindex(error => {
        if (error) {
            state.callbackError(`map reindex: "${error.message}"`)
            callback(false)
        } else {
            state.callbackDebug(`map reindex: end`)
            callback(true)
        }
    })
}