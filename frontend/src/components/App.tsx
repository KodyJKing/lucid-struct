import { useEffect, useState } from 'react'
import * as Backend from "../../wailsjs/go/main/App"
import { win32 } from '../../wailsjs/go/models'
import { Resizable } from './Resizable'
import { TableView } from './TableView'
import { useAppState } from './App.state'

import classes from "./App.module.css"
import { CanvasTable } from './CanvasTable'

export default function App() {
    const state = useAppState()
    const {
        proc, setProc,
        size, setSize,
        addressString, setAddressString,
        address,
        data,
        pickScreen,
        isRecording
    } = state

    return (
        <div id="App">
            <div className={classes.Menu}>
                <button title="pick window or screen to record" onClick={pickScreen}>pick window</button>
                <ProcessPicker {...{ proc, setProc }} />
                <input type="text" title="memory address to record from" placeholder="address"
                    value={addressString} onChange={( event ) => {
                        setAddressString( event.target.value )
                    }}
                />
                <input type="number" title="size of memory region to record" placeholder="size"
                    value={size} onChange={( event ) => {
                        setSize( event.target.valueAsNumber )
                    }}
                />
                {!state.isRecording && <button title="begin recording" onClick={state.recordStream}>record</button>}
                {state.isRecording && <button title="stop recording" onClick={state.stopRecordStream}>stop</button>}
            </div>

            <Resizable bottom>
                <video id="mainVideo" ref={state.videoRef} width="1024" height="768" controls />
            </Resizable>

            <TableView
                baseAddress={address}
                data={data}
                byteCount={size}
            />

        </div>
    )
}

function ProcessPicker( props: {
    proc, setProc
} ) {
    const [ processes, setProcesses ] = useState<win32.ProcessInfo[]>( [] )
    function updateProcesses() {
        Backend.EnumAppProcessInfo().then( ( processes ) => {
            processes.unshift( { filename: "none", pid: 0 } )
            setProcesses( processes )
        } )
    }
    useEffect( updateProcesses, [] )

    return (
        <select title="process to record memory from" onFocus={updateProcesses}
            onChange={( event ) => {
                const pid = parseInt( event.target.value )
                const process = processes.find( ( process ) => {
                    return process.pid === pid
                } )
                props.setProc( process )
            }}
        >
            {processes.map( ( process ) => {
                return <option key={process.pid} value={process.pid}>{process.filename}</option>
            } )}
        </select>
    )
}

function parseAddress( addressString: string ) {
    try {
        return BigInt( "0x" + addressString )
    } catch ( e ) {
        return BigInt( 0 )
    }
}
