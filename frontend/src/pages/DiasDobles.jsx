import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import diasDoblesService from "../services/diasDoblesService";
import { adminLinks as adminNavigationLinks } from "../utils/navigationLinks";

const initialForm = {
  id_dia_doble: null,
  fecha: "",
  descripcion: "",
  multiplicador: "2",
  activo: true,
};

const DiasDobles = () => {
  const { user, logoutUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [diasDobles, setDiasDobles] = useState([]);
  const [formData, setFormData] = useState(initialForm);

  const adminLinks = useMemo(() => adminNavigationLinks, []);

  const loadDiasDobles = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await diasDoblesService.getAll();
      setDiasDobles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cargar la configuración de días dobles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiasDobles();
  }, []);

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
  };

  const onEdit = (item) => {
    setError("");
    setSuccess("");
    setFormData({
      id_dia_doble: item.id_dia_doble,
      fecha: (item.fecha || "").toString().slice(0, 10),
      descripcion: item.descripcion || "",
      multiplicador: String(item.multiplicador ?? 2),
      activo: Boolean(item.activo),
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        fecha: formData.fecha,
        descripcion: formData.descripcion,
        multiplicador: Number(formData.multiplicador),
        activo: Boolean(formData.activo),
      };

      if (formData.id_dia_doble) {
        await diasDoblesService.update(formData.id_dia_doble, payload);
        setSuccess("Día doble actualizado correctamente.");
      } else {
        await diasDoblesService.create(payload);
        setSuccess("Día doble creado correctamente.");
      }

      resetForm();
      await loadDiasDobles();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el día doble.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item) => {
    const confirmado = window.confirm(`¿Eliminar el día doble del ${String(item.fecha).slice(0, 10)}?`);
    if (!confirmado) return;

    setError("");
    setSuccess("");
    try {
      await diasDoblesService.remove(item.id_dia_doble);
      setSuccess("Día doble eliminado correctamente.");
      if (formData.id_dia_doble === item.id_dia_doble) {
        resetForm();
      }
      await loadDiasDobles();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo eliminar el día doble.");
    }
  };

  if (!user) return <p>Cargando usuario...</p>;
  if (user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        links={adminLinks}
        roleColor="blue"
        isMobileOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex flex-col flex-grow">
        <Navbar
          title="Panel de Administración"
          user={user}
          roleColor="blue"
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onLogout={logoutUser}
        />

        <main className="flex-grow p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Días dobles (feriados)</h1>
            <p className="text-gray-500 text-sm">
              Aquí se configuran las fechas que se pagan doble (o con otro multiplicador).
            </p>
          </div>

          {error && <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
          {success && (
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-700 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          <section className="bg-white shadow rounded-xl p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {formData.id_dia_doble ? "Editar día doble" : "Nuevo día doble"}
            </h2>
            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <label htmlFor="fecha" className="font-medium">Fecha</label>
                <input
                  id="fecha"
                  name="fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={onChange}
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="flex flex-col gap-1 text-sm text-gray-600 lg:col-span-2">
                <label htmlFor="descripcion" className="font-medium">Descripción</label>
                <input
                  id="descripcion"
                  name="descripcion"
                  type="text"
                  value={formData.descripcion}
                  onChange={onChange}
                  required
                  maxLength={150}
                  placeholder="Ej: Día de la Independencia"
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <label htmlFor="multiplicador" className="font-medium">Multiplicador</label>
                <input
                  id="multiplicador"
                  name="multiplicador"
                  type="number"
                  min="1"
                  step="0.1"
                  value={formData.multiplicador}
                  onChange={onChange}
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 lg:col-span-1">
                <input
                  type="checkbox"
                  name="activo"
                  checked={formData.activo}
                  onChange={onChange}
                  className="h-4 w-4"
                />
                Activo
              </label>

              <div className="sm:col-span-2 lg:col-span-3 flex gap-2 justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={resetForm}>
                  Limpiar
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={saving}>
                  {saving ? "Guardando..." : formData.id_dia_doble ? "Actualizar" : "Guardar"}
                </Button>
              </div>
            </form>
          </section>

          <section className="bg-white shadow rounded-xl overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Fechas configuradas</h2>
            </div>

            {loading ? (
              <p className="p-4 text-gray-600">Cargando días dobles...</p>
            ) : diasDobles.length === 0 ? (
              <p className="p-4 text-gray-600">No hay días dobles configurados aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Multiplicador</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Activo</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {diasDobles.map((item) => (
                      <tr key={item.id_dia_doble} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-700">{String(item.fecha).slice(0, 10)}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{item.descripcion}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-700">{item.multiplicador}</td>
                        <td className="px-4 py-2 text-sm text-center text-gray-700">{item.activo ? "Sí" : "No"}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="warning" size="sm" onClick={() => onEdit(item)}>
                              Editar
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => onDelete(item)}>
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default DiasDobles;
