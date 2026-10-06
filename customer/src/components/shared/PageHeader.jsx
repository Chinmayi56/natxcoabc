export default function PageHeader({ title, subtitle, breadcrumb = [], actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6" data-testid="page-header">
      <div>
        {breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-zinc-300">/</span>}
                <span className={i === breadcrumb.length - 1 ? "text-zinc-700 font-medium" : ""}>{b}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-zinc-900">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
