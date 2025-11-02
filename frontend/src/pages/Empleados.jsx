import React from "react";
import { useEmpleado } from "../hooks/useEmpleado";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";

const Empleados = () => {
  const { user, logoutUser } = useAuth();
  const {
    empleados,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingEmpleado,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    handleDeactivate,
    handleActivate,
    resetForm,
  } = useEmpleado();

  const adminLinks = [
    { path: "/admin", label: "Inicio" },
    { path: "/admin/usuarios", label: "Usuarios" },
    { path: "/admin/empleados", label: "Empleados" },
    { path: "/admin/planilla", label: "Planilla" },
    { path: "/admin/vacaciones", label: "Vacaciones" },
    { path: "/admin/prestamos", label: "Préstamos" },
    { path: "/admin/liquidaciones", label: "Liquidaciones" },
  ];

  if (!user) return <p>Cargando usuario...</p>;
  if (user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar links={adminLinks} roleColor="blue" />
      <div className="flex flex-col flex-grow">
        <Navbar
          title="Panel de Administración"
          user={user}
          roleColor="blue"
          onLogout={logoutUser}
        />
        <main className="flex-grow p-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold">Empleados</h1>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                resetForm();
                setModalOpen(true);
              }}
            >
              Agregar Empleado
            </Button>
          </div>

          {error && <p className="text-red-500 mb-2">{error}</p>}

          {loading ? (
            <p>Cargando empleados...</p>
          ) : (
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border px-2 py-1">Nombre</th>
                  <th className="border px-2 py-1">Apellido</th>
                  <th className="border px-2 py-1">Cédula</th>
                  <th className="border px-2 py-1">Puesto</th>
                  <th className="border px-2 py-1">Salario Base</th>
                  <th className="border px-2 py-1">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empleados.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center p-2">
                      No hay empleados disponibles
                    </td>
                  </tr>
                )}
                {empleados.map((emp) => (
                  <tr key={emp.id_empleado}>
                    <td className="border px-2 py-1">{emp.nombre}</td>
                    <td className="border px-2 py-1">{emp.apellido}</td>
                    <td className="border px-2 py-1">{emp.cedula}</td>
                    <td className="border px-2 py-1">{emp.id_puesto}</td>
                    <td className="border px-2 py-1">{emp.salario_base}</td>
                    <td className="border px-2 py-1 space-x-1">
                      <Button variant="warning" size="sm" onClick={() => handleEdit(emp)}>
                        Editar
                      </Button>
                      {emp.estado ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeactivate(emp.id_empleado)}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleActivate(emp.id_empleado)}
                        >
                          Activar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {modalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center">
              <div className="bg-white p-6 rounded w-96">
                <h2 className="text-lg font-bold mb-4">
                  {editingEmpleado ? "Editar Empleado" : "Agregar Empleado"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-2">
                  {Object.keys(formData).map((key) => {
                    if (key === "id_puesto" || key === "cedula" || key === "salario_base" || key === "fecha_nacimiento" || key === "fecha_ingreso" || key === "nombre" || key === "apellido" || key === "telefono" || key === "email") {
                      const type = key.includes("fecha") ? "date" : key === "salario_base" ? "number" : key === "email" ? "email" : "text";
                      return (
                        <input
                          key={key}
                          type={type}
                          name={key}
                          value={formData[key] || ""}
                          onChange={handleChange}
                          placeholder={key.replace("_", " ").toUpperCase()}
                          className="w-full border px-2 py-1 rounded"
                          required={["nombre","apellido","id_puesto","cedula","fecha_ingreso","salario_base"].includes(key)}
                        />
                      );
                    }
                    return null;
                  })}
                  <div className="flex justify-end space-x-2 mt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        resetForm();
                        setModalOpen(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" type="submit">
                      {editingEmpleado ? "Actualizar" : "Crear"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Empleados;
