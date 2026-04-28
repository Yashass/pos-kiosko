import { useEffect, useRef, useState } from 'react';
import { X, Camera, CameraOff, ShieldAlert } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

type ScanStatus = 'starting' | 'active' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError:
    'Permiso de cámara denegado.\n\nEn Chrome: tocá el ícono 🔒 en la barra de dirección → Permisos → Cámara → Permitir.',
  PermissionDeniedError:
    'Permiso de cámara denegado.\n\nEn Chrome: tocá el ícono 🔒 en la barra de dirección → Permisos → Cámara → Permitir.',
  NotFoundError: 'No se encontró cámara en el dispositivo.',
  DevicesNotFoundError: 'No se encontró cámara en el dispositivo.',
  NotReadableError:
    'La cámara está en uso por otra aplicación. Cerrá otras pestañas o apps que usen la cámara.',
  AbortError: 'El acceso a la cámara fue interrumpido. Volvé a intentar.',
};

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<ScanStatus>('starting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. Verificar contexto seguro (HTTPS requerido para cámara)
      if (!window.isSecureContext) {
        setError(
          'La cámara requiere HTTPS.\n\n' +
            `URL actual: ${window.location.origin}\n\n` +
            'Accedé a la app usando https:// en lugar de http://\n' +
            'Si estás en desarrollo, ejecutá `npm run dev` y usá la URL con https.',
        );
        setStatus('error');
        return;
      }

      // 2. Verificar disponibilidad de la API
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Tu navegador no permite el acceso a la cámara. Usá Chrome o Safari actualizado.');
        setStatus('error');
        return;
      }

      try {
        const reader = new BrowserMultiFormatReader();

        // decodeFromConstraints maneja getUserMedia internamente y selecciona la cámara trasera
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' }, // cámara trasera en móvil
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current!,
          (result) => {
            if (cancelled || doneRef.current) return;
            if (result) {
              doneRef.current = true;
              controls.stop();
              onScan(result.getText());
            }
          },
        );

        controlsRef.current = controls;
        if (cancelled) {
          controls.stop();
        } else {
          setStatus('active');
        }
      } catch (e) {
        if (cancelled) return;

        const err = e as DOMException;

        // Si falla con constraints de cámara trasera, reintenta sin restricciones
        if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          try {
            const reader2 = new BrowserMultiFormatReader();
            const controls2 = await reader2.decodeFromConstraints(
              { video: true },
              videoRef.current!,
              (result) => {
                if (cancelled || doneRef.current) return;
                if (result) {
                  doneRef.current = true;
                  controls2.stop();
                  onScan(result.getText());
                }
              },
            );
            controlsRef.current = controls2;
            if (cancelled) controls2.stop();
            else setStatus('active');
            return;
          } catch {
            // fall through to generic error
          }
        }

        setError(ERROR_MESSAGES[err.name] ?? `Error al acceder a la cámara: ${err.message}`);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white">
          <div className="flex items-center gap-2">
            {status === 'active' && <Camera size={18} className="text-green-400" />}
            {status === 'error' && <CameraOff size={18} className="text-red-400" />}
            {status === 'starting' && (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
            )}
            <span className="font-semibold text-sm">Escanear código de barras</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Visor de cámara */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />

          {/* Marco de escaneo */}
          {status === 'active' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-64 h-40">
                {/* Esquinas */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                {/* Línea de escaneo */}
                <div className="absolute inset-x-6 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
              </div>
            </div>
          )}

          {/* Overlay cuando hay error */}
          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <ShieldAlert size={48} className="text-red-400" />
            </div>
          )}
        </div>

        {/* Mensaje */}
        <div className="p-4">
          {status === 'active' && (
            <p className="text-slate-600 text-sm text-center">
              Apuntá la cámara al código de barras del producto
            </p>
          )}
          {status === 'starting' && (
            <p className="text-slate-400 text-sm text-center">Iniciando cámara…</p>
          )}
          {status === 'error' && (
            <div className="space-y-2">
              <p className="text-red-600 text-sm font-semibold">No se pudo acceder a la cámara</p>
              <p className="text-red-500 text-xs whitespace-pre-line leading-relaxed">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
