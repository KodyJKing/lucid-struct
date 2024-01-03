export function debounce( wait: number, func: Function ) {
    let timeout: ReturnType<typeof setTimeout>
    return function executedFunction( ...args: any[] ) {
        const later = () => {
            clearTimeout( timeout )
            func( ...args )
        }
        clearTimeout( timeout )
        timeout = setTimeout( later, wait )
    }
}