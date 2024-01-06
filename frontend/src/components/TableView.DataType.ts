export const DataTypes = {
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

export type DataType = keyof typeof DataTypes

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
        size,
        supportsHex: true,
        cellWidth: ( hex: boolean ) => {
            return charCount( hex ) * 11 + 4
        },
        format: ( data: DataView, offset: number, hex: boolean ) => {
            const val = getterFunc.call( data, offset, true )
            return val
                .toString( hex ? 16 : 10 )
                .padStart( charCount( hex ), signed || !hex ? " " : "0" )
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
            const fixed = val.toFixed( 4 )
            const exp = val.toExponential( 1 )
            return exp.length + 1 < fixed.length ? exp : fixed
        },
    }
}
