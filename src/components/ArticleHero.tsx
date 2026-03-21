import Image from "next/image";
import Link from "next/link";

interface ArticleHeroProps {
  title: string;
  excerpt: string;
  featuredImage: string;
  date: string;
  formattedDate: string;
  category?: { name: string; slug: string };
}

export default function ArticleHero({
  title,
  excerpt,
  featuredImage,
  date,
  formattedDate,
  category,
}: ArticleHeroProps) {
  return (
    <section className="relative w-full h-[320px] sm:h-[420px] md:h-[500px] lg:h-[560px] overflow-hidden">
      {/* Background image */}
      <Image
        src={featuredImage}
        alt={title}
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />

      {/* Dark gradient overlay — stronger at bottom for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

      {/* Content positioned at bottom */}
      <div className="absolute inset-0 flex flex-col justify-end px-6 sm:px-8 md:px-12 pb-8 md:pb-12">
        <div className="max-w-3xl">
          {/* Breadcrumb */}
          <nav className="text-sm text-white/70 mb-3">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/guides" className="hover:text-white transition-colors">
              Guides
            </Link>
            {category && (
              <>
                <span className="mx-2">/</span>
                <span className="text-white/90">{category.name}</span>
              </>
            )}
          </nav>

          {/* Category badge */}
          {category && (
            <span className="inline-block bg-orange-500/90 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
              {category.name}
            </span>
          )}

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] font-bold text-white leading-tight mb-3 drop-shadow-lg">
            {title}
          </h1>

          {/* Excerpt */}
          <p className="text-sm sm:text-base text-white/80 mb-4 max-w-2xl line-clamp-2 leading-relaxed">
            {excerpt}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-sm text-white/70">
            <time dateTime={date}>{formattedDate}</time>
            <span className="w-1 h-1 rounded-full bg-white/50" />
            <span>TravelPlanInfo</span>
          </div>
        </div>
      </div>

      {/* Scroll-down indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50 animate-bounce">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </section>
  );
}
