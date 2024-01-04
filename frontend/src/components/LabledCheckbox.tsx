import classes from "./LabledCheckbox.module.css"

export function LabledCheckBox( props: {
    label: string,
    checked: boolean,
    onChange: ( checked: boolean ) => void,
} ) {
    return (
        <span className={classes.LabledCheckbox}>
            <label>{props.label}</label>
            <input type="checkbox"
                checked={props.checked}
                onChange={( event ) => props.onChange( event.target.checked )}
            />
        </span>
    )
}