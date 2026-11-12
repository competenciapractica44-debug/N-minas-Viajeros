import React, { useState } from 'react';
import { Cloud, ShieldCheck, FolderSync, Users, AlertCircle, Loader2, ArrowRight, ExternalLink, Copy, Check } from 'lucide-react';
import { googleSignIn } from '../services/authService';
import { User } from 'firebase/auth';

interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
  allowDismiss?: boolean;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  allowDismiss = true,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyDomain = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentHost);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 3000);
    }
  };

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsUnauthorizedDomain(false);
    try {
      const result = await googleSignIn();
      if (result) {
        onLoginSuccess(result.user, result.accessToken);
        onClose();
      }
    } catch (err: any) {
      console.error('Error durante el inicio de sesión:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Has cerrado la ventana de inicio de sesión de Google. Inténtalo de nuevo.');
      } else if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
        setErrorMessage('Dominio web no autorizado en Firebase Authentication.');
      } else {
        setErrorMessage(
          err.message || 'No se pudo completar el inicio de sesión. Comprueba tu conexión a internet.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-slate-800">
        {/* Header Decorativo con temática Direxis & Google Drive */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="inline-flex p-3 bg-white/15 backdrop-blur-md rounded-2xl mb-3 shadow-inner">
            <Cloud className="w-8 h-8 text-white stroke-[2]" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Acceso Privado con Google</h2>
          <p className="text-xs text-blue-100 mt-1 max-w-xs mx-auto leading-relaxed">
            Sincroniza tus turnos y nóminas en tu carpeta personal de <strong>Google Drive</strong>
          </p>
        </div>

        {/* Cuerpo informativo */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50/80 rounded-2xl border border-blue-100">
              <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5">
                <FolderSync className="w-4 h-4" />
              </div>
              <div className="text-xs text-slate-700">
                <span className="font-bold text-slate-900 block">Carpeta automática Direxis / Nóminas</span>
                Se creará en tu Google Drive la carpeta <strong>Direxis</strong> y la subcarpeta <strong>Nóminas</strong> donde se respaldarán tus datos.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-emerald-50/80 rounded-2xl border border-emerald-100">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs text-slate-700">
                <span className="font-bold text-slate-900 block">Tus datos son 100% privados e independientes</span>
                Cada conductor que acceda trabajará con sus propios turnos guardados en su cuenta, permitiendo compartir la aplicación de forma segura.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50/80 rounded-2xl border border-amber-100">
              <div className="p-2 bg-amber-600 text-white rounded-xl shrink-0 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div className="text-xs text-slate-700">
                <span className="font-bold text-slate-900 block">Sincronización bidireccional</span>
                Si ya tienes turnos guardados en tu Drive, se cargarán automáticamente. Cualquier cambio se guardará en la nube.
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="space-y-2.5 animate-fadeIn">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-semibold">{errorMessage}</span>
              </div>

              {isUnauthorizedDomain && (
                <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs space-y-2 text-slate-700">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                    <span>Cómo autorizar tu dominio en Firebase (1 minuto):</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Estás ejecutando la web desde <code className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px]">{currentHost || 'tu dominio web'}</code>. Para permitir el acceso seguro con Google desde este dominio:
                  </p>

                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700">
                    <li>
                      Abre la configuración de Firebase:
                      <a
                        href="https://console.firebase.google.com/project/gen-lang-client-0594243376/authentication/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 font-bold underline"
                      >
                        <span>Consola Firebase (Settings)</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>
                      Baja hasta la sección <strong>"Dominios autorizados"</strong> (Authorized domains) y pulsa <strong>"Añadir dominio"</strong>.
                    </li>
                    <li>
                      Pega tu dominio: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200 text-amber-900 text-[10px] font-bold">{currentHost}</code>
                    </li>
                    <li>
                      Pulsa <strong>Guardar</strong> y luego vuelve a pulsar el botón de Google abajo.
                    </li>
                  </ol>

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-amber-300 font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedDomain ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                          <span>Copiar dominio ({currentHost})</span>
                        </>
                      )}
                    </button>

                    <a
                      href="https://console.firebase.google.com/project/gen-lang-client-0594243376/authentication/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <span>Abrir Firebase</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botón Oficial Sign in with Google */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full h-13 px-4 flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-2xl border-2 border-slate-300 shadow-sm transition-all hover:shadow active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <span>Conectando con Google...</span>
                </>
              ) : (
                <>
                  {/* Google SVG Logo Oficial */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span>Iniciar sesión con cuenta de Google</span>
                </>
              )}
            </button>
          </div>

          {allowDismiss && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline transition-colors inline-flex items-center gap-1"
              >
                <span>Continuar en modo local (sin sincronizar con Drive)</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
