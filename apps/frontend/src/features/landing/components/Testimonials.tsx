import { QUOTES } from "../data";

export function Testimonials() {
  return (
    <section className="border-t border-[#161718]">
      <div className="mx-auto flex max-w-[1248px] flex-col gap-10 px-6 pt-32">
        <div className="flex flex-wrap gap-3">
          {QUOTES.map((q) => (
            <figure
              key={q.name}
              className={`m-0 flex min-h-[400px] min-w-[min(100%,320px)] flex-col justify-between gap-24 rounded-xl p-8 ${q.wide ? "flex-[2_1_460px]" : "flex-[1_1_300px]"}`}
              style={{ background: q.bg }}
            >
              <blockquote className="m-0 max-w-[640px] text-[clamp(26px,2.8vw,38px)] leading-[1.15] font-[510] tracking-[-0.8px] text-pretty text-[#08090a]">{q.text}</blockquote>
              <figcaption className="flex items-center gap-4">
                <span className="grid size-10 place-items-center rounded-full bg-[#08090a] text-[13px] font-[590] text-white">{q.init}</span>
                <span className="flex flex-col gap-0.5 border-l border-[rgba(8,9,10,0.15)] pl-4">
                  <span className="text-[15px] font-[590] text-[#08090a]">{q.name}</span>
                  <span className="text-sm text-[#383b3f]">{q.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
