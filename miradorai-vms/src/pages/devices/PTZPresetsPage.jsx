import { useState, useRef, useEffect, useCallback } from "react";
import Button from "../../components/shared/Button";
import { MOCK_CAMERAS } from "../../data/mockData";
import "./PTZPresetsPage.css";

export default function PTZPresetsPage() {
  const [selected, setSelected]   = useState(null);
  const [presets, setPresets]     = useState([
    { id: 1, name: "Home",        pan: 0,   tilt: 0,   zoom: 0,  x: 50, y: 50 },
    { id: 2, name: "Entrance",    pan: -45, tilt: -10, zoom: 20, x: 20, y: 40 },
    { id: 3, name: "Parking Lot", pan: 60,  tilt: -20, zoom: 35, x: 75, y: 65 },
  ]);
  const [selPreset, setSelPreset]   = useState(null);
  const [speed, setSpeed]           = useState(50);
  const [pan, setPan]               = useState(0);
  const [tilt, setTilt]             = useState(0);
  const [zoom, setZoom]             = useState(0);
  const [focus, setFocus]           = useState(50);
  const [activeBtn, setActiveBtn]   = useState(null);
  const [streamActive, setStreamActive] = useState(false);
  const [streamError, setStreamError]   = useState("");
  const [moving, setMoving]         = useState(false);
  const [ctxMenu, setCtxMenu]       = useState(null);
  const [ctxStep, setCtxStep]       = useState("menu");
  const [ctxName, setCtxName]       = useState("");

  const intervalRef  = useRef(null);
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const videoWrapRef = useRef(null);
  const ctxInputRef  = useRef(null);

  const selectedCam = MOCK_CAMERAS.find((c) => c.id === selected);

  useEffect(() => {
    if (!selected) { stopStream(); return; }
    startStream();
    return () => stopStream();
  }, [selected]);

  const startStream = async () => {
    setStreamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
      }
    } catch (err) {
      setStreamError(
        err.name === "NotAllowedError" ? "Camera access denied. Please allow camera permissions." :
        err.name === "NotFoundError"   ? "No camera device found on this system." :
        "Could not access camera."
      );
      setStreamActive(false);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  };

  const step = () => Math.max(1, Math.round(speed / 20));

  const startMove = useCallback((dir) => {
    setActiveBtn(dir);
    const move = () => {
      const s = step();
      if (dir === "up")         setTilt((v) => Math.min(90, v + s));
      if (dir === "down")       setTilt((v) => Math.max(-90, v - s));
      if (dir === "left")       setPan((v)  => Math.max(-180, v - s));
      if (dir === "right")      setPan((v)  => Math.min(180, v + s));
      if (dir === "up-left")    { setTilt((v) => Math.min(90, v + s));  setPan((v) => Math.max(-180, v - s)); }
      if (dir === "up-right")   { setTilt((v) => Math.min(90, v + s));  setPan((v) => Math.min(180, v + s)); }
      if (dir === "down-left")  { setTilt((v) => Math.max(-90, v - s)); setPan((v) => Math.max(-180, v - s)); }
      if (dir === "down-right") { setTilt((v) => Math.max(-90, v - s)); setPan((v) => Math.min(180, v + s)); }
    };
    move();
    intervalRef.current = setInterval(move, 100);
  }, [speed]);

  const stopMove = useCallback(() => {
    setActiveBtn(null);
    clearInterval(intervalRef.current);
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const handleHome = () => { setPan(0); setTilt(0); setZoom(0); setFocus(50); };

  const gotoPreset = (preset) => {
    setSelPreset(preset.id);
    setMoving(true);
    const startPan = pan, startTilt = tilt, startZoom = zoom;
    const duration = 800;
    const startTime = Date.now();
    const animate = () => {
      const elapsed  = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      setPan(Math.round(startPan   + (preset.pan  - startPan)  * ease));
      setTilt(Math.round(startTilt + (preset.tilt - startTilt) * ease));
      setZoom(Math.round(startZoom + (preset.zoom - startZoom) * ease));
      if (progress < 1) requestAnimationFrame(animate);
      else setMoving(false);
    };
    requestAnimationFrame(animate);
  };

  const removePreset = () => {
    setPresets((p) => p.filter((x) => x.id !== selPreset));
    setSelPreset(null);
  };

  const handleVideoRightClick = (e) => {
    e.preventDefault();
    if (!selected || !streamActive) return;
    const rect = videoWrapRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width)  * 100;
    const py = ((e.clientY - rect.top)  / rect.height) * 100;
    setCtxMenu({ screenX: e.clientX - rect.left, screenY: e.clientY - rect.top, videoX: px, videoY: py });
    setCtxStep("menu");
    setCtxName("");
  };

  const handleCtxAddPreset = () => {
    setCtxStep("naming");
    setTimeout(() => ctxInputRef.current?.focus(), 50);
  };

  const handleCtxSavePreset = () => {
    if (!ctxName.trim() || !ctxMenu) return;
    const newPan  = Math.round((ctxMenu.videoX - 50) * 3.6);
    const newTilt = Math.round((50 - ctxMenu.videoY) * 1.8);
    setPresets((p) => [...p, {
      id: Date.now(), name: ctxName.trim(),
      pan: newPan, tilt: newTilt, zoom,
      x: ctxMenu.videoX, y: ctxMenu.videoY,
    }]);
    setCtxMenu(null); setCtxName(""); setCtxStep("menu");
  };

  const handleCtxGoHere = () => {
    if (!ctxMenu) return;
    setPan(Math.round((ctxMenu.videoX - 50) * 3.6));
    setTilt(Math.round((50 - ctxMenu.videoY) * 1.8));
    setCtxMenu(null);
  };

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const videoTransform = `scale(${1 + zoom / 150}) translate(${-pan * 0.15}%, ${tilt * 0.15}%)`;

  function JoystickBtn({ dir, children, label }) {
    return (
      <button
        className={`ptz-joy-btn ${activeBtn === dir ? "ptz-joy-btn--active" : ""}`}
        onMouseDown={() => selected && startMove(dir)}
        onMouseUp={stopMove} onMouseLeave={stopMove}
        onTouchStart={(e) => { e.preventDefault(); selected && startMove(dir); }}
        onTouchEnd={stopMove}
        disabled={!selected} title={label}
      >{children}</button>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">PTZ <span>Presets</span></h1>
          <p className="page-desc">Pan, tilt and zoom cameras. Right-click the live video to drop a preset pin at any position.</p>
        </div>
      </div>

      {/* Camera Table */}
      <div className="card" style={{ overflow: "auto", flexShrink: 0 }}>
        <table className="m-table">
          <thead><tr>{["Camera Name","Model","Server","Type"].map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {MOCK_CAMERAS.map((cam) => {
              const isSel = selected === cam.id;
              return (
                <tr key={cam.id} className={`m-table__row ${isSel ? "m-table__row--selected" : ""}`}
                  onClick={() => setSelected(isSel ? null : cam.id)}>
                  <td className="m-table__primary">{cam.name}</td>
                  <td>{cam.model}</td>
                  <td>{cam.server}</td>
                  <td><span className="ptz-type-badge">{cam.type}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Main PTZ Layout */}
      <div className="ptz-layout">

        {/* Video Preview */}
        <div className="ptz-video-card card">
          {!selected ? (
            <div className="ptz-no-cam">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8">
                <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
              <span>Select a camera to control</span>
            </div>
          ) : (
            <>
              <div className="ptz-video-header">
                <span className="ptz-live-dot" />
                <span className="ptz-cam-name">{selectedCam?.name}</span>
                <span className="ptz-live-tag">{moving ? "MOVING" : "LIVE"}</span>
                <span className="ptz-coord-badge">P {pan > 0 ? "+" : ""}{pan}°</span>
                <span className="ptz-coord-badge">T {tilt > 0 ? "+" : ""}{tilt}°</span>
                <span className="ptz-coord-badge">Z {zoom}%</span>
                {streamActive && <span className="ptz-hint">Right-click video to add preset</span>}
              </div>
              <div className="ptz-video-wrap" ref={videoWrapRef} onContextMenu={handleVideoRightClick}>
                {streamError ? (
                  <div className="ptz-stream-err">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                    </svg>
                    <span>{streamError}</span>
                  </div>
                ) : (
                  <video ref={videoRef} className="ptz-video" autoPlay playsInline muted
                    style={{ transform: videoTransform, transition: moving ? "transform 0.05s linear" : activeBtn ? "none" : "transform 0.4s ease" }} />
                )}

                {streamActive && (
                  <div className="ptz-crosshair">
                    <div className="ptz-ch-h" /><div className="ptz-ch-v" />
                    <div className="ptz-ch-dot" />
                  </div>
                )}

                {/* Preset pins */}
                {streamActive && presets.map((p) => (
                  <div key={p.id}
                    className={`ptz-pin ${selPreset === p.id ? "ptz-pin--active" : ""}`}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    onClick={(e) => { e.stopPropagation(); gotoPreset(p); }}
                    title={`Go to: ${p.name}`}>
                    <div className="ptz-pin__dot" />
                    <div className="ptz-pin__label">{p.name}</div>
                  </div>
                ))}

                {/* Moving indicator */}
                {moving && (
                  <div className="ptz-moving-badge">
                    <div className="ptz-moving-spinner" />
                    Moving to preset...
                  </div>
                )}

                {/* Right-click context menu */}
                {ctxMenu && (
                  <div className="ptz-ctx-menu"
                    style={{ left: ctxMenu.screenX, top: ctxMenu.screenY }}
                    onClick={(e) => e.stopPropagation()}>
                    {ctxStep === "menu" ? (
                      <>
                        <div className="ptz-ctx-header">
                          Position {Math.round(ctxMenu.videoX)}%, {Math.round(ctxMenu.videoY)}%
                        </div>
                        <button className="ptz-ctx-item" onClick={handleCtxAddPreset}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                          Add Preset Here
                        </button>
                        <button className="ptz-ctx-item" onClick={handleCtxGoHere}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                          Move Camera Here
                        </button>
                        <button className="ptz-ctx-item ptz-ctx-item--cancel" onClick={() => setCtxMenu(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="ptz-ctx-header">Name this preset</div>
                        <div className="ptz-ctx-input-row">
                          <input ref={ctxInputRef} className="ptz-ctx-input"
                            placeholder="e.g. Front Gate"
                            value={ctxName}
                            onChange={(e) => setCtxName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCtxSavePreset();
                              if (e.key === "Escape") setCtxMenu(null);
                            }} />
                        </div>
                        <div className="ptz-ctx-actions">
                          <button className="ptz-ctx-save" onClick={handleCtxSavePreset} disabled={!ctxName.trim()}>
                            Save Preset
                          </button>
                          <button className="ptz-ctx-item ptz-ctx-item--cancel" onClick={() => setCtxMenu(null)}>
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {streamActive && (
                  <div className="ptz-video-overlay">{selectedCam?.name} · {selectedCam?.model}</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Controls Column */}
        <div className="ptz-controls-col">
          <div className="ptz-joystick-card card">
            <div className="ptz-joy-title">Pan / Tilt</div>
            <div className="ptz-joy-grid">
              <JoystickBtn dir="up-left"    label="Up-Left">↖</JoystickBtn>
              <JoystickBtn dir="up"         label="Up">▲</JoystickBtn>
              <JoystickBtn dir="up-right"   label="Up-Right">↗</JoystickBtn>
              <JoystickBtn dir="left"       label="Left">◀</JoystickBtn>
              <button className="ptz-joy-home" onClick={handleHome} disabled={!selected} title="Home">⌂</button>
              <JoystickBtn dir="right"      label="Right">▶</JoystickBtn>
              <JoystickBtn dir="down-left"  label="Down-Left">↙</JoystickBtn>
              <JoystickBtn dir="down"       label="Down">▼</JoystickBtn>
              <JoystickBtn dir="down-right" label="Down-Right">↘</JoystickBtn>
            </div>
          </div>

          <div className="ptz-sliders-card card">
            {[
              { label: "Zoom",  value: zoom,  onChange: setZoom,  min: 0,    max: 100, color: "#00c8a0", icon: "⊕" },
              { label: "Focus", value: focus, onChange: setFocus, min: 0,    max: 100, color: "#4d9fff", icon: "◎" },
              { label: "Pan",   value: pan,   onChange: setPan,   min: -180, max: 180, color: "#ffb340", icon: "↔" },
              { label: "Tilt",  value: tilt,  onChange: setTilt,  min: -90,  max: 90,  color: "#c084fc", icon: "↕" },
            ].map(({ label, value, onChange, min, max, color, icon }) => (
              <div key={label} className="ptz-slider-row">
                <span className="ptz-slider-icon" style={{ color }}>{icon}</span>
                <span className="ptz-slider-label">{label}</span>
                <button className="ptz-arrow-btn" onClick={() => selected && onChange((v) => Math.max(min, v - 5))} disabled={!selected}>‹</button>
                <div className="ptz-slider-wrap">
                  <input type="range" min={min} max={max} value={value} disabled={!selected}
                    onChange={(e) => onChange(Number(e.target.value))}
                    style={{ accentColor: color }} className="ptz-slider" />
                </div>
                <button className="ptz-arrow-btn" onClick={() => selected && onChange((v) => Math.min(max, v + 5))} disabled={!selected}>›</button>
                <span className="ptz-slider-val" style={{ color }}>
                  {value > 0 && label !== "Zoom" && label !== "Focus" ? "+" : ""}{value}{label === "Zoom" || label === "Focus" ? "%" : "°"}
                </span>
              </div>
            ))}
            <div className="ptz-divider" />
            <div className="ptz-slider-row">
              <span className="ptz-slider-icon" style={{ color: "#8892a4" }}>⚡</span>
              <span className="ptz-slider-label">Speed</span>
              <button className="ptz-arrow-btn" onClick={() => setSpeed((v) => Math.max(1, v - 10))}>‹</button>
              <div className="ptz-slider-wrap">
                <input type="range" min={1} max={100} value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  style={{ accentColor: "#8892a4" }} className="ptz-slider" />
              </div>
              <button className="ptz-arrow-btn" onClick={() => setSpeed((v) => Math.min(100, v + 10))}>›</button>
              <span className="ptz-slider-val" style={{ color: "#8892a4" }}>{speed}%</span>
            </div>
          </div>
        </div>

        {/* Presets Panel */}
        <div className="ptz-presets-card card">
          <div className="ptz-presets-title">
            Saved Presets
            <span className="ptz-presets-count">{presets.length}</span>
          </div>
          <div className="ptz-presets-list">
            {presets.length === 0 && (
              <div className="ptz-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                Right-click the video to add presets
              </div>
            )}
            {presets.map((p) => (
              <div key={p.id}
                className={`ptz-preset-item ${selPreset === p.id ? "ptz-preset-item--active" : ""}`}
                onClick={() => gotoPreset(p)}>
                <div className="ptz-preset-pin" />
                <div className="ptz-preset-info">
                  <span className="ptz-preset-name">{p.name}</span>
                  <span className="ptz-preset-coords">P{p.pan > 0 ? "+" : ""}{p.pan}° T{p.tilt > 0 ? "+" : ""}{p.tilt}° Z{p.zoom}%</span>
                </div>
                {selPreset === p.id && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </div>
            ))}
          </div>
          <div className="ptz-presets-actions">
            <Button label="Go To" variant="primary" disabled={!selPreset || !selected}
              onClick={() => { const p = presets.find(x => x.id === selPreset); if (p) gotoPreset(p); }} />
            <Button label="Remove" variant="danger" disabled={!selPreset} onClick={removePreset} />
          </div>
          <div className="ptz-presets-tip">
            💡 Right-click the live video to place a preset pin at any position
          </div>
        </div>

      </div>
    </div>
  );
}