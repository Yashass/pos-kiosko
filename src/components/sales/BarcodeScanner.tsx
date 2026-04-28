import { useEffect, useRef, useState } from 'react';
import { X, Camera, CameraOff } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function startScan() {
      try {
        setScanning(true);
        setError(null);

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices.length) {
          setError('No se encontró cámara disponible');
          setScanning(false);
          return;
        }

        // Preferir cámara trasera en móviles
        const backCamera = devices.find(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('tras'),
        ) ?? devices[devices.length - 1];

        if (!videoRef.current || !mounted) return;

        const controls = await reader.decodeFromVideoDevice(
          backCamera.deviceId,
          videoRef.current,
          (result, err) => {
            if (!mounted) return;
            if (result) {
              const text = result.getText();
              onScan(text);
              controls.stop();
            } else if (err && !(err instanceof NotFoundException)) {
              console.warn('Scanner error:', err);
            }
          },
        );

        controlsRef.current = controls;
      } catch (e) {
        if (mounted) {
          setError('No se pudo acceder a la cámara. Verificá los permisos.');
          setScanning(false);
        }
      }
    }

    startScan();

    return () => {
      mounted = false;
      controlsRef.current?.stop();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white">
          <div className="flex items-center gap-2">
            {scanning ? <Camera size={18} className="text-green-400" /> : <CameraOff size={18} />}
            <span className="font-semibold text-sm">Escanear código de barras</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="relative bg-black aspect-square">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          {/* Viewfinder */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-40 border-2 border-blue-400 rounded-lg relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-blue-400/60 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="p-4">
          {error ? (
            <p className="text-red-500 text-sm text-center">{error}</p>
          ) : (
            <p className="text-slate-500 text-sm text-center">
              Apuntá la cámara al código de barras del producto
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
