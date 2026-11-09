
import { useEffect, useMemo, useRef, useState } from 'react';

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import html2pdf from 'html2pdf.js';
import rehypeSlug from 'rehype-slug';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Sidebar from './components/Sidebar.jsx';

import 'katex/dist/katex.min.css';
import './App.css';

const initialMarkdown = `# Machine Learning Notes

## 1. Introduction

Machine Learning is a branch of Artificial Intelligence that enables computers to learn from data.

## 2. Linear Regression

Linear Regression predicts continuous values using a linear relationship.

### Mathematical Equation

The equation of a straight line is:

$$
y = mx + c
$$

### Mean Squared Error

$$
MSE = \\frac{1}{n}\\sum_{i=1}^{n}(y_i - \\hat{y}_i)^2
$$

## 3. Types of Machine Learning

| Type | Description |
|---|---|
| Supervised | Uses labelled data |
| Unsupervised | Uses unlabelled data |
| Reinforcement | Learns through rewards |

## 4. Important Points

- Predicts continuous values.
- Learns patterns from data.
- Used in prediction problems.

## 5. Conclusion

Machine Learning helps computers make predictions using historical data.
`;

/* Convert common LaTeX delimiters into remark-math syntax. */
function normalizeMath(markdown) {
  const codeBlocks = [];

  let content = markdown.replace(
    /(^\s*```[\s\S]*?^\s*```[ \t]*$|^\s*~~~[\s\S]*?^\s*~~~[ \t]*$)/gm,
    (block) => {
      const token = `NOTEFLOW_CODE_${codeBlocks.length}_TOKEN`;
      codeBlocks.push({ token, block });
      return token;
    }
  );

  content = content.replace(
    /\\{1,2}\[([\s\S]*?)\\{1,2}\]/g,
    (_, formula) => `\n\n$$\n${formula.trim()}\n$$\n\n`
  );

  content = content.replace(
    /\\{1,2}\(([\s\S]*?)\\{1,2}\)/g,
    (_, formula) => `$${formula.trim()}$`
  );

  for (const item of codeBlocks) {
    content = content.replace(item.token, item.block);
  }

  return content;
}

/* Convert rich clipboard HTML into Markdown. */
function convertRichContentToMarkdown(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const mathExpressions = [];

  const mathElements = Array.from(
    doc.body.querySelectorAll(
      '.katex-display, .katex, mjx-container, math, script[type="math/tex"]'
    )
  ).filter((element) => {
    return !element.parentElement?.closest(
      '.katex-display, .katex, mjx-container, math, script[type="math/tex"]'
    );
  });

  mathElements.forEach((element) => {
    const annotation = element.querySelector(
      'annotation[encoding="application/x-tex"]'
    );

    const latex =
      annotation?.textContent?.trim() ||
      element.getAttribute('aria-label')?.trim() ||
      element.getAttribute('alttext')?.trim() ||
      element.getAttribute('data-math')?.trim() ||
      (element.matches('script[type="math/tex"]')
        ? element.textContent.trim()
        : '');

    if (!latex) return;

    const isDisplay =
      element.classList.contains('katex-display') ||
      element.matches('mjx-container[display="true"]') ||
      element.getAttribute('display') === 'block';

    const isInsideTable = Boolean(element.closest('td, th'));

    const formula =
      isDisplay && !isInsideTable
        ? `\n\n$$\n${latex}\n$$\n\n`
        : `$${latex}$`;

    const token = `NOTEFLOW_MATH_${mathExpressions.length}_TOKEN`;

    mathExpressions.push({ token, formula });
    element.replaceWith(doc.createTextNode(token));
  });

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*'
  });

  turndown.use(gfm);

  let markdown = turndown.turndown(doc.body.innerHTML);

  for (const item of mathExpressions) {
    markdown = markdown.replaceAll(item.token, item.formula);
  }

  return markdown.trim();
}

function App() {
  const [sortBy, setSortBy] = useState('recent');

  const [activeTab, setActiveTab] = useState('split');

  const [rightOpen, setRightOpen] = useState(true);

  const [mobileDrawer, setMobileDrawer] = useState(null);

  const [importerOpen, setImporterOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importHtml, setImportHtml] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState('Saved');

  const [folders, setFolders] = useState(() => {
    try {
      const savedFolders = localStorage.getItem('noteflow-folders');
      if (savedFolders) {
        const parsedFolders = JSON.parse(savedFolders);
        if (
          Array.isArray(parsedFolders) &&
          parsedFolders.every((folder) => typeof folder === 'string') &&
          parsedFolders.includes('Uncategorized')
        ) {
          return parsedFolders;
        }
        console.error('Stored NoteFlow folders have an invalid format.');
      }
    } catch (error) {
      console.error('Unable to load NoteFlow folders:', error);
    }
    return ['Uncategorized'];
  });

  const [theme, setTheme] = useState(() => {
  return localStorage.getItem('noteflow-theme') || 'light';
});

useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('noteflow-theme', theme);
}, [theme]);

  const [activeFolder, setActiveFolder] = useState('All Notes');

  const [notes, setNotes] = useState(() => {
    try {
      const savedNotes = localStorage.getItem('noteflow-library');
      if (savedNotes) {
        const parsedNotes = JSON.parse(savedNotes);
        if (
          Array.isArray(parsedNotes) &&
          parsedNotes.every(
            (note) =>
              note &&
              typeof note.id === 'string' &&
              typeof note.title === 'string' &&
              typeof note.content === 'string'
          )
        ) {
          return parsedNotes.map((note) => ({
            ...note,
            folder: note.folder || 'Uncategorized',
            favorite: note.favorite ?? false,
            tags: note.tags || []
          }));
        }

        console.error('Stored NoteFlow library has an invalid format.');
      }
    } catch (error) {
      console.error('Unable to load the saved NoteFlow library:', error);
    }

    return [
      {
        id: 'note_001',
        title: 'Machine Learning',
        content: initialMarkdown,
        updatedAt: Date.now(),
        folder: 'Uncategorized',
        favorite: false,
        tags: []
      }
    ];
  });

  const [currentNoteId, setCurrentNoteId] = useState(() =>
    notes.find((note) => note.id === 'note_001')?.id || notes[0]?.id || ''
  );

  const editorRef = useRef(null);
  const previewRef = useRef(null);

  const currentNote =
    notes.find((note) => note.id === currentNoteId) || notes[0];
  const markdown = currentNote?.content || '';
  const filteredNotes = notes
    .filter((note) => {
      if (activeFolder === 'All Notes') return true;
      if (activeFolder === 'Favourites') return note.favorite === true;
      return (note.folder || 'Uncategorized') === activeFolder;
    })
    .filter((note) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
  switch (sortBy) {
    case 'oldest':
      return a.updatedAt - b.updatedAt;
    case 'az':
      return a.title.localeCompare(b.title);
    case 'za':
      return b.title.localeCompare(a.title);
    default:
      return b.updatedAt - a.updatedAt;
  }
});

  useEffect(() => {
    try {
      localStorage.setItem('noteflow-folders', JSON.stringify(folders));
    } catch (error) {
      console.error('Unable to save NoteFlow folders:', error);
    }
  }, [folders]);

function moveNoteToFolder(noteId, folderName) {
  setNotes((prevNotes) =>
    prevNotes.map((note) =>
      note.id === noteId
        ? {
            ...note,
            folder: folderName,
            updatedAt: Date.now()
          }
        : note
    )
  );
}

function toggleFavorite(noteId) {
  setNotes((prevNotes) =>
    prevNotes.map((note) =>
      note.id === noteId
        ? {
            ...note,
            favorite: !note.favorite,
            updatedAt: Date.now()
          }
        : note
    )
  );
}

  function setMarkdown(value) {
    setSaveStatus('Saving...');
    setNotes((previousNotes) =>
      previousNotes.map((note) => {
        if (note.id !== currentNoteId) {
          return note;
        }

        const updatedContent =
          typeof value === 'function' ? value(note.content) : value;

        return {
          ...note,
          content: updatedContent,
          updatedAt: Date.now()
        };
      })
    );
  }

  async function exportPDF() {
    const preview = previewRef.current;

    if (!preview) {
      alert('Markdown preview not found!');
      return;
    }

    const exportContainer = document.createElement('div');
    const clone = preview.cloneNode(true);

    exportContainer.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: 794px;
    background: #ffffff;
    z-index: -1;
  `;

    const pdfStyles = document.createElement('style');

    pdfStyles.textContent = `
    * {
      box-sizing: border-box !important;
    }

    .markdown-preview,
    .markdown-content {
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      background: #ffffff !important;
      color: #202b45 !important;
      font-family: Arial, sans-serif !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
    }

    h1, h2, h3, h4, p, li {
      overflow-wrap: normal !important;
      word-break: normal !important;
    }

    table {
      display: table !important;
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      overflow: visible !important;
      table-layout: auto !important;
    }

    th, td {
      padding: 8px !important;
      border: 1px solid #cccccc !important;
      word-break: normal !important;
      overflow-wrap: break-word !important;
    }

    pre {
      white-space: pre-wrap !important;
      overflow: visible !important;
      overflow-wrap: break-word !important;
    }

    img {
      max-width: 100% !important;
      height: auto !important;
    }

    .katex-display {
      overflow: visible !important;
      margin: 1em 0 !important;
    }

    h1, h2, h3, table, pre, blockquote {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    h1, h2, h3, h4 {
  break-after: avoid !important;
  page-break-after: avoid !important;
}

.katex-display {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

p {
  orphans: 3;
  widows: 3;
}

table,
pre,
blockquote {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}
  /* PDF PAGINATION FIX */

h1, h2, h3, h4 {
  break-after: avoid !important;
  page-break-after: avoid !important;
}

p {
  orphans: 3;
  widows: 3;
}

.katex-display {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

tr {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

th, td {
  break-inside: avoid !important;
}

img, pre, blockquote {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}


/* =================================
   NOTEFLOW PDF TYPOGRAPHY - V2
================================= */

.markdown-preview,
.markdown-content {
  font-family: Arial, Helvetica, sans-serif !important;
  font-size: 11pt !important;
  line-height: 1.7 !important;
  color: #273449 !important;
  letter-spacing: 0.1px !important;
}

/* Main heading */
h1 {
  font-size: 25pt !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  color: #172554 !important;
  margin-top: 20px !important;
  margin-bottom: 16px !important;
}

/* Section heading */
h2 {
  font-size: 19pt !important;
  font-weight: 700 !important;
  line-height: 1.35 !important;
  color: #1e3a8a !important;
  margin-top: 22px !important;
  margin-bottom: 12px !important;
}

/* Subsection heading */
h3 {
  font-size: 15pt !important;
  font-weight: 600 !important;
  line-height: 1.4 !important;
  color: #334155 !important;
  margin-top: 18px !important;
  margin-bottom: 9px !important;
}

h4 {
  font-size: 12pt !important;
  font-weight: 700 !important;
  color: #334155 !important;
}

/* Paragraphs */
p {
  font-size: 11pt !important;
  line-height: 1.7 !important;
  margin-top: 9px !important;
  margin-bottom: 11px !important;
  text-align: left !important;
}

/* Lists */
ul, ol {
  font-size: 10.5pt !important;
  line-height: 1.65 !important;
}

li {
  margin-bottom: 5px !important;
}

/* Tables */
table {
  font-size: 9.5pt !important;
  line-height: 1.5 !important;
}

th {
  font-weight: 700 !important;
  color: #172554 !important;
}

/* Inline code */
code {
  font-family: Consolas, monospace !important;
  font-size: 9.5pt !important;
}

/* Mathematical formulas */
.katex {
  font-size: 1.05em !important;
}

.katex-display {
  margin-top: 16px !important;
  margin-bottom: 16px !important;
}

/* Blockquotes */
blockquote {
  font-size: 10.5pt !important;
  line-height: 1.65 !important;
  color: #475569 !important;
}

/* Horizontal divider */
hr {
  border: none !important;
  border-top: 1px solid #cbd5e1 !important;
  margin: 18px 0 !important;
}


/* ADVANCED PDF PAGINATION */

/* Keep headings with the following content */
h1, h2, h3, h4 {
  break-after: avoid !important;
  page-break-after: avoid !important;
}

/* Keep mathematical formulas together */
.katex-display {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

/* Prevent table rows from splitting */
table {
  border-collapse: collapse !important;
}

thead {
  display: table-header-group !important;
}

tr, th, td {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

/* Keep code blocks and images together */
pre, img, blockquote {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

/* Improve paragraph splitting */
p {
  orphans: 3;
  widows: 3;
}


  `;

    exportContainer.appendChild(pdfStyles);
    exportContainer.appendChild(clone);
    document.body.appendChild(exportContainer);

    try {
      await document.fonts.ready;


      const options = {
        margin: [16, 12, 16, 12],

        filename: `${(currentNote?.title || 'Note').replace(/[\\/:*?"<>|]/g, '-')}.pdf`,

        image: {
          type: 'jpeg',
          quality: 0.98
        },

        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          scrollY: 0
        },

        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        },

        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: [
            'h1', 'h2', 'h3', 'h4',
            'tr', 'pre', 'blockquote',
            'img', '.katex-display'
          ]
        }
      };


      const worker = html2pdf()
        .set(options)
        .from(clone)
        .toPdf();

      await worker.get('pdf').then((pdf) => {
        const totalPages = pdf.internal.getNumberOfPages();

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const title = currentNote?.title || 'Untitled Note';

        for (let page = 1; page <= totalPages; page++) {
          pdf.setPage(page);

          // Header
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(40, 55, 80);

          pdf.text(title, 12, 8, {
            maxWidth: pageWidth - 24
          });

          pdf.setDrawColor(210, 215, 225);
          pdf.line(12, 11, pageWidth - 12, 11);

          // Footer
          pdf.line(12, pageHeight - 11, pageWidth - 12, pageHeight - 11);

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(110, 110, 110);

          pdf.text('NoteFlow', 12, pageHeight - 6);

          pdf.text(
            `Page ${page} of ${totalPages}`,
            pageWidth - 12,
            pageHeight - 6,
            { align: 'right' }
          );
        }
      });

      await worker.save();


    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Unable to export PDF.');
    } finally {
      exportContainer.remove();
    }
  }

  function createFolder() {
    const folderName = window.prompt('Enter folder name:');

    if (!folderName || !folderName.trim()) return;

    const name = folderName.trim();
    const reservedNames = ['All Notes', 'Favourites'];

    if (
      reservedNames.some(
        (reservedName) => reservedName.toLowerCase() === name.toLowerCase()
      ) ||
      folders.some((folder) => folder.toLowerCase() === name.toLowerCase())
    ) {
      alert('This folder already exists or uses a reserved name.');
      return;
    }

    setFolders((previousFolders) => [...previousFolders, name]);
    setActiveFolder(name);
  }

  function createNote() {
    const newNote = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '# Untitled Note\n\nStart writing your notes here...',
      folder: folders.includes(activeFolder) ? activeFolder : 'Uncategorized',
      updatedAt: Date.now(),
      favorite: false,
      tags: []
    };

    setNotes((previousNotes) => [...previousNotes, newNote]);
    setCurrentNoteId(newNote.id);
    setActiveTab('edit');
    setMobileDrawer(null);
  }

  function selectNote(noteId) {
    setCurrentNoteId(noteId);
    setActiveTab('split');
    setMobileDrawer(null);
  }

  function renameNote() {
    if (!currentNote) return;

    const newTitle = window.prompt(
      'Enter the new note title:',
      currentNote.title
    );

    if (!newTitle || !newTitle.trim()) return;

    setSaveStatus('Saving...');
    setNotes((previousNotes) =>
      previousNotes.map((note) =>
        note.id === currentNoteId
          ? { ...note, title: newTitle.trim(), updatedAt: Date.now() }
          : note
      )
    );
  }

  function deleteNote() {
    if (!currentNote) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${currentNote.title}"?`
    );

    if (!confirmed) return;

    setSaveStatus('Saving...');
    const remainingNotes = notes.filter((note) => note.id !== currentNoteId);

    if (remainingNotes.length === 0) {
      const newNote = {
        id: crypto.randomUUID(),
        title: 'Untitled Note',
        content: '# Untitled Note\n\n',
        updatedAt: Date.now(),
        folder: 'Uncategorized',
        favorite: false,
        tags: []
      };

      setNotes([newNote]);
      setCurrentNoteId(newNote.id);
    } else {
      setNotes(remainingNotes);
      setCurrentNoteId(remainingNotes[0].id);
    }

    setActiveTab('split');
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('noteflow-library', JSON.stringify(notes));
        setSaveStatus('Saved');
      } catch (error) {
        console.error('Unable to save the NoteFlow library:', error);
        setSaveStatus('Save failed');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [notes]);

  // Extract headings for the document outline.
  const headings = useMemo(() => {
    const result = [];
    let insideCodeBlock = false;
    const slugCounts = new Map();

    markdown.split('\n').forEach((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        insideCodeBlock = !insideCodeBlock;
        return;
      }

      if (insideCodeBlock) return;

      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (!match) return;

      const title = match[2].replace(/[*_`]/g, '').trim();

      const baseId = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

      const count = slugCounts.get(baseId) || 0;
      slugCounts.set(baseId, count + 1);

      result.push({
        level: match[1].length,
        title,
        id: count === 0 ? baseId : `${baseId}-${count}`
      });
    });

    return result;
  }, [markdown]);

  // Navigate to a heading.
  function navigateToHeading(id) {
    setActiveTab('preview');
    setMobileDrawer(null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    });
  }


  function CodeBlock({ className, children, ...props }) {
    const match = /language-([\w-]+)/.exec(className || '');
    const language = match ? match[1] : null;

    const code = String(children).replace(/\n$/, '');

    if (!language) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    async function copyCode() {
      try {
        await navigator.clipboard.writeText(code);
      } catch (error) {
        console.error('Unable to copy code:', error);
      }
    }

    return (
      <div className="noteflow-code-block">
        <div className="noteflow-code-header">
          <span>{language.toUpperCase()}</span>

          <button type="button" onClick={copyCode}>
            📋 Copy
          </button>
        </div>

        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '18px',
            borderRadius: '0 0 9px 9px',
            fontSize: '13px'
          }}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }


  // Insert Markdown at the cursor position.
  function insertText(text) {
    setMobileDrawer(null);

    setActiveTab('edit');

    requestAnimationFrame(() => {
      const textarea = editorRef.current;

      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const updated =
        markdown.substring(0, start) +
        text +
        markdown.substring(end);

      setMarkdown(updated);

      requestAnimationFrame(() => {
        textarea.focus();

        textarea.setSelectionRange(
          start + text.length,
          start + text.length
        );
      });
    });
  }

  // Capture rich clipboard content.
  function handleImportPaste(event) {
    const clipboard = event.clipboardData;

    const html = clipboard.getData('text/html');
    const plainText = clipboard.getData('text/plain');

    setImportHtml(html || '');

    if (plainText) {
      event.preventDefault();
      setImportText(plainText);
    }
  }

  // Import ChatGPT content.
  function importConversation(mode) {
    if (!importText.trim() && !importHtml.trim()) {
      alert('Please paste your ChatGPT conversation first!');
      return;
    }

    try {
      let sourceContent = importHtml.trim()
        ? convertRichContentToMarkdown(importHtml)
        : importText.trim();

      if (!sourceContent.trim()) {
        sourceContent = importText.trim();
      }

      const cleanedContent = normalizeMath(sourceContent);

      if (mode === 'replace') {
        setMarkdown(cleanedContent);
      } else {
        setMarkdown((previous) =>
          previous.trim()
            ? `${previous.trimEnd()}\n\n---\n\n${cleanedContent}`
            : cleanedContent
        );
      }

      setImportText('');
      setImportHtml('');
      setImporterOpen(false);
      setActiveTab('split');
      setMobileDrawer(null);
    } catch (error) {
      console.error('NoteFlow import failed:', error);

      alert(
        'The content could not be converted. Please try importing again.'
      );
    }
  }


  function restoreNotesBackup(event) {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target.result);

        // Validate backup structure
        if (
          backupData.appName !== 'NoteFlow' ||
          !Array.isArray(backupData.notes) ||
          backupData.notes.length === 0
        ) {
          throw new Error('Invalid NoteFlow backup file.');
        }

        const validNotes = backupData.notes.every((note) =>
          note &&
          typeof note.id === 'string' &&
          typeof note.title === 'string' &&
          typeof note.content === 'string' &&
          typeof note.updatedAt === 'number'
        );

        if (!validNotes) {
          throw new Error('Backup contains invalid note data.');
        }

        // Prevent duplicate note IDs
        const ids = backupData.notes.map((note) => note.id);

        if (new Set(ids).size !== ids.length) {
          throw new Error('Backup contains duplicate note IDs.');
        }

        const confirmed = window.confirm(
          `Restore ${backupData.notes.length} notes? This will replace your current Notes Library.`
        );

        if (!confirmed) return;

        const restoredNotes = backupData.notes.map((note) => ({
          ...note,
          folder: note.folder || 'Uncategorized',
          favorite: note.favorite ?? false,
          tags: Array.isArray(note.tags) ? note.tags : []
        }));

        setNotes(restoredNotes);
        setFolders((previousFolders) => [
          ...new Set([
            ...previousFolders,
            ...restoredNotes.map((note) => note.folder)
          ])
        ]);
        setCurrentNoteId(restoredNotes[0].id);
        setActiveTab('split');

        alert('Notes Library restored successfully!');
      } catch (error) {
        console.error('Backup restore failed:', error);
        alert(error.message || 'Unable to restore backup.');
      } finally {
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      alert('Unable to read backup file.');
      event.target.value = '';
    };

    reader.readAsText(file);
  }

  function exportNotesBackup() {
    if (!notes.length) {
      alert('No notes available to back up!');
      return;
    }

    const backupData = {
      appName: 'NoteFlow',
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: notes
    };

    const blob = new Blob(
      [JSON.stringify(backupData, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'noteflow-backup.json';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }


  // Export Markdown file.

  function exportMarkdown() {
    if (!currentNote) {
      alert('No note selected!');
      return;
    }

    const blob = new Blob(
      [currentNote.content],
      { type: 'text/markdown;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const filename = (currentNote.title || 'Untitled Note')
      .replace(/[\\/:*?"<>|]/g, '-');

    link.href = url;
    link.download = `${filename}.md`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function importMarkdown(event) {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.md')) {
      alert('Please select a Markdown (.md) file.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target.result;

      const newNote = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.md$/i, ''),
        content,
        updatedAt: Date.now(),
        folder: folders.includes(activeFolder) ? activeFolder : 'Uncategorized',
        favorite: false,
        tags: []
      };

      setNotes((prev) => [...prev, newNote]);
      setCurrentNoteId(newNote.id);
      setActiveTab('split');

      alert('Markdown file imported successfully!');
    };

    reader.onerror = () => {
      alert('Unable to read the Markdown file.');
    };

    reader.readAsText(file);
    event.target.value = '';
  }

  function clearImporter() {
    setImportText('');
    setImportHtml('');
  }

  // Close mobile drawer.
  function closeMobileDrawer() {
    setMobileDrawer(null);
  }

  // Toggle mobile drawer.
  function openMobileDrawer(type) {
    setMobileDrawer((previous) =>
      previous === type ? null : type
    );
  }

  function moveNoteToFolder(noteId, folderName) {
  setNotes((prevNotes) =>
    prevNotes.map((note) =>
      note.id === noteId
        ? {
            ...note,
            folder: folderName,
            updatedAt: Date.now()
          }
        : note
    )
  );
}
function deleteFolder(folderName) {
  if (folderName === 'Uncategorized') {
    alert('The Uncategorized folder cannot be deleted.');
    return;
  }

  const confirmed = window.confirm(
    `Delete "${folderName}"? Its notes will be moved to Uncategorized.`
  );

  if (!confirmed) return;

  // Move notes into Uncategorized
  setNotes((prevNotes) =>
    prevNotes.map((note) =>
      note.folder === folderName
        ? {
            ...note,
            folder: 'Uncategorized',
            updatedAt: Date.now()
          }
        : note
    )
  );

  // Remove folder
  setFolders((prevFolders) =>
    prevFolders.filter((folder) => folder !== folderName)
  );

  if (activeFolder === folderName) {
    setActiveFolder('All Notes');
  }
}

  return (
    <div className="app">
      {/* TOP NAVIGATION */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">N</span>
          <span>NoteFlow</span>
        </div>
        
        <div className="topbar-actions">
          <button
            className="mobile-nav-button"
            onClick={() => openMobileDrawer('outline')}
          >
            ☰ Outline
          </button>

          <button
            className="mobile-nav-button"
            onClick={() => openMobileDrawer('tools')}
          >
            ⚙ Tools
          </button>
{/* 
          <button onClick={() => setImporterOpen(true)}>
            📋 Import ChatGPT
          </button> */}

          {/* <button
            onClick={() => {
              if (window.confirm('Create a new empty note?')) {
                setMarkdown('');
              }
            }}
          >
            New Note
          </button> */}
          <button
  type="button"
  className="theme-toggle-button"
  onClick={() =>
    setTheme((previous) =>
      previous === 'light' ? 'dark' : 'light'
    )
  }
>
  {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
</button>
          <button onClick={exportMarkdown}>Export MD ↓</button>
        </div>
      </header>

      {/* IMPORT MODAL */}
      {importerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '15px'
          }}
        >
          <div
            style={{
              background: 'white',
              width: '100%',
              maxWidth: '750px',
              padding: '25px',
              borderRadius: '14px',
              boxShadow: '0 15px 50px rgba(0,0,0,0.2)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px'
              }}
            >
              <h2>📋 Import ChatGPT Notes</h2>

              <button
                onClick={() => setImporterOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '25px'
                }}
              >
                ×
              </button>
            </div>

            <p
              style={{
                color: '#777',
                marginBottom: '15px',
                fontSize: '14px'
              }}
            >
              Paste your ChatGPT Markdown content below.
              Rich clipboard HTML will be used when available.
            </p>

            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              onPaste={handleImportPaste}
              placeholder="Paste your Markdown notes here..."
              style={{
                width: '100%',
                height: '300px',
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '9px',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: '1.7',
                resize: 'vertical',
                outlineColor: '#3659d9'
              }}
            />

            <p
              style={{
                color: '#9299a9',
                fontSize: '12px',
                marginTop: '8px'
              }}
            >
              {importText.length} characters
              {importHtml
                ? ' · Rich HTML clipboard captured'
                : ' · Plain text mode'}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                flexWrap: 'wrap',
                marginTop: '15px'
              }}
            >
              <button onClick={clearImporter}>Clear</button>

              <button onClick={() => importConversation('append')}>
                Import & Append
              </button>

              <button onClick={() => importConversation('replace')}>
                Import & Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE DRAWER OVERLAY */}
      {mobileDrawer && (
        <button
          className="mobile-drawer-overlay"
          aria-label="Close navigation"
          onClick={closeMobileDrawer}
        />
      )}

      {/* MAIN WORKSPACE */}
      <main className="workspace">

        {/* LEFT SIDEBAR / OUTLINE */}
        <aside
          className={`left-sidebar ${mobileDrawer === 'outline' ? 'mobile-drawer-open' : ''
            }`}
        >
          <div className="mobile-drawer-heading">
            <strong>📚 Outline</strong>
            <button onClick={closeMobileDrawer}>×</button>
          </div>

          <h3>MY WORKSPACE</h3>

          <Sidebar
            folders={folders}
            activeFolder={activeFolder}
            setActiveFolder={setActiveFolder}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            createFolder={createFolder}
            filteredNotes={filteredNotes}
            currentNoteId={currentNote?.id}
            onSelectNote={selectNote}
            moveNoteToFolder={moveNoteToFolder}
            toggleFavorite={toggleFavorite}
deleteFolder={deleteFolder}
sortBy={sortBy}
setSortBy={setSortBy}
           
          />

          <div className="sidebar-divider" />

          <h3>ON THIS PAGE</h3>

          <div className="heading-navigation">
            {headings.map((heading, index) => (
              <button
                key={`${heading.id}-${index}`}
                className={`heading-link level-${heading.level}`}
                onClick={() => navigateToHeading(heading.id)}
              >
                {heading.title}
              </button>
            ))}

            {headings.length === 0 && (
              <p className="muted">No headings yet</p>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <section className="main-content">
          <div className="document-header">


            <div className="note-actions">
              <button onClick={createNote}>
                + New Note
              </button>

              <button onClick={renameNote}>
                ✏️ Rename
              </button>

              <button onClick={deleteNote}>
                🗑 Delete
              </button>
              <button
                onClick={() => document.getElementById('markdown-import').click()}
              >
                📥 Import MD
              </button>

              <input
                id="markdown-import"
                type="file"
                accept=".md,text/markdown"
                style={{ display: 'none' }}
                onChange={importMarkdown}
              />
              <button
                className="export-pdf-button"
                onClick={exportPDF}
              >
                📄 Export PDF
              </button>
              <button onClick={exportNotesBackup}>
                💾 Backup All Notes
              </button>
              <button
                onClick={() =>
                  document.getElementById('backup-import').click()
                }
              >
                ♻️ Restore Backup
              </button>

              <input
                id="backup-import"
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={restoreNotesBackup}
              />
            </div>

            <div>
              <span className="breadcrumb">My Workspace / Notes</span>
              <h2>{currentNote?.title || 'Untitled Note'}</h2>
              <span className="save-status">
                ● {saveStatus}
              </span>
            </div>

            <div className="view-switcher">
              <button
                className={activeTab === 'edit' ? 'selected' : ''}
                onClick={() => setActiveTab('edit')}
              >
                Edit
              </button>

              <button
                className={activeTab === 'split' ? 'selected' : ''}
                onClick={() => setActiveTab('split')}
              >
                Split
              </button>

              <button
                className={activeTab === 'preview' ? 'selected' : ''}
                onClick={() => setActiveTab('preview')}
              >
                Preview
              </button>
            </div>
          </div>

          {/* EDITOR AND PREVIEW */}
          <div className={`editor-layout mode-${activeTab}`}>
            {activeTab !== 'preview' && (
              <div className="editor-panel">
                <div className="panel-heading">
                  <span>MARKDOWN EDITOR</span>
                  <span>✏️ Source</span>
                </div>

                <textarea
                  ref={editorRef}
                  value={markdown}
                  onChange={(event) => setMarkdown(event.target.value)}
                  placeholder="Write or paste your Markdown notes here..."
                  spellCheck="false"
                />
              </div>
            )}

            {activeTab !== 'edit' && (
              <div className="preview-panel">
                <div className="panel-heading">
                  <span>LIVE PREVIEW</span>
                  <span>👁 Rendered</span>
                </div>

                <article className="markdown-content">
                  <div ref={previewRef} className="markdown-preview">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[
                        [
                          rehypeKatex,
                          {
                            throwOnError: false,
                            errorColor: '#cc0000',
                            strict: 'warn'
                          }
                        ],
                        rehypeSlug
                      ]}
                      components={{
                        code({ className, children, ...props }) {
                          return (
                            <CodeBlock className={className} {...props}>
                              {children}
                            </CodeBlock>
                          );
                        }
                      }}
                    >
                      {markdown}
                    </ReactMarkdown>
                  </div>
                </article>
              </div>
            )}
          </div>
        </section>
        {/* RIGHT SIDEBAR / TOOLS */}
        {(rightOpen || mobileDrawer === 'tools') && (
          <aside
            className={`right-sidebar ${mobileDrawer === 'tools' ? 'mobile-drawer-open' : ''
              }`}
          >
            <div className="mobile-drawer-heading">
              <strong>⚙ Quick Tools</strong>
              <button onClick={closeMobileDrawer}>×</button>
            </div>

            <div className="toolbar-header">
              <h3>QUICK TOOLS</h3>
              <button onClick={() => setRightOpen(false)}>×</button>
            </div>

            <p>FORMATTING</p>

            <div className="tool-grid">
              <button onClick={() => insertText('\n# Heading\n')}>
                <b>H1</b>
                Heading 1
              </button>

              <button onClick={() => insertText('\n## Heading\n')}>
                <b>H2</b>
                Heading 2
              </button>

              <button onClick={() => insertText('**Bold text**')}>
                <b>B</b>
                Bold
              </button>

              <button onClick={() => insertText('*Italic text*')}>
                <i>I</i>
                Italic
              </button>

              <button onClick={() => insertText('\n- List item\n')}>
                <b>☷</b>
                List
              </button>

              <button onClick={() => insertText('\n> Important note\n')}>
                <b>❝</b>
                Quote
              </button>
            </div>

            <div className="toolbar-divider" />

            <p>MATHEMATICS</p>

            <div className="tool-grid">
              <button onClick={() => insertText('$$\n\\frac{a}{b}\n$$')}>
                <b>½</b>
                Fraction
              </button>

              <button onClick={() => insertText('$$\n\\sqrt{x}\n$$')}>
                <b>√</b>
                Square Root
              </button>

              <button onClick={() => insertText('$$\n\\sum_{i=1}^{n} x_i\n$$')}>
                <b>∑</b>
                Summation
              </button>

              <button onClick={() => insertText('$$\n\\int_a^b f(x)dx\n$$')}>
                <b>∫</b>
                Integral
              </button>

              <button onClick={() => insertText('$$\n\\alpha + \\beta = \\theta\n$$')}>
                <b>α</b>
                Greek
              </button>

              <button
                onClick={() =>
                  insertText(
                    '$$\n\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}\n$$'
                  )
                }
              >
                <b>▦</b>
                Matrix
              </button>
            </div>

            <div className="toolbar-divider" />

            <p>INSERT ELEMENTS</p>

            <div className="insert-tools">
              <button
                onClick={() =>
                  insertText(
                    '\n| Column 1 | Column 2 |\n|---|---|\n| Value 1 | Value 2 |\n'
                  )
                }
              >
                ▦ &nbsp; Table
              </button>

              <button
                onClick={() =>
                  insertText('\n```javascript\n// Write code here\n```\n')
                }
              >
                {'</>'} &nbsp; Code Block
              </button>

              <button
                onClick={() => insertText('\n![Image description](image-url)\n')}
              >
                🖼 &nbsp; Image
              </button>
            </div>
          </aside>
        )}

        {/* DESKTOP REOPEN TOOLBAR */}
        {!rightOpen && (
          <button
            className="reopen-toolbar"
            onClick={() => setRightOpen(true)}
          >
            Open Tools →
          </button>
        )}
      </main>
    </div>
  );
}

export default App;
