import { Link } from "react-router-dom";

const VARIANT_CLASS = {
  primary: "sb-btn--primary",
  secondary: "sb-btn--secondary",
  ghost: "sb-btn--ghost",
  danger: "sb-btn--danger",
};

export function Button({
  children,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  to,
  type = "button",
  ...props
}) {
  const classes = [
    "sb-btn",
    VARIANT_CLASS[variant] ?? VARIANT_CLASS.primary,
    loading ? "is-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const isDisabled = disabled || loading;
  const content = (
    <>
      {loading ? <span className="sb-btn__spinner" aria-hidden="true" /> : null}
      <span>{loading ? "Загрузка..." : children}</span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={classes}
        aria-disabled={isDisabled ? "true" : undefined}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault();
          }
          props.onClick?.(event);
        }}
        {...props}
      >
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={isDisabled} {...props}>
      {content}
    </button>
  );
}
