import { useRef, useState } from "react"

import classes from "./StructView.module.css"
import useSize from "../hooks/useSize"

// A table that displays the contents of a DataView as a struct.
export function StructView( props: {
    baseAddress: bigint,
    data: DataView,
    bytesPerRow: number,
    byteCount: number,
} ) {
    const [ dataType, setDataType ] = useState<DataType>( "uint8" )
    const [ hex, setHex ] = useState( true )

    const dataTypeInfo = DataTypes[ dataType ]
    const cellCount = props.byteCount / dataTypeInfo.size

    const tableRef = useRef<HTMLDivElement>( null )
    const addressRef = useRef<HTMLTableCellElement>( null )
    const tableSize = useSize( tableRef )
    const addressSize = useSize( addressRef )

    const contentWidth = tableSize[ 0 ] - addressSize[ 0 ]
    const cellWidth = dataTypeInfo.cellWidth( hex )
    const cellsPerRow = Math.max( 1, Math.floor( contentWidth / cellWidth ) )
    const rowCount = cellCount / cellsPerRow

    const headers: any[] = []
    headers.push( <th key="address" ref={addressRef} className={classes.StructViewAddress}>Address</th> )
    for ( let i = 0; i < cellsPerRow; i++ )
        headers.push( <th key={i}>{formatHex( i * dataTypeInfo.size )}</th> )
    const headerRow = <tr key="header">{headers}</tr>

    const rows: any[] = []
    for ( let r = 0; r < rowCount; r++ ) {
        const row: any[] = []
        row.push( <td key="address">{formatHex( props.baseAddress + BigInt( r ) )}</td> )
        for ( let c = 0; c < cellsPerRow; c++ ) {
            const cell = c + r * cellsPerRow
            const offset = cell * dataTypeInfo.size
            const outOfBounds = offset + dataTypeInfo.size > props.data.byteLength
            const text = outOfBounds ? "??" : dataTypeInfo.format( props.data, offset, hex )
            row.push( <td key={cell} style={{ width: `${ cellWidth }px` }}>{text}</td> )
        }
        rows.push( <tr key={r}>{row}</tr> )
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
                <DataTypeInput dataType={dataType} setDataType={setDataType} hex={hex} setHex={setHex} />
            </div>
            <div className={classes.TableOuter}>
                <table
                    onPointerUp={getSelectedBytes}
                >
                    <tbody>
                        {headerRow}
                        {rows}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function DataTypeInput( props: {
    dataType: DataType,
    setDataType: ( dataType: DataType ) => void,
    hex: boolean,
    setHex: ( hex: boolean ) => void,
} ) {
    return (
        <span className={`flex-row ${ classes.DataTypeInput }`} style={{ gap: 8 }}>
            <div className="flex-row">
                <label htmlFor="show-as-hex">
                    Hex
                </label>
                <input id="show-as-hex" type="checkbox"
                    checked={props.hex}
                    disabled={!DataTypes[ props.dataType ].supportsHex}
                    onChange={( event ) => {
                        props.setHex( event.target.checked )
                    }}
                />
            </div>
            <select value={props.dataType} onChange={( event ) => {
                props.setDataType( event.target.value as DataType )
            }}>
                {Object.keys( DataTypes ).map( ( dataType ) => {
                    return <option key={dataType} value={dataType}>{dataType}</option>
                } )}
            </select>
        </span>
    )
}

const DataTypes = {
    uint8: integralType( 1, "getUint8" ),
    uint16: integralType( 2, "getUint16" ),
    uint32: integralType( 4, "getUint32" ),
    uint64: integralType( 8, "getBigUint64" ),
    int8: integralType( 1, "getInt8", true ),
    int16: integralType( 2, "getInt16", true ),
    int32: integralType( 4, "getInt32", true ),
    int64: integralType( 8, "getBigInt64", true ),
    float32: floatType( 4, "getFloat32" ),
    float64: floatType( 8, "getFloat64" ),
} as const
type DataType = keyof typeof DataTypes

function formatHex( n ) {
    return n.toString( 16 ).padStart( 2, "0" ).toUpperCase()
}

function integralType( size: number, getter: string, signed = false ) {
    const getterFunc = DataView.prototype[ getter ]
    const hexCharsToDecChars = 1.204 // log(16) / log(10)
    function charCount( hex: boolean ) {
        let charCount = size * 2
        if ( !hex ) charCount *= hexCharsToDecChars
        if ( signed ) charCount += 1
        return Math.ceil( charCount )
    }
    return {
        size, supportsHex: true,
        cellWidth: ( hex: boolean ) => {
            return charCount( hex ) * 11 + 4
        },
        format: ( data: DataView, offset: number, hex: boolean ) => {
            const val = getterFunc.call( data, offset, true )
            return val
                .toString( hex ? 16 : 10 )
                .padStart( charCount( hex ), signed ? " " : "0" )
                .toUpperCase()
        },
    }
}
function floatType( size: number, getter: string ) {
    const getterFunc = DataView.prototype[ getter ]
    return {
        size, supportsHex: false,
        cellWidth: ( _hex: boolean ) => 84,
        format: ( data: DataView, offset: number, _hex: boolean ) => {
            const val = getterFunc.call( data, offset, true )
            const fixed = val.toFixed( 2 )
            const exp = val.toExponential( 1 )
            return exp.length < fixed.length ? exp : fixed
        },
    }
}
