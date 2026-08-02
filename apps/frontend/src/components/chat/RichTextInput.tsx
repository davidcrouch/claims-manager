'use client';

import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';

export interface RichTextInputRef {
  focus: () => void;
  clear: () => void;
  getText: () => string;
  setContent: (text: string) => void;
}

interface RichTextInputProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  initialValue?: string;
  onChange?: (text: string) => void;
}

export const RichTextInput = forwardRef<RichTextInputRef, RichTextInputProps>(
  function RichTextInput(
    { onSubmit, placeholder, disabled, className, initialValue, onChange },
    ref,
  ) {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
        }),
        Placeholder.configure({
          placeholder: placeholder ?? 'Type a message...',
          emptyEditorClass: 'is-editor-empty',
        }),
      ],
      content: initialValue ?? '',
      editable: !disabled,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: cn(
            'min-h-[36px] max-h-[50vh] overflow-y-auto px-0 py-0 text-sm focus:outline-none',
            'prose prose-sm max-w-none prose-p:my-0 prose-p:leading-relaxed',
          ),
          'aria-label': 'Chat message input',
        },
        handleKeyDown: (_view, event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const text = editor?.getText()?.trim();
            if (text) {
              onSubmit(text);
              editor?.commands.clearContent();
            }
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: e }) => {
        onChange?.(e.getText());
      },
    });

    useEffect(() => {
      if (editor && disabled !== undefined) {
        editor.setEditable(!disabled);
      }
    }, [editor, disabled]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editor?.commands.focus(),
        clear: () => editor?.commands.clearContent(),
        getText: () => editor?.getText() ?? '',
        setContent: (text: string) => editor?.commands.setContent(text),
      }),
      [editor],
    );

    return (
      <div className={cn('chat-rich-text flex-1', className)}>
        <EditorContent editor={editor} />
        <style>{`
          .chat-rich-text .ProseMirror p.is-editor-empty:first-child::before {
            color: #94a3b8;
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
        `}</style>
      </div>
    );
  },
);
