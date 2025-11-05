import React from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { usePuesto } from "../hooks/usePuesto";

const Puestos = () => {
  const { user, logoutUser } = useAuth();
  const {
    puestos,
    loading,
    error,
    modalOpen,
    editingPuesto,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    handleDelete,
    openCreateModal,
    closeModal,
  } = usePuesto();

  const adminLinks = [
    { path: "/admin", label: "Inicio" },
    { path: "/admin/asistencia", label: "Asistencia" },
    { path: "/admin/usuarios", label: "Usuarios" },
    { path: "/admin/empleados", label: "Empleados" },
    { path: "/admin/puestos", label: "Puestos" },
    { path: "/admin/planilla", label: "Planilla" },
    { path: "/admin/vacaciones", label: "Vacaciones" },
    { path: "/admin/prestamos", label: "Préstamos" },
    { path: "/admin/liquidaciones", label: "Liquidaciones" },
  ];

  if (!user) return <p>Cargando usuario...</p>;
  if (user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;

  const confirmAndDelete = (puesto) => {
    const confirmed = window.confirm(
      `¿Estás seguro de eliminar el puesto "${puesto.nombre}"?`
    );
    if (confirmed) {
      handleDelete(puesto);
    }
  };

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
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Puestos</h1>
              <p className="text-sm text-gray-500">
                Administra el catálogo de puestos registrados en la base de datos.
              </p>
            </div>
            <Button variant="primary" size="md" onClick={openCreateModal}>
              Agregar Puesto
            </Button>
          </div>

          {error && <p className="text-red-500 mb-3">{error}</p>}

          {loading ? (
            <p>Cargando puestos...</p>
          ) : (
            <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
              <table className="min-w-full bg-white text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <th className="px-4 py-3">Nombre del puesto</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {puestos.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="px-4 py-6 text-center text-gray-500">
                        No hay puestos registrados.
                      </td>
                    </tr>
                  ) : (
                    puestos.map((puesto) => (
                      <tr
                        key={puesto.id_puesto}
                        className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {puesto.nombre}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="warning"
                              size="sm"
                              onClick={() => handleEdit(puesto)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => confirmAndDelete(puesto)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {modalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center">
              <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {editingPuesto ? "Editar Puesto" : "Agregar Puesto"}
                  </h2>
                  <button
                    aria-label="Cerrar"
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">
                      Nombre del puesto
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={closeModal}
                    >
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" type="submit">
                      {editingPuesto ? "Actualizar" : "Crear"}
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

export default Puestos;
