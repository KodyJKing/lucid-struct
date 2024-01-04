import classes from "./LabledCheckbox.module.css"

type LabledCheckBoxProps = {
    label: string,
    checked: boolean,
    onChange: ( checked: boolean ) => void,
    disabled?: boolean,
} & Omit<React.HTMLProps<HTMLSpanElement>, "onChange">

export function LabledCheckBox( props: LabledCheckBoxProps ) {
    const { label, checked, onChange, disabled, ...spanProps } = props
    return (
        <span className={classes.LabledCheckbox} {...spanProps}
            onClick={() => onChange( !checked )}
        >
            <label>{label}</label>
            <input type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={( event ) => onChange( event.target.checked )}
            />
        </span>
    )
}