'use client';

import { useRef, useEffect, useState, RefObject } from 'react';

interface Cut {
  s: number;
  e: number;
}

interface VideoPlayerProps {
  videoARef: RefObject<HTMLVideoElement | null>;
  videoBRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  effDuration: () => number;
  realToEff: (t: number) => number;
  effToReal: (te: number) => number;
  nextCutAfter: (t: number) => Cut | null;
  fmtSmart: (t: number) => string;
  started: boolean;
  setStarted: (started: boolean) => void;
  isSeeking: boolean;
  setIsSeeking: (seeking: boolean) => void;
}

const VideoPlayer = ({
  videoARef,
  videoBRef,
  videoUrl,
  effDuration,
  realToEff,
  effToReal,
  nextCutAfter,
  fmtSmart,
  started,
  setStarted,
  isSeeking,
  setIsSeeking,
}: VideoPlayerProps) => {
  const seekRef = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Utils
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  // Active/standby layers
  const active = () => {
    return videoARef.current?.classList.contains('video-visible') ? videoARef.current : videoBRef.current;
  };

  // Play/pause
  const handlePlayPause = async () => {
    if (!started) {
      setStarted(true);
    }
    const A = active();
    const B = videoARef.current === A ? videoBRef.current : videoARef.current;
    if (!A || !B) return;

    if (A.paused) {
      // Handle play() promises to avoid AbortError
      A.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.warn('Video A play error:', err);
        }
      });
      B.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.warn('Video B play error:', err);
        }
      });
    } else {
      videoARef.current?.pause();
      videoBRef.current?.pause();
    }
  };

  // Mute/unmute
  const handleMute = () => {
    if (!videoARef.current || !videoBRef.current) return;
    const mute = !(videoARef.current.muted && videoBRef.current.muted);
    videoARef.current.muted = videoBRef.current.muted = mute;
  };

  // Seek handling
  const handleSeekInput = () => {
    if (!seekRef.current) return;
    setIsSeeking(true);
    const effVal = parseFloat(seekRef.current.value);
    const real = effToReal(effVal);
    const A = active();
    const B = videoARef.current === A ? videoBRef.current : videoARef.current;
    if (!A || !B) return;

    try {
      A.currentTime = real;
    } catch {}
    const nxt = nextCutAfter(real);
    const standbyTarget = nxt ? Math.max(nxt.e, real + (nxt.e - nxt.s)) : real;
    try {
      B.currentTime = standbyTarget;
    } catch {}
  };

  const handleSeekChange = () => {
    setIsSeeking(false);
  };

  // Initialize video visibility states
  useEffect(() => {
    if (videoARef.current && videoBRef.current) {
      // Ensure initial visibility states are correct
      videoARef.current.classList.add('video-visible');
      videoARef.current.classList.remove('video-hidden');
      videoBRef.current.classList.add('video-hidden');
      videoBRef.current.classList.remove('video-visible');
      
      console.log('Video elements initialized:', {
        videoA: videoARef.current.className,
        videoB: videoBRef.current.className
      });
    }
  }, []);

  // UI tick (effective axis)
  useEffect(() => {
    const uiTick = () => {
      const A = active();
      if (!A) return;
      
      const tReal = A.currentTime || 0;
      const eff = realToEff(tReal);
      const eDur = effDuration();
      
      setCurrentTime(eff);
      setTotalTime(eDur);
      
      if (!isSeeking && seekRef.current) {
        seekRef.current.max = eDur.toFixed(3);
        seekRef.current.value = clamp(eff, 0, eDur).toFixed(3);
      }
      
      requestAnimationFrame(uiTick);
    };
    
    const animationId = requestAnimationFrame(uiTick);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [active, realToEff, effDuration, isSeeking]);

  return (
    <div className="relative bg-black border rounded-[12px] overflow-hidden" style={{ borderColor: 'var(--bd)' }}>
      <div className="video-container">
        <video
          ref={videoARef}
          className="video-layer video-visible"
          src={videoUrl}
          preload="auto"
          playsInline
          controls={false}
          style={{ display: 'block' }}
          onError={(e) => {
            const video = e.target as HTMLVideoElement;
            console.error('Video A loading error:', {
              error: e,
              target: video,
              src: video?.src,
              readyState: video?.readyState,
              networkState: video?.networkState
            });
            setVideoError('Video A yüklenirken hata oluştu');
          }}
          onLoadedData={() => {
            console.log('Video A loaded successfully');
            setVideoLoaded(true);
            setVideoError(null);
          }}
        />
        <video
          ref={videoBRef}
          className="video-layer video-hidden"
          src={videoUrl}
          preload="auto"
          playsInline
          controls={false}
          style={{ display: 'block' }}
          onError={(e) => {
            const video = e.target as HTMLVideoElement;
            console.error('Video B loading error:', {
              error: e,
              target: video,
              src: video?.src,
              readyState: video?.readyState,
              networkState: video?.networkState
            });
            setVideoError('Video B yüklenirken hata oluştu');
          }}
          onLoadedData={() => {
            console.log('Video B loaded successfully');
          }}
        />
        
        {/* Loading/Error overlay */}
        {!videoLoaded && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-white text-center">
              <div className="mb-2">Video yükleniyor...</div>
              <div className="animate-pulse">⏳</div>
            </div>
          </div>
        )}
        
        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-red-400 text-center">
              <div className="mb-2">❌ {videoError}</div>
              <div className="text-sm">Video dosyasının mevcut olduğundan emin olun.</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="panel flex items-center gap-3 mt-0 flex-wrap">
        <button onClick={handlePlayPause} className="btn">
          ▶︎ / ❚❚
        </button>
        <span className="pill">
          Zaman: <span className="time">{fmtSmart(currentTime)}</span> / <span className="time">{fmtSmart(totalTime)}</span>
        </span>
        <input
          ref={seekRef}
          type="range"
          min="0"
          max="60"
          step="0.01"
          defaultValue="0"
          onInput={handleSeekInput}
          onChange={handleSeekChange}
          className="flex-1 min-w-[240px]"
        />
        <button onClick={handleMute} className="btn">
          🔊/🔇
        </button>
      </div>
    </div>
  );
};

export default VideoPlayer;

