import { useEffect, useState } from "react";
import api from "@/lib/api";

/**
 * Fetches admin-uploaded images (Admin → Settings → Images) for a given
 * placement ("home" | "dashboard" | "projects" | "services") and keeps them
 * in sync with what the admin has configured. Uses the public, unauthenticated
 * endpoint so it works for logged-out visitors on marketing pages (Home) as
 * well as inside the logged-in customer portal.
 */
export function useSiteImages(placement) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get("/public/site-images", { params: { placement } });
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        if (active) setImages(items);
      } catch (e) {
        // Non-fatal — pages that show admin images always have a sensible
        // default/fallback visual, so a failed fetch just means "no extra images".
        if (active) setImages([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [placement]);

  return { images, loading };
}

export default useSiteImages;
