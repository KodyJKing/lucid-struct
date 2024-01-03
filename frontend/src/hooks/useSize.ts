import { useEffect, useRef, useState } from "react"
import { debounce } from "../util/debounce"

type Size = [ number, number ]

export default function useSize( ref: React.RefObject<HTMLElement> ) {
    const [ size, setSize ] = useState<Size>( [ 0, 0 ] )
    const [ width, height ] = size

    const setSizeDebounced = debounce( 100, setSize )

    const observer = new ResizeObserver( () => {
        const element = ref.current
        if ( !element ) return
        const rect = element.getBoundingClientRect()
        if ( rect.width !== width || rect.height !== height )
            setSizeDebounced( [ rect.width, rect.height ] )
    } )

    useEffect( () => {
        if ( ref.current )
            observer.observe( ref.current )
        return () => {
            if ( ref.current )
                observer.unobserve( ref.current )
            observer.disconnect()
        }
    } )

    return size
}