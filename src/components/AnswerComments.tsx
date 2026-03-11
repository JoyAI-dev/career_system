'use client';

import { useActionState, useTransition, useRef, useEffect } from 'react';
import { addComment, type ActionState } from '@/server/actions/comment';
import { Button } from '@/components/ui/button';

type Comment = {
  id: string;
  content: string;
  activityTag: string | null;
  createdAt: string;
};

type Props = {
  responseAnswerId: string;
  comments: Comment[];
  activityTag?: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AnswerComments({ responseAnswerId, comments, activityTag }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(addComment, {});
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <div className="mt-3 space-y-2">
      {/* Existing comments */}
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <p className="text-sm">{comment.content}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(comment.createdAt)}</span>
                {comment.activityTag && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {comment.activityTag}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      <form
        ref={formRef}
        action={(formData) => startTransition(() => formAction(formData))}
        className="flex gap-2"
      >
        <input type="hidden" name="responseAnswerId" value={responseAnswerId} />
        {activityTag && <input type="hidden" name="activityTag" value={activityTag} />}
        <input
          name="content"
          placeholder="Add a reflection..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          maxLength={1000}
        />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? '...' : 'Add'}
        </Button>
      </form>

      {state.errors?.content && (
        <p className="text-xs text-destructive">{state.errors.content[0]}</p>
      )}
      {state.errors?._form && (
        <p className="text-xs text-destructive">{state.errors._form[0]}</p>
      )}
    </div>
  );
}
