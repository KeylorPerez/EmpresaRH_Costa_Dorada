import { useContext } from "react";
import AuthContext from "../context/AuthContext"; // sin llaves

export const useAuth = () => useContext(AuthContext);
