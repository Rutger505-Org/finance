import type { ActionResult } from "@/app/actions";

export function ResultMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return result.message ? <p className="text-sm text-emerald-700">{result.message}</p> : null;
  }
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-medium">{result.error}</p>
      {result.issues && result.issues.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {result.issues.map((issue, index) => (
            <li key={index}>
              {issue.path && <code className="font-mono">{issue.path}</code>}
              {issue.path && ": "}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
