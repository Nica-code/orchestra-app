// Skeleton loaders. Co-located in one file; each is exported individually.
const bar = 'animate-pulse rounded bg-slate-200';

function Card() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className={`${bar} h-5 w-1/3`} />
      <div className={`${bar} mt-3 h-4 w-2/3`} />
      <div className={`${bar} mt-2 h-4 w-1/2`} />
    </div>
  );
}

export function ConcertListSkeleton() {
  return <div className="space-y-3">{[0, 1, 2].map((i) => <Card key={i} />)}</div>;
}

export function TemplateListSkeleton() {
  return <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Card key={i} />)}</div>;
}

export function MusicianListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
          <div className={`${bar} h-4 w-8`} />
          <div className={`${bar} h-4 flex-1`} />
          <div className={`${bar} h-4 w-24`} />
          <div className={`${bar} h-4 w-16`} />
        </div>
      ))}
    </div>
  );
}

export function SendLogSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
          <div className={`${bar} h-4 w-8`} />
          <div className={`${bar} h-4 flex-1`} />
          <div className={`${bar} h-4 w-28`} />
          <div className={`${bar} h-4 w-20`} />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className={`${bar} h-4 w-2/3`} />
            <div className={`${bar} mt-2 h-7 w-1/3`} />
          </div>
        ))}
      </div>
      <ConcertListSkeleton />
    </div>
  );
}

export function BillingPageSkeleton() {
  return (
    <div className="space-y-4">
      <Card />
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className={`${bar} h-4 w-1/3`} />
        <div className={`${bar} mt-3 h-2.5 w-full`} />
      </div>
      <Card />
    </div>
  );
}
