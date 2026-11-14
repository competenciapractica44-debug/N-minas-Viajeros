import React from 'react';
import { ArrowLeft, ShieldCheck, FileText, Lock, Cloud, Mail, CheckCircle2 } from 'lucide-react';
import { PublicFooter, PublicLegalPage } from './PublicFooter';

interface LegalPageViewProps {
  page: PublicLegalPage;
  onBackToHome: () => void;
  onNavigateLegal: (page: PublicLegalPage) => void;
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({
  page,
  onBackToHome,
  onNavigateLegal,
}) => {
  const isPrivacy = page === 'privacidad';

  const handleBackClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onBackToHome();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top public bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-lg tracking-wider shrink-0">
              RN
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg block leading-tight">
                RutaNómina - Transporte de Viajeros
              </span>
              <span className="text-[11px] text-slate-500 block">
                Información legal pública · {isPrivacy ? 'Política de Privacidad' : 'Condiciones del Servicio'}
              </span>
            </div>
          </div>

          <a
            href="/"
            onClick={handleBackClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al inicio</span>
          </a>
        </div>
      </header>

      {/* Main legal document */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Switcher between Privacy Policy and Terms */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-white border border-slate-200 rounded-2xl shadow-2xs">
            <a
              href="/?page=privacidad"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onNavigateLegal('privacidad');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isPrivacy
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Política de Privacidad</span>
            </a>
            <a
              href="/?page=terminos"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  onNavigateLegal('terminos');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                !isPrivacy
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Condiciones del Servicio</span>
            </a>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Última actualización: noviembre de 2026
          </span>
        </div>

        {isPrivacy ? (
          <article className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
            <div className="border-b border-slate-100 pb-5 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                <Lock className="w-3.5 h-3.5" />
                <span>Documento Oficial de Privacidad</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Política de Privacidad de RutaNómina - Transporte de Viajeros
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                RutaNómina es una herramienta para gestionar rutas, jornadas y nóminas de conductores de transporte de viajeros.
              </p>
            </div>

            {/* Mandatory Google API Limited Use Disclosure */}
            <section className="p-4 sm:p-5 rounded-2xl bg-blue-50/90 border border-blue-200 space-y-2">
              <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Cumplimiento con la Política de Datos de Usuario de Google (Uso Limitado)</span>
              </h2>
              <p className="text-xs sm:text-sm text-blue-950 font-medium leading-relaxed">
                El uso y la transferencia por parte de <strong>RutaNómina - Transporte de Viajeros</strong> de cualquier información recibida de las APIs de Google cumplirá estrictamente con la{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold text-blue-800 hover:text-blue-950"
                >
                  Política de datos de usuario de los servicios API de Google (Google API Services User Data Policy)
                </a>
                , incluidos los requisitos de <strong>Uso Limitado (Limited Use requirements)</strong>.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. Responsable de la aplicación</h2>
              <p>
                La aplicación web <strong>RutaNómina - Transporte de Viajeros</strong> está diseñada para que conductores de transporte de viajeros puedan registrar sus turnos, horarios, pluses de convenio y estimaciones de nómina de manera privada e independiente.
              </p>
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 pt-1">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Contacto del desarrollador: <a href="mailto:exea1973@gmail.com" className="text-blue-600 hover:underline">exea1973@gmail.com</a></span>
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. Datos a los que accedemos y finalidad</h2>
              <p>
                Cuando el usuario decide iniciar sesión voluntariamente con su cuenta de Google, RutaNómina solicita únicamente los siguientes datos y permisos:
              </p>
              <ul className="space-y-2 pl-1">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Identificación básica de cuenta Google (nombre, correo y foto de perfil):</strong> se utiliza exclusivamente para mostrar qué cuenta tiene la sesión iniciada en la interfaz de la aplicación.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Cloud className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Permiso limitado de Google Drive (<code>https://www.googleapis.com/auth/drive.file</code>):</strong> permite únicamente crear y gestionar la carpeta privada <em>Direxis / Nóminas</em> dentro del propio Google Drive del usuario y los archivos creados por la propia aplicación (configuración de chófer, base de turnos, valores de convenio 2026, cuadrante y copias PDF/JSON de nóminas). <strong>RutaNómina no puede ver, leer ni modificar otros archivos o carpetas de tu Google Drive.</strong>
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. Almacenamiento local y en tu propio Google Drive</h2>
              <p>
                RutaNómina funciona directamente en tu navegador web sin servidores externos propios que recolecten tus nóminas. Tus registros de turnos y configuraciones se guardan localmente en tu dispositivo (<em>localStorage</em>) y, si conectas Google Drive, se sincronizan directamente entre tu navegador y tu cuenta personal de Google Drive.
              </p>
              <p>
                Los tokens de acceso OAuth de Google Drive se mantienen únicamente en memoria durante la sesión activa del navegador y nunca se venden, ceden ni comparten con terceros, anunciantes o corredores de datos.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">4. Prohibición de uso publicitario o transferencia a terceros</h2>
              <p>
                RutaNómina no utiliza los datos obtenidos a través de las APIs de Google Workspace/Drive para publicidad, elaboración de perfiles comerciales, entrenamiento de modelos de inteligencia artificial ni ningún otro fin distinto al almacenamiento y sincronización personal solicitada por el propio conductor.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">5. Control, revocación y eliminación de datos</h2>
              <p>
                El usuario mantiene en todo momento la propiedad y control absoluto de su información:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Puede utilizar la aplicación en modo local sin iniciar sesión con Google.</li>
                <li>Puede cerrar sesión en cualquier momento desde la cabecera de la aplicación.</li>
                <li>Puede revocar el acceso de RutaNómina en cualquier momento desde la configuración de permisos de su cuenta de Google (<a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">myaccount.google.com/permissions</a>).</li>
                <li>Puede eliminar directamente la carpeta <em>Direxis / Nóminas</em> en su Google Drive o borrar los datos locales del navegador.</li>
              </ul>
            </section>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <a
                href="/"
                onClick={handleBackClick}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al inicio</span>
              </a>
              <a
                href="/?page=terminos"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    onNavigateLegal('terminos');
                  }
                }}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Ver Condiciones del Servicio →
              </a>
            </div>
          </article>
        ) : (
          <article className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
            <div className="border-b border-slate-100 pb-5 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                <FileText className="w-3.5 h-3.5" />
                <span>Condiciones Legales de Uso</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Condiciones del Servicio de RutaNómina - Transporte de Viajeros
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                RutaNómina es una herramienta para gestionar rutas, jornadas y nóminas de conductores de transporte de viajeros.
              </p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. Objeto de la aplicación</h2>
              <p>
                <strong>RutaNómina - Transporte de Viajeros</strong> es una aplicación web de apoyo personal destinada a conductores profesionales del sector de transporte de viajeros por carretera. Permite organizar cuadrantes de trabajo, partes horarios, horas nocturnas, pluses de convenio, extras diarios y simular el cálculo mensual de la nómina, así como exportar informes en PDF y Excel o respaldarlos en el Google Drive del propio usuario.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. Carácter orientativo de los cálculos</h2>
              <p>
                Los cálculos salariales, importes de pluses, retenciones de IRPF y cotizaciones a la Seguridad Social generados por RutaNómina tienen carácter estrictamente <strong>informativo y orientativo</strong> para ayudar al trabajador en el seguimiento de sus jornadas. El único documento con validez laboral y fiscal oficial es el recibo de salarios emitido por la empresa empleadora.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. Uso de cuenta Google y sincronización con Google Drive</h2>
              <p>
                El acceso mediante cuenta de Google es opcional para la sincronización en la nube. Al autorizar el acceso a Google Drive (alcance <code>drive.file</code>), el usuario consiente que la aplicación cree y actualice sus archivos personales dentro de su propia carpeta <em>Direxis / Nóminas</em>. El usuario es el único responsable de la custodia de su cuenta de Google y de los archivos generados en su Drive.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">4. Uso aceptable y disponibilidad</h2>
              <p>
                El usuario se compromete a utilizar la aplicación conforme a la ley y de buena fe, introduciendo datos veraces bajo su propia responsabilidad. RutaNómina se ofrece «tal cual» (<em>as-is</em>), sin garantía de disponibilidad ininterrumpida, y puede actualizarse para incorporar mejoras o cambios en las tablas del convenio aplicable.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">5. Propiedad intelectual y modificaciones</h2>
              <p>
                Los datos introducidos por el conductor y los archivos almacenados en su Google Drive pertenecen exclusivamente al usuario. Estas condiciones pueden actualizarse cuando sea necesario para reflejar mejoras técnicas o requisitos normativos.
              </p>
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 pt-1">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Consultas o soporte: <a href="mailto:exea1973@gmail.com" className="text-blue-600 hover:underline">exea1973@gmail.com</a></span>
              </p>
            </section>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <a
                href="/"
                onClick={handleBackClick}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al inicio</span>
              </a>
              <a
                href="/?page=privacidad"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    onNavigateLegal('privacidad');
                  }
                }}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Ver Política de Privacidad →
              </a>
            </div>
          </article>
        )}
      </main>

      {/* Public Footer (no BottomNav overlap here) */}
      <PublicFooter onNavigateLegal={onNavigateLegal} className="!pb-2 mt-4" />
    </div>
  );
};
