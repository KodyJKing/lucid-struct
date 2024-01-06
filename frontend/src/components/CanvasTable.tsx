import { useEffect, useRef } from "react"
import { useConstant } from "../hooks/useConstant"

import classes from "./CanvasTable.module.css"
import { DataType, DataTypes } from "./TableView.DataType"

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
    dataType: DataType,
    baseAddress: bigint,
    hex: boolean,
}

function newTableState( canvasRef: React.RefObject<HTMLCanvasElement>, data: DataView, dataType: DataType ) {
    return {
        canvasRef, data, dataType,
        heat: new Uint8ClampedArray( cellCount( data, dataType ) ),
        baseAddress: 0n,
        hex: true,
    }
}

function cellCount( data: DataView, dataType: DataType ) {
    return Math.floor( data.byteLength / DataTypes[ dataType ].size )
}

function updateTableData( state: TableState, data: DataView, dataType: DataType = "float32" ) {
    const prev = state.data

    state.data = data
    state.dataType = dataType

    const minLength = Math.min( data.byteLength, prev.byteLength )
    const typeSize = DataTypes[ state.dataType ].size

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
    const textColor = containerStyle.getPropertyValue( "--text" )
    const headerColor = containerStyle.getPropertyValue( "--primary-2" )
    const rowHeightStyle = containerStyle.getPropertyValue( "--rowHeight" )
    const rowHeight = parseInt( rowHeightStyle.replace( "px", "" ) )

    let top = container.scrollTop
    let bottom = top + container.clientHeight

    const firstRow = Math.floor( top / rowHeight )
    const lastRow = Math.ceil( bottom / rowHeight )

    // Todo: Get address size from process.
    const maxAddress = state.baseAddress + BigInt( state.data.byteLength )
    const maxAddressString = maxAddress.toString( 16 )
    const addressTemplate = "00000000"
    const addressWidth = Math.floor( Math.max(
        ctx.measureText( maxAddressString ).width,
        ctx.measureText( addressTemplate ).width
    ) ) + 4

    let tableWidth = container.clientWidth
    const contentWidth = tableWidth - addressWidth

    const dataType = state.dataType
    const dataTypeInfo = DataTypes[ dataType ]

    const minCellWidth = dataTypeInfo.cellWidth( state.hex )
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
        return dataTypeInfo.format( state.data, offset, state.hex )
    }

    const spareWidth = contentWidth - cellsPerRow * minCellWidth
    const extraCellWidth = Math.floor( spareWidth / cellsPerRow )
    const cellWidth = minCellWidth + Math.floor( spareWidth / cellsPerRow )
    const wPad = Math.ceil( extraCellWidth / 2 )
    const contentWidthWithPadding = cellsPerRow * cellWidth
    const leftoverWidth = contentWidth - contentWidthWithPadding
    const contentPadding = Math.floor( leftoverWidth / 2 )

    const cellX = ( column: number ) => contentPadding + addressWidth + column * cellWidth
    const cellY = ( row: number ) => ( row + 1 ) * rowHeight

    let tableHeight = Math.max(
        ( rowCount + 1 ) * rowHeight,
        Math.ceil( container.clientHeight / rowHeight ) * rowHeight
    )

    updateSize( canvas, tableWidth, tableHeight )

    ctx.clearRect( 0, 0, tableWidth, tableHeight )

    // Draw content
    for ( let row = firstRow; row < lastRow; row++ ) {
        const y = cellY( row )
        for ( let column = 0; column < cellsPerRow; column++ ) {
            const x = cellX( column )
            const value = formatValue( row, column )
            const offset = byteOffset( row, column )
            const headIndex = Math.floor( offset / typeSize )
            const heat = state.heat[ headIndex ]
            if ( heat > 0 ) {
                ctx.fillStyle = `rgba( 173, 79, 79, ${ heat / 255 } )`
                ctx.fillRect( x, y, cellWidth, rowHeight )
                state.heat[ headIndex ] -= 2
            }
            ctx.fillStyle = textColor
            ctx.font = containerFont
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            const drawX = x + minCellWidth / 2 + wPad
            const drawY = y + rowHeight / 2
            ctx.fillText( value, drawX, drawY )
        }
    }

    // Draw addresses
    for ( let row = firstRow; row < lastRow; row++ ) {
        const offset = row * bytesPerRow
        const address = state.baseAddress + BigInt( offset )
        const text = address.toString( 16 ).toUpperCase()
        const y = cellY( row )
        ctx.fillStyle = textColor
        ctx.font = containerFont
        ctx.textAlign = "right"
        ctx.textBaseline = "middle"
        const drawX = addressWidth - 2
        const drawY = y + rowHeight / 2
        ctx.fillText( text, drawX, drawY )
    }

    // Draw header rect
    const rowStart = top + rowHeight
    ctx.fillStyle = headerColor
    ctx.fillRect( 0, top, tableWidth, rowHeight )

    { // Draw address header
        const text = "address"
        const drawX = addressWidth - 2
        const drawY = top + rowHeight / 2
        ctx.fillStyle = textColor
        ctx.font = containerFont
        ctx.textAlign = "right"
        ctx.textBaseline = "middle"
        ctx.fillText( text, drawX, drawY )
    }

    // Draw offsets headers
    for ( let column = 0; column < cellsPerRow; column++ ) {
        const x = cellX( column )
        const text = ( column * typeSize ).toString( 16 ).padStart( 2, "0" ).toUpperCase()
        ctx.fillStyle = textColor
        ctx.font = containerFont
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        const drawX = x + minCellWidth / 2 + wPad
        const drawY = top + rowHeight / 2
        ctx.fillText( text, drawX, drawY )
    }

    ctx.beginPath()
    ctx.strokeStyle = textColor
    ctx.lineWidth = 1
    ctx.moveTo( addressWidth + 2, 0 )
    ctx.lineTo( addressWidth + 2, tableHeight )
    ctx.stroke()

    ctx.beginPath()
    ctx.strokeStyle = textColor
    ctx.lineWidth = 1
    ctx.moveTo( 0, rowStart )
    ctx.lineTo( tableWidth, rowStart )
    ctx.stroke()
}

function drawTableContent(
    state: TableState
) {

}

type CanvasTableProps = {
    baseAddress: bigint,
    data: DataView,
    dataType: DataType,
    hex: boolean,
} & React.HTMLAttributes<HTMLCanvasElement>

export function CanvasTable( props: CanvasTableProps ) {
    const { baseAddress, data, dataType, hex, ...rest } = props

    const canvasRef = useRef<HTMLCanvasElement>( null )
    const state = useConstant( () => newTableState( canvasRef, data, dataType ) )

    state.baseAddress = baseAddress
    state.hex = hex

    useEffect( () => {
        updateTableData( state, data, dataType )
    }, [ baseAddress, data, dataType ] )

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

    return <div className={classes.Container}>
        <canvas className={classes.Canvas} ref={canvasRef} {...rest} />
    </div>
}
