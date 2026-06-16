"use client";

import { useState, useEffect } from "react";
import { usePricing, useUpdatePricing } from "@/hooks/usePricing";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatNaira } from "@/lib/utils";
import type { PricingConfig } from "@/lib/api";
import { Save, Calculator } from "lucide-react";

// ── Human-readable labels & grouping ─────────────────────────────────────────

const GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Standard Cleaning",
    keys: ["room_rate", "toilet_rate", "living_room_extra", "kitchen_extra"],
  },
  {
    label: "Specialist Services",
    keys: ["deep_cleaning_room_rate", "window_cleaning_extra", "fumigation_flat"],
  },
  {
    label: "Laundry",
    keys: ["laundry_per_item", "laundry_ironing", "laundry_delicates"],
  },
  {
    label: "Transport",
    keys: ["transport_threshold_km", "transport_band_km", "transport_band_fee"],
  },
  {
    label: "Scan & Area Pricing",
    keys: ["scan_rate_per_sqm"],
  },
  {
    label: "Surge & Limits",
    keys: ["surge_peak", "surge_holiday", "price_floor", "price_ceiling"],
  },
];

const KEY_LABELS: Record<string, string> = {
  room_rate: "Room rate (₦)",
  toilet_rate: "Toilet rate (₦)",
  deep_cleaning_room_rate: "Deep clean / room (₦)",
  kitchen_extra: "Kitchen extra (₦)",
  living_room_extra: "Living room extra (₦)",
  window_cleaning_extra: "Window cleaning extra (₦)",
  laundry_per_item: "Per item (₦)",
  laundry_ironing: "Ironing (₦)",
  laundry_delicates: "Delicates (₦)",
  fumigation_flat: "Fumigation flat (₦)",
  scan_rate_per_sqm: "Scan rate / m² (₦)",
  transport_threshold_km: "Free transport up to (km)",
  transport_band_km: "Distance band (km)",
  transport_band_fee: "Band fee (₦)",
  surge_peak: "Peak surge (×)",
  surge_holiday: "Holiday surge (×)",
  price_floor: "Price floor (₦)",
  price_ceiling: "Price ceiling (₦)",
};

const IS_MULTIPLIER = new Set(["surge_peak", "surge_holiday"]);
const IS_KM = new Set(["transport_threshold_km", "transport_band_km"]);

function fieldStep(key: string) {
  if (IS_MULTIPLIER.has(key)) return "0.01";
  return "1";
}

// ── Live price simulator ──────────────────────────────────────────────────────

function PriceSimulator({ config }: { config: PricingConfig }) {
  const [rooms, setRooms] = useState(2);
  const [toilets, setToilets] = useState(1);
  const [distanceKm, setDistanceKm] = useState(5);
  const [hasKitchen, setHasKitchen] = useState(false);
  const [hasLivingRoom, setHasLivingRoom] = useState(false);

  const computed = (() => {
    let price = 0;
    price += (config.room_rate ?? 0) * rooms;
    price += (config.toilet_rate ?? 0) * toilets;
    if (hasKitchen) price += config.kitchen_extra ?? 0;
    if (hasLivingRoom) price += config.living_room_extra ?? 0;

    // Transport
    const threshold = config.transport_threshold_km ?? 5;
    const bandKm = config.transport_band_km ?? 5;
    const bandFee = config.transport_band_fee ?? 1000;
    if (distanceKm > threshold) {
      const extraKm = distanceKm - threshold;
      const bands = Math.ceil(extraKm / bandKm);
      price += bands * bandFee;
    }

    // Floor
    price = Math.max(price, config.price_floor ?? 0);
    return price;
  })();

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-text">Price Simulator</h4>
        <span className="text-xs text-text-muted ml-1">(standard cleaning)</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <label className="text-xs text-text-muted mb-1 block">Rooms</label>
          <input
            type="number"
            min={0}
            value={rooms}
            onChange={(e) => setRooms(Math.max(0, Number(e.target.value)))}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Toilets</label>
          <input
            type="number"
            min={0}
            value={toilets}
            onChange={(e) => setToilets(Math.max(0, Number(e.target.value)))}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Distance (km)</label>
          <input
            type="number"
            min={0}
            value={distanceKm}
            onChange={(e) => setDistanceKm(Math.max(0, Number(e.target.value)))}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex flex-col gap-2 justify-end pb-0.5">
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={hasKitchen}
              onChange={(e) => setHasKitchen(e.target.checked)}
              className="accent-primary"
            />
            Kitchen
          </label>
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={hasLivingRoom}
              onChange={(e) => setHasLivingRoom(e.target.checked)}
              className="accent-primary"
            />
            Living room
          </label>
        </div>
      </div>

      <div className="bg-primary/10 border border-primary/30 rounded-xl px-5 py-4 flex justify-between items-center">
        <span className="text-sm font-medium text-text-muted">Estimated price</span>
        <span className="text-3xl font-bold text-primary">{formatNaira(computed)}</span>
      </div>

      <div className="text-xs text-text-muted space-y-0.5">
        <p>{rooms} rooms × {formatNaira(config.room_rate ?? 0)} = {formatNaira((config.room_rate ?? 0) * rooms)}</p>
        <p>{toilets} toilets × {formatNaira(config.toilet_rate ?? 0)} = {formatNaira((config.toilet_rate ?? 0) * toilets)}</p>
        {hasKitchen && <p>Kitchen extra: {formatNaira(config.kitchen_extra ?? 0)}</p>}
        {hasLivingRoom && <p>Living room extra: {formatNaira(config.living_room_extra ?? 0)}</p>}
        {distanceKm > (config.transport_threshold_km ?? 5) && (
          <p>
            Transport ({distanceKm - (config.transport_threshold_km ?? 5)} km over threshold,{" "}
            {Math.ceil((distanceKm - (config.transport_threshold_km ?? 5)) / (config.transport_band_km ?? 5))} band
            {Math.ceil((distanceKm - (config.transport_threshold_km ?? 5)) / (config.transport_band_km ?? 5)) !== 1 ? "s" : ""}){" "}
            = {formatNaira(
              Math.ceil((distanceKm - (config.transport_threshold_km ?? 5)) / (config.transport_band_km ?? 5)) *
              (config.transport_band_fee ?? 1000)
            )}
          </p>
        )}
        <p className="font-medium text-text pt-1">
          Floor: {formatNaira(config.price_floor ?? 0)} · Ceiling: {formatNaira(config.price_ceiling ?? 0)}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { data: origConfig, isLoading } = usePricing();
  const update = useUpdatePricing();
  const [localConfig, setLocalConfig] = useState<PricingConfig>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (origConfig) {
      setLocalConfig(origConfig);
      setDirty(false);
    }
  }, [origConfig]);

  const handleChange = (key: string, value: number) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    update.mutate(localConfig, { onSuccess: () => setDirty(false) });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {dirty ? (
            <span className="text-warning font-medium">Unsaved changes</span>
          ) : (
            "All changes saved"
          )}
        </p>
        <button
          onClick={handleSave}
          disabled={!dirty || update.isPending}
          className="flex items-center gap-2 bg-primary text-black font-semibold rounded-xl px-5 py-2 text-sm hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {update.isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Config groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {GROUPS.map(({ label, keys }) => {
          // Only render keys that exist in the config
          const presentKeys = keys.filter((k) => k in localConfig);
          if (presentKeys.length === 0) return null;

          return (
            <div key={label} className="bg-surface border border-border rounded-2xl p-5 space-y-4">
              <h4 className="font-semibold text-text">{label}</h4>
              <div className="space-y-3">
                {presentKeys.map((key) => (
                  <div key={key}>
                    <label className="text-xs text-text-muted mb-1 block">
                      {KEY_LABELS[key] ?? key.replace(/_/g, " ")}
                    </label>
                    <input
                      type="number"
                      step={fieldStep(key)}
                      min={0}
                      value={localConfig[key] ?? ""}
                      onChange={(e) =>
                        handleChange(key, parseFloat(e.target.value) || 0)
                      }
                      className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {IS_KM.has(key) && (
                      <p className="text-xs text-text-muted mt-0.5">kilometres</p>
                    )}
                    {IS_MULTIPLIER.has(key) && (
                      <p className="text-xs text-text-muted mt-0.5">
                        e.g. 1.2 = 20% surge
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Simulator */}
      {Object.keys(localConfig).length > 0 && (
        <PriceSimulator config={localConfig} />
      )}
    </div>
  );
}
