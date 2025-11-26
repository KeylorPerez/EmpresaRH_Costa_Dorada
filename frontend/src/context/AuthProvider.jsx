/**
 * Proveedor de autenticación. Persiste el token en `localStorage`, expone los
 * datos del usuario y ofrece helpers para login/logout. El decode del JWT se
 * encapsula aquí para que el resto de la app consuma siempre un `user` ya
 * procesado.
 */
import React, { useState, useEffect } from "react";
import AuthContext from "./AuthContext";
import api from "../api/axiosConfig";
import { decodeJwtPayload } from "../utils/jwt";

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al montar el proveedor, intenta rehidratar la sesión guardada en el
  // almacenamiento local para mantener al usuario autenticado tras recargas.
  useEffect(() => {
    const rehydrateSession = async () => {
      const storedToken = localStorage.getItem("token");

      if (storedToken) {
        try {
          decodeJwtPayload(storedToken);
          const { data } = await api.get("/auth/me");

          setUser(data);
          setToken(storedToken);
        } catch (error) {
          console.error("Error rehidratando la sesión", error);
          localStorage.removeItem("token");
          setUser(null);
          setToken(null);
        }
      }

      setLoading(false);
    };

    rehydrateSession();
  }, []);

  const loginUser = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem("token", jwtToken);
  };

  const logoutUser = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
