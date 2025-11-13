import React from "react";
import { Link } from "react-router-dom";

const Acerca = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">
          Acerca de EmpresaRH
        </h1>
        <p className="text-gray-700 leading-relaxed mb-4">
          EmpresaRH es una plataforma diseñada para facilitar la gestión del
          talento humano dentro de tu organización. Con nuestro sistema podés
          administrar empleados, puestos, asistencia, vacaciones, préstamos y
          más, todo en un mismo lugar y con una interfaz intuitiva.
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          El objetivo principal es agilizar los procesos administrativos del
          departamento de Recursos Humanos, brindando herramientas que permitan
          tomar decisiones informadas y mantener la información centralizada y
          segura.
        </p>
        <p className="text-gray-700 leading-relaxed mb-6">
          Este proyecto fue desarrollado como parte de un esfuerzo por mejorar
          la eficiencia operativa y la experiencia de los colaboradores. ¡Gracias
          por utilizar EmpresaRH!
        </p>
        <div className="text-center">
          <Link
            to="/login"
            className="inline-block px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Acerca;
