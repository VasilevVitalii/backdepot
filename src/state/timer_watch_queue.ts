import { State } from "./index"
import { FromFile } from '../pk'

export function TimerWatchQueue (state: State) {

    let timer = setTimeout(function tick() {
        const watchQueueState = state.watchQueueState()

        if (watchQueueState === 'unwanted') {
            const watchQueue = state.watchQueue.splice(0, state.watchQueue.length)
            if (watchQueue.length > 0) {
                state.callbackDebug (`timer watch queue: watch_queue_state = "unwanted", ignore ${watchQueue.length} change(s)`)
            }
            timer = setTimeout(tick, 1000)
            return
        }

        if (watchQueueState === 'pause') {
            timer = setTimeout(tick, 500)
            return
        }

        if (watchQueueState === 'work') {
            const watchQueue = state.watchQueue.splice(0, state.watchQueue.length)
            if (watchQueue.length <= 0) {
                timer = setTimeout(tick, 500)
                return
            }

            const forDelete = watchQueue.filter(f => f.action === 'unlink')
            const forDeletePk = forDelete.map(m => { return FromFile(m.fullFileName, state.pathData) })
            state.sqlite.execDataDelete(forDeletePk, error => {
                if (error) {
                    state.callbackError(`queue delete: delete map(s) "${error.message}"`)
                } else if (forDeletePk.length > 0) {
                    state.callbackChangeDelete(forDeletePk)
                }
                if (forDelete.length > 10) {
                    state.callbackDebug(`queue delete: delete ${forDelete.length} files`)
                } else {
                    forDelete.forEach(item => {
                        state.callbackDebug(`queue delete: delete file ${item.fullFileName}`)
                    })
                }
                const forUpsert = watchQueue.filter(f => f.action === 'add' || f.action === 'change')
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                state.upsert(true, forUpsert, isSuccess => {
                    timer = setTimeout(tick, 500)
                })
            })
            return
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        timer = setTimeout(tick, 500)
    })

}