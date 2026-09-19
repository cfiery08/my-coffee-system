"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  floor?: string;
  instructions?: string;
};

interface Props {
  onClose: () => void;
  onSelect: (address: string, lat: number, lng: number, floor: string, instructions: string) => void;
  currentAddress: string;
}

const LABEL_CHIPS = ["Home", "Work", "Partner's", "Other"];
const ACCENT = "#b16b16";

export default function AddressPickerModal({ onClose, onSelect, currentAddress }: Props) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialCoords, setInitialCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [pickedAddress, setPickedAddress] = useState("");
  const [pickedLat, setPickedLat] = useState(0);
  const [pickedLng, setPickedLng] = useState(0);
  const [floor, setFloor] = useState("");
  const [instructions, setInstructions] = useState("");
  const [label, setLabel] = useState("Home");
  const [customLabel, setCustomLabel] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("brewora_saved_addresses");
    if (stored) {
      setAddresses(JSON.parse(stored));
    } else if (currentAddress) {
      const initial: SavedAddress[] = [{ id: Date.now().toString(), label: "Home", address: currentAddress, lat: 0, lng: 0 }];
      setAddresses(initial);
      localStorage.setItem("brewora_saved_addresses", JSON.stringify(initial));
    }
  }, []);

  const persist = (updated: SavedAddress[]) => {
    setAddresses(updated);
    localStorage.setItem("brewora_saved_addresses", JSON.stringify(updated));
  };

  const openNewForm = (coords?: { lat: number; lng: number }) => {
    setEditingId(null);
    setPickedAddress(""); setPickedLat(coords?.lat ?? 10.3157); setPickedLng(coords?.lng ?? 123.9054);
    setFloor(""); setInstructions(""); setLabel("Home"); setCustomLabel("");
    setInitialCoords(coords);
    setShowForm(true);
  };

  const openEditForm = (a: SavedAddress) => {
    setEditingId(a.id);
    setPickedAddress(a.address); setPickedLat(a.lat); setPickedLng(a.lng);
    setFloor(a.floor || ""); setInstructions(a.instructions || "");
    setLabel(LABEL_CHIPS.includes(a.label) ? a.label : "");
    setCustomLabel(LABEL_CHIPS.includes(a.label) ? "" : a.label);
    setInitialCoords({ lat: a.lat, lng: a.lng });
    setShowForm(true);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return openNewForm();
    navigator.geolocation.getCurrentPosition(
      (pos) => openNewForm({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => openNewForm()
    );
  };

  const handleSave = () => {
    const finalLabel = label || customLabel.trim() || "Home";
    const entry: SavedAddress = {
      id: editingId || Date.now().toString(),
      label: finalLabel, address: pickedAddress,
      lat: pickedLat, lng: pickedLng, floor, instructions,
    };
    const updated = editingId ? addresses.map((a) => a.id === editingId ? entry : a) : [...addresses, entry];
    persist(updated);
    onSelect(entry.address, entry.lat, entry.lng, entry.floor || "", entry.instructions || "");
    onClose();
  };

  if (showForm) {
    return createPortal(
      <MapWithForm
        initialCoords={initialCoords}
        initialAddress={pickedAddress}
        floor={floor} instructions={instructions} label={label} customLabel={customLabel}
        onAddressChange={(addr, lat, lng) => { setPickedAddress(addr); setPickedLat(lat); setPickedLng(lng); }}
        onFloorChange={setFloor}
        onInstructionsChange={setInstructions}
        onLabelChange={setLabel}
        onCustomLabelChange={setCustomLabel}
        onBack={() => setShowForm(false)}
        onSave={handleSave}
        isEdit={!!editingId}
      />,
      document.body
    );
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "12px 20px 40px", width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 -4px 24px rgba(0,0,0,0.15)" }}>
        <div style={{ width: "40px", height: "4px", background: "#e0d6cc", borderRadius: "2px", margin: "0 auto 20px" }} />
        <h2 style={{ color: "#21140b", fontSize: "18px", fontWeight: 900, marginBottom: "20px" }}>Where should we deliver?</h2>

        <button onClick={handleUseCurrentLocation} style={{ width: "100%", background: "none", border: "none", display: "flex", alignItems: "center", gap: "12px", padding: "14px 4px", cursor: "pointer", color: ACCENT }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={ACCENT} strokeWidth={2} style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: "14px" }}>Use my current location</span>
        </button>

        <div style={{ borderTop: "1px solid #f0e8df", margin: "8px 0" }} />

        {addresses.length === 0 && <p style={{ color: "#aaa", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No saved addresses yet.</p>}

        {addresses.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 4px", borderBottom: "1px solid #f5ede6" }}>
            <div
              onClick={() => { onSelect(a.address, a.lat, a.lng, a.floor || "", a.instructions || ""); onClose(); }}
              style={{
                width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0, cursor: "pointer",
                border: `2px solid ${a.address === currentAddress ? ACCENT : "#ccc"}`,
                background: a.address === currentAddress ? ACCENT : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {a.address === currentAddress && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }} />}
            </div>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { onSelect(a.address, a.lat, a.lng, a.floor || "", a.instructions || ""); onClose(); }}>
              <p style={{ color: "#21140b", fontWeight: 700, fontSize: "14px", margin: "0 0 2px" }}>{a.label}</p>
              <p style={{ color: "#7a5c44", fontSize: "12px", margin: 0, lineHeight: 1.4 }}>{a.address}</p>
              {a.floor && <p style={{ color: "#aaa", fontSize: "11px", margin: "2px 0 0" }}>{a.floor}</p>}
              {a.instructions && <p style={{ color: "#aaa", fontSize: "11px", margin: "2px 0 0" }}>{a.instructions}</p>}
            </div>
            <button onClick={() => openEditForm(a)} style={{ background: "none", border: "1px solid #e0d6cc", borderRadius: "6px", cursor: "pointer", color: "#7a5c44", fontSize: "11px", fontWeight: 600, padding: "4px 8px" }}>Edit</button>
            <button onClick={() => persist(addresses.filter((x) => x.id !== a.id))} style={{ background: "none", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", color: "#ef4444", fontSize: "11px", fontWeight: 600, padding: "4px 8px" }}>Remove</button>
          </div>
        ))}

        <button onClick={() => openNewForm()} style={{ width: "100%", background: "none", border: "none", display: "flex", alignItems: "center", gap: "12px", padding: "16px 4px", cursor: "pointer", color: ACCENT, marginTop: "4px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700 }}>+</span>
          <span style={{ fontWeight: 700, fontSize: "14px" }}>Add a new address</span>
        </button>
      </div>
    </div>
  );
}

function MapWithForm({
  initialCoords, initialAddress, floor, instructions, label, customLabel,
  onAddressChange, onFloorChange, onInstructionsChange, onLabelChange, onCustomLabelChange,
  onBack, onSave, isEdit,
}: {
  initialCoords?: { lat: number; lng: number };
  initialAddress: string;
  floor: string; instructions: string; label: string; customLabel: string;
  onAddressChange: (addr: string, lat: number, lng: number) => void;
  onFloorChange: (v: string) => void;
  onInstructionsChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onCustomLabelChange: (v: string) => void;
  onBack: () => void;
  onSave: () => void;
  isEdit: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [resolving, setResolving] = useState(false);
  const [address, setAddress] = useState(initialAddress || "");
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debounceRef = useRef<any>(null);
  const skipReverseRef = useRef(false);
  const initLat = initialCoords?.lat ?? 10.3157;
  const initLng = initialCoords?.lng ?? 123.9054;

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setResolving(true);
    try {
      const res = await fetch(`/api/geocode?type=reverse&lat=${lat}&lng=${lng}`);
      const data = await res.json();
      const addr = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddress(addr); onAddressChange(addr, lat, lng);
    } catch {
      const addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddress(addr); onAddressChange(addr, lat, lng);
    } finally { setResolving(false); }
  }, [onAddressChange]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([initLat, initLng], 17);
      mapInstanceRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.on("moveend", () => {
        if (skipReverseRef.current) { skipReverseRef.current = false; return; }
        const c = map.getCenter();
        reverseGeocode(c.lat, c.lng);
      });
      reverseGeocode(initLat, initLng);
    });
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  const handleSearchInput = (val: string) => {
    setSearch(val); setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?type=search&q=${encodeURIComponent(val)}`);
        setSuggestions(await res.json());
      } catch { }
    }, 300);
  };

  const handleSuggestionClick = (s: any) => {
    setSuggestions([]); setSearch(s.display_name);
    const lat = parseFloat(s.lat); const lng = parseFloat(s.lon);
    setAddress(s.display_name); onAddressChange(s.display_name, lat, lng);
    skipReverseRef.current = true;
    mapInstanceRef.current?.flyTo([lat, lng], 17, { duration: 0.8 });
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, background: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Search bar */}
      <div style={{ flexShrink: 0, background: "#fff", padding: "10px 12px", display: "flex", gap: "10px", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
        <button onClick={onBack} style={{ background: "#f5ede6", border: "none", borderRadius: "50%", width: "40px", height: "40px", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>←</button>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            value={search}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && suggestions.length) handleSuggestionClick(suggestions[0]); }}
            placeholder="Search street, barangay, city..."
            style={{ width: "100%", background: "#f9f4ef", border: `1px solid #e0d6cc`, borderRadius: "10px", padding: "10px 40px 10px 14px", fontSize: "14px", outline: "none", boxSizing: "border-box", color: "#21140b" }}
          />
          <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "#bbb", pointerEvents: "none", fontWeight: 600 }}>Search</span>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ flexShrink: 0, background: "#fff", borderTop: "1px solid #f5ede6", maxHeight: "200px", overflowY: "auto" }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => handleSuggestionClick(s)}
              style={{ padding: "11px 16px", cursor: "pointer", fontSize: "13px", color: "#21140b", borderBottom: "1px solid #f5ede6", display: "flex", gap: "10px", alignItems: "flex-start" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fdf8f4")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <span style={{ lineHeight: 1.4 }}>{s.display_name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      <div style={{ position: "relative", height: "280px", flexShrink: 0 }}>
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        {/* Center pin */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -100%)", zIndex: 1000, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ background: "rgba(33,20,11,0.82)", color: "#fff", padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", marginBottom: "4px" }}>Move to edit location</div>
          <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid rgba(33,20,11,0.82)", marginBottom: "2px" }} />
          <svg width="36" height="48" viewBox="0 0 36 48" style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.3))" }}>
            <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill={ACCENT} />
            <circle cx="18" cy="18" r="8" fill="#fff" />
            <circle cx="18" cy="18" r="4" fill={ACCENT} />
          </svg>
        </div>
        {/* My location */}
        <button
          onClick={() => navigator.geolocation?.getCurrentPosition((p) => mapInstanceRef.current?.flyTo([p.coords.latitude, p.coords.longitude], 17, { duration: 0.8 }))}
          style={{ position: "absolute", bottom: 12, right: 12, zIndex: 1000, background: "#fff", border: "none", borderRadius: "50%", width: "40px", height: "40px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", fontSize: "18px" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={ACCENT} strokeWidth={2}>
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: "auto", background: "#fff", padding: "20px 20px 40px" }}>
        <div style={{ background: "#fdf3e3", borderRadius: "10px", padding: "10px 14px", marginBottom: "20px" }}>
          <p style={{ color: "#7a5c44", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>Your order will be delivered to the pinned location. Move the map to adjust.</p>
        </div>

        <p style={{ color: "#21140b", fontSize: "14px", fontWeight: 700, margin: "0 0 8px" }}>Delivery Address</p>
        <div style={{ marginBottom: "20px", padding: "12px 14px", background: "#fdf8f4", borderRadius: "10px", border: "1px solid #e8ddd4" }}>
          <p style={{ color: resolving ? "#bbb" : "#21140b", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
            {resolving ? "Finding address..." : (address || "Move the map to set your location")}
          </p>
        </div>

        <p style={{ color: "#21140b", fontSize: "14px", fontWeight: 700, margin: "0 0 8px" }}>Floor / Unit / Room #</p>
        <input value={floor} onChange={(e) => onFloorChange(e.target.value)} placeholder="e.g. Unit 3B, 2nd Floor"
          style={{ width: "100%", background: "#fff", border: "1px solid #e0d6cc", borderRadius: "10px", padding: "12px 14px", color: "#21140b", fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "16px" }} />

        <p style={{ color: "#21140b", fontSize: "14px", fontWeight: 700, margin: "0 0 4px" }}>Delivery Instructions</p>
        <p style={{ color: "#aaa", fontSize: "12px", margin: "0 0 8px" }}>Give us more information about your address.</p>
        <textarea value={instructions} onChange={(e) => onInstructionsChange(e.target.value)} placeholder="e.g. Leave at the door" rows={3}
          style={{ width: "100%", background: "#fff", border: "1px solid #e0d6cc", borderRadius: "10px", padding: "12px 14px", color: "#21140b", fontSize: "14px", outline: "none", boxSizing: "border-box", resize: "none", marginBottom: "20px" }} />

        <p style={{ color: "#21140b", fontSize: "14px", fontWeight: 700, margin: "0 0 10px" }}>Label</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
          {LABEL_CHIPS.map((chip) => (
            <button key={chip} onClick={() => { onLabelChange(chip); onCustomLabelChange(""); }} style={{
              padding: "8px 18px", borderRadius: "20px",
              border: `1px solid ${label === chip ? ACCENT : "#e0d6cc"}`,
              background: label === chip ? ACCENT : "#fff",
              color: label === chip ? "#fff" : "#5a3e2b",
              fontSize: "13px", fontWeight: label === chip ? 700 : 400, cursor: "pointer",
            }}>{chip}</button>
          ))}
        </div>
        <input value={customLabel} onChange={(e) => { onCustomLabelChange(e.target.value); onLabelChange(""); }} placeholder="Or type a custom label"
          style={{ width: "100%", background: "#fff", border: "1px solid #e0d6cc", borderRadius: "10px", padding: "12px 14px", color: "#21140b", fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "24px" }} />

        <button onClick={onSave} disabled={resolving || !address} style={{
          width: "100%", background: ACCENT, color: "#fff", border: "none",
          borderRadius: "12px", padding: "15px", fontWeight: 900, fontSize: "15px",
          cursor: resolving || !address ? "not-allowed" : "pointer",
          opacity: resolving || !address ? 0.5 : 1,
        }}>
          {isEdit ? "Save Changes" : "Save and continue"}
        </button>
      </div>
    </div>
  );
}
