export function EmptyIdentityState({ text }: { text: string }) {
  return (
    <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-zinc-300 px-5 text-center dark:border-white/10">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{text}</p>
    </div>
  );
}
