export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="rounded-[24px] bg-black/5 h-[200px] p-8">
        <div className="h-4 w-32 bg-black/10 rounded-full" />
        <div className="h-8 w-64 bg-black/10 rounded-xl mt-4" />
        <div className="mt-8 grid grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i=><div key={i} className="h-20 bg-black/5 rounded-xl" />)}
        </div>
      </div>
      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 h-[180px] bg-white border border-black/10 rounded-[20px]" />
        <div className="md:col-span-4 h-[180px] bg-black/5 rounded-[20px]" />
      </div>
      <div className="h-[300px] bg-white border border-black/10 rounded-[20px]" />
    </div>
  );
}
