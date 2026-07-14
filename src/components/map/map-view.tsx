"use client";

import maplibregl, {
  type LngLatLike,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import darkStyle from "@/styles/map-dark.json";
import lightStyle from "@/styles/map-light.json";
import { cn } from "@/lib/cn";
import type { Bbox } from "./types";
import { useResolvedTheme } from "./use-resolved-theme";

const STYLES: Record<"light" | "dark", StyleSpecification> = {
  light: lightStyle as unknown as StyleSpecification,
  dark: darkStyle as unknown as StyleSpecification,
};

/** Enea Stadion. The seed city is Poznań; nothing but this default assumes it. */
export const DEFAULT_CENTER: LngLatLike = [16.874, 52.393];
export const DEFAULT_ZOOM = 13.5;

export type Viewport = {
  bbox: Bbox;
  zoom: number;
};

type MapContextValue = {
  map: MapLibreMap | null;
  /** Style reloads wipe sources and layers; layers re-add themselves on this. */
  styleEpoch: number;
};

const MapContext = createContext<MapContextValue>({ map: null, styleEpoch: 0 });

export function useMapLibre(): MapContextValue {
  return useContext(MapContext);
}

function readViewport(map: MapLibreMap): Viewport {
  const bounds = map.getBounds();
  return {
    bbox: {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    },
    zoom: map.getZoom(),
  };
}

export type MapViewProps = {
  onViewportChange: (viewport: Viewport) => void;
  onReady?: (map: MapLibreMap) => void;
  /** Tapping the map itself is how a driver dismisses a selected pin. */
  onBackgroundClick?: () => void;
  children?: React.ReactNode;
  className?: string;
};

/**
 * The map is the application, not a widget inside it: it fills the shell and
 * everything else floats over it. The canvas has a fixed box from first paint,
 * so nothing shifts when tiles arrive.
 */
export function MapView({
  onViewportChange,
  onReady,
  onBackgroundClick,
  children,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const theme = useResolvedTheme();

  const viewportHandler = useRef(onViewportChange);
  viewportHandler.current = onViewportChange;
  const readyHandler = useRef(onReady);
  readyHandler.current = onReady;
  const backgroundHandler = useRef(onBackgroundClick);
  backgroundHandler.current = onBackgroundClick;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const instance = new maplibregl.Map({
      container,
      style: STYLES.light,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
      // Camera moves are feedback, not decoration. MapLibre already downgrades
      // flyTo/easeTo to a jump under prefers-reduced-motion, so no camera call
      // here may pass essential: true — that flag would override the driver's
      // system setting.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxZoom: 19,
      minZoom: 9,
    });
    instance.touchZoomRotate.disableRotation();

    const emit = () => viewportHandler.current(readViewport(instance));
    instance.on("load", () => {
      emit();
      readyHandler.current?.(instance);
    });
    instance.on("moveend", emit);
    instance.on("click", (event) => {
      if (event.defaultPrevented) return;
      backgroundHandler.current?.();
    });

    mapRef.current = instance;
    setMap(instance);

    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  useEffect(() => {
    const instance = mapRef.current;
    if (!instance) return;
    instance.setStyle(STYLES[theme]);
    const onStyleLoad = () => setStyleEpoch((epoch) => epoch + 1);
    instance.once("styledata", onStyleLoad);
    return () => {
      instance.off("styledata", onStyleLoad);
    };
  }, [theme]);

  const value = useMemo<MapContextValue>(() => ({ map, styleEpoch }), [map, styleEpoch]);

  return (
    <MapContext.Provider value={value}>
      <div
        ref={containerRef}
        // Height, not inset: maplibre-gl.css sets `.maplibregl-map { position:
        // relative }` on this node, which beats `absolute inset-0` and collapses
        // the canvas to zero. The parent supplies the definite box.
        className={cn("h-full w-full bg-bg", className)}
        // The canvas carries the whole screen; a driver reading it does not need
        // the tiles announced to them.
        aria-hidden="true"
      />
      {map ? children : null}
    </MapContext.Provider>
  );
}

export type MapMarkerProps = {
  lng: number;
  lat: number;
  zIndex?: number;
  children: React.ReactNode;
};

/**
 * A real MapLibre marker with the React tree portalled into it: the marker is
 * moved by the map's own transform, so panning does not re-render anything.
 * Anchored at the bottom — the tip sits on the entrance, not on the label.
 */
export function MapMarker({ lng, lat, zIndex, children }: MapMarkerProps) {
  const { map } = useMapLibre();
  const [element] = useState(() => {
    if (typeof document === "undefined") return null;
    const node = document.createElement("div");
    node.style.willChange = "transform";
    return node;
  });
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map || !element) return;
    const marker = new maplibregl.Marker({ element, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, element, lng, lat]);

  useEffect(() => {
    markerRef.current?.setLngLat([lng, lat]);
  }, [lng, lat]);

  useEffect(() => {
    if (!element) return;
    element.style.zIndex = zIndex === undefined ? "" : String(zIndex);
  }, [element, zIndex]);

  if (!element) return null;

  return createPortal(children, element);
}
