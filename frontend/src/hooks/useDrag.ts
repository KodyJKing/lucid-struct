import { useEffect, useRef } from "react"
import { useConstant } from "./useConstant";

type Position = { x: number; y: number }

export type DragState = ReturnType<typeof useDragState>
//
function useDragState() {
    return useConstant( () => ( {
        isDragging: false,
        origin: { x: 0, y: 0 } as Position,
        current: { x: 0, y: 0 } as Position,
        pointerId: -1,
        button: -1
    } ) )
}

export function useDrag(
    ref: React.RefObject<HTMLElement>,
    handlers: {
        onDragBegin?: ( drag: DragState ) => void,
        onDragUpdate?: ( drag: DragState ) => void,
        onDragEnd?: ( drag: DragState ) => void
    }
) {
    const handlerRef = useRef( handlers )
    handlerRef.current = handlers

    const state = useDragState()

    useEffect( () => {

        const element = ref.current

        if ( !element ) return

        const handlePointerDown = ( event: PointerEvent ) => {

            if ( state.isDragging ) return

            const box = ref.current?.getBoundingClientRect()
            if ( !box ) return

            state.isDragging = true
            state.pointerId = event.pointerId
            state.button = event.button
            state.origin.x = event.clientX - box.left
            state.origin.y = event.clientY - box.top
            state.current.x = state.origin.x
            state.current.y = state.origin.y

            element.setPointerCapture( event.pointerId )

            handlerRef.current.onDragBegin?.( state )
        }

        const handlePointerMove = ( event: PointerEvent ) => {

            if ( !state.isDragging || event.pointerId !== state.pointerId ) return

            const box = ref.current?.getBoundingClientRect()
            if ( !box ) return

            state.current.x = event.clientX - box.left
            state.current.y = event.clientY - box.top

            handlerRef.current.onDragUpdate?.( state )
        }

        const handlePointerUp = ( event: PointerEvent ) => {

            if ( !state.isDragging || event.pointerId !== state.pointerId ) return

            state.isDragging = false
            state.pointerId = -1
            state.button = -1

            element.releasePointerCapture( event.pointerId )

            handlerRef.current.onDragEnd?.( state )
        }

        element.addEventListener( "pointerdown", handlePointerDown )
        element.addEventListener( "pointermove", handlePointerMove )
        element.addEventListener( "pointerup", handlePointerUp )

        return () => {

            element.removeEventListener( "pointerdown", handlePointerDown )
            element.removeEventListener( "pointermove", handlePointerMove )
            element.removeEventListener( "pointerup", handlePointerUp )

        }

    }, [ ref ] )

}