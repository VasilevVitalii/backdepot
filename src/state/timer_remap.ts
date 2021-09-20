import * as vvs from 'vv-shared'
import { State } from "."
import { reindex } from './reindex'
import { rescan } from './rescan'

export function timer_remap (state: State) {
    let timer = setTimeout(function tick() {
        if (!vvs.isEmpty(state.work_info.time_remap)) {
            timer = setTimeout(tick, 10000)
            return
        }
        reindex(state, success => {
            if (!success) {
                timer = setTimeout(tick, 10000)
                return
            }
            rescan(state, success => {
                if (!success) {
                    timer = setTimeout(tick, 10000)
                    return
                }
                state.work_info.time_remap = new Date()
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                timer = setTimeout(tick, 10000)
            })
        })
    }, 0)
}