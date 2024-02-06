import { useState } from "react"

import classes from "./TableView.module.css"
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

    const [ selection, setSelection ] = useState<SelectionRange>()

    return (
        <div className={classes.TableView}>

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
                selection={selection}
                setSelection={setSelection}
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
