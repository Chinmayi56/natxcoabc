import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmptyState({ icon: Icon = Inbox, title = "Nothing here yet", description, action, testId = "empty-state" }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6" data-testid={testId}>
      <div className="h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-zinc-400" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-zinc-800">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && (
        <Button className="mt-5 bg-brand text-zinc-900 hover:bg-brand-hover font-semibold" onClick={action.onClick} data-testid="empty-state-action">
          {action.label}
        </Button>
      )}
    </div>
  );
}
