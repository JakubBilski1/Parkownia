"use client";

import maplibregl, {
  type LngLatLike,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createContext,
  useCallback,
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
  /**
   * "auto" follows the page theme and is what the driver's map wants: at night,
   * outside a stadium, a white rectangle in the face is the wrong answer.
   *
   * "paper" pins the map to the light style whatever the page is doing. The
   * owners' calculator is the one place that earns it — there the map is a
   * document somebody reads to find their own street, on a desk, in daylight,
   * and legibility beats matching the page.
   */
  tone?: "auto" | "paper";
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
  tone = "auto",
  children,
  className,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const pageTheme = useResolvedTheme();
  const theme = tone === "paper" ? "light" : pageTheme;

  const viewportHandler = useRef(onViewportChange);
  viewportHandler.current = onViewportChange;
  const readyHandler = useRef(onReady);
  readyHandler.current = onReady;
  const backgroundHandler = useRef(onBackgroundClick);
  backgroundHandler.current = onBackgroundClick;
  // Read at creation time so the first painted frame is already the right
  // style; the effect below keeps it in step afterwards.
  const themeRef = useRef(theme);
  themeRef.current = theme;
  /** The style the live map instance actually carries. See syncStyle below. */
  const appliedTheme = useRef(theme);
  const styleLoadedRef = useRef(false);

  /**
   * The only path to setStyle, and it refuses two calls that used to happen.
   *
   * One: the theme the map was BUILT with. The constructor already applied it,
   * so re-applying is pure loss.
   *
   * Two: any call against a style still loading. MapLibre answers those by
   * throwing the half-built style away and rebuilding it ("Unable to perform
   * style diff: Style is not done loading"), and the rebuild never repaints on
   * its own — the canvas stays blank until a drag or a resize forces a frame.
   * That is how /mapa shipped: every tile fetched with 200, nothing drawn, and
   * the map appearing on first touch. Black in Zmierzch, cream in Bilet — the
   * inverting filter had nothing to do with it.
   *
   * Both fired on a normal load, and the second one still would after fixing
   * only the first: ThemeProvider starts at "system" and reads localStorage in
   * an effect, so anybody who ever picked a theme by hand gets a theme change
   * milliseconds after mount, while the first style is mid-flight. A change that
   * arrives that early is held here and applied by the load handler.
   */
  const syncStyle = useCallback(() => {
    const instance = mapRef.current;
    if (!instance || !styleLoadedRef.current) return;
    const next = themeRef.current;
    if (appliedTheme.current === next) return;

    appliedTheme.current = next;
    instance.setStyle(STYLES[next]);
    // Sources and layers are wiped by setStyle; the children re-add themselves.
    instance.once("styledata", () => setStyleEpoch((epoch) => epoch + 1));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const instance = new maplibregl.Map({
      container,
      style: STYLES[themeRef.current],
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
      styleLoadedRef.current = true;
      emit();
      readyHandler.current?.(instance);
      // Children go up only once the style is loaded. EventOverlay and the
      // calculator's rings call addSource() the moment they see a map, and
      // MapLibre refuses that against a style still in flight.
      setMap(instance);
      // A theme that resolved while the map was still building waits until here.
      syncStyle();
      // And one more frame once there is something to show. Cheap insurance:
      // the theme class lands in an effect that runs long before the first tile,
      // so the repaint it asks for hits an empty canvas and nothing requests
      // another.
      //
      // Do NOT read this as the cure for a blank map. A long hunt for one —
      // black in Zmierzch, patchy in Bilet — ended with the symptom reproducing
      // in the light theme with `filter: none` on a correctly sized canvas, and
      // clearing on any window resize. That is the automation harness, not this
      // component. preserveDrawingBuffer was tried here and removed again: it
      // changed nothing and costs memory on every map a driver opens.
      requestAnimationFrame(() => instance.triggerRepaint());
    });
    instance.on("moveend", emit);
    instance.on("click", (event) => {
      if (event.defaultPrevented) return;
      backgroundHandler.current?.();
    });

    mapRef.current = instance;
    appliedTheme.current = themeRef.current;

    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      instance.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
      setMap(null);
    };
  }, [syncStyle]);

  /**
   * The dark map is the light raster turned inside out (see globals.css and
   * map-dark.json). The class goes on imperatively rather than through
   * className: the value is read from matchMedia during render, and putting it
   * in the server-rendered markup would be a hydration mismatch.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.classList.toggle("map-tiles-inverted", theme === "dark");
    // The composited result changed even though nothing on the map did. Ask for
    // a frame so the compositor has something current to filter — see the
    // preserveDrawingBuffer note above for what happens when it does not.
    mapRef.current?.triggerRepaint();
  }, [theme]);

  useEffect(() => {
    syncStyle();
  }, [theme, syncStyle]);

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
