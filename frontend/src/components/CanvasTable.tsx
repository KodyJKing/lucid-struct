import { useEffect, useRef, useState } from "react"
import { useConstant } from "../hooks/useConstant"

import classes from "./CanvasTable.module.css"
import { DataType, DataTypes } from "./TableView.DataType"
import { DisplayOptions, DisplayOptions_default, SelectionRange } from "./TableView"
import { DragState, useDrag } from "../hooks/useDrag"

import * as Runtime from "../../wailsjs/runtime/runtime"

function updateSize( canvas: HTMLCanvasElement, w: number, h: number ) {
    if ( canvas.width !== w ) {
        canvas.width = w
        canvas.style.width = `${ w }px`
    }
    if ( canvas.height !== h ) {
        canvas.height = h
        canvas.style.height = `${ h }px`
    }
}

type TableState = {
    canvasRef: React.RefObject<HTMLCanvasElement>,
    data: DataView,
    heat: Uint8ClampedArray,

    selection: SelectionRange | undefined,
    baseAddress: bigint,
    displayOptions: DisplayOptions,

    layout: {
        contentStartX: number,
        contentStartY: number,
        cellWidth: number,
        rowHeight: number,
        bytesPerRow: number,
    }
}

function newTableState( canvasRef: React.RefObject<HTMLCanvasElement>, data: DataView ): TableState {
    return {
        canvasRef, data,
        heat: new Uint8ClampedArray( cellCount( data, DisplayOptions_default.dataType ) ),
        selection: undefined,
        baseAddress: BigInt( 0 ),
        displayOptions: DisplayOptions_default,

        layout: {
            contentStartX: 0,
            contentStartY: 0,
            cellWidth: 0,
            rowHeight: 0,
            bytesPerRow: 0,
        }
    }
}

function getByteOffset( state: TableState, x: number, y: number ) {
    const { layout, displayOptions } = state
    const { dataType } = displayOptions
    const typeSize = DataTypes[ dataType ].size
    const { contentStartX, contentStartY, cellWidth, rowHeight, bytesPerRow } = layout
    const column = Math.floor( ( x - contentStartX ) / cellWidth )
    const row = Math.floor( ( y - contentStartY ) / rowHeight )

    if ( column < 0 || column >= bytesPerRow )
        return -1

    return row * bytesPerRow + column * typeSize
}

function getSelectionText( state: TableState ) {
    if ( !state.selection )
        return ""

    const { data, selection: selectionRange, displayOptions } = state
    const { dataType } = displayOptions
    const dataTypeInfo = DataTypes[ dataType ]
    const typeSize = dataTypeInfo.size

    const { start, end } = selectionRange

    let result: string[] = []
    for ( let i = start; i <= end; i += typeSize ) {
        if ( i + typeSize >= data.byteLength )
            result.push( "??" )
        else
            result.push( dataTypeInfo.format( data, i, displayOptions.hex ) )
    }
    return result.join( " " )
}

function cellCount( data: DataView, dataType: DataType ) {
    return Math.floor( data.byteLength / DataTypes[ dataType ].size )
}

function updateTableData( state: TableState, data: DataView ) {
    const prev = state.data

    state.data = data

    const dataType = state.displayOptions.dataType
    const dataTypeInfo = DataTypes[ dataType ]
    const typeSize = dataTypeInfo.size

    const minLength = Math.min( data.byteLength, prev.byteLength )

    const _cellCount = cellCount( data, dataType )
    if ( _cellCount > state.heat.byteLength )
        state.heat = new Uint8ClampedArray( _cellCount )

    for ( let i = 0; i < minLength; i++ ) {
        const previous = prev.getUint8( i )
        const current = data.getUint8( i )
        if ( previous !== current )
            state.heat[ Math.floor( i / typeSize ) ] = 255
    }
}

function drawTable( state: TableState ) {
    const canvas = state.canvasRef.current
    if ( !canvas )
        return

    const container = canvas.parentElement
    if ( !container )
        return

    const ctx = canvas.getContext( "2d" )
    if ( !ctx )
        return

    const containerStyle = getComputedStyle( container )
    const containerFont = containerStyle.font
    const accentColor = containerStyle.getPropertyValue( "--accent" )
    const borderColor = containerStyle.getPropertyValue( "--border" )
    const textColor = containerStyle.getPropertyValue( "--text" )
    const headerColor = containerStyle.getPropertyValue( "--primary-2" )
    const rowHeightStyle = containerStyle.getPropertyValue( "--rowHeight" )
    const rowHeight = parseInt( rowHeightStyle.replace( "px", "" ) )

    let top = container.scrollTop
    let bottom = top + container.clientHeight

    const firstRow = Math.floor( top / rowHeight )
    const lastRow = Math.ceil( bottom / rowHeight )

    // Todo: Get address size from process.
    let addressTextWidth = 0
    if ( state.displayOptions.showAddress ) {
        const maxAddress = state.baseAddress + BigInt( state.data.byteLength )
        const maxAddressString = maxAddress.toString( 16 )
        addressTextWidth = Math.floor( Math.max(
            ctx.measureText( maxAddressString ).width,
            ctx.measureText( "00000000" ).width
        ) )
    } else {
        const maxOffset = state.data.byteLength - 1
        const maxOffsetString = maxOffset.toString( 16 ).padStart( 2, "0" )
        addressTextWidth = Math.floor( Math.max(
            ctx.measureText( maxOffsetString ).width,
            ctx.measureText( "000" ).width
        ) )
    }
    const addressWidth = addressTextWidth + 4

    let tableWidth = container.clientWidth
    const contentWidth = tableWidth - addressWidth

    const dataType = state.displayOptions.dataType
    const dataTypeInfo = DataTypes[ dataType ]

    const minCellWidth = dataTypeInfo.cellWidth( state.displayOptions.hex )
    const cellsPerRow = Math.max( 1, Math.floor( contentWidth / minCellWidth ) )
    const rowCount = Math.ceil( state.data.byteLength / cellsPerRow )
    const typeSize = dataTypeInfo.size
    const bytesPerRow = cellsPerRow * typeSize
    const byteOffset = ( row: number, column: number ) => {
        return row * bytesPerRow + column * typeSize
    }
    const formatValue = ( row: number, column: number ) => {
        const offset = byteOffset( row, column )
        if ( offset + typeSize > state.data.byteLength )
            return "??"
        return dataTypeInfo.format( state.data, offset, state.displayOptions.hex )
    }
    const isSelected = ( row: number, column: number ) => {
        if ( !state.selection )
            return false
        const offset = byteOffset( row, column )
        return offset >= state.selection.start && offset <= state.selection.end
    }

    const spareWidth = contentWidth - cellsPerRow * minCellWidth
    const extraCellWidth = Math.floor( spareWidth / cellsPerRow )
    const cellWidth = minCellWidth + Math.floor( spareWidth / cellsPerRow )
    const wPad = Math.ceil( extraCellWidth / 2 )
    const contentWidthWithPadding = cellsPerRow * cellWidth
    const leftoverWidth = contentWidth - contentWidthWithPadding
    const contentPadding = Math.floor( leftoverWidth / 2 )
    const contentStartX = contentPadding + addressWidth
    const contentStartY = rowHeight

    state.layout.cellWidth = cellWidth
    state.layout.rowHeight = rowHeight
    state.layout.contentStartX = contentStartX
    state.layout.contentStartY = contentStartY
    state.layout.bytesPerRow = bytesPerRow

    const cellX = ( column: number ) => contentStartX + column * cellWidth
    const cellY = ( row: number ) => contentStartY + row * rowHeight

    let tableHeight = Math.max(
        ( rowCount + 1 ) * rowHeight,
        Math.ceil( container.clientHeight / rowHeight ) * rowHeight
    )

    updateSize( canvas, tableWidth, tableHeight )

    ctx.clearRect( 0, 0, tableWidth, tableHeight )

    ctx.font = containerFont

    // Content
    for ( let row = firstRow; row < lastRow; row++ ) {
        const y = cellY( row )
        for ( let column = 0; column < cellsPerRow; column++ ) {
            const x = cellX( column )
            const value = formatValue( row, column )

            const selected = isSelected( row, column )
            if ( selected ) {
                ctx.fillStyle = accentColor
                ctx.fillRect( x, y, cellWidth, rowHeight )
            }

            const offset = byteOffset( row, column )
            const headIndex = Math.floor( offset / typeSize )
            const heat = state.heat[ headIndex ]
            if ( heat > 0 ) {
                ctx.fillStyle = `rgba( 173, 79, 79, ${ heat / 255 } )`
                ctx.fillRect( x, y, cellWidth, rowHeight )
                state.heat[ headIndex ] -= 2
            }

            ctx.fillStyle = textColor
            // ctx.font = containerFont
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            const drawX = x + minCellWidth / 2 + wPad
            const drawY = y + rowHeight / 2
            ctx.fillText( value, drawX, drawY )
        }
    }

    // Addresses
    for ( let row = firstRow; row < lastRow; row++ ) {
        const offset = row * bytesPerRow
        let text = ""
        if ( state.displayOptions.showAddress ) {
            const address = state.baseAddress + BigInt( offset )
            text = address.toString( 16 ).toUpperCase()
        } else {
            text = offset.toString( 16 ).toUpperCase().padStart( 2, "0" )
        }
        const y = cellY( row )
        ctx.fillStyle = textColor
        // ctx.font = containerFont
        ctx.textAlign = "right"
        ctx.textBaseline = "middle"
        const drawX = addressWidth - 2
        const drawY = y + rowHeight / 2
        ctx.fillText( text, drawX, drawY )
    }

    // Header rect
    const rowStart = top + rowHeight
    ctx.fillStyle = headerColor
    ctx.fillRect( 0, top, tableWidth, rowHeight )

    // Address header
    if ( state.displayOptions.showAddress ) {
        const text = "address"
        const drawX = addressWidth - 2
        const drawY = top + rowHeight / 2
        ctx.fillStyle = textColor
        // ctx.font = containerFont
        ctx.textAlign = "right"
        ctx.textBaseline = "middle"
        ctx.fillText( text, drawX, drawY )
    }

    // Offsets headers
    for ( let column = 0; column < cellsPerRow; column++ ) {
        const x = cellX( column )
        const text = ( column * typeSize ).toString( 16 ).padStart( 2, "0" ).toUpperCase()
        ctx.fillStyle = textColor
        // ctx.font = containerFont
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        const drawX = x + minCellWidth / 2 + wPad
        const drawY = top + rowHeight / 2
        ctx.fillText( text, drawX, drawY )
    }

    // Vertical border
    ctx.beginPath()
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 1
    ctx.moveTo( addressWidth + 2.5, 0 )
    ctx.lineTo( addressWidth + 2.5, tableHeight )
    ctx.stroke()

    // Horizontal border
    ctx.beginPath()
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 1
    ctx.moveTo( 0, rowStart + .5 )
    ctx.lineTo( tableWidth, rowStart + .5 )
    ctx.stroke()
}

type CanvasTableProps = {
    baseAddress: bigint,
    data: DataView,
    displayOptions: DisplayOptions,
    selection: SelectionRange | undefined,
    setSelection: ( range: SelectionRange | undefined ) => void,
} & React.HTMLAttributes<HTMLCanvasElement>

export function CanvasTable( props: CanvasTableProps ) {
    const {
        baseAddress, data, displayOptions,
        selection, setSelection,
        ...rest } = props

    const canvasRef = useRef<HTMLCanvasElement>( null )
    const state = useConstant( () => newTableState( canvasRef, data ) )

    state.selection = selection
    state.baseAddress = baseAddress
    state.displayOptions = displayOptions
    useEffect( () => {
        updateTableData( state, data )
    }, [ baseAddress, data, displayOptions ] )

    // Selection logic
    const selectionAnchored = useRef<boolean>( false )
    function handleDrag( e: DragState ) {
        if ( e.button !== 0 ) return
        const { current, origin } = e
        const offset0 = getByteOffset( state, origin.x, origin.y )
        const offset1 = getByteOffset( state, current.x, current.y )
        const minOffset = Math.max( 0, Math.min( offset0, offset1 ) )
        const maxOffset = Math.max( 0, Math.max( offset0, offset1 ) )

        setSelection( { start: minOffset, end: maxOffset } )
        selectionAnchored.current = true
    }
    useDrag( canvasRef, {
        onDragBegin: handleDrag,
        onDragUpdate: handleDrag
    } )
    function onPointerMove( e: React.PointerEvent<HTMLCanvasElement> ) {
        const box = canvasRef.current?.getBoundingClientRect()
        if ( !box )
            return
        const x = e.clientX - box.left
        const y = e.clientY - box.top
        const offset = getByteOffset( state, x, y )
        if ( offset >= 0 && !selectionAnchored.current ) {
            setSelection( { start: offset, end: offset } )
        }

    }

    useEffect( () => {
        let rendering = true
        function renderLoop() {
            if ( !rendering )
                return

            drawTable( state )
            requestAnimationFrame( renderLoop )
        }
        renderLoop()
        return () => {
            rendering = false
        }
    }, [ canvasRef ] )

    return <div className={classes.Container} tabIndex={0}
        onKeyDown={( e ) => {
            // Copy
            if ( e.key === "c" && e.ctrlKey ) {
                const selection = state.selection
                if ( !selection )
                    return
                Runtime.ClipboardSetText( getSelectionText( state ) )
            }
            // Escape
            if ( e.key === "Escape" ) {
                setSelection( undefined )
                selectionAnchored.current = false
            }
        }}
    >
        <canvas className={classes.Canvas} ref={canvasRef} {...rest} onPointerMove={onPointerMove} />
    </div>
}
