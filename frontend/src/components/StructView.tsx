import { useRef, useState } from "react"

import classes from "./StructView.module.css"
import useSize from "../hooks/useSize"

const DataTypes = {
    byte: {
        size: 1,
        cellWidth: 24,
        format: ( data: DataView, offset ) => data.getUint8( offset ).toString( 16 ).padStart( 2, "0" ).toUpperCase(),
    },
    float: {
        size: 4,
        cellWidth: 100,
        format: ( data: DataView, offset ) => {
            const val = data.getFloat32( offset, true )
            const fixed = val.toFixed( 2 )
            const exp = val.toExponential( 1 )
            return exp.length < fixed.length ? exp : fixed
        },
    }
} as const
type DataType = keyof typeof DataTypes

// A table that displays the contents of a DataView as a struct.
export function StructView( props: {
    baseAddress: bigint,
    data: DataView,
    bytesPerRow: number,
    byteCount: number,
} ) {
    const [ dataType, setDataType ] = useState<DataType>( "byte" )

    const dataTypeInfo = DataTypes[ dataType ]
    const cellCount = props.byteCount / dataTypeInfo.size

    const tableRef = useRef<HTMLDivElement>( null )
    const addressRef = useRef<HTMLTableCellElement>( null )
    const tableSize = useSize( tableRef )
    const addressSize = useSize( addressRef )

    const contentWidth = tableSize[ 0 ] - addressSize[ 0 ]
    const cellsPerRow = Math.max( 1, Math.floor( contentWidth / dataTypeInfo.cellWidth ) )
    const rowCount = cellCount / cellsPerRow

    const tableHeaders: any[] = []
    tableHeaders.push( <th ref={addressRef} className={classes.StructViewAddress}>Address</th> )
    for ( let i = 0; i < cellsPerRow; i++ ) {
        tableHeaders.push( <th>{formatHex( i * dataTypeInfo.size )}</th> )
    }

    const rows: any[] = []
    for ( let r = 0; r < rowCount; r++ ) {
        const row: any[] = []
        row.push( <td>{formatHex( props.baseAddress + BigInt( r ) )}</td> )
        for ( let c = 0; c < cellsPerRow; c++ ) {
            const cell = c + r * cellsPerRow
            const offset = cell * dataTypeInfo.size
            const outOfBounds = offset + dataTypeInfo.size >= props.data.byteLength
            const text = outOfBounds ? "??" : dataTypeInfo.format( props.data, offset )
            row.push( <td style={{ width: `${ dataTypeInfo.cellWidth }px` }}>{text}</td> )
        }
        rows.push( <tr>{row}</tr> )
    }

    function getSelectedBytes() {
        const selection = window.getSelection()
        if ( !selection ) {
            return
        }
        const range = selection.getRangeAt( 0 )
        const start = range.startOffset
        const end = range.endOffset

        console.log( start, end )
    }

    return (
        <div ref={tableRef} className={classes.StructView}>
            <div>
                <DataTypeInput dataType={dataType} setDataType={setDataType} />
            </div>
            <table
                onPointerUp={getSelectedBytes}
            >
                <tbody>
                    {tableHeaders}
                    {rows}
                </tbody>
            </table>
        </div>
    )
}

function DataTypeInput( props: {
    dataType: DataType,
    setDataType: ( dataType: DataType ) => void,
} ) {
    return (
        <select value={props.dataType} onChange={( event ) => {
            props.setDataType( event.target.value as DataType )
        }}>
            {Object.keys( DataTypes ).map( ( dataType ) => {
                return <option value={dataType}>{dataType}</option>
            } )}
        </select>
    )
}

function formatHex( n ) {
    return n.toString( 16 ).padStart( 2, "0" ).toUpperCase()
}
