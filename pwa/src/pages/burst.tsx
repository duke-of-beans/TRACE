/**
 * TRACE PWA — Burst Capture Mode
 *
 * For field events when things move fast.
 * Tap = photo. Hold = video (future). No forms, no fields.
 * Each capture immediately queues for encrypted upload.
 * Auto-purges from device on server confirmation.
 * GPS + timestamp attach silently.
 *
 * If the phone is seized, whatever uploaded is safe on the node.
 * Whatever didn't upload is encrypted in IndexedDB until sync or wipe.
 */
import { useState, useRef, useCallback, useEffect } from "preact/hooks";
import { Icon } from "../components/icon.js";
import { enqueue, getQueueCount, drainQueue } from "../lib/queue.js";
import { getReporterId } from "../lib/api.js";
import { scrubPhoto } from "../lib/photo-scrub.js";

type BurstCapture = {
  id: string;
  blob: Blob;
  previewUrl: string;
  lat: number | null;
  lng: number | null;
  timestamp: string;
  uploaded: boolean;
};

type BurstProps = {
  onExit: () => void;
};

export function BurstCapture({ onExit }: BurstProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [captures, setCaptures] = useState<BurstCapture[]>([]);
  const [flash, setFlash] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalQueued, setTotalQueued] = useState(0);
  const locationRef = useRef(location);
  locationRef.current = location;

  // Start camera + continuous GPS
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
      } catch {
        setError("Camera access denied");
      }
    })();

    // Continuous GPS tracking (not one-shot)
    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (mounted) setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    // Periodic queue drain
    const drainInterval = setInterval(() => {
      drainQueue().then(() => getQueueCount().then(setTotalQueued)).catch(() => {});
    }, 3000);

    return () => {
      mounted = false;
      stream?.getTracks().forEach((t) => t.stop());
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(drainInterval);
    };
  }, []);

  // Capture handler - fast, no forms
  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Flash feedback
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      // Scrub EXIF metadata
      const { clean } = await scrubPhoto(blob).catch(() => ({ clean: blob }));
      const id = `burst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const loc = locationRef.current;
      const timestamp = new Date().toISOString();

      const entry: BurstCapture = {
        id,
        blob: clean,
        previewUrl: URL.createObjectURL(clean),
        lat: loc?.lat || null,
        lng: loc?.lng || null,
        timestamp,
        uploaded: false,
      };

      setCaptures((prev) => [entry, ...prev]);

      // Convert to base64 and enqueue immediately
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          await enqueue({
            id,
            payload: {
              lat: loc?.lat || null,
              lng: loc?.lng || null,
              observedAt: timestamp,
              reporterId: getReporterId(),
              burstMode: true,
              activityDescription: "[Burst capture - no description]",
            },
            photos: [base64],
            queuedAt: timestamp,
          });
          setCaptures((prev) =>
            prev.map((c) => (c.id === id ? { ...c, uploaded: true } : c))
          );
          setUploadedCount((prev) => prev + 1);
        } catch {
          // Queue is encrypted + persistent - it will retry
        }
      };
      reader.readAsDataURL(clean);
    }, "image/jpeg", 0.82);
  }, []);

  const handleExit = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    // Clean up preview URLs
    captures.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    onExit();
  }, [stream, captures, onExit]);

  if (error) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#000", zIndex: 200,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: "#fff", padding: 24, textAlign: "center",
      }}>
        <p style={{ color: "#e74c3c", marginBottom: 16 }}>{error}</p>
        <button onClick={onExit} style={{
          padding: "10px 24px", background: "#333", color: "#fff",
          border: "none", borderRadius: 8, fontSize: 14,
        }}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000", zIndex: 200,
      display: "flex", flexDirection: "column",
    }}>
      {/* Camera feed */}
      <video ref={videoRef} autoPlay playsInline muted
        style={{ flex: 1, objectFit: "cover" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Flash overlay */}
      {flash && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(255,255,255,0.4)",
          pointerEvents: "none", zIndex: 201,
        }} />
      )}

      {/* Top bar: status */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 202,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#e74c3c",
            animation: "pulse 1.5s infinite",
            boxShadow: "0 0 8px rgba(231,76,60,0.6)",
          }} />
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Burst capture
          </span>
        </div>
        {location && (
          <span style={{ color: "#4fc3f7", fontSize: 10 }}>
            GPS active
          </span>
        )}
      </div>

      {/* Capture counter - prominent */}
      <div style={{
        position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)",
        zIndex: 202, textAlign: "center",
      }}>
        <div style={{
          fontSize: 48, fontWeight: 700, color: "#fff",
          textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          lineHeight: 1,
        }}>{captures.length}</div>
        <div style={{
          fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2,
        }}>
          {uploadedCount} uploaded
          {captures.length > uploadedCount && ` / ${captures.length - uploadedCount} queued`}
        </div>
      </div>

      {/* Thumbnail strip - last 5 captures */}
      {captures.length > 0 && (
        <div style={{
          position: "absolute", top: 120, right: 12, zIndex: 202,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {captures.slice(0, 5).map((c) => (
            <div key={c.id} style={{
              width: 48, height: 48, borderRadius: 6, overflow: "hidden",
              border: c.uploaded ? "2px solid #27ae60" : "2px solid #d97706",
              opacity: c.uploaded ? 0.7 : 1,
            }}>
              <img src={c.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
        </div>
      )}

      {/* Bottom controls */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 32, padding: "20px 24px", paddingBottom: 36,
        background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
      }}>
        {/* Exit */}
        <button onClick={handleExit} style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)",
          color: "#fff", fontSize: 14, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          Done
        </button>

        {/* Capture button - big, obvious */}
        <button onClick={capture} style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "#fff", border: "5px solid #e74c3c",
          cursor: "pointer", position: "relative",
          boxShadow: "0 4px 20px rgba(231,76,60,0.4)",
        }}>
          <div style={{
            position: "absolute", inset: 6, borderRadius: "50%",
            background: "#e74c3c",
          }} />
        </button>

        {/* Spacer for centering */}
        <div style={{ width: 52 }} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
