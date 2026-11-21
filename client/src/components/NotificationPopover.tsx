import { AppIcon } from "@/components/icons/AppIcon";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function NotificationPopover({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const inbox = trpc.notifications.list.useQuery(undefined, { enabled });
  const refresh = () => utils.notifications.invalidate();
  const onError = (error: { message: string }) => toast.error(error.message);
  const read = trpc.notifications.markRead.useMutation({ onSuccess: refresh, onError });
  const all = trpc.notifications.markAllRead.useMutation({ onSuccess: refresh, onError });
  const unread = enabled ? inbox.data?.filter(notification => !notification.isRead).length ?? 0 : 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
          className="web-button relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <AppIcon name="Bell" size={18} />
          {enabled && unread > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={12} aria-label="Notifications"
        className="w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <h2 className="font-semibold">Notifications {unread > 0 && <span className="text-sm text-muted-foreground">({unread} unread)</span>}</h2>
          <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)}
            className="web-button rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <AppIcon name="X" size={16} />
          </button>
        </div>
        <div className="max-h-[min(440px,60vh)] overflow-y-auto" aria-live="polite">
          {enabled && inbox.isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading notifications...</p>
          ) : enabled && inbox.isError ? (
            <div className="p-6 text-center text-sm">
              <p className="text-muted-foreground">Could not load notifications.</p>
              <button type="button" onClick={() => void inbox.refetch()} className="web-button mt-2 font-semibold text-emerald-600 hover:underline">Try again</button>
            </div>
          ) : !enabled || !inbox.data?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <AppIcon name="Bell" className="mx-auto mb-3 opacity-50" size={28} />
              No notifications yet.
            </div>
          ) : inbox.data.map(notification => {
            const link = notification.data?.link;
            return (
              <article key={notification.id} className={`border-b p-4 last:border-0 ${notification.isRead ? "" : "bg-emerald-500/5"}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><AppIcon name="Bell" size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-semibold">{notification.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{notification.body}</p>
                    <time dateTime={new Date(notification.createdAt).toISOString()} className="mt-2 block text-xs text-muted-foreground">{new Date(notification.createdAt).toLocaleString()}</time>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                      {!notification.isRead && <button type="button" disabled={read.isPending || all.isPending}
                        onClick={() => read.mutate({ notificationId: notification.id })}
                        className="web-button inline-flex items-center gap-1 text-emerald-600 hover:underline disabled:opacity-50"><AppIcon name="Check" size={14} />Mark as read</button>}
                      {typeof link === "string" && link.startsWith("/") && !link.startsWith("//") && (
                        <button type="button" className="web-button text-emerald-600 hover:underline" onClick={() => {
                          if (!notification.isRead) read.mutate({ notificationId: notification.id });
                          setOpen(false);
                          setLocation(link);
                        }}>Open</button>
                      )}
                    </div>
                  </div>
                  {!notification.isRead && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" />}
                </div>
              </article>
            );
          })}
        </div>
        {enabled && unread > 0 && <div className="border-t p-3">
          <button type="button" disabled={all.isPending || read.isPending} onClick={() => all.mutate()}
            className="web-button flex w-full items-center justify-center gap-2 rounded-lg p-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50">
            <AppIcon name="CheckCircle2" size={16} />Mark all as read
          </button>
        </div>}
      </PopoverContent>
    </Popover>
  );
}
