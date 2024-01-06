import { useEffect, useRef, useState } from "react"

import classes from "./TableView.module.css"
import useSize from "../hooks/useSize"
import { TablePosition, TableRange, getRowAndColumn, getSelectionRange } from "../util/table"
import { DataType, DataTypes } from "./TableView.DataType"
import { LabledCheckBox } from "./LabledCheckbox"
import { CanvasTable } from "./CanvasTable"

export type SelectionRange = {
    start: number,
    end: number,
}

// A table that displays the contents of a DataView.
export function TableView( props: {
    baseAddress: bigint,
    data: DataView,
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
    function selectionText() {
        if ( !selection )
            return ""
        let result: string[] = []
        const dataSize = dataTypeInfo.size
        for ( let i = selection.start; i <= selection.end; i += dataSize ) {
            if ( i + dataSize > props.data.byteLength )
                result.push( "??" )
            else
                result.push( dataTypeInfo.format( props.data, i, displayOptions.hex ) )
        }
        return result.join( " " )
    }

    const lastData = useRef( props.data )
    useEffect( () => { lastData.current = props.data }, [ props.data ] )
    function changedAt( offset: number ) {
        for ( let i = 0; i < dataTypeInfo.size; i++ ) {
            const j = offset + i
            if ( j >= props.data.byteLength || j >= lastData.current.byteLength )
                continue
            if ( props.data.getUint8( j ) !== lastData.current.getUint8( j ) )
                return true
        }
        return false
    }

    function onCopy( e: React.ClipboardEvent<HTMLTableElement> ) {
        if ( !selection )
            return
        e.clipboardData.setData( "text/plain", selectionText() )
        e.preventDefault()
    }

    return (
        <div ref={tableRef} className={classes.TableView}>

            {/* Table Header */}
            <div className={classes.TableHeader}>
                <DisplayOptionsInput {...{ displayOptions, setDisplayOptions }} />

                {/* Selection info */}
                {!!selection && <>
                    <div className="flex-row" style={{ gap: 8 }}>
                        <span>{selection.end - selection.start + 1}</span>
                        <span>bytes</span>
                    </div>
                    <div className="flex-row mono" style={{ gap: 8, padding: "0px 8px" }}>
                        <span>{formatHex( props.baseAddress )}</span>
                        <span>+</span>
                        <span>{formatHex( selection.start )}</span>
                        <span>=</span>
                        <span>{formatHex( props.baseAddress + BigInt( selection.start ) )}</span>
                    </div>
                </>}
            </div>

            {/* Table */}
            <CanvasTable
                data={props.data}
                displayOptions={displayOptions}
                baseAddress={props.baseAddress}
                selectionRange={selection}
                setSelectionRange={setSelection}
            />
        </div>
    )
}

export type DisplayOptions = {
    dataType: DataType,
    hex: boolean,
    showAddress: boolean,
}

export const DisplayOptions_default: DisplayOptions = {
    dataType: "uint8",
    hex: true,
    showAddress: true,
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

    const dataTypeInfo = DataTypes[ dataType ]
    const hexDisabled = !dataTypeInfo.supportsHex

    return <div className={`flex-row flex-stretch`} style={{ gap: 1 }}>
        {typePicker()}
        <LabledCheckBox label="hex" checked={hex} onChange={setHex} disabled={hexDisabled}
            title="display as hex" />
        <LabledCheckBox label="address" checked={props.displayOptions.showAddress} onChange={setShowAddress}
            title="show full address" />
    </div>
}

function formatHex( n ) {
    return n.toString( 16 ).padStart( 2, "0" ).toUpperCase()
}
