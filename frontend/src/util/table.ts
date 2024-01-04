export type TablePosition = { row: number, column: number }
export type TableRange = { start: TablePosition, end: TablePosition }

// Get the row and column of a node in a table.
export function getRowAndColumn( node: Node | null ): TablePosition | undefined {
    if ( !node )
        return
    const cellElem = node instanceof HTMLTableCellElement ? node : node.parentElement
    if ( !( cellElem instanceof HTMLTableCellElement ) )
        return
    const rowElem = cellElem.parentNode
    if ( !rowElem )
        return
    const rowParent = rowElem.parentNode
    if ( !rowParent )
        return
    const column = Array.prototype.indexOf.call( rowElem.children, cellElem ) - 1
    const row = Array.prototype.indexOf.call( rowParent.children, rowElem ) - 1
    if ( column < 0 || row < 0 )
        return
    return { column, row }
}

// Get column+row selection range of a table. Start and end are sorted.
export function getSelectionRange() {
    const selection = window.getSelection()
    if ( !selection )
        return
    let start = getRowAndColumn( selection.anchorNode )
    let end = getRowAndColumn( selection.focusNode )
    if ( !start || !end )
        return
    if ( start.row > end.row || ( start.row === end.row && start.column > end.column ) ) {
        const temp = start
        start = end
        end = temp
    }
    return { start, end }
}