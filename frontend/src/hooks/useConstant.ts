import { useRef } from "react"

// Guarantees that the initialization function passed in is only called once.
export function useConstant<T>( fn: () => T ): T {
    const ref = useRef<T | null>( null )
    if ( ref.current === null )
        ref.current = fn()
    return ref.current
}
