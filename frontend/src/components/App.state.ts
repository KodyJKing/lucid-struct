import { useEffect, useRef, useState } from "react"
import { win32 } from "../../wailsjs/go/models"
import { useLoop } from "../hooks/useLoop"
import * as Backend from "../../wailsjs/go/main/App"

const emptyData = new DataView( new ArrayBuffer( 0 ) )

export type AppState = ReturnType<typeof useAppState>

export enum RecordingState {
    None,
    Recording,
    Playing,
}

export function useAppState() {
    const [ proc, setProc ] = useState<win32.ProcessInfo>()
    const [ size, setSize ] = useState<number>( 1024 )
    const [ addressString, setAddressString ] = useState<string>( "" )
    const address = parseAddress( addressString )
    const [ data, setData ] = useState<DataView>( emptyData ) // Todo: Double buffer this. Don't construct a new array buffer every time.

    const videoRef = useRef<HTMLVideoElement>( null )
    const [ stream, _setStream ] = useState<MediaStream | null>( null )
    const recordStartTime = useRef( 0 )
    const mediaRecorder = useRef<MediaRecorder | null>( null )
    const [ recordingState, setIsRecordingState ] = useState<RecordingState>( RecordingState.None )
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
        if ( !stream )
            return
        let recorder = mediaRecorder.current = new MediaRecorder( stream )
        setIsRecordingState( RecordingState.Recording )
        recorder.onstart = () => {
            chunks.length = 0
        }
        recorder.ondataavailable = ( e ) => {
            if ( e.data.size == 0 ) return
            chunks.push( e.data )
        }
        recorder.onstop = playRecording
        recordStartTime.current = Date.now()
        recorder.start()

        if ( !proc || !proc.pid ) return
        Backend.StartRecording( proc.pid, addressString, size, 50 )
    }
    function stopRecordStream() {
        if ( !mediaRecorder.current )
            return
        mediaRecorder.current.stop()
        mediaRecorder.current = null
        setIsRecordingState( RecordingState.Playing )

        Backend.StopRecording()
    }

    function playRecording() {
        const blob = new Blob( chunks, { type: "video/webm" } )
        if ( recordingUrl.current ) URL.revokeObjectURL( recordingUrl.current )
        const url = recordingUrl.current = URL.createObjectURL( blob )
        const video = videoRef.current
        if ( !video )
            return
        video.srcObject = null
        video.src = url
        video.onloadedmetadata = () => video.play()

        syncDataWithVideo( video )
    }

    function syncDataWithVideo( video: HTMLVideoElement ) {
        video.ontimeupdate = () => {
            const time = Math.floor( video.currentTime * 1000 + recordStartTime.current )
            Backend.GetRecordingFrame( time ).then( ( dataBase64 ) => {
                setData( base64ToDataView( dataBase64 as unknown as string ) )
            } ).catch( err => {
                if ( data !== emptyData )
                    setData( emptyData )
            } )
        }
    }

    function clearRecording() {
        if ( recordingUrl.current ) URL.revokeObjectURL( recordingUrl.current )
        recordingUrl.current = ""
        const video = videoRef.current
        if ( !video )
            return
        video.srcObject = null
        video.src = ""
        video.onloadedmetadata = null

        setIsRecordingState( RecordingState.None )
    }

    // Poll memory if we're not recording or playing back.
    useLoop( 100, () => {
        const isPlaying = recordingState == RecordingState.Playing
        if ( isPlaying )
            return
        if ( !proc || !proc.pid || recordingState == RecordingState.Recording ) {
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

    // Extra video controls
    useEffect( () => {
        const video = videoRef.current
        if ( !video )
            return
        const step = ( delta: number ) => {
            video.pause()
            video.currentTime += delta
        }
        function onKeyPress( e: KeyboardEvent ) {
            if ( e.key == "." )
                step( 1 / 25 )
            if ( e.key == "," )
                step( -1 / 25 )
        }
        window.addEventListener( "keypress", onKeyPress )
        return () => {
            window.removeEventListener( "keypress", onKeyPress )
        }
    }, [ videoRef.current ] )

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
        clearRecording,
        recordingState,
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
