
function Sidebar({
  folders,
  activeFolder,
  setActiveFolder,
  createFolder,
  filteredNotes,
  currentNoteId,
  onSelectNote,
  toggleFavorite,
  moveNoteToFolder,
  deleteFolder,
  searchQuery,
setSearchQuery,
sortBy,
setSortBy,
}) {
  return (
    <div className="folder-section">
        <div className="sidebar-search-sort">
  <input
    type="search"
    className="note-search"
    placeholder="🔍 Search notes..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
  />

  <select
    className="note-sort-select"
    value={sortBy}
    onChange={(e) => setSortBy(e.target.value)}
  >
    <option value="recent">Recently Updated</option>
    <option value="oldest">Oldest First</option>
    <option value="az">Name: A–Z</option>
    <option value="za">Name: Z–A</option>
  </select>
</div>

      {/* ALL NOTES */}
      <button
        type="button"
        className={`folder-item ${
          activeFolder === 'All Notes' ? 'active' : ''
        }`}
        onClick={() => setActiveFolder('All Notes')}
      >
        📚 All Notes
      </button>

      {/* FAVOURITES */}
      <button
        type="button"
        className={`folder-item ${
          activeFolder === 'Favourites' ? 'active' : ''
        }`}
        onClick={() => setActiveFolder('Favourites')}
      >
        ⭐ Favourites
      </button>

      {/* FOLDER LIST */}
      <div className="folder-list">
        {folders.map((folder) => (
          <div className="folder-row" key={folder}>

            <button
              type="button"
              className={`folder-item ${
                activeFolder === folder ? 'active' : ''
              }`}
              onClick={() => setActiveFolder(folder)}
            >
              📁 {folder}
            </button>

            {folder !== 'Uncategorized' && (
              <button
                type="button"
                className="delete-folder-button"
                title={`Delete ${folder}`}
                onClick={() => deleteFolder(folder)}
              >
                🗑️
              </button>
            )}

          </div>
        ))}
      </div>

      {/* CREATE FOLDER */}
      <button
        type="button"
        className="create-folder-button"
        onClick={createFolder}
      >
        + New Folder
      </button>

      <hr />

      {/* NOTES */}
      <div className="note-list">

        {filteredNotes.map((note) => (
          <div
            key={note.id}
            className={`note-list-item ${
              currentNoteId === note.id ? 'active' : ''
            }`}
          >

            <div
              className="note-list-details"
              onClick={() => onSelectNote(note.id)}
            >
              <span>📄</span>
              <strong>{note.title}</strong>
            </div>

            {/* MOVE NOTE */}
            <select
              className="move-note-select"
              value={note.folder || 'Uncategorized'}
              onChange={(event) =>
                moveNoteToFolder(note.id, event.target.value)
              }
              onClick={(event) => event.stopPropagation()}
              title="Move note to folder"
            >
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>

            {/* FAVORITE */}
            <button
              type="button"
              className="favorite-button"
              onClick={() => toggleFavorite(note.id)}
              title={note.favorite ? 'Remove favorite' : 'Add favorite'}
            >
              {note.favorite ? '⭐' : '☆'}
            </button>

          </div>
        ))}

        {filteredNotes.length === 0 && (
          <p className="empty-notes">
            No notes in this folder.
          </p>
        )}

      </div>
    </div>
  );
}

export default Sidebar;
