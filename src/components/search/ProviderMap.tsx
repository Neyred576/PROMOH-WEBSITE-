"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { Star } from "lucide-react";
import Image from "next/image";

// Fix for default marker icon in Next.js/Leaflet
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Provider {
  id: string;
  businessName: string;
  firstName: string;
  lastName: string;
  servicesOffered: string;
  photoURL?: string;
  rating?: number;
  location?: string;
  hourlyRate?: string;
}

export default function ProviderMap({ providers }: { providers: Provider[] }) {
  // Try to geocode locations (For MVP, we'll use a fixed center and randomize provider locations slightly around it if we don't have real lat/lng)
  // In a real app, you'd save lat/lng in Firestore
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-full w-full bg-secondary-100 animate-pulse rounded-2xl" />;

  const center: [number, number] = [40.7128, -74.0060]; // Default NY

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden shadow-md border border-secondary-200 z-0">
      <MapContainer center={center} zoom={11} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {providers.map((p, i) => {
          // Mocking coordinates near NY for demonstration since real locations might be just string "New York"
          const lat = center[0] + (Math.random() - 0.5) * 0.2;
          const lng = center[1] + (Math.random() - 0.5) * 0.2;

          return (
            <Marker key={p.id} position={[lat, lng]}>
              <Popup className="rounded-xl overflow-hidden p-0">
                <div className="flex flex-col w-48">
                  {p.photoURL ? (
                    <div className="h-24 w-full relative">
                       <Image src={p.photoURL} alt="Provider" fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="h-24 w-full bg-primary-100 flex items-center justify-center">
                       <span className="text-xl font-bold text-primary-600">{(p.businessName || p.firstName || "?")[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="p-3">
                    <h4 className="font-bold text-sm truncate">{p.businessName || `${p.firstName} ${p.lastName}`}</h4>
                    <p className="text-xs text-secondary-500 truncate mb-1">{p.servicesOffered}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs flex items-center"><Star className="w-3 h-3 text-yellow-500 mr-0.5 fill-yellow-500"/> {p.rating?.toFixed(1) || "New"}</span>
                      {p.hourlyRate && <span className="text-xs font-bold text-primary-600">${p.hourlyRate}/hr</span>}
                    </div>
                    <Link href={`/provider/${p.id}`} className="block mt-2 text-center text-xs bg-primary-600 text-white py-1.5 rounded-md font-medium hover:bg-primary-700">
                      View Profile
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
