import { useRef, useState } from "react"

import classes from "./TableView.module.css"
import useSize from "../hooks/useSize"
import { TablePosition, TableRange, getRowAndColumn, getSelectionRange } from "../util/table"
import { DataType, DataTypes } from "./TableView.DataType"
import { LabledCheckBox } from "./LabledCheckbox"

type SelectionRange = {
    start: number,
    end: number,
}

// A table that displays the contents of a DataView.
export function TableView( props: {
    baseAddress: bigint,
    data: DataView,
    bytesPerRow: number,
    byteCount: number,
} ) {
    const [ displayOptions, setDisplayOptions ] = useState<DisplayOptions>( {
        dataType: "uint8" as DataType,
        hex: true, showAddress: false,
    } )
    const { dataType } = displayOptions

    const dataTypeInfo = DataTypes[ dataType ]
    const cellCount = props.byteCount / dataTypeInfo.size

    const tableRef = useRef<HTMLDivElement>( null )
    const addressRef = useRef<HTMLTableCellElement>( null )
    const tableSize = useSize( tableRef )
    const addressSize = useSize( addressRef )

    const contentWidth = tableSize[ 0 ] - addressSize[ 0 ]
    const cellWidth = dataTypeInfo.cellWidth( displayOptions.hex )
    const cellsPerRow = Math.max( 1, Math.floor( contentWidth / cellWidth ) )
    const rowCount = cellCount / cellsPerRow
    const bytesPerRow = cellsPerRow * dataTypeInfo.size
    function getOffset( row: number, column: number ) {
        return row * bytesPerRow + column * dataTypeInfo.size
    }

    const [ selection, setSelection ] = useState<SelectionRange>()
    const hasSelection = !!selection
    const [ selectAnchored, setSelectAnchored ] = useState( false )
    function isSelected( row: number, column: number ) {
        if ( !selection )
            return false
        const offset = getOffset( row, column )
        return offset >= selection.start && offset <= selection.end
    }
    function setSelectionFromTableRange( range: TableRange | undefined ) {
        if ( !range ) {
            setSelection( undefined )
            return
        }
        const start = getOffset( range.start.row, range.start.column )
        const end = getOffset( range.end.row, range.end.column ) + dataTypeInfo.size - 1
        setSelection( { start, end } )
    }

    const headers: any[] = []
    const addressOrOffset = displayOptions.showAddress ? "Address" : "Offset"
    headers.push( <th key="address" ref={addressRef} className={classes.TableViewAddress}>{addressOrOffset}</th> )
    for ( let i = 0; i < cellsPerRow; i++ )
        headers.push( <th key={i}>{formatHex( i * dataTypeInfo.size )}</th> )
    const headerRow = <tr key="header">{headers}</tr>

    const rows: any[] = []
    for ( let r = 0; r < rowCount; r++ ) {
        const row: any[] = []
        const addressOrOffset = displayOptions.showAddress ? props.baseAddress + BigInt( r * bytesPerRow ) : r * bytesPerRow
        row.push( <td key="address">{formatHex( addressOrOffset )}</td> )
        for ( let c = 0; c < cellsPerRow; c++ ) {
            const selected = isSelected( r, c )
            const cell = c + r * cellsPerRow
            const offset = cell * dataTypeInfo.size
            const outOfBounds = offset + dataTypeInfo.size > props.data.byteLength
            const text = outOfBounds ? "??" : dataTypeInfo.format( props.data, offset, displayOptions.hex )
            const className = selected ? classes.TableViewSelected : undefined
            row.push( <td key={cell} className={className}>{text}</td> )
        }
        rows.push( <tr key={r}>{row}</tr> )
    }

    function onPointerMove( e: React.PointerEvent<HTMLTableElement> ) {
        if ( selectAnchored )
            return
        const target = e.target
        if ( !( target instanceof Node ) )
            return

        let range = getSelectionRange()
        if ( range ) {
            setSelectionFromTableRange( range )
            return
        }

        const position = getRowAndColumn( target )
        if ( !position )
            return
        setSelectionFromTableRange( { start: position, end: position } )
    }
    function onPointerUp( e: React.PointerEvent<HTMLTableElement> ) {
        const target = e.target
        if ( !( target instanceof Node ) )
            return
        setSelectionFromTableRange( getSelectionRange() )
        setSelectAnchored( true )
    }
    function onKeyUp( e: React.KeyboardEvent<HTMLTableElement> ) {
        if ( e.key === "Escape" ) {
            setSelection( undefined )
            setSelectAnchored( false )
            window.getSelection()?.removeAllRanges()
        }
    }
    function onPointerLeave( e: React.PointerEvent<HTMLTableElement> ) {
        if ( !selectAnchored )
            setSelection( undefined )
    }

    return (
        <div ref={tableRef} className={classes.TableView}>
            <div className={classes.TableHeader}>
                <DisplayOptionsInput {...{ displayOptions, setDisplayOptions }} />

                {/* Selection info */}
                {!!selection && <>
                    <div className="flex-row" style={{ gap: 8 }}>
                        <span>{selection.end - selection.start + 1}</span>
                        <span>bytes</span>
                    </div>
                    <div className="flex-row" style={{ gap: 8 }}>
                        <span>{formatHex( props.baseAddress )}</span>
                        <span>+</span>
                        <span>{formatHex( selection.start )}</span>
                        <span>=</span>
                        <span>{formatHex( props.baseAddress + BigInt( selection.start ) )}</span>
                    </div>
                </>
                }
            </div>
            <div className={classes.TableOuter}>
                <table
                    onPointerLeave={onPointerLeave}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onKeyUp={onKeyUp}
                    tabIndex={0}
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

type DisplayOptions = {
    dataType: DataType,
    hex: boolean,
    showAddress: boolean,
}
function DisplayOptionsInput( props: {
    displayOptions: DisplayOptions,
    setDisplayOptions: ( options: DisplayOptions ) => void,
} ) {
    const patch = ( options: Partial<DisplayOptions> ) => props.setDisplayOptions( { ...props.displayOptions, ...options } )
    const setDataType = ( dataType: DataType ) => {
        patch( { dataType } )
        window.getSelection()?.removeAllRanges()
    }
    const setHex = ( hex: boolean ) => patch( { hex } )
    const setShowAddress = ( showAddress: boolean ) => patch( { showAddress } )
    const { dataType, hex } = props.displayOptions

    function typePicker() {
        return (
            <select value={dataType} onChange={( event ) => {
                setDataType( event.target.value as DataType )
            }}>
                {Object.keys( DataTypes ).map( ( dataType ) => {
                    return <option key={dataType} value={dataType}>{dataType}</option>
                } )}
            </select>
        )
    }

    return <div className={`flex-row flex-stretch`}>
        {typePicker()}
        <LabledCheckBox label="hex" checked={hex} onChange={setHex} />
        <LabledCheckBox label="address" checked={props.displayOptions.showAddress} onChange={setShowAddress} />
    </div>
}

function formatHex( n ) {
    return n.toString( 16 ).padStart( 2, "0" ).toUpperCase()
}
