import { useEffect, useState } from "react";
import api from "@/lib/api";

/**
 * Fetches the 3 admin-managed Customer/Home page images (Admin → Settings →
 * Images → "Home Page Images") and merges them over the given defaults —
 * keyed by the stable slot ids customer_home_image_1/2/3.
 *
 * Uses the public, unauthenticated endpoint so it works for logged-out
 * visitors on the marketing Home page. Any slot that's missing (not yet
 * seeded), inactive, or fails to load simply keeps its default image — the
 * 3 existing Home page positions never go blank.
 *
 * This is intentionally separate from useSiteImages/SiteImageGallery
 * ("Featured" images) — these are the 3 fixed, always-present Home page
 * images, not the open-ended featured gallery.
 */
export function useHomeImages(defaults) {
  const [images, setImages] = useState(defaults);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get("/public/home-images");
        const overrides = data?.data && typeof data.data === "object" ? data.data : {};
        if (active) setImages((prev) => ({ ...prev, ...overrides }));
      } catch (e) {
        // Non-fatal — keep showing the default images.
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return images;
}

export default useHomeImages;
