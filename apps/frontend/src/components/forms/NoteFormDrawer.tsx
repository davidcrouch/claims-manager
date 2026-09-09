'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  StickyNote,
  Bold,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { createNoteAction } from '@/app/(app)/messages/actions';
import { cn } from '@/lib/utils';

export interface NoteFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
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

export function NoteFormDrawer({
  open,
  onOpenChange,
  jobId,
}: NoteFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: 'Write a note…',
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = editor?.getHTML() ?? '';
    const textContent = editor?.getText()?.trim() ?? '';
    if (!textContent) {
      setError('Note body is required');
      return;
    }
    if (!jobId) {
      setError('A job is required to add a note');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await createNoteAction({ jobId, body });
      if (result.success) {
        onOpenChange(false);
        editor?.commands.clearContent();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to add note');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add Note"
      description="Add an internal note for this job. Notes are not sent as messages."
      icon={<StickyNote className="h-5 w-5" />}
    >
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="space-y-2">
            <Label>Note</Label>
            <div className="rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
              <EditorToolbar editor={editor} />
              <EditorContent editor={editor} />
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
            {submitting ? 'Saving…' : 'Add Note'}
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
