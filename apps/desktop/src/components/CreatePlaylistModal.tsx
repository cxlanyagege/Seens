import { FolderPlus, X } from "lucide-react";
import type { FormEvent, MouseEvent } from "react";

type CreatePlaylistModalProps = {
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function CreatePlaylistModal({ name, onNameChange, onClose, onSubmit }: CreatePlaylistModalProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  const stopPropagation = (event: MouseEvent) => event.stopPropagation();

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onSubmit={submit} onMouseDown={stopPropagation}>
        <div className="modal__icon"><FolderPlus /></div>
        <button className="modal__close" type="button" onClick={onClose}><X /></button>
        <h2>Create a playlist</h2>
        <p>Give your playlist a name. You can add tracks after it is created.</p>
        <label>Playlist name<input autoFocus maxLength={80} value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="e.g. Late night listening" /></label>
        <div className="modal__actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit" disabled={!name.trim()}>Create playlist</button>
        </div>
      </form>
    </div>
  );
}

