"use client";

import { useRef, useState } from "react";
import { X, Camera, Trash2, Loader2 } from "lucide-react";
import { updateProfileApi, type UserProfile } from "../lib/apiClient";

// Resize/compress an image file to a small square-ish data URL so it fits
// comfortably inside a Firestore document.
function fileToResizedDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That image could not be loaded."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image processing is not supported here."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSaved: (p: UserProfile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const displayName = name || profile.email?.split("@")[0] || "?";
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setPhotoURL(await fileToResizedDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that image.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfileApi({ name: name.trim(), bio, photoURL });
      onSaved({ ...profile, name: name.trim(), bio, photoURL });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <span className="profile-title">Edit profile</span>
          <button className="profile-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <div className="profile-error">{error}</div>}

        <div className="profile-avatar-edit">
          <div className="profile-avatar-large">
            {photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoURL} alt="Profile" />
            ) : (
              <span>{initials || "?"}</span>
            )}
          </div>
          <div className="profile-avatar-actions">
            <button className="fc-btn" onClick={() => fileRef.current?.click()}>
              <Camera size={15} /> Upload photo
            </button>
            {photoURL && (
              <button className="fc-btn ghost" onClick={() => setPhotoURL("")}>
                <Trash2 size={15} /> Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickFile}
            />
          </div>
        </div>

        <label className="profile-field">
          <span className="profile-label">Photo URL (optional)</span>
          <input
            className="profile-input"
            type="text"
            placeholder="https://…"
            value={photoURL.startsWith("data:") ? "" : photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            disabled={photoURL.startsWith("data:")}
          />
          {photoURL.startsWith("data:") && (
            <span className="profile-help">Using your uploaded image. Remove it to paste a URL instead.</span>
          )}
        </label>

        <label className="profile-field">
          <span className="profile-label">Display name</span>
          <input
            className="profile-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>

        <label className="profile-field">
          <span className="profile-label">Bio</span>
          <textarea
            className="profile-input profile-textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A little about you…"
            rows={3}
            maxLength={500}
          />
          <span className="profile-help">{bio.length}/500</span>
        </label>

        <div className="profile-footer">
          <button className="fc-btn ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="fc-btn primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
