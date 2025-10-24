import React from "react";

const Button = ({ children, onClick, variant = "primary", className = "" }) => {
  let baseStyle =
    "px-4 py-2 rounded-lg font-semibold transition focus:outline-none";

  let variantStyle = "";
  switch (variant) {
    case "primary":
      variantStyle = "bg-blue-500 hover:bg-blue-600 text-white";
      break;
    case "secondary":
      variantStyle = "bg-gray-500 hover:bg-gray-600 text-white";
      break;
    case "danger":
      variantStyle = "bg-red-500 hover:bg-red-600 text-white";
      break;
    default:
      variantStyle = "bg-blue-500 hover:bg-blue-600 text-white";
  }

  return (
    <button className={`${baseStyle} ${variantStyle} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;
