'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  MessageSquare,
  Bold,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { createMessageAction } from '@/app/(app)/jobs/[id]/actions';
import { cn } from '@/lib/utils';

/** Keep in sync with apps/api/src/modules/messages/message-subjects.ts */
const MESSAGE_SUBJECTS = [
  'Contentious claim',
  'General',
  'Repair Update',
  'Status Update',
  'Customer Complaint - Supplier Services',
  'Vulnerable Customer',
  'Customer Complaint - Insurance Services',
  'Cancellation Request',
  'Cash Settlement Request',
  'Update Required',
] as const;

const messageFormSchema = z.object({
  subject: z.enum(MESSAGE_SUBJECTS, {
    error: 'Subject is required',
  }),
  acknowledgementRequired: z.boolean(),
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

export interface MessageFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Job-scoped send (CW fromJobId/toJobId). */
  jobId?: string | null;
  /** Claim-scoped send (CW fromClaimId/toClaimId). Ignored when jobId is set. */
  claimId?: string | null;
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    cn(
      'inline-flex h-7 w-7 items-center justify-center rounded transition-colors',
      active
        ? 'bg-slate-200 text-slate-900'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
    );

  return (
    <div className="flex items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive('bold'))}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive('italic'))}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass(editor.isActive('strike'))}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <div className="mx-1 h-4 w-px bg-slate-200" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive('bulletList'))}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive('orderedList'))}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function MessageFormDrawer({
  open,
  onOpenChange,
  jobId,
  claimId,
}: MessageFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<MessageFormValues>({
    resolver: standardSchemaResolver(messageFormSchema),
    defaultValues: {
      subject: undefined,
      acknowledgementRequired: false,
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: 'Compose your message...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[320px] max-h-[80vh] overflow-y-auto px-3 py-2 text-sm focus:outline-none',
          'prose prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed',
          'prose-ul:my-1 prose-ol:my-1 prose-li:my-0',
        ),
      },
    },
  });

  async function onSubmit(values: MessageFormValues) {
    const body = editor?.getHTML() ?? '';
    const textContent = editor?.getText()?.trim() ?? '';
    if (!textContent) {
      setError('Message body is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        subject: values.subject,
        text: body,
        acknowledgementRequired: values.acknowledgementRequired,
      };
      if (jobId) {
        payload.fromJobId = jobId;
        payload.toJobId = jobId;
      } else if (claimId) {
        payload.fromClaimId = claimId;
        payload.toClaimId = claimId;
      } else {
        setError('A job or claim is required to send a message');
        setSubmitting(false);
        return;
      }
      const result = await createMessageAction(payload);
      if (result.success) {
        onOpenChange(false);
        form.reset({ subject: undefined, acknowledgementRequired: false });
        editor?.commands.clearContent();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to send message');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Send Message"
      description={
        jobId
          ? 'Compose and send a message related to this job.'
          : 'Compose and send a message related to this claim.'
      }
      icon={<MessageSquare className="h-5 w-5" />}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="w-1/2 min-w-0 space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Controller
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? null}
                      onValueChange={(v) => field.onChange(v ?? undefined)}
                    >
                      <SelectTrigger id="subject" className="w-full">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {MESSAGE_SUBJECTS.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.subject && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.subject.message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Controller
                  control={form.control}
                  name="acknowledgementRequired"
                  render={({ field }) => (
                    <Switch
                      id="acknowledgementRequired"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(!!v)}
                    />
                  )}
                />
                <Label htmlFor="acknowledgementRequired" className="cursor-pointer">
                  Requires Acknowledgement
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <div className="rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                <EditorToolbar editor={editor} />
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Message'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #94a3b8;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </BottomFormDrawer>
  );
}
