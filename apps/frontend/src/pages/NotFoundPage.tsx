import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="font-mono text-sm text-sand">404</p>
        <h1 className="text-2xl font-bold text-strong">Nothing here</h1>
        <Link to="/" className="text-sm text-link">Back to the console</Link>
      </div>
    </div>
  );
}
