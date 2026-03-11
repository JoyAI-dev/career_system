'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  createDraftVersion,
  publishVersion,
  setActiveVersion,
  deleteDraftVersion,
  createTopic,
  updateTopic,
  deleteTopic,
  reorderTopic,
  createDimension,
  updateDimension,
  deleteDimension,
  reorderDimension,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestion,
  createQuestionNote,
  updateQuestionNote,
  deleteQuestionNote,
  type ActionState,
} from '@/server/actions/questionnaire';

// ─── Types ──────────────────────────────────────────────────────────

type QuestionNote = {
  id: string;
  questionId: string;
  label: string;
  content: string;
};

type AnswerOption = {
  id: string;
  questionId: string;
  label: string;
  score: number;
};

type Question = {
  id: string;
  dimensionId: string;
  title: string;
  order: number;
  notes: QuestionNote[];
  answerOptions: AnswerOption[];
};

type Dimension = {
  id: string;
  topicId: string;
  name: string;
  order: number;
  questions: Question[];
};

type Topic = {
  id: string;
  versionId: string;
  name: string;
  order: number;
  dimensions: Dimension[];
};

type VersionSummary = {
  id: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
};

type VersionStructure = {
  id: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  topics: Topic[];
} | null;

type Props = {
  versions: VersionSummary[];
  initialStructure: VersionStructure;
  initialVersionId: string | null;
};

// ─── Main Component ─────────────────────────────────────────────────

export function QuestionnaireManager({
  versions,
  initialStructure,
  initialVersionId,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedVersionId, setSelectedVersionId] = useState(initialVersionId);
  const t = useTranslations('admin.questionnaire');

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const isDraft = selectedVersion && !selectedVersion.isActive;
  const structure = initialStructure;

  return (
    <div className="space-y-6">
      {/* Version Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('versionManagement')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {/* Version Selector */}
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedVersionId ?? ''}
              onChange={(e) => {
                setSelectedVersionId(e.target.value || null);
                // Trigger page reload to fetch new structure
                window.location.href = `/admin/questionnaire?v=${e.target.value}`;
              }}
            >
              {versions.length === 0 && <option value="">{t('noVersions')}</option>}
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} ({v.isActive ? t('active') : t('draft')})
                </option>
              ))}
            </select>

            {/* Create Draft */}
            {!versions.some((v) => !v.isActive) && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await createDraftVersion();
                  })
                }
              >
                {isPending ? t('creating') : t('createNewDraft')}
              </Button>
            )}

            {/* Publish Draft */}
            {isDraft && selectedVersionId && (
              <>
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      if (confirm(t('confirmPublish'))) {
                        await publishVersion(selectedVersionId);
                      }
                    })
                  }
                >
                  {isPending ? t('publishing') : t('publishVersion')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      if (confirm(t('confirmDeleteDraft'))) {
                        await deleteDraftVersion(selectedVersionId);
                      }
                    })
                  }
                >
                  {t('deleteDraft')}
                </Button>
              </>
            )}

            {/* Set Active (for published versions) */}
            {selectedVersion && !selectedVersion.isActive && selectedVersionId && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    if (confirm(t('confirmSetActive'))) {
                      await setActiveVersion(selectedVersionId);
                    }
                  })
                }
              >
                {t('setAsActive')}
              </Button>
            )}
          </div>

          {versions.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('noVersionsHint')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Structure Tree */}
      {structure && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {t('structure')} — v{structure.version}
              {structure.isActive ? (
                <span className="ml-2 text-sm font-normal text-green-600 dark:text-green-400">
                  ({t('activeReadOnly')})
                </span>
              ) : (
                <span className="ml-2 text-sm font-normal text-amber-600 dark:text-amber-400">
                  ({t('draftEditable')})
                </span>
              )}
            </h2>
            {isDraft && <AddTopicButton versionId={structure.id} />}
          </div>

          {structure.topics.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t('noVersionsHint')}
              </CardContent>
            </Card>
          )}

          {structure.topics.map((topic, topicIdx) => (
            <TopicSection
              key={topic.id}
              topic={topic}
              isDraft={!!isDraft}
              isFirst={topicIdx === 0}
              isLast={topicIdx === structure.topics.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Topic Button + Dialog ──────────────────────────────────────

function AddTopicButton({ versionId }: { versionId: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('admin.questionnaire');
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await createTopic(prev, formData);
      if (result.success) setOpen(false);
      return result;
    },
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        {t('addTopic')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addTopic')}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="versionId" value={versionId} />
          {state.errors?.name && (
            <p className="text-sm text-destructive">{state.errors.name[0]}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="topic-name">{t('topicName')}</Label>
            <Input id="topic-name" name="name" required />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? t('adding') : t('addTopic')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Topic Section ──────────────────────────────────────────────────

function TopicSection({
  topic,
  isDraft,
  isFirst,
  isLast,
}: {
  topic: Topic;
  isDraft: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const t = useTranslations('admin.questionnaire');

  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateTopic(prev, formData);
      if (result.success) setEditOpen(false);
      return result;
    },
    {},
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-lg">{expanded ? '▼' : '▶'}</span>
            <CardTitle className="text-lg">{topic.name}</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({t('dimensionCount', { count: topic.dimensions.length })})
            </span>
          </button>
          {isDraft && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={isFirst || isPending}
                onClick={() =>
                  startTransition(async () => {
                    await reorderTopic(topic.id, 'up');
                  })
                }
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isLast || isPending}
                onClick={() =>
                  startTransition(async () => {
                    await reorderTopic(topic.id, 'down');
                  })
                }
              >
                ↓
              </Button>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger
                  render={<Button variant="ghost" size="sm" />}
                >
                  {t('edit')}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('editTopic')}</DialogTitle>
                  </DialogHeader>
                  <form action={editAction} className="space-y-4">
                    <input type="hidden" name="id" value={topic.id} />
                    {editState.errors?.name && (
                      <p className="text-sm text-destructive">{editState.errors.name[0]}</p>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor={`edit-topic-${topic.id}`}>{t('topicName')}</Label>
                      <Input
                        id={`edit-topic-${topic.id}`}
                        name="name"
                        defaultValue={topic.name}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={editPending}>
                      {editPending ? t('saving') : t('save')}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={isPending}
                onClick={() => {
                  if (confirm(t('confirmDeleteTopic', { name: topic.name }))) {
                    startTransition(async () => {
                      await deleteTopic(topic.id);
                    });
                  }
                }}
              >
                {t('delete')}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {isDraft && <AddDimensionButton topicId={topic.id} />}
          {topic.dimensions.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              {t('noDimensions')}
            </p>
          )}
          {topic.dimensions.map((dim, dimIdx) => (
            <DimensionSection
              key={dim.id}
              dimension={dim}
              isDraft={isDraft}
              isFirst={dimIdx === 0}
              isLast={dimIdx === topic.dimensions.length - 1}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Add Dimension Button ───────────────────────────────────────────

function AddDimensionButton({ topicId }: { topicId: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('admin.questionnaire');
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await createDimension(prev, formData);
      if (result.success) setOpen(false);
      return result;
    },
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent">
        + {t('addDimension')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addDimension')}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="topicId" value={topicId} />
          {state.errors?.name && (
            <p className="text-sm text-destructive">{state.errors.name[0]}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="dim-name">{t('dimensionName')}</Label>
            <Input id="dim-name" name="name" required />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? t('adding') : t('addDimension')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dimension Section ──────────────────────────────────────────────

function DimensionSection({
  dimension,
  isDraft,
  isFirst,
  isLast,
}: {
  dimension: Dimension;
  isDraft: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const t = useTranslations('admin.questionnaire');

  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateDimension(prev, formData);
      if (result.success) setEditOpen(false);
      return result;
    },
    {},
  );

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-sm">{expanded ? '▼' : '▶'}</span>
          <span className="font-medium">{dimension.name}</span>
          <span className="text-sm text-muted-foreground">
            ({t('questionCount', { count: dimension.questions.length })})
          </span>
        </button>
        {isDraft && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              disabled={isFirst || isPending}
              onClick={() =>
                startTransition(async () => {
                  await reorderDimension(dimension.id, 'up');
                })
              }
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={isLast || isPending}
              onClick={() =>
                startTransition(async () => {
                  await reorderDimension(dimension.id, 'down');
                })
              }
            >
              ↓
            </Button>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger
                render={<Button variant="ghost" size="xs" />}
              >
                {t('edit')}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('editDimension')}</DialogTitle>
                </DialogHeader>
                <form action={editAction} className="space-y-4">
                  <input type="hidden" name="id" value={dimension.id} />
                  {editState.errors?.name && (
                    <p className="text-sm text-destructive">{editState.errors.name[0]}</p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`edit-dim-${dimension.id}`}>{t('dimensionName')}</Label>
                    <Input
                      id={`edit-dim-${dimension.id}`}
                      name="name"
                      defaultValue={dimension.name}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={editPending}>
                    {editPending ? t('saving') : t('save')}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive"
              disabled={isPending}
              onClick={() => {
                if (confirm(t('confirmDeleteDimension', { name: dimension.name }))) {
                  startTransition(async () => {
                    await deleteDimension(dimension.id);
                  });
                }
              }}
            >
              {t('delete')}
            </Button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 pl-5">
          {isDraft && <AddQuestionButton dimensionId={dimension.id} />}
          {dimension.questions.length === 0 && (
            <p className="py-1 text-sm text-muted-foreground">{t('noQuestions')}</p>
          )}
          {dimension.questions.map((q, qIdx) => (
            <QuestionItem
              key={q.id}
              question={q}
              isDraft={isDraft}
              isFirst={qIdx === 0}
              isLast={qIdx === dimension.questions.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Question Button ────────────────────────────────────────────

function AddQuestionButton({ dimensionId }: { dimensionId: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('admin.questionnaire');
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await createQuestion(prev, formData);
      if (result.success) setOpen(false);
      return result;
    },
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-7 items-center justify-center rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent">
        + {t('addQuestion')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addQuestion')}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="dimensionId" value={dimensionId} />
          {state.errors?.title && (
            <p className="text-sm text-destructive">{state.errors.title[0]}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="q-title">{t('questionTitle')}</Label>
            <Input id="q-title" name="title" required />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? t('adding') : t('addQuestion')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Question Item ──────────────────────────────────────────────────

function QuestionItem({
  question,
  isDraft,
  isFirst,
  isLast,
}: {
  question: Question;
  isDraft: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const t = useTranslations('admin.questionnaire');

  const optionsSum = question.answerOptions.reduce((sum, o) => sum + o.score, 0);

  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateQuestion(prev, formData);
      if (result.success) setEditOpen(false);
      return result;
    },
    {},
  );

  return (
    <div className="rounded border bg-background p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm">{question.title}</p>
          <div className="mt-1 flex items-center gap-3">
            {question.notes.length > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setNotesExpanded(!notesExpanded)}
              >
                {notesExpanded ? '▼' : '▶'} {t('noteCount', { count: question.notes.length })}
              </button>
            )}
            <Link
              href={`/admin/questionnaire/${question.id}/options`}
              className={`text-xs hover:text-foreground ${
                optionsSum === 100
                  ? 'text-green-600 dark:text-green-400'
                  : optionsSum > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
              }`}
            >
              {t('optionCount', { count: question.answerOptions.length })} ({t('optionSum', { sum: optionsSum })})
            </Link>
          </div>
        </div>
        {isDraft && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              disabled={isFirst || isPending}
              onClick={() =>
                startTransition(async () => {
                  await reorderQuestion(question.id, 'up');
                })
              }
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={isLast || isPending}
              onClick={() =>
                startTransition(async () => {
                  await reorderQuestion(question.id, 'down');
                })
              }
            >
              ↓
            </Button>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger
                render={<Button variant="ghost" size="xs" />}
              >
                {t('edit')}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('editQuestion')}</DialogTitle>
                </DialogHeader>
                <form action={editAction} className="space-y-4">
                  <input type="hidden" name="id" value={question.id} />
                  {editState.errors?.title && (
                    <p className="text-sm text-destructive">{editState.errors.title[0]}</p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`edit-q-${question.id}`}>{t('questionTitle')}</Label>
                    <Input
                      id={`edit-q-${question.id}`}
                      name="title"
                      defaultValue={question.title}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={editPending}>
                    {editPending ? t('saving') : t('save')}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <AddNoteButton questionId={question.id} />
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive"
              disabled={isPending}
              onClick={() => {
                if (confirm(t('confirmDeleteQuestion'))) {
                  startTransition(async () => {
                    await deleteQuestion(question.id);
                  });
                }
              }}
            >
              {t('delete')}
            </Button>
          </div>
        )}
      </div>
      {/* Notes display */}
      {notesExpanded && question.notes.length > 0 && (
        <div className="mt-2 space-y-1 border-t pt-2">
          {question.notes.map((note) => (
            <NoteItem key={note.id} note={note} isDraft={isDraft} />
          ))}
        </div>
      )}
      {/* Show notes inline when no toggle needed and in read-only mode */}
      {!isDraft && question.notes.length > 0 && !notesExpanded && null}
    </div>
  );
}

// ─── Add Note Button ────────────────────────────────────────────────

function AddNoteButton({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('admin.questionnaire');
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await createQuestionNote(prev, formData);
      if (result.success) setOpen(false);
      return result;
    },
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="xs" />}
      >
        + {t('addNote')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addNote')}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="questionId" value={questionId} />
          {state.errors?.label && (
            <p className="text-sm text-destructive">{state.errors.label[0]}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="note-label">{t('noteLabel')}</Label>
            <Input id="note-label" name="label" required />
          </div>
          {state.errors?.content && (
            <p className="text-sm text-destructive">{state.errors.content[0]}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="note-content">{t('noteContent')}</Label>
            <textarea
              id="note-content"
              name="content"
              required
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? t('adding') : t('addNote')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Note Item ──────────────────────────────────────────────────────

function NoteItem({ note, isDraft }: { note: QuestionNote; isDraft: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const t = useTranslations('admin.questionnaire');

  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateQuestionNote(prev, formData);
      if (result.success) setEditOpen(false);
      return result;
    },
    {},
  );

  return (
    <div className="flex items-start justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
      <div>
        <span className="font-medium">{note.label}:</span>{' '}
        <span className="text-muted-foreground">{note.content}</span>
      </div>
      {isDraft && (
        <div className="flex shrink-0 items-center gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger
              render={<Button variant="ghost" size="xs" />}
            >
              {t('edit')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('editNote')}</DialogTitle>
              </DialogHeader>
              <form action={editAction} className="space-y-4">
                <input type="hidden" name="id" value={note.id} />
                {editState.errors?.label && (
                  <p className="text-sm text-destructive">{editState.errors.label[0]}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor={`edit-note-${note.id}-label`}>{t('noteLabel')}</Label>
                  <Input
                    id={`edit-note-${note.id}-label`}
                    name="label"
                    defaultValue={note.label}
                    required
                  />
                </div>
                {editState.errors?.content && (
                  <p className="text-sm text-destructive">{editState.errors.content[0]}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor={`edit-note-${note.id}-content`}>{t('noteContent')}</Label>
                  <textarea
                    id={`edit-note-${note.id}-content`}
                    name="content"
                    defaultValue={note.content}
                    required
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button type="submit" disabled={editPending}>
                  {editPending ? t('saving') : t('save')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="xs"
            className="text-destructive"
            disabled={isPending}
            onClick={() => {
              if (confirm(t('confirmDeleteNote'))) {
                startTransition(async () => {
                  await deleteQuestionNote(note.id);
                });
              }
            }}
          >
            {t('delete')}
          </Button>
        </div>
      )}
    </div>
  );
}
