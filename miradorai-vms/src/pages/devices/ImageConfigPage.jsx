import { useState, useRef, useEffect } from "react";
import Toggle from "../../components/shared/Toggle";
import Button from "../../components/shared/Button";
import SearchBar from "../../components/shared/SearchBar";
import { MOCK_CAMERAS } from "../../data/mockData";
import "./ImageConfigPage.css";

const SLIDERS = [
  { label: "Brightness",  key: "brightness",  color: "#ffb340", min: -100, max: 100 },
  { label: "Color Level", key: "colorLevel",  color: "#4d9fff", min: -100, max: 100 },
  { label: "Sharpness",   key: "sharpness",   color: "#00c8a0", min: -100, max: 100 },
  { label: "Contrast",    key: "contrast",    color: "#c084fc", min: -100, max: 100 },
];

const DEFAULT_VALS = {
  brightness: 0, colorLevel: 0, sharpness: 0, contrast: 0,
  whiteBalance: "", rotateImage: "",
  autoRotation: false, mirrorImage: false,
  backlightComp: false,
  dynamicContrast: false, dynamicContrastLevel: 0,
};

function buildCSSFilter(vals) {
  const brightness = 1 + (vals.brightness / 100);
  let contrast = 1 + (vals.contrast / 100);
  if (vals.dynamicContrast) contrast += vals.dynamicContrastLevel / 200;
  const backlightBoost = vals.backlightComp ? 0.15 : 0;
  const saturate = 1 + (vals.colorLevel / 100);
  const sharpnessContrast = 1 + (vals.sharpness / 400);
  let hueRotate = 0, sepia = 0;
  if (vals.whiteBalance === "Sunny")    { hueRotate = 5;  sepia = 0.05; }
  if (vals.whiteBalance === "Cloudy")   { hueRotate = -5; sepia = 0.08; }
  if (vals.whiteBalance === "Indoor")   { hueRotate = 15; sepia = 0.12; }
  if (vals.whiteBalance === "Tungsten") { hueRotate = 25; sepia = 0.18; }
  return [
    `brightness(${Math.max(0.1, brightness + backlightBoost).toFixed(3)})`,
    `contrast(${Math.max(0.1, contrast * sharpnessContrast).toFixed(3)})`,
    `saturate(${Math.max(0, saturate).toFixed(3)})`,
    hueRotate !== 0 ? `hue-rotate(${hueRotate}deg)` : "",
    sepia > 0 ? `sepia(${sepia})` : "",
  ].filter(Boolean).join(" ");
}

function buildTransform(vals) {
  const parts = [];
  if (vals.mirrorImage) parts.push("scaleX(-1)");
  if (vals.rotateImage) parts.push(`rotate(${vals.rotateImage}deg)`);
  return parts.join(" ") || "none";
}

export default function ImageConfigPage() {
  const [filter, setFilter]     = useState("");
  const [selected, setSelected] = useState(null);
  const [vals, setVals]         = useState(DEFAULT_VALS);
  const [streamActive, setStreamActive] = useState(false);
  const [streamError, setStreamError]   = useState("");
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const setV = (k, v) => setVals((f) => ({ ...f, [k]: v }));

  const filteredCameras = MOCK_CAMERAS.filter((c) =>
    !filter ||
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.server.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    if (!selected) { stopStream(); return; }
    startStream();
    return () => stopStream();
  }, [selected]);

  const startStream = async () => {
    setStreamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
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
        "Could not access camera: " + err.message
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

  const handleReset = () => setVals(DEFAULT_VALS);

  const handleSelectCamera = (camId) => {
    if (selected === camId) { setSelected(null); }
    else { setSelected(camId); setVals(DEFAULT_VALS); }
  };

  const cssFilter    = buildCSSFilter(vals);
  const cssTransform = buildTransform(vals);
  const selectedCam  = MOCK_CAMERAS.find((c) => c.id === selected);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Image <span>Configuration</span></h1>
          <p className="page-desc">Make changes in real time. Changes apply instantly to the live preview.</p>
        </div>
        <SearchBar value={filter} onChange={setFilter} placeholder="Type to filter" />
      </div>

      <div className="ic-table-wrap card">
        <table className="m-table">
          <thead><tr>{["Name","Channel","Server"].map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {filteredCameras.length === 0 ? (
              <tr><td colSpan={3} className="m-table__empty">No cameras match your filter.</td></tr>
            ) : filteredCameras.map((cam) => {
              const isSel = selected === cam.id;
              return (
                <tr key={cam.id}
                  className={`m-table__row ${isSel ? "m-table__row--selected" : ""}`}
                  onClick={() => handleSelectCamera(cam.id)}>
                  <td className="m-table__primary">{cam.name}</td>
                  <td>{cam.channel}</td>
                  <td>{cam.server}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ic-bottom">
        <div className="ic-preview card">
          {!selected ? (
            <div className="ic-preview__inner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
              <span>Select a camera to begin</span>
            </div>
          ) : (
            <div className="ic-preview__active">
              <div className="ic-preview__cam-label">
                <span className="ic-live-dot" />
                {selectedCam?.name}
                <span className="ic-live-tag">LIVE</span>
              </div>
              <div className="ic-preview__video-wrap">
                {streamError ? (
                  <div className="ic-stream-error">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                    </svg>
                    <span>{streamError}</span>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    className="ic-video"
                    autoPlay playsInline muted
                    style={{
                      filter: cssFilter,
                      transform: cssTransform,
                      transition: "filter 0.1s ease, transform 0.2s ease",
                    }}
                  />
                )}
                {streamActive && (
                  <div className="ic-filter-readout">
                    {[
                      vals.brightness !== 0 && `Brightness ${vals.brightness > 0 ? "+" : ""}${vals.brightness}`,
                      vals.contrast   !== 0 && `Contrast ${vals.contrast > 0 ? "+" : ""}${vals.contrast}`,
                      vals.colorLevel !== 0 && `Saturation ${vals.colorLevel > 0 ? "+" : ""}${vals.colorLevel}`,
                      vals.sharpness  !== 0 && `Sharpness ${vals.sharpness > 0 ? "+" : ""}${vals.sharpness}`,
                      vals.mirrorImage       && "Mirrored",
                      vals.rotateImage       && `Rotated ${vals.rotateImage}°`,
                      vals.backlightComp     && "Backlight Comp",
                      vals.dynamicContrast   && `WDR ${vals.dynamicContrastLevel}`,
                      vals.whiteBalance      && `WB: ${vals.whiteBalance}`,
                    ].filter(Boolean).map((tag) => (
                      <span key={tag} className="ic-filter-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ic-controls card">
          <div className="ic-controls__title">Image Parameters</div>

          {SLIDERS.map(({ label, key, color, min, max }) => (
            <div key={key} className="ic-row">
              <span className="ic-label">{label}</span>
              <div className="ic-slider-wrap">
                <input type="range" min={min} max={max} value={vals[key]}
                  disabled={!selected}
                  onChange={(e) => setV(key, Number(e.target.value))}
                  style={{ accentColor: color }} className="ic-slider" />
              </div>
              <span className="ic-val" style={{ color }}>{vals[key] > 0 ? "+" : ""}{vals[key]}</span>
            </div>
          ))}

          <div className="ic-divider" />

          <div className="ic-row">
            <span className="ic-label">White balance</span>
            <select disabled={!selected} value={vals.whiteBalance}
              onChange={(e) => setV("whiteBalance", e.target.value)} className="ic-select">
              <option value="">Auto</option>
              {["Sunny","Cloudy","Indoor","Tungsten"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="ic-row">
            <span className="ic-label">Rotate image</span>
            <div className="ic-row-inline">
              <select disabled={!selected} value={vals.rotateImage}
                onChange={(e) => setV("rotateImage", e.target.value)} className="ic-select ic-select--sm">
                <option value="">0</option>
                {["90","180","270"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <span className="ic-unit">degrees</span>
            </div>
          </div>

          <div className="ic-divider" />

          {[
            ["Automatic image rotation", "autoRotation"],
            ["Mirror image",             "mirrorImage"],
            ["Backlight compensation",   "backlightComp"],
          ].map(([label, key]) => (
            <div key={key} className="ic-row">
              <span className="ic-label">{label}</span>
              <Toggle value={vals[key]} onChange={(v) => selected && setV(key, v)} disabled={!selected} />
            </div>
          ))}

          <div className="ic-divider" />

          <div className="ic-row">
            <span className="ic-label">
              Dynamic contrast <span className="ic-label-sub">(wide dynamic range)</span>
            </span>
            <Toggle value={vals.dynamicContrast} onChange={(v) => selected && setV("dynamicContrast", v)} disabled={!selected} />
          </div>

          {vals.dynamicContrast && selected && (
            <div className="ic-row ic-row--indented">
              <span className="ic-label">Dynamic contrast</span>
              <div className="ic-slider-wrap">
                <input type="range" min={0} max={100} value={vals.dynamicContrastLevel}
                  onChange={(e) => setV("dynamicContrastLevel", Number(e.target.value))}
                  style={{ accentColor: "#c084fc" }} className="ic-slider" />
              </div>
              <span className="ic-val" style={{ color: "#c084fc" }}>{vals.dynamicContrastLevel}</span>
            </div>
          )}

          <div className="ic-divider" />

          <div className="ic-row">
            <span className="ic-label">Custom dewarp settings</span>
            <div className="ic-btn-group">
              <Button label="Import…" disabled={!selected} />
              <Button label="Reset"   disabled={!selected} onClick={handleReset} />
            </div>
          </div>
        </div>
      </div>

      <div className="page-footer">
        <span />
        <div className="page-footer-right">
          <Button label="Reset to defaults" disabled={!selected} onClick={handleReset} />
          <Button label="Apply" variant="primary" disabled={!selected} />
        </div>
      </div>
    </div>
  );
}
