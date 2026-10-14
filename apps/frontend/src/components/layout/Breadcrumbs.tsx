import { Fragment } from "react";
import { Link } from "react-router";

/** Projects / Argus / production / argus-api. The last item is the current page. */
export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-0.5">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={i}>
            {c.to && !last ? (
              <Link to={c.to} className="rounded-lg px-2 py-[5px] text-[11.5px] text-sand hover:bg-hover hover:text-strong">
                {c.label}
              </Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className="px-2 py-[5px] text-[11.5px] text-muted-deep">
                {c.label}
              </span>
            )}
            {!last && <span className="text-[11.5px] text-focus">/</span>}
          </Fragment>
        );
      })}
    </nav>
  );
}
