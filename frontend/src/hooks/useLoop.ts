import { useEffect, useRef } from "react"

export function useLoop( sleepMillis: number, callback: () => void ) {
    const callbackRef = useRef( callback )
    useEffect( () => {
        callbackRef.current = callback
    }, [ callback ] )
    useEffect( () => {
        let stopped = false
        function loop() {
            if ( stopped )
                return
            if ( callbackRef.current )
                callbackRef.current()
            setTimeout( loop, sleepMillis )
        }
        loop()
        return () => {
            stopped = true
        }
    }, [] )
}