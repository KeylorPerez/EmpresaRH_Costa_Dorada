import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import empleadoService from "../services/empleadoService";
import empleadoDescansosService from "../services/empleadoDescansosService";
import { adminLinks as adminNavigationLinks } from "../utils/navigationLinks";

const tiposDescanso = [
  { value: "FIJO_SEMANAL", label: "Fijo semanal" },
  { value: "ALTERNADO_SEMANAL", label: "Alternado semanal" },
  { value: "FECHA_UNICA", label: "Fecha única" },
  { value: "RANGO_FECHAS", label: "Rango de fechas" },
];

const diasSemana = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const initialForm = {
  id_descanso: null,
  id_empleado: "",
  tipo_descanso: "FIJO_SEMANAL",
  dia_semana: "",
  dia_semana_alterno: "",
  fecha_inicio: "",
  fecha_fin: "",
  observacion: "",
  estado: true,
};

const EmpleadoDescansos = () => {
  const { user, logoutUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [empleados, setEmpleados] = useState([]);
  const [descansos, setDescansos] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const adminLinks = useMemo(() => adminNavigationLinks, []);

  const isSemanal = formData.tipo_descanso === "FIJO_SEMANAL" || formData.tipo_descanso === "ALTERNADO_SEMANAL";
  const isAlternado = formData.tipo_descanso === "ALTERNADO_SEMANAL";
  const isRango = formData.tipo_descanso === "RANGO_FECHAS";

  const resetForm = () => setFormData(initialForm);

  const loadPageData = async () => {
    setLoading(true);
    setError("");
    try {
      const [empleadosData, descansosData] = await Promise.all([
        empleadoService.getAll(),
        empleadoDescansosService.getAll(),
      ]);
      setEmpleados(Array.isArray(empleadosData) ? empleadosData.filter((e) => Boolean(e.estado)) : []);
      setDescansos(Array.isArray(descansosData) ? descansosData : []);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cargar la configuración de descansos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const toPayload = () => ({
    id_empleado: Number(formData.id_empleado),
    tipo_descanso: formData.tipo_descanso,
    dia_semana: isSemanal ? Number(formData.dia_semana) || null : null,
    dia_semana_alterno: isAlternado ? Number(formData.dia_semana_alterno) || null : null,
    fecha_inicio: formData.fecha_inicio,
    fecha_fin: isRango ? formData.fecha_fin || null : null,
    observacion: formData.observacion?.trim() || null,
    estado: Boolean(formData.estado),
  });

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = toPayload();
      if (formData.id_descanso) {
        await empleadoDescansosService.update(formData.id_descanso, payload);
        setSuccess("Descanso actualizado correctamente.");
      } else {
        await empleadoDescansosService.create(payload);
        setSuccess("Descanso creado correctamente.");
      }
      resetForm();
      await loadPageData();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el descanso.");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (item) => {
    setError("");
    setSuccess("");
    setFormData({
      id_descanso: item.id_descanso,
      id_empleado: String(item.id_empleado),
      tipo_descanso: item.tipo_descanso,
      dia_semana: item.dia_semana ? String(item.dia_semana) : "",
      dia_semana_alterno: item.dia_semana_alterno ? String(item.dia_semana_alterno) : "",
      fecha_inicio: String(item.fecha_inicio).slice(0, 10),
      fecha_fin: item.fecha_fin ? String(item.fecha_fin).slice(0, 10) : "",
      observacion: item.observacion || "",
      estado: Boolean(item.estado),
    });
  };

  const onDelete = async (item) => {
    const confirmed = window.confirm(`¿Eliminar descanso #${item.id_descanso} de ${item.empleado_nombre}?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");
    try {
      await empleadoDescansosService.remove(item.id_descanso);
      setSuccess("Descanso eliminado correctamente.");
      if (formData.id_descanso === item.id_descanso) resetForm();
      await loadPageData();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo eliminar el descanso.");
    }
  };

  if (!user) return <p>Cargando usuario...</p>;
  if (user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar links={adminLinks} roleColor="blue" isMobileOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
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
            <h1 className="text-2xl font-bold text-gray-800">Descansos por empleado</h1>
            <p className="text-gray-500 text-sm">Configura descansos fijos, alternados y por fechas especiales.</p>
          </div>

          {error && <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
          {success && <div className="bg-emerald-100 border border-emerald-300 text-emerald-700 px-4 py-3 rounded-lg">{success}</div>}

          <section className="bg-white shadow rounded-xl p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{formData.id_descanso ? "Editar descanso" : "Nuevo descanso"}</h2>
            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <label htmlFor="id_empleado" className="font-medium">Empleado</label>
                <select id="id_empleado" name="id_empleado" value={formData.id_empleado} onChange={onChange} required className="rounded-lg border border-gray-300 px-3 py-2">
                  <option value="">Seleccione</option>
                  {empleados.map((emp) => (
                    <option key={emp.id_empleado} value={emp.id_empleado}>{emp.nombre} {emp.apellido}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <label htmlFor="tipo_descanso" className="font-medium">Tipo</label>
                <select id="tipo_descanso" name="tipo_descanso" value={formData.tipo_descanso} onChange={onChange} className="rounded-lg border border-gray-300 px-3 py-2">
                  {tiposDescanso.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
                </select>
              </div>

              {isSemanal && (
                <div className="flex flex-col gap-1 text-sm text-gray-600">
                  <label htmlFor="dia_semana" className="font-medium">Día principal</label>
                  <select id="dia_semana" name="dia_semana" value={formData.dia_semana} onChange={onChange} required className="rounded-lg border border-gray-300 px-3 py-2">
                    <option value="">Seleccione</option>
                    {diasSemana.map((dia) => <option key={dia.value} value={dia.value}>{dia.label}</option>)}
                  </select>
                </div>
              )}

              {isAlternado && (
                <div className="flex flex-col gap-1 text-sm text-gray-600">
                  <label htmlFor="dia_semana_alterno" className="font-medium">Día alterno</label>
                  <select id="dia_semana_alterno" name="dia_semana_alterno" value={formData.dia_semana_alterno} onChange={onChange} required className="rounded-lg border border-gray-300 px-3 py-2">
                    <option value="">Seleccione</option>
                    {diasSemana.map((dia) => <option key={dia.value} value={dia.value}>{dia.label}</option>)}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <label htmlFor="fecha_inicio" className="font-medium">Fecha inicio</label>
                <input id="fecha_inicio" name="fecha_inicio" type="date" value={formData.fecha_inicio} onChange={onChange} required className="rounded-lg border border-gray-300 px-3 py-2" />
              </div>

              {isRango && (
                <div className="flex flex-col gap-1 text-sm text-gray-600">
                  <label htmlFor="fecha_fin" className="font-medium">Fecha fin</label>
                  <input id="fecha_fin" name="fecha_fin" type="date" value={formData.fecha_fin} onChange={onChange} required className="rounded-lg border border-gray-300 px-3 py-2" />
                </div>
              )}

              <div className="flex flex-col gap-1 text-sm text-gray-600 lg:col-span-2">
                <label htmlFor="observacion" className="font-medium">Observación</label>
                <input id="observacion" name="observacion" type="text" maxLength={200} value={formData.observacion} onChange={onChange} className="rounded-lg border border-gray-300 px-3 py-2" />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 lg:col-span-1">
                <input type="checkbox" name="estado" checked={formData.estado} onChange={onChange} className="h-4 w-4" />
                Activo
              </label>

              <div className="sm:col-span-2 lg:col-span-3 flex gap-2 justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={resetForm}>Limpiar</Button>
                <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? "Guardando..." : formData.id_descanso ? "Actualizar" : "Guardar"}</Button>
              </div>
            </form>
          </section>

          <section className="bg-white shadow rounded-xl overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Descansos configurados</h2>
            </div>

            {loading ? (
              <p className="p-4 text-gray-600">Cargando descansos...</p>
            ) : descansos.length === 0 ? (
              <p className="p-4 text-gray-600">No hay descansos configurados aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Regla</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Vigencia</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Activo</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {descansos.map((item) => (
                      <tr key={item.id_descanso} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-700">{item.empleado_nombre}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{item.tipo_descanso}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{item.dia_semana || "-"} / {item.dia_semana_alterno || "-"}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{String(item.fecha_inicio).slice(0, 10)} - {item.fecha_fin ? String(item.fecha_fin).slice(0, 10) : "Sin fin"}</td>
                        <td className="px-4 py-2 text-sm text-center text-gray-700">{item.estado ? "Sí" : "No"}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="warning" size="sm" onClick={() => onEdit(item)}>Editar</Button>
                            <Button variant="danger" size="sm" onClick={() => onDelete(item)}>Eliminar</Button>
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

export default EmpleadoDescansos;
