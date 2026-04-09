import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Heading2, Undo, Redo, Minus } from 'lucide-react';

interface NewsEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export default function NewsEditor({ content, onChange }: NewsEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
  });

  if (!editor) return null;

  const ToolButton = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
        <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolButton>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading">
          <Heading2 className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <List className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
          <ListOrdered className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <Minus className="w-4 h-4" />
        </ToolButton>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo className="w-4 h-4" />
        </ToolButton>
      </div>
      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
