import { useRef, useState } from "react"
import { win32 } from "../../wailsjs/go/models"
import { useLoop } from "../hooks/useLoop"
import * as Backend from "../../wailsjs/go/main/App"

const emptyData = new DataView( new ArrayBuffer( 0 ) )

export type AppState = ReturnType<typeof useAppState>

export function useAppState() {


    const [ proc, setProc ] = useState<win32.ProcessInfo>()
    const [ size, setSize ] = useState<number>( 1024 )
    const [ addressString, setAddressString ] = useState<string>( "0000000000000000" )
    const address = parseAddress( addressString )
    const [ data, setData ] = useState<DataView>( emptyData )

    const videoRef = useRef<HTMLVideoElement>( null )
    const [ stream, _setStream ] = useState<MediaStream | null>( null )
    const recordStartTime = useRef( 0 )
    const mediaRecorder = useRef<MediaRecorder | null>( null )
    const [ isRecording, setIsRecording ] = useState( false )
    const chunks: Blob[] = useRef( [] ).current
    const recordingUrl = useRef( "" )

    function setStream( stream: MediaStream | null ) {
        if ( stream ) {
            const video = videoRef.current
            if ( !video ) return
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
    function recordStream() {
        if ( !stream ) return
        let recorder = mediaRecorder.current = new MediaRecorder( stream )
        setIsRecording( true )
        recorder.onstart = () => {
            chunks.length = 0
            recordStartTime.current = Date.now()
        }
        recorder.ondataavailable = ( e ) => {
            if ( e.data.size == 0 ) return
            chunks.push( e.data )
        }
        recorder.onstop = () => {
            const blob = new Blob( chunks, { type: "video/webm" } )
            if ( recordingUrl.current ) URL.revokeObjectURL( recordingUrl.current )
            const url = recordingUrl.current = URL.createObjectURL( blob )
            const video = videoRef.current
            if ( !video ) return
            video.srcObject = null
            video.src = url
            video.onloadedmetadata = () => {
                video.play()
            }
        }
        recorder.start()
    }
    function stopRecordStream() {
        if ( !mediaRecorder.current ) return
        mediaRecorder.current.stop()
        mediaRecorder.current = null
        setIsRecording( false )
    }

    // Poll memory
    useLoop( 100, () => {
        if ( !proc || !proc.pid ) {
            if ( data !== emptyData )
                setData( emptyData )
            return
        }
        Backend.ReadBytes( proc.pid, addressString, size ).then( dataBase64 =>
            setData( base64ToDataView( dataBase64 as unknown as string ) )
        ).catch( () => {
            if ( data !== emptyData )
                setData( emptyData )
        } )
    } )

    return {
        proc,
        setProc,
        addressString,
        setAddressString,
        address,
        size,
        setSize,
        data,

        videoRef,
        stream,
        pickScreen,
        recordStream,
        stopRecordStream,
        isRecording,
        recordingUrl,
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