export default function DashboardLoading() {
  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="overflow-hidden rounded-[2rem] border border-[rgba(24,44,41,0.09)] bg-white shadow-[0_35px_85px_-38px_rgba(21,49,46,0.32)]">
          <div className="grid min-h-[860px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden border-r border-[rgba(24,44,41,0.09)] bg-[#f4efe6] px-5 py-6 lg:block">
              <div className="h-11 rounded-2xl bg-gradient-to-r from-white/40 via-[rgba(18,108,100,0.12)] to-white/40 bg-[length:200%_100%] [animation:shimmer_2.4s_infinite_linear]" />
              <div className="mt-8 grid gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 rounded-2xl bg-gradient-to-r from-white/40 via-[rgba(18,108,100,0.12)] to-white/40 bg-[length:200%_100%] [animation:shimmer_2.4s_infinite_linear]" />
                ))}
              </div>
            </aside>
            <main className="px-5 py-6 lg:px-6 xl:px-8">
              <div className="h-20 rounded-[1.7rem] bg-gradient-to-r from-white/40 via-[rgba(18,108,100,0.12)] to-white/40 bg-[length:200%_100%] [animation:shimmer_2.4s_infinite_linear]" />
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 rounded-[1.9rem] bg-gradient-to-r from-white/40 via-[rgba(18,108,100,0.12)] to-white/40 bg-[length:200%_100%] [animation:shimmer_2.4s_infinite_linear]" />
                ))}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
