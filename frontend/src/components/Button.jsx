// src/components/Button.jsx
import React from "react";
import PropTypes from "prop-types";

const Button = ({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
}) => {
  const variantClasses = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    success: "btn-success",
    danger: "btn-danger",
    warning: "btn-warning",
    outline: "btn-outline",
    ghost: "btn-ghost",
    link: "btn-link",
  };

  const sizeClasses = {
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg",
  };

  const resolvedVariant = variantClasses[variant] || variantClasses.primary;
  const resolvedSize = sizeClasses[size] || sizeClasses.md;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${resolvedVariant} ${resolvedSize} ${className}`.trim()}
    >
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  type: PropTypes.string,
  variant: PropTypes.oneOf([
    "primary",
    "secondary",
    "success",
    "danger",
    "warning",
    "outline",
    "ghost",
    "link",
  ]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default Button;
