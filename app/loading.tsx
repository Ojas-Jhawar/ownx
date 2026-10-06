export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading">
      <span className="size-6 animate-spin rounded-full border-2 border-border border-t-brand" />
    </div>
  )
}
