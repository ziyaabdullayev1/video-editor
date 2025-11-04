'use client';

import { useRef, useEffect, useState, RefObject } from 'react';

interface Cut {
  s: number;
  e: number;
}

interface TimelineProps {
  viewStart: number;
  viewEnd: number;
  selEffStart: number;
  selEffEnd: number;
  duration: number; // Add duration as a reactive prop
  effDuration: () => number;
  effSpan: () => number;
  fmtSmart: (t: number) => string;
  onSelectionChange: (start: number, end: number) => void;
  onZoom: (anchorEff: number, factor: number) => void;
  videoARef: RefObject<HTMLVideoElement | null>;
  videoBRef: RefObject<HTMLVideoElement | null>;
  effToReal: (te: number) => number;
  nextCutAfter: (t: number) => Cut | null;
  setIsSeeking: (seeking: boolean) => void;
  setScrubbing: (scrubbing: boolean) => void;
  setWasPlaying: (playing: boolean) => void;
}

const Timeline = ({
  viewStart,
  viewEnd,
  selEffStart,
  selEffEnd,
  duration,
  effDuration,
  effSpan,
  fmtSmart,
  onSelectionChange,
  onZoom,
  videoARef,
  videoBRef,
  effToReal,
  nextCutAfter,
  setIsSeeking,
  setScrubbing,
  setWasPlaying,
}: TimelineProps) => {
  // Debug render counter
  const renderCount = useRef(0);
  renderCount.current += 1;
  
  console.log('🎬 Timeline component rendered (#' + renderCount.current + ') with props:', {
    duration,
    viewStart,
    viewEnd,
    effDuration_result: effDuration()
  });
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const cutZoneRef = useRef<HTMLDivElement>(null);
  const hStartRef = useRef<HTMLDivElement>(null);
  const hEndRef = useRef<HTMLDivElement>(null);
  const lblStartRef = useRef<HTMLDivElement>(null);
  const lblEndRef = useRef<HTMLDivElement>(null);

  // Drag system state - following drag-system-explanation.txt
  const [dragging, setDragging] = useState<string | null>(null);
  const dragStateRef = useRef({ lastUpdate: 0, animFrame: null as number | null });
  const wasPlayingRef = useRef<boolean>(false);

  // Utils
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  // Timeline calculations
  const innerW = () => (timelineRef.current?.clientWidth || 0) - 16;
  const effToX = (e: number) => 8 + ((e - viewStart) / effSpan()) * innerW();
  const xToEff = (x: number) => clamp(viewStart + ((x - 8) / innerW()) * effSpan(), 0, effDuration());

  // Zoom-based precision following drag-system-explanation.txt
  const dragStep = () => {
    const pps = innerW() / effSpan(); // pixels per second
    if (pps >= 1000) return 0.01;    // 10ms precision (very close zoom)
    if (pps >= 500) return 0.05;     // 50ms precision
    if (pps >= 200) return 0.1;      // 100ms precision
    if (pps >= 100) return 0.2;      // 200ms precision
    return 0.5;                      // 500ms precision (far zoom)
  };

  // Active/standby video elements
  const active = () => {
    return videoARef.current?.classList.contains('video-visible') ? videoARef.current : videoBRef.current;
  };

  const standby = () => {
    return active() === videoARef.current ? videoBRef.current : videoARef.current;
  };

  // Live preview with smooth seeking
  const previewAtEff = (eff: number) => {
    const real = effToReal(eff);
    const A = active();
    const B = standby();
    if (!A || !B) return;

    // Use requestAnimationFrame for smoother seeking
    requestAnimationFrame(() => {
      try {
        if (Math.abs(A.currentTime - real) > 0.1) { // Only update if significant change
          A.currentTime = real;
        }
      } catch {}
      
      const nxt = nextCutAfter(real);
      const standbyTarget = nxt ? Math.max(nxt.e, real + (nxt.e - nxt.s)) : real;
      try {
        if (Math.abs(B.currentTime - standbyTarget) > 0.1) {
          B.currentTime = standbyTarget;
        }
      } catch {}
    });
    
    setIsSeeking(true);
  };

  // Place handles
  const placeHandles = () => {
    if (!timelineRef.current || !cutZoneRef.current || !hStartRef.current || !hEndRef.current) return;
    if (!lblStartRef.current || !lblEndRef.current) return;

    const timelineWidth = timelineRef.current.clientWidth;
    const timelinePadding = 8; // Inner padding from CSS
    const visibleWidth = timelineWidth - (timelinePadding * 2);

    // Calculate raw positions
    const sXRaw = effToX(selEffStart);
    const eXRaw = effToX(selEffEnd);

    // Debug handle positioning
    console.log('🎯 Handle positioning:', {
      selEffStart: selEffStart.toFixed(3),
      selEffEnd: selEffEnd.toFixed(3),
      viewStart: viewStart.toFixed(3),
      viewEnd: viewEnd.toFixed(3),
      sXRaw: sXRaw.toFixed(1),
      eXRaw: eXRaw.toFixed(1),
      timelineWidth
    });

    // Clamp positions to stay within visible timeline area
    const minX = timelinePadding;
    const maxX = timelineWidth - timelinePadding;
    
    const sX = Math.max(minX, Math.min(maxX, sXRaw));
    const eX = Math.max(minX, Math.min(maxX, eXRaw));

    const pct = (v: number) => (v / timelineWidth * 100) + '%';

    // Position handles (always visible)
    hStartRef.current.style.left = pct(sX);
    hEndRef.current.style.left = pct(eX);

    // Show visual indicators when handles are clamped
    const startClamped = sXRaw < minX || sXRaw > maxX;
    const endClamped = eXRaw < minX || eXRaw > maxX;

    // Add visual indicators for clamped handles
    if (startClamped) {
      hStartRef.current.classList.add('clamped');
    } else {
      hStartRef.current.classList.remove('clamped');
    }
    
    if (endClamped) {
      hEndRef.current.classList.add('clamped');
    } else {
      hEndRef.current.classList.remove('clamped');
    }

    // Cut zone positioning (can extend beyond visible area)
    const cutZoneLeft = Math.max(0, sXRaw);
    const cutZoneRight = Math.max(0, timelineWidth - eXRaw);
    
    cutZoneRef.current.style.left = pct(cutZoneLeft);
    cutZoneRef.current.style.right = pct(cutZoneRight);

    // Smart label positioning to prevent overlap
    const labelGap = Math.abs(eX - sX);
    const minLabelGap = 80; // Minimum pixels between labels

    // Labels
    lblStartRef.current.textContent = fmtSmart(selEffStart);
    lblEndRef.current.textContent = fmtSmart(selEffEnd);

    // Adjust label positioning when too close
    if (labelGap < minLabelGap) {
      // Stack labels vertically when too close
      lblStartRef.current.style.top = '8px';
      lblEndRef.current.style.top = '28px';
      lblEndRef.current.style.background = 'rgba(20,30,50,0.95)';
    } else {
      // Normal horizontal positioning
      lblStartRef.current.style.top = '8px';
      lblEndRef.current.style.top = '8px';
      lblEndRef.current.style.background = 'rgba(8,17,30,0.95)';
    }
  };

  // Update handles when props change
  useEffect(() => {
    console.log('🔄 Timeline useEffect triggered - updating handles', {
      duration,
      selEffStart,
      selEffEnd,
      viewStart,
      viewEnd
    });
    placeHandles();
  }, [selEffStart, selEffEnd, viewStart, viewEnd, duration]);

  // Handle-specific drag handlers
  const startHandleDrag = (e: React.MouseEvent, dragType: 'start' | 'end') => {
    if (!timelineRef.current) return;
    
    console.log(dragType === 'start' ? '🟢 START handle clicked!' : '🔴 END handle clicked!');
    
    e.preventDefault();
    e.stopPropagation();

    const rect = timelineRef.current.getBoundingClientRect();
    setDragging(dragType);
    setScrubbing(true);
    
    // Store playback state and pause for smooth preview
    wasPlayingRef.current = !active()?.paused;
    setWasPlaying(wasPlayingRef.current);
    if (active()) {
      active()!.pause();
    }
    
    // Initial preview at current handle position
    const initialTime = dragType === 'start' ? selEffStart : selEffEnd;
    if (videoARef.current && videoBRef.current) {
      const realTime = effToReal(initialTime);
      const clampedRealTime = clamp(realTime, 0, duration - 0.001);
      
      try {
        if (videoARef.current.readyState >= 2) {
          videoARef.current.currentTime = clampedRealTime;
          console.log('🎬 Initial preview at:', clampedRealTime.toFixed(3));
        }
      } catch (error) {
        console.warn('⚠️ Initial preview failed:', error);
      }
    }
    
    // Simple drag handler with live preview
    const handleDrag = (ev: MouseEvent) => {
      const x = ev.clientX - rect.left;
      const newTime = xToEff(x);
      
      console.log('📍 Drag to time:', newTime.toFixed(3));
      
      // Throttled live preview
      const now = performance.now();
      if (now - dragStateRef.current.lastUpdate >= 16) {
        dragStateRef.current.lastUpdate = now;
        
        if (videoARef.current && videoBRef.current) {
          const realTime = effToReal(newTime);
          const clampedRealTime = clamp(realTime, 0, duration - 0.001);
          
          try {
            if (videoARef.current.readyState >= 2) {
              videoARef.current.currentTime = clampedRealTime;
            }
          } catch (error) {
            console.warn('⚠️ Live preview failed:', error);
          }
        }
      }
      
      if (dragType === 'start') {
        const newStart = clamp(newTime, 0, selEffEnd - 0.1);
        onSelectionChange(newStart, selEffEnd);
      } else {
        const newEnd = clamp(newTime, selEffStart + 0.1, effDuration());
        onSelectionChange(selEffStart, newEnd);
      }
    };
    
    const handleDragEnd = () => {
      console.log('🏁 Drag ended');
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
      setDragging(null);
      setScrubbing(false);
      
      // Resume playback if it was playing before drag
      if (wasPlayingRef.current && active()) {
        active()!.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.warn('Resume playback error:', err);
          }
        });
        console.log('▶️ Resumed playback after drag');
      }
    };
    
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', handleDragEnd);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    // Always prevent default scroll behavior on timeline
    e.preventDefault();
    e.stopPropagation();
    
    if (!e.ctrlKey || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const anchor = xToEff(e.clientX - rect.left);
    const factor = Math.exp(-e.deltaY * 0.002); // Slightly more sensitive
    onZoom(anchor, factor);
  };

  // Double-click to zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const anchor = xToEff(e.clientX - rect.left);
    onZoom(anchor, 2.0);
  };

  // Update handles when props change
  useEffect(() => {
    placeHandles();
  }, [selEffStart, selEffEnd, viewStart, viewEnd]);

  // Add native wheel event listener for better zoom control
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!e.ctrlKey) return;
      
      const rect = timeline.getBoundingClientRect();
      const anchor = xToEff(e.clientX - rect.left);
      const factor = Math.exp(-e.deltaY * 0.002);
      onZoom(anchor, factor);
    };

    timeline.addEventListener('wheel', wheelHandler, { passive: false });
    
    return () => {
      timeline.removeEventListener('wheel', wheelHandler);
    };
  }, [xToEff, onZoom]);

  // Generate time markings based on zoom level
  const generateTimeMarkings = () => {
    const markings = [];
    const span = effSpan();
    const width = innerW();
    
    // Determine marking interval based on zoom level
    let interval = 10; // Default 10 seconds
    if (span <= 5) interval = 0.5;      // 500ms when very zoomed in
    else if (span <= 10) interval = 1;  // 1s
    else if (span <= 30) interval = 2;  // 2s
    else if (span <= 60) interval = 5;  // 5s
    else if (span <= 300) interval = 10; // 10s
    else if (span <= 600) interval = 30; // 30s
    else interval = 60; // 1 minute
    
    // Generate markings
    const startTime = Math.floor(viewStart / interval) * interval;
    const endTime = Math.ceil(viewEnd / interval) * interval;
    
    for (let time = startTime; time <= endTime; time += interval) {
      if (time >= viewStart && time <= viewEnd) {
        const x = effToX(time);
        const isVisible = x >= 8 && x <= width + 8;
        
        if (isVisible) {
          markings.push(
            <div
              key={time}
              className="timeline-marking"
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: '45px',
                width: '1px',
                height: '15px',
                backgroundColor: '#4a5568',
                fontSize: '9px',
                color: '#a0a0a0'
              }}
            >
              <div style={{ 
                position: 'absolute', 
                top: '16px', 
                left: '50%', 
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontSize: '9px'
              }}>
                {fmtSmart(time)}
              </div>
            </div>
          );
        }
      }
    }
    
    return markings;
  };

  return (
    <div
      ref={timelineRef}
      className="timeline"
      onDoubleClick={handleDoubleClick}
      style={{ touchAction: 'none' }}
    >
      <div className="track"></div>
      {generateTimeMarkings()}
      <div ref={cutZoneRef} className="cutzone"></div>
      <div 
        ref={hStartRef} 
        className="handle" 
        id="hStart"
        onMouseDown={(e) => startHandleDrag(e, 'start')}
      >
        <div ref={lblStartRef} className="label">--:--</div>
      </div>
      <div 
        ref={hEndRef} 
        className="handle" 
        id="hEnd"
        onMouseDown={(e) => startHandleDrag(e, 'end')}
      >
        <div ref={lblEndRef} className="label">--:--</div>
      </div>
    </div>
  );
};

export default Timeline;

