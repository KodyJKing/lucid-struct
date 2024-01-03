import { useState } from "react"
import { win32 } from "../../wailsjs/go/models"
import { useLoop } from "../hooks/useLoop"
import * as Backend from "../../wailsjs/go/main/App"

const initialData = new DataView( new ArrayBuffer( 1024 ) )

export type AppState = ReturnType<typeof useAppState>

export function useAppState() {

    const [ proc, setProc ] = useState<win32.ProcessInfo>()
    const [ size, setSize ] = useState<number>( 1024 )
    const [ addressString, setAddressString ] = useState<string>( "00000000" )
    const address = parseAddress( addressString )
    const [ stream, _setStream ] = useState<MediaStream | null>( null )
    const [ data, setData ] = useState<DataView>( initialData )

    function setStream( stream: MediaStream | null ) {
        if ( stream ) {
            const video = document.getElementById( "mainVideo" ) as HTMLVideoElement
            video.srcObject = stream
            video.onloadedmetadata = () => {
                video.play()
            }
        }
        _setStream( stream )
    }
    function pickScreen() {
        navigator.mediaDevices.getDisplayMedia( { video: true } ).then( ( stream ) => {
            setStream( stream )
        } )
    }

    // Poll memory
    useLoop( 100, () => {
        if ( !proc || !proc.pid ) return
        Backend.ReadBytes( proc.pid, addressString, size ).then( ( dataBase64 ) => {
            setData( base64ToDataView( dataBase64 as unknown as string ) )
        } )
    } )

    return {
        proc,
        setProc,
        size,
        setSize,
        addressString,
        setAddressString,
        address,
        stream,
        pickScreen,
        data,
    }

}

/////////////////////////////////////////////////

function parseAddress( addressString: string ) {
    try {
        return BigInt( "0x" + addressString )
    } catch ( e ) {
        return BigInt( 0 )
    }
}

function base64ToDataView( base64: string ) {
    const bytes = atob( base64 )
    const buffer = new ArrayBuffer( bytes.length )
    const view = new DataView( buffer )
    for ( let i = 0; i < bytes.length; i++ ) {
        view.setUint8( i, bytes.charCodeAt( i ) )
    }
    return view
}