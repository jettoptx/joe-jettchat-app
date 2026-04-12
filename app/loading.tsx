export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-500"></div>
        <p className="text-sm font-mono text-zinc-500">Loading JettChat...</p>
      </div>
    </div>
  );
}
