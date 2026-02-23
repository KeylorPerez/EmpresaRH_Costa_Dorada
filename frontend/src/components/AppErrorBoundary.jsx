import React from "react";
import PropTypes from "prop-types";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      info: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: `ERR-${Date.now()}`,
    };
  }

  componentDidCatch(error, info) {
    this.setState({ info });

    console.group("[APP ERROR BOUNDARY]");
    console.error("Error capturado por ErrorBoundary:", error);
    console.error("Stack de componentes:", info?.componentStack || "No disponible");
    console.groupEnd();
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
          <div className="mx-auto w-full max-w-3xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-red-700">La aplicación se detuvo por un error</h1>
            <p className="mt-3 text-sm text-slate-700">
              Se detectó un fallo de ejecución y por eso viste una pantalla en blanco.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Código de incidente: <span className="font-mono font-semibold">{this.state.errorId}</span>
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Abre la consola del navegador (F12 → Console) para ver el error exacto.</li>
              <li>Revisa también la pestaña Network para verificar la respuesta de /api/planilla.</li>
              <li>Si vuelve a ocurrir, comparte el código de incidente y el stack del error.</li>
            </ul>

            {isDev ? (
              <div className="mt-5 rounded-md bg-slate-950 p-4 text-xs text-slate-100">
                <p className="font-semibold text-amber-300">Mensaje técnico:</p>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {this.state.error?.stack || this.state.error?.message || "Sin detalles"}
                </pre>
                {this.state.info?.componentStack ? (
                  <>
                    <p className="mt-3 font-semibold text-amber-300">Component stack:</p>
                    <pre className="mt-2 whitespace-pre-wrap break-words">
                      {this.state.info.componentStack}
                    </pre>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                onClick={this.handleReload}
              >
                Recargar aplicación
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

AppErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppErrorBoundary;
