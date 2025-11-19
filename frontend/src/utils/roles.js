export const getRoleLabel = (user) => {
  if (!user) return "Usuario";

  if (user.rol) return user.rol;

  switch (user.id_rol) {
    case 1:
      return "Administrador";
    case 2:
      return "Empleado";
    default:
      return "Usuario";
  }
};
