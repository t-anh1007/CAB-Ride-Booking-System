import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBooking } from "@app/BookingProvider.jsx";

export function HomeMapPickupPage() {
  const navigate = useNavigate();
  const { setPickup } = useBooking();
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  
  const [addressName, setAddressName] = useState("Đang định vị...");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      const name = data.display_name || `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddressName(name);
    } catch (e) {
      setAddressName("Vị trí đã chọn");
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    const timeoutId = setTimeout(async () => {
      if (query.trim().length < 2) return;
      setLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Việt Nam")}&limit=5`
        );
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  };

  const selectLocation = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setAddressName(result.display_name);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    if (leafletMap.current) {
      leafletMap.current.flyTo([lat, lng], 17);
    }
  };

  useEffect(() => {
    if (!leafletMap.current && window.L) {
      leafletMap.current = window.L.map(mapRef.current, {
        center: [10.7769, 106.7009],
        zoom: 15,
        zoomControl: false,
        attributionControl: false
      });
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(leafletMap.current);
      leafletMap.current.on("moveend", () => {
        const center = leafletMap.current.getCenter();
        reverseGeocode(center.lat, center.lng);
      });
      const initialCenter = leafletMap.current.getCenter();
      reverseGeocode(initialCenter.lat, initialCenter.lng);
    }
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  const handleConfirmPickup = () => {
    if (!leafletMap.current) return;
    const center = leafletMap.current.getCenter();
    const locationData = { address: addressName, lat: center.lat, lng: center.lng };
    console.log("🏠 [PICKUP] Confirming:", locationData);
    setPickup(locationData);
    navigate("/customer/booking/destination");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm h-[800px] bg-white rounded-[32px] shadow-2xl overflow-hidden relative border-4 border-slate-900/5">
        
        <div className="absolute top-6 inset-x-6 z-[2000] space-y-2">
          <div className={`bg-white rounded-2xl shadow-2xl p-2 border-2 transition-all ${isSearching ? 'border-slate-900' : 'border-white'}`}>
             <div className="flex flex-col">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                   <div className="w-2 h-2 rounded-full bg-slate-900"></div>
                   <input 
                      className="bg-transparent flex-1 text-sm font-bold outline-none text-slate-800"
                      placeholder="Bạn đang ở đâu?"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      onFocus={() => setIsSearching(true)}
                   />
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                    {searchResults.map((result, idx) => (
                      <div key={idx} className="p-4 hover:bg-slate-50 cursor-pointer flex gap-3 items-start" onClick={() => selectLocation(result)}>
                        <span className="text-lg">📍</span>
                        <div className="flex-1 overflow-hidden">
                           <p className="text-sm font-bold text-slate-900 truncate">{result.display_name.split(',')[0]}</p>
                           <p className="text-[10px] text-slate-500 truncate">{result.display_name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>

        <div ref={mapRef} className="absolute inset-0 z-0" onClick={() => setIsSearching(false)}></div>
        
        {!isSearching && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center pb-8 z-[1001]">
             <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center shadow-2xl border-4 border-white animate-bounce">
                   <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="w-4 h-1 bg-black/20 rounded-full blur-[2px] mt-1 scale-x-150"></div>
             </div>
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-[0_-15px_50px_rgba(0,0,0,0.2)] z-[1002]">
          <div className="flex justify-center mb-5"><div className="w-12 h-1.5 rounded-full bg-slate-200"></div></div>
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg text-xl">🏠</div>
             <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Điểm đón</p>
                <p className="text-sm font-bold text-slate-900 truncate">{addressName}</p>
             </div>
          </div>
          <button className="w-full rounded-2xl bg-slate-900 text-white py-4 text-sm font-bold shadow-xl active:scale-95 transition-all" onClick={handleConfirmPickup}>
            XÁC NHẬN ĐIỂM ĐÓN
          </button>
        </div>
      </div>
    </div>
  );
}
