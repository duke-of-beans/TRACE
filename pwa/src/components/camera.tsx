/**
 * TRACE PWA — Direct Camera Capture
 *
 * Uses getUserMedia to capture directly from camera stream.
 * Photos NEVER touch the device's photo gallery.
 * Captured frames go straight to encrypted queue.
 *
 * Fallback: file input for devices where getUserMedia fails,
 * but with a warning that gallery copies may exist.
 */
import { useState, useRef, useCallback, useEffect } from "preact/hooks";

type CaptureResult = {
  blob: Blob;
  url: string; // object URL for preview
  timestamp: Date;
  lat: number | null;
  lng: number | null;
};

type DirectCameraProps = {
  onCapture: (result: CaptureResult) => void;
  onClose: () => void;
};

export function DirectCamera({ onCapture, onClose }: DirectCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // start camera
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!mounted) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        setError("Camera access denied. Use the file picker instead.");
      }

      // get GPS
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (mounted) setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
          () => {},
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    })();

    return () => {
      mounted = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      onCapture({
        blob,
        url,
        timestamp: new Date(),
        lat: location?.lat || null,
        lng: location?.lng || null,
      });
    }, "image/jpeg", 0.85);
  }, [location, onCapture]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    onClose();
  }, [stream, onClose]);

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "#e74c3c", marginBottom: 12 }}>{error}</p>
        <p style={{ color: "#888", fontSize: 12, marginBottom: 12 }}>
          ⚠ File picker saves a copy to your photo gallery. Delete it manually after.
        </p>
        <button onClick={onClose} style={{
          padding: "8px 20px", background: "#2a2a3e", color: "#ccc",
          border: "none", borderRadius: 6, cursor: "pointer",
        }}>Close</button>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000", zIndex: 100,
      display: "flex", flexDirection: "column",
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ flex: 1, objectFit: "cover" }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* GPS indicator */}
      {location && (
        <div style={{
          position: "absolute", top: 12, left: 12,
          background: "rgba(0,0,0,0.6)", padding: "4px 8px",
          borderRadius: 4, fontSize: 10, color: "#4fc3f7",
        }}>
          📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </div>
      )}

      {/* Controls */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 24, padding: 20, background: "rgba(0,0,0,0.8)",
      }}>
        <button onClick={stopCamera} style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "#333", border: "none", color: "#fff",
          fontSize: 20, cursor: "pointer",
        }}>✕</button>

        <button onClick={capture} style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "#fff", border: "4px solid #4fc3f7",
          cursor: "pointer",
        }} />

        <div style={{ width: 48 }} /> {/* spacer for centering */}
      </div>
    </div>
  );
}
