import { motion } from "framer-motion";
import { useSiteImages } from "@/hooks/useSiteImages";

/**
 * Renders admin-uploaded images (Admin → Settings → Images) for a given
 * placement. Renders nothing when there are no active images for that
 * placement, so it never leaves an empty gap on pages that don't have any
 * uploaded yet.
 */
export default function SiteImageGallery({ placement, title, className = "", container = true }) {
  const { images, loading } = useSiteImages(placement);
  if (loading || !images.length) return null;

  return (
    <section className={`${container ? "max-w-7xl mx-auto px-6" : ""} ${className}`}>
      {title && <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#0A2540] mb-4">{title}</h2>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {images.map((img, i) => (
          <motion.figure
            key={img.id || i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-sm"
          >
            <div className="aspect-video w-full bg-zinc-100">
              <img
                src={img.image}
                alt={img.title || "NTAXCO"}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            {img.title && (
              <figcaption className="px-4 py-3 text-sm font-medium text-zinc-800">{img.title}</figcaption>
            )}
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
