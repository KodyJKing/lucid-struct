import React, { useState, useRef, useEffect } from "react"

import classes from "./Resizeable.module.css"

enum MouseButtons {
    Left = 0,
    Middle = 1,
    Right = 2
}

type State<T> = [ T, ( value: T ) => void ]

type Dimension = "width" | "height"

export function Resizable(
    props: React.HTMLAttributes<HTMLDivElement> & {
        left?: boolean, right?: boolean,
        top?: boolean, bottom?: boolean,
        flex?: boolean
        minWidth?: number, minHeight?: number,
        handleWidth?: number,
        children?: React.ReactNode
    }
) {
    const {
        left = false, right = false, top = false, bottom = false, flex = false,
        minWidth = 200, minHeight = 200,
        handleWidth = 8,
        children, style,
        ...rest
    } = props

    const dragState = useRef( { dragging: false, capturedPointer: 0 } ).current
    const mainRef = useRef<HTMLDivElement>( null )

    const size = `${ handleWidth }px`
    const handleProps = { dragState, containerProps: { ...props, minWidth, minHeight } }
    const borderStyle = "2px"
    const handleStyles: Record<string, React.CSSProperties> = {
        left: { left: "0px", top: "0px", width: size, height: "100%", cursor: "col-resize", borderLeftWidth: borderStyle },
        right: { right: "0px", top: "0px", width: size, height: "100%", cursor: "col-resize", borderRightWidth: borderStyle },
        top: { left: "0px", top: "0px", height: size, width: "100%", cursor: "row-resize", borderTopWidth: borderStyle },
        bottom: { left: "0px", bottom: "0px", height: size, width: "100%", cursor: "row-resize", borderBottomWidth: borderStyle },
    }

    const extaStyle: React.CSSProperties = {
        position: "relative",
        minWidth: `${ minWidth }px`,
        minHeight: `${ minHeight }px`,
    }

    return <div
        ref={mainRef}
        style={{ ...extaStyle, ...style }}
        {...rest}
    >
        {children}
        {[
            left && <ResizeHandle key="left" axis="x" sign={-1} style={handleStyles.left} {...handleProps} />,
            right && <ResizeHandle key="right" axis="x" sign={1} style={handleStyles.right} {...handleProps} />,
            top && <ResizeHandle key="top" axis="y" sign={-1} style={handleStyles.top} {...handleProps} />,
            bottom && <ResizeHandle key="bottom" axis="y" sign={1} style={handleStyles.bottom} {...handleProps} />,
        ]}
    </div>
}

function ResizeHandle( { axis, sign, style, dragState, containerProps } ) {
    const { minWidth, minHeight, flex } = containerProps

    return <div
        className={classes.ResizeHandle}
        style={{ position: "absolute", ...style }}

        onPointerDown={e => {
            if ( e.button !== MouseButtons.Left )
                return

            dragState.dragging = true
            dragState.capturedPointer = e.pointerId
            e.currentTarget.setPointerCapture( dragState.capturedPointer )
        }}

        onPointerUp={e => {
            if ( e.pointerId == dragState.capturedPointer )
                dragState.dragging = false
        }}

        onPointerMove={e => {
            if ( !dragState.dragging )
                return

            const div = e.currentTarget.parentElement as HTMLElement
            const divParent = div.parentElement as HTMLElement
            const rect = div.getBoundingClientRect()
            const style = div.style

            if ( axis == "x" )
                setSize( "width", addToSize( "width", minWidth, e.movementX * sign ) )
            else if ( axis == "y" )
                setSize( "height", addToSize( "height", minHeight, e.movementY * sign ) )

            function addToSize( dimension: Dimension, minSize: number, addPixels: number ) {
                const sizeStyle = style[ dimension ]
                const size = rect[ dimension ]

                let sizeInPixels = Math.max( minSize, size + addPixels )

                if ( sizeStyle.endsWith( "%" ) ) {
                    const parentRect = divParent.getBoundingClientRect()
                    const parentSize = parentRect[ dimension ]
                    return `${ Math.min( sizeInPixels / parentSize, 1 ) * 100 }%`
                }

                return `${ sizeInPixels }px`
            }

            function setSize( dimension: Dimension, size: string ) {
                const style = div.style
                if ( style && size.length > 0 ) {
                    if ( flex )
                        style.flex = `0 1 ${ size }`
                    else
                        style[ dimension ] = size
                }
            }
        }}
    />

}
