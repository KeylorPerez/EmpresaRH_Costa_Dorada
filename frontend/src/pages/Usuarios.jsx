import React from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { useUsuario } from "../hooks/useUsuario";
import { adminLinks } from "../utils/navigationLinks";

const Usuarios = () => {
  const { user, logoutUser } = useAuth();
  const {
    usuarios,
    empleados,
    availableEmpleados,
    rolesOptions,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingUsuario,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    handleChangeStatus,
    resetForm,
    setError,
    statusFilter,
    setStatusFilter,
  } = useUsuario();

  if (!user) return <p>Cargando usuario...</p>;
  if (user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
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
            <h1 className="text-xl font-bold">Usuarios</h1>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-col">
                <label htmlFor="statusFilter" className="text-sm font-semibold text-gray-700">
                  Mostrar
                </label>
                <select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border px-2 py-1 rounded"
                >
                  <option value="1">Activos</option>
                  <option value="0">Inactivos</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setError("");
                  resetForm();
                  setModalOpen(true);
                }}
              >
                Agregar Usuario
              </Button>
            </div>
          </div>

          {error && <p className="text-red-500 mb-2">{error}</p>}

          {loading ? (
            <p>Cargando usuarios...</p>
          ) : (
            <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
              <div className="max-h-[70vh] overflow-y-auto">
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border px-2 py-1">Usuario</th>
                      <th className="border px-2 py-1">Rol</th>
                      <th className="border px-2 py-1">Empleado</th>
                      <th className="border px-2 py-1">Estado</th>
                      <th className="border px-2 py-1">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center p-2">
                          No hay usuarios {statusFilter === "todos" ? "disponibles" : "con el estado seleccionado"}
                        </td>
                      </tr>
                    )}
                    {usuarios.map((usuario) => {
                      const empleadoRelacionado = empleados.find(
                        (emp) => emp.id_empleado === usuario.id_empleado
                      );

                      return (
                        <tr key={usuario.id_usuario}>
                          <td className="border px-2 py-1">{usuario.username}</td>
                          <td className="border px-2 py-1">{usuario.rol || usuario.id_rol}</td>
                          <td className="border px-2 py-1">
                            {empleadoRelacionado
                              ? `${empleadoRelacionado.nombre} ${empleadoRelacionado.apellido}`
                              : usuario.id_empleado}
                          </td>
                          <td className="border px-2 py-1">
                            {usuario.estado ? "Activo" : "Inactivo"}
                          </td>
                          <td className="border px-2 py-1 space-x-1">
                            <Button variant="warning" size="sm" onClick={() => handleEdit(usuario)}>
                              Editar
                            </Button>
                            {usuario.estado ? (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleChangeStatus(usuario.id_usuario, 0)}
                              >
                                Desactivar
                              </Button>
                            ) : (
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleChangeStatus(usuario.id_usuario, 1)}
                              >
                                Activar
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
                <h2 className="text-lg font-bold mb-4">
                  {editingUsuario ? "Editar Usuario" : "Agregar Usuario"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1" htmlFor="username">
                      Usuario
                    </label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleChange}
                      className="w-full border px-2 py-1 rounded"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1" htmlFor="password">
                      Contraseña {editingUsuario && <span className="text-xs text-gray-500">(opcional)</span>}
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full border px-2 py-1 rounded"
                      placeholder={editingUsuario ? "Dejar en blanco para mantener" : ""}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1" htmlFor="id_rol">
                      Rol
                    </label>
                    <select
                      id="id_rol"
                      name="id_rol"
                      value={formData.id_rol}
                      onChange={handleChange}
                      className="w-full border px-2 py-1 rounded"
                      required
                    >
                      <option value="">Seleccione un rol</option>
                      {rolesOptions.map((rol) => (
                        <option key={rol.value} value={rol.value}>
                          {rol.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1" htmlFor="id_empleado">
                      Empleado asociado
                    </label>
                    <select
                      id="id_empleado"
                      name="id_empleado"
                      value={formData.id_empleado}
                      onChange={handleChange}
                      className="w-full border px-2 py-1 rounded"
                      required
                    >
                      <option value="">Seleccione un empleado</option>
                      {availableEmpleados.map((empleado) => (
                        <option key={empleado.id_empleado} value={empleado.id_empleado}>
                          {empleado.nombre} {empleado.apellido}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1" htmlFor="estado">
                      Estado
                    </label>
                    <select
                      id="estado"
                      name="estado"
                      value={formData.estado}
                      onChange={handleChange}
                      className="w-full border px-2 py-1 rounded"
                      required
                    >
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <Button variant="secondary" size="sm" onClick={closeModal}>
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" type="submit">
                      {editingUsuario ? "Actualizar" : "Crear"}
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

export default Usuarios;
