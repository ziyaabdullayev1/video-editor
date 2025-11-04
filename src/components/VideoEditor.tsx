'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './VideoPlayer';
import Timeline from './Timeline';
import CutsList from './CutsList';
import ZoomControls from './ZoomControls';
import VideoUpload from './VideoUpload';

interface Cut {
  s: number; // start time in seconds
  e: number; // end time in seconds
}

const VideoEditor = () => {
  // Video refs
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  // State
  const [duration, setDuration] = useState(60);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [started, setStarted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [wasPlaying, setWasPlaying] = useState(false);
  
  // Video upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>(''); // Will be set from URL or default
  const [videoSource, setVideoSource] = useState<'file' | 'url'>('url'); // Track video source
  
  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  // Selection on effective axis
  const [selEffStart, setSelEffStart] = useState(0.0);
  const [selEffEnd, setSelEffEnd] = useState(5.0);

  // Zoom (effective axis window)
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(60);
  const minSpan = 0.1; // minimum zoom span (100ms)

  // Constants
  const FADE_MS = 150;

  // Utils
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  // Enhanced time formatting with millisecond precision
  const fmt = (t: number, showMs = false) => {
    t = Math.max(0, t);
    const totalMs = Math.round(t * 1000);
    const m = Math.floor(totalMs / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    if (showMs) {
      return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms < 100 ? '0' : ''}${
        ms < 10 ? '0' : ''
      }${ms}`;
    } else {
      return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
  };

  // Smart formatting based on zoom level
  const fmtSmart = (t: number) => {
    const span = effSpan();
    const showMs = span <= 10; // Show milliseconds when zoomed to 10s or less
    return fmt(t, showMs);
  };

  // Normalize cuts (merge overlapping cuts)
  const normalizeCuts = (arr: Cut[]): Cut[] => {
    if (arr.length === 0) return [];

    // Sort by start time
    arr.sort((a, b) => a.s - b.s);

    const merged = [];
    let current = { ...arr[0] };

    for (let i = 1; i < arr.length; i++) {
      const next = arr[i];

      // If current cut overlaps or touches the next cut (with small tolerance)
      if (current.e >= next.s - 1e-3) {
        // Merge: extend current cut to include next cut
        current.e = Math.max(current.e, next.e);
      } else {
        // No overlap: add current to result and start new current
        merged.push(current);
        current = { ...next };
      }
    }

    // Don't forget the last cut
    merged.push(current);

    return merged;
  };

  const totalCutLen = () => cuts.reduce((a, c) => a + (c.e - c.s), 0);
  // Keep timeline duration fixed at original video length
  const effDuration = () => duration; // Always return original duration
  
  // Effective duration after cuts (for video player)
  const effDurationAfterCuts = () => {
    return Math.max(0, duration - totalCutLen());
  };

  // VIDEO PLAYER time conversion (Real video time <-> Player effective time)
  const realToPlayerEff = (t: number) => {
    let shift = 0;
    for (const c of cuts) {
      const len = c.e - c.s;
      if (t >= c.e) shift += len;
      else if (t > c.s) return c.s - shift;
      else break;
    }
    return t - shift;
  };

  const playerEffToReal = (te: number) => {
    let shift = 0;
    for (const c of cuts) {
      const len = c.e - c.s;
      const effStart = c.s - shift;
      if (te >= effStart) shift += len;
      else break;
    }
    return te + shift;
  };

  // TIMELINE functions (identity since timeline shows real time)
  const realToEff = (t: number) => t; // Timeline time = Real time
  const effToReal = (te: number) => te; // Timeline time = Real time

  const nextCutAfter = (t: number): Cut | null => {
    for (const c of cuts) {
      if (t < c.e) {
        if (t < c.s) return c;
        if (t >= c.s && t < c.e) return c;
      }
    }
    return null;
  };

  // Zoom functions
  const effSpan = () => Math.max(minSpan, viewEnd - viewStart);

  const resetViewToAll = () => {
    setViewStart(0);
    setViewEnd(effDuration());
  };

  const zoomAt = (anchorEff: number, factor: number) => {
    const span = effSpan();
    let newSpan = clamp(span / factor, minSpan, Math.max(minSpan, effDuration()));
    let leftRatio = (anchorEff - viewStart) / span;
    leftRatio = clamp(leftRatio, 0, 1);
    const newViewStart = clamp(
      anchorEff - leftRatio * newSpan,
      0,
      Math.max(0, effDuration() - newSpan)
    );
    setViewStart(newViewStart);
    setViewEnd(newViewStart + newSpan);
  };

  const zoomToSelection = () => {
    if (selEffEnd - selEffStart < 0.1) return;
    const padding = Math.max(0.5, (selEffEnd - selEffStart) * 0.1);
    setViewStart(Math.max(0, selEffStart - padding));
    setViewEnd(Math.min(effDuration(), selEffEnd + padding));
  };

  const zoomToTimeSpan = (seconds: number) => {
    const center = (selEffStart + selEffEnd) / 2;
    const halfSpan = seconds / 2;
    setViewStart(clamp(center - halfSpan, 0, Math.max(0, effDuration() - seconds)));
    setViewEnd(clamp(viewStart + seconds, seconds, effDuration()));
  };

  // Active/standby layers
  const active = () => {
    return videoARef.current?.classList.contains('video-visible') ? videoARef.current : videoBRef.current;
  };

  const standby = () => {
    return active() === videoARef.current ? videoBRef.current : videoARef.current;
  };

  const show = (el: HTMLVideoElement | null) => {
    if (!el) return;
    el.classList.remove('video-hidden');
    el.classList.add('video-visible');
  };

  const hide = (el: HTMLVideoElement | null) => {
    if (!el) return;
    el.classList.remove('video-visible');
    el.classList.add('video-hidden');
  };

  // Volume crossfade + visual crossfade
  const crossToStandby = () => {
    const from = active();
    const to = standby();
    if (!from || !to) return;

    // Visual
    show(to);
    hide(from);

    // Audio: 150ms volume ramp
    const t0 = performance.now();
    const fromStart = from.volume;
    const toStart = to.volume;
    // Handle play() promise to avoid AbortError
    to.play().catch(err => {
      if (err.name !== 'AbortError') {
        console.warn('Video play error:', err);
      }
    });

    const step = (ts: number) => {
      const k = Math.min(1, (ts - t0) / FADE_MS);
      
      // Clamp volumes to valid range [0, 1]
      const newFromVolume = fromStart * (1 - k);
      const newToVolume = toStart + (1 - toStart) * k;
      
      from.volume = Math.max(0, Math.min(1, newFromVolume));
      to.volume = Math.max(0, Math.min(1, newToVolume));
      
      // Debug volume issues
      if (newFromVolume > 1 || newToVolume > 1) {
        console.log('🔊 Volume out of range!', {
          fromStart, toStart, k, newFromVolume, newToVolume
        });
      }
      
      if (k < 1) requestAnimationFrame(step);
      else {
        try {
          from.pause();
        } catch {}
      }
    };
    requestAnimationFrame(step);
  };

  // Skip while playing
  const tickSkip = () => {
    console.log('🔔 tickSkip called! cuts.length =', cuts.length); // Debug
    
    const A = active();
    const B = standby();
    if (!A || !B) return;

    const t = A.currentTime || 0;
    console.log('⏰ Current time:', t.toFixed(3)); // Debug
    
    const cut = nextCutAfter(t);
    
    if (!cut) {
      // No cuts to skip
      console.log('❌ No cuts found for time', t.toFixed(3)); // Debug
      return;
    }

    console.log('⏩ tickSkip: time =', t.toFixed(3), 'cut =', cut.s.toFixed(3), '-', cut.e.toFixed(3)); // Debug

    const len = cut.e - cut.s;
    if (t >= cut.s - 0.4) {
      try {
        B.currentTime = Math.max(cut.e, t + len);
        console.log('📺 Prepared standby at:', B.currentTime.toFixed(3)); // Debug
      } catch {}
    }
    if (t >= cut.s && t < cut.e) {
      console.log('🚀 SKIPPING CUT! Jumping from', t.toFixed(3), 'to', cut.e.toFixed(3)); // Debug
      try {
        B.currentTime = Math.max(B.currentTime || 0, cut.e);
      } catch {}
      if (!A.paused) {
        B.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.warn('Video play error during cut skip:', err);
          }
        });
      }
      crossToStandby();
    }
  };

  // Add cut
  const addCut = () => {
    console.log('✂️ Cut button clicked!'); // Debug
    console.log('Current cuts:', cuts); // Debug
    console.log('Selection:', selEffStart, 'to', selEffEnd); // Debug
    
    if (selEffEnd - selEffStart < 0.05) {
      console.log('❌ Selection too small for cut'); // Debug
      return;
    }

    // Convert effective selection to real time
    console.log('🎬 Converting effective to real time:'); // Debug
    console.log('  Effective selection:', selEffStart.toFixed(3), 'to', selEffEnd.toFixed(3)); // Debug
    
    const realStart = effToReal(selEffStart);
    const realEnd = effToReal(selEffEnd);
    
    console.log('  Real time result:', realStart.toFixed(3), 'to', realEnd.toFixed(3)); // Debug

    // Check if this cut already exists
    const existingCut = cuts.find(c => 
      Math.abs(c.s - realStart) < 0.1 && Math.abs(c.e - realEnd) < 0.1
    );
    
    if (existingCut) {
      console.log('⚠️ Cut already exists!', existingCut); // Debug
      return;
    }

    // Add new cut
    const newCuts = [...cuts, { s: realStart, e: realEnd }];
    console.log('📝 New cuts array:', newCuts); // Debug

    // Normalize and merge overlapping cuts
    const normalizedCuts = normalizeCuts(newCuts);
    console.log('🎬 Before setCuts - old cuts:', cuts.length); // Debug
    console.log('🎬 Setting new cuts:', normalizedCuts); // Debug
    setCuts(normalizedCuts);

    // Reset video position with better error handling
    if (videoARef.current && videoBRef.current) {
      console.log('🔄 Resetting video position after cut'); // Debug
      
      show(videoARef.current);
      hide(videoBRef.current);
      videoARef.current.volume = 1;
      videoBRef.current.volume = 0;

      const real = clamp(effToReal(0), 0, duration - 0.001);
      console.log('🎯 Setting video position to:', real); // Debug
      
      // More robust currentTime setting
      try {
        if (videoARef.current.readyState >= 2) { // HAVE_CURRENT_DATA
          videoARef.current.currentTime = real;
        } else {
          console.log('⚠️ Video A not ready, skipping currentTime set'); // Debug
        }
      } catch (error) {
        console.warn('⚠️ Failed to set video A currentTime:', error);
      }
      
      const nxt = nextCutAfter(real);
      const standbyTarget = nxt ? Math.max(nxt.e, real + (nxt.e - nxt.s)) : real;
      
      try {
        if (videoBRef.current.readyState >= 2) { // HAVE_CURRENT_DATA
          videoBRef.current.currentTime = standbyTarget;
        } else {
          console.log('⚠️ Video B not ready, skipping currentTime set'); // Debug
        }
      } catch (error) {
        console.warn('⚠️ Failed to set video B currentTime:', error);
      }
    }

    // Update view
    const newViewStart = clamp(viewStart, 0, Math.max(0, effDuration() - effSpan()));
    const newViewEnd = clamp(newViewStart + effSpan(), minSpan, effDuration());
    setViewStart(newViewStart);
    setViewEnd(newViewEnd);
    defaultSelection();
  };

  // Clear all cuts
  const clearAllCuts = () => {
    if (!window.confirm(`Tüm ${cuts.length} kesimi geri almak istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setCuts([]);

    // Reset video position
    if (videoARef.current && videoBRef.current) {
      show(videoARef.current);
      hide(videoBRef.current);
      videoARef.current.volume = 1;
      videoBRef.current.volume = 0;
      try {
        videoARef.current.currentTime = 0;
        videoBRef.current.currentTime = 0;
      } catch {}
    }

    resetViewToAll();
    defaultSelection();
  };

  // Remove specific cut
  const removeCut = (index: number) => {
    const cut = cuts[index];
    if (!window.confirm(`${cut.s.toFixed(1)}s - ${cut.e.toFixed(1)}s aralığındaki kesimi geri almak istediğinize emin misiniz?`)) {
      return;
    }

    const newCuts = cuts.filter((_, i) => i !== index);
    setCuts(normalizeCuts(newCuts));

    // Reset video position
    if (videoARef.current && videoBRef.current) {
      show(videoARef.current);
      hide(videoBRef.current);
      videoARef.current.volume = 1;
      videoBRef.current.volume = 0;
      try {
        videoARef.current.currentTime = 0;
        videoBRef.current.currentTime = 0;
      } catch {}
    }

    resetViewToAll();
    defaultSelection();
  };

  // Default selection after layout/changes
  const defaultSelection = () => {
    const eDur = effDuration();
    if (eDur <= 0) {
      setSelEffStart(0);
      setSelEffEnd(0.5);
      return;
    }
    const w = Math.min(5, Math.max(1, eDur * 0.1));
    const newSelStart = clamp(viewStart + (effSpan() - w) / 2, viewStart, viewEnd - w);
    setSelEffStart(newSelStart);
    setSelEffEnd(newSelStart + w);
  };

  // Video upload handlers
  const handleVideoSelect = (file: File) => {
    console.log('🎬 New video selected:', file.name);
    
    // Clean up previous video URL if it was a blob
    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }
    
    // Create new video URL
    const newVideoUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(newVideoUrl);
    setVideoSource('file');
    
    // Reset editor state
    setCuts([]);
    setStarted(false);
    setIsSeeking(false);
    setScrubbing(false);
    setWasPlaying(false);
    
    console.log('✅ Video upload complete, URL:', newVideoUrl);
  };

  const handleClearVideo = () => {
    console.log('🗑️ Clearing video');
    
    // Clean up blob URL
    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }
    
    // Reset to default
    setVideoFile(null);
    setVideoUrl('/video.mp4');
    
    // Reset editor state
    setCuts([]);
    setStarted(false);
    setIsSeeking(false);
    setScrubbing(false);
    setWasPlaying(false);
    
    console.log('✅ Video cleared, back to default');
  };

  // Export video with cuts
  const handleExportVideo = async () => {
    if (!videoUrl || cuts.length === 0) {
      alert('Önce video yükleyin ve en az bir kesim yapın!');
      return;
    }

    if (!window.confirm(`${cuts.length} kesim uygulanarak video dışa aktarılsın mı?`)) {
      return;
    }

    setExporting(true);
    setExportProgress('Video işleniyor...');

    try {
      console.log('🎬 Starting export...', { videoUrl, cuts });

      const response = await fetch('/api/export-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: videoUrl,
          cuts: cuts,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      const result = await response.json();
      console.log('✅ Export successful:', result);

      setExportProgress('İndiriliyor...');

      // Download the file
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportProgress('');
      alert('✅ Video başarıyla dışa aktarıldı ve indirildi!');

    } catch (error: any) {
      console.error('❌ Export error:', error);
      alert('❌ Video dışa aktarılamadı: ' + error.message);
      setExportProgress('');
    } finally {
      setExporting(false);
    }
  };

  // Initialize on metadata load
  const onMeta = () => {
    const dur = (videoARef.current?.duration && isFinite(videoARef.current.duration))
      ? videoARef.current.duration
      : (videoBRef.current?.duration || 60);
    
    console.log('📊 Video metadata loaded:', {
      videoUrl: videoUrl.substring(0, 50) + '...',
      duration: dur,
      videoA_duration: videoARef.current?.duration,
      videoB_duration: videoBRef.current?.duration,
      previousDuration: duration // Show previous duration
    });
    
    console.log('🔄 Setting new duration:', dur, '(was:', duration, ')');
    setDuration(dur);
    setViewStart(0);
    setViewEnd(dur); // Use the actual duration value, not the function
    
    // Reset selection to fit new duration
    const w = Math.min(5, Math.max(1, dur * 0.1));
    const newSelStart = clamp(0, 0, dur - w);
    setSelEffStart(newSelStart);
    setSelEffEnd(newSelStart + w);
    console.log('🎯 Selection reset to:', newSelStart.toFixed(3), '-', (newSelStart + w).toFixed(3));
  };

  // Setup initial video state (removed duplicate event listeners)
  useEffect(() => {
    const vA = videoARef.current;
    const vB = videoBRef.current;

    if (vA && vB) {
      console.log('🎬 Setting up initial video state');
      
      // Setup initial state only
      vA.muted = vB.muted = false;
      vA.volume = 1;
      vB.volume = 0;
    }
  }, []); // Only run once on mount

  // Handle video URL changes and setup event listeners
  useEffect(() => {
    console.log('🎬 Video URL changed:', videoUrl);
    console.log('🎬 Current duration state:', duration);
    
    const vA = videoARef.current;
    const vB = videoBRef.current;
    
    if (vA && vB) {
      console.log('🔄 Setting up videos with new URL');
      
      // Setup event listeners first
      const handleMeta = () => {
        console.log('🎵 loadedmetadata event fired!');
        onMeta();
      };
      const handleSkip = () => tickSkip();
      
      // Add event listeners
      vA.addEventListener('loadedmetadata', handleMeta);
      vB.addEventListener('loadedmetadata', handleMeta);
      vA.addEventListener('timeupdate', handleSkip);
      vB.addEventListener('timeupdate', handleSkip);
      vA.addEventListener('playing', handleSkip);
      vB.addEventListener('playing', handleSkip);
      
      // Force reload to trigger metadata loading
      console.log('🔄 Forcing video reload');
      vA.load();
      vB.load();
      
      // Cleanup function
      return () => {
        console.log('🧹 Cleaning up video event listeners');
        vA.removeEventListener('loadedmetadata', handleMeta);
        vB.removeEventListener('loadedmetadata', handleMeta);
        vA.removeEventListener('timeupdate', handleSkip);
        vB.removeEventListener('timeupdate', handleSkip);
        vA.removeEventListener('playing', handleSkip);
        vB.removeEventListener('playing', handleSkip);
        
        // Don't revoke blob URL here - it might still be needed
        // Blob URL cleanup is handled in component unmount
      };
    } else {
      console.log('❌ Video elements not ready yet');
    }
  }, [videoUrl, cuts]); // Include cuts to refresh event listeners

  // Cleanup blob URL only on unmount
  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith('blob:')) {
        console.log('🧹 Final cleanup: revoking blob URL');
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, []); // Empty dependency - only on unmount

  // Load video from URL query parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathParam = params.get('path');
    
    if (pathParam) {
      console.log('🔗 Video path from URL:', pathParam);
      
      let fullVideoUrl = pathParam;
      
      // Check if it's already a full URL (starts with http:// or https://)
      if (pathParam.startsWith('http://') || pathParam.startsWith('https://')) {
        // Already a full URL, use as-is
        fullVideoUrl = pathParam;
        console.log('🌐 Full URL provided:', fullVideoUrl);
      } else if (pathParam.startsWith('/outputs/')) {
        // Relative path from recorder app - construct full URL
        const recorderDomain = 'https://boenrecord.boencv.com';
        fullVideoUrl = `${recorderDomain}${pathParam}`;
        console.log('🎬 Loading from recorder app:', fullVideoUrl);
      } else if (pathParam.startsWith('/')) {
        // Local path (relative to video editor server)
        fullVideoUrl = pathParam;
        console.log('📁 Local path:', fullVideoUrl);
      } else {
        // Assume it's a relative path, add leading slash
        fullVideoUrl = `/${pathParam}`;
        console.log('📝 Relative path converted:', fullVideoUrl);
      }
      
      setVideoUrl(fullVideoUrl);
      setVideoSource('url');
      console.log('✅ Video URL set from query string:', fullVideoUrl);
    } else {
      // Default video if no query parameter
      console.log('📺 No path parameter, using default video');
      setVideoUrl('/video.mp4');
      setVideoSource('url');
    }
  }, []); // Only run once on mount

  return (
    <div className="w-full mx-auto px-4" style={{ maxWidth: '1200px', marginTop: '28px', overflowX: 'auto' }}>
      <h1 className="mb-3 text-lg font-bold">
        Timeline'da aralık seç → <em>Kes</em> (listeden geri al) • Sürüklerken CANLI önizleme • Sesli cross-fade • Gelişmiş Zoom (10ms hassasiyet)
      </h1>

      {/* Video Upload */}
      <VideoUpload
        onVideoSelect={handleVideoSelect}
        currentVideo={videoFile ? videoFile.name : (videoSource === 'url' && videoUrl && videoUrl !== '/video.mp4' ? videoUrl : null)}
        onClearVideo={handleClearVideo}
        videoSource={videoSource}
      />

      {/* Timeline + Zoom - Full width */}
      <div className="panel mb-4">
        <div className="flex justify-between items-center flex-wrap mb-4" style={{ gap: '12px' }}>
          <div className="flex items-center flex-wrap" style={{ gap: '12px' }}>
            <button onClick={addCut} className="btn btn-ok">
              ➕ Bu aralığı <strong>Kes</strong>
            </button>
            <span className="pill">
              Seçim: <span className="time">{fmtSmart(selEffStart)}</span> → <span className="time">{fmtSmart(selEffEnd)}</span>
              <small style={{ marginLeft: '8px', opacity: 0.7 }}>
                ({(selEffEnd - selEffStart).toFixed(2)}s)
              </small>
            </span>
          </div>
          
          <ZoomControls
            viewStart={viewStart}
            viewEnd={viewEnd}
            selEffStart={selEffStart}
            selEffEnd={selEffEnd}
            effDuration={effDuration()}
            effSpan={effSpan()}
            onZoomFit={resetViewToAll}
            onZoomIn={() => zoomAt((selEffStart + selEffEnd) / 2, 1.5)}
            onZoomOut={() => zoomAt((selEffStart + selEffEnd) / 2, 1 / 1.5)}
            onZoomSelection={zoomToSelection}
            onZoomToTimeSpan={zoomToTimeSpan}
          />
        </div>

        <Timeline
          viewStart={viewStart}
          viewEnd={viewEnd}
          selEffStart={selEffStart}
          selEffEnd={selEffEnd}
          duration={duration}
          effDuration={effDuration}
          effSpan={effSpan}
          fmtSmart={fmtSmart}
          onSelectionChange={(start, end) => {
            setSelEffStart(start);
            setSelEffEnd(end);
          }}
          onZoom={zoomAt}
          videoARef={videoARef}
          videoBRef={videoBRef}
          effToReal={effToReal}
          nextCutAfter={nextCutAfter}
          setIsSeeking={setIsSeeking}
          setScrubbing={setScrubbing}
          setWasPlaying={setWasPlaying}
        />
      </div>

      {/* Player and Cuts side by side */}
      <div className="grid grid-responsive" style={{ 
        gridTemplateColumns: '1fr 340px', 
        gap: '16px'
      }}>
        {/* Player - Left column (1fr) */}
        <div>
        <VideoPlayer
          videoARef={videoARef}
          videoBRef={videoBRef}
          videoUrl={videoUrl}
          effDuration={effDurationAfterCuts} // ✅ Use effective duration after cuts
          realToEff={realToPlayerEff} // ✅ Use player-specific conversion
          effToReal={playerEffToReal} // ✅ Use player-specific conversion
          nextCutAfter={nextCutAfter}
          fmtSmart={fmtSmart}
          started={started}
          setStarted={setStarted}
          isSeeking={isSeeking}
          setIsSeeking={setIsSeeking}
        />
        </div>

        {/* Cuts list - Right column (340px) */}
        <div style={{ width: '340px' }}>
          <CutsList
            cuts={cuts}
            fmt={fmt}
            onRemoveCut={removeCut}
            onClearAll={clearAllCuts}
            onExport={handleExportVideo}
            exporting={exporting}
            exportProgress={exportProgress}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;

