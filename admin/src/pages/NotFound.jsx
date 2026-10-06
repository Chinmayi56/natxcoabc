import { useNavigate } from "react-router-dom";
import Logo from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center" data-testid="not-found-page">
      <Logo className="h-10 mb-8" />
      <div className="h-16 w-16 rounded-2xl bg-brand-faint flex items-center justify-center mb-6">
        <FileQuestion className="h-8 w-8 text-brand-hover" />
      </div>
      <h1 className="font-heading text-6xl font-extrabold text-zinc-900">404</h1>
      <p className="text-lg text-zinc-700 mt-2 font-medium">Page not found</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">The page you're looking for doesn't exist or has been moved.</p>
      <Button className="mt-8 bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={() => navigate("/")} data-testid="back-home-btn">
        <Home className="h-4 w-4 mr-2" />Back to Home
      </Button>
    </div>
  );
}
