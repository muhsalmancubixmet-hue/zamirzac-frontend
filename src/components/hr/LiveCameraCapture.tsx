import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, AlertCircle, Check, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LiveCameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onCancel?: () => void;
  className?: string;
  initialCaptured?: string | null;
}

export function LiveCameraCapture({
  onCapture,
  onCancel,
  className = "",
  initialCaptured = null,
}: LiveCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(initialCaptured);
  const [isStarting, setIsStarting] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    setIsStarting(true);
    setCameraError(null);
    stopStream();

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported by this browser. Please use an updated modern browser (Chrome, Firefox, Safari, Edge).");
      setIsStarting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsStarting(false);
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Please allow camera access in your browser settings to punch attendance.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera hardware found on this device. A camera is required for identity verification.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setCameraError("Camera is currently in use by another application. Please close other camera apps and retry.");
      } else {
        setCameraError(err.message || "Failed to initialize camera. Please check device permissions.");
      }
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (!capturedImage) {
      startCamera(facingMode);
    }
    return () => {
      stopStream();
    };
  }, [facingMode, capturedImage]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // If front camera, mirror image to match user preview
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to high-quality JPEG data URL
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopStream();
    onCapture(dataUrl);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  const toggleFacingMode = () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
  };

  return (
    <div className={`flex flex-col space-y-3 ${className}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-black/90 shadow-inner">
        {cameraError ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 text-left">
              <AlertCircle className="size-4" />
              <AlertTitle>Camera Required</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed mt-1">
                {cameraError}
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => startCamera(facingMode)}
            >
              <RefreshCw className="mr-2 size-3.5" /> Try Again
            </Button>
          </div>
        ) : capturedImage ? (
          <div className="relative h-full w-full">
            <img
              src={capturedImage}
              alt="Live Captured Selfie"
              className="h-full w-full object-cover"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-emerald-600/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
              <Check className="size-3" /> Selfie Captured
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
            />
            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
                <RefreshCw className="size-6 animate-spin text-accent" />
                <p className="mt-2 text-xs font-medium">Starting camera…</p>
              </div>
            )}
            {!isStarting && (
              <>
                <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" /> Live Camera
                </div>
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title="Switch camera"
                  className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur hover:bg-black/70"
                >
                  <SwitchCamera className="size-4" />
                </button>
                {/* Face Alignment Oval Overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-36 rounded-[50%] border-2 border-dashed border-white/40 shadow-sm" />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {capturedImage ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleRetake}
          >
            <RefreshCw className="mr-2 size-4" /> Retake Photo
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isStarting || Boolean(cameraError)}
            onClick={handleCapture}
          >
            <Camera className="mr-2 size-4" /> Capture Selfie
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
