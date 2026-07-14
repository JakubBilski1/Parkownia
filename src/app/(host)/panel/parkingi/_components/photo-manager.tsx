"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui";

export type PhotoItem = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
};

const MAX_PHOTOS = 10;
const ACCEPTED = "image/jpeg,image/png,image/webp,image/avif";

async function readSize(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

export type PhotoManagerProps = {
  parkingId: string | null;
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
};

/**
 * The file goes straight from the browser to storage over a presigned PUT; the app
 * server only hands out the URL and then confirms what actually landed. A failed
 * upload says what failed and leaves the rest of the form untouched.
 */
export function PhotoManager({ parkingId, photos, onChange }: PhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_PHOTOS - photos.length;

  async function uploadOne(file: File, id: string): Promise<PhotoItem> {
    const ticketResponse = await fetch(`/api/parkings/${id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type }),
    });

    if (!ticketResponse.ok) {
      const payload = await ticketResponse.json().catch(() => null);
      throw new Error(payload?.error?.message ?? "Nie udało się przygotować wysyłki zdjęcia.");
    }

    const ticket: { uploadUrl: string; objectKey: string; maxBytes: number } =
      await ticketResponse.json();

    if (file.size > ticket.maxBytes) {
      throw new Error(
        `Zdjęcie waży ponad ${Math.round(ticket.maxBytes / (1024 * 1024))} MB. Zmniejsz je i spróbuj ponownie.`,
      );
    }

    const upload = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!upload.ok) {
      throw new Error("Wysyłka zdjęcia nie doszła do skutku. Spróbuj ponownie.");
    }

    const size = await readSize(file);

    const confirm = await fetch(`/api/parkings/${id}/photos/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectKey: ticket.objectKey, ...size }),
    });

    if (!confirm.ok) {
      const payload = await confirm.json().catch(() => null);
      throw new Error(payload?.error?.message ?? "Nie udało się zapisać zdjęcia.");
    }

    return confirm.json();
  }

  async function handleFiles(files: FileList) {
    if (!parkingId) return;

    setBusy(true);
    setError(null);

    const accepted = Array.from(files).slice(0, remaining);
    const uploaded: PhotoItem[] = [];

    try {
      for (const file of accepted) {
        uploaded.push(await uploadOne(file, parkingId));
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nie udało się wgrać zdjęcia.");
    } finally {
      if (uploaded.length > 0) onChange([...photos, ...uploaded]);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(photoId: string) {
    if (!parkingId) return;
    setError(null);

    const response = await fetch(`/api/parkings/${parkingId}/photos/${photoId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError("Nie udało się usunąć zdjęcia. Spróbuj ponownie.");
      return;
    }

    onChange(photos.filter((photo) => photo.id !== photoId));
  }

  if (!parkingId) {
    return (
      <p className="text-ui text-muted">
        Zdjęcia dodasz, gdy zapiszemy szkic — wystarczy, że wpiszesz nazwę parkingu.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-ui text-muted">
          Kierowca wybiera oczami. Trzy zdjęcia wystarczą: wjazd, plac, okolica.
        </p>
        <span className="num shrink-0 text-ui text-muted">
          {photos.length} z {MAX_PHOTOS}
        </span>
      </div>

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                className="aspect-[4/3] w-full rounded-chip border border-line bg-surface-2 object-cover"
              />
              <button
                type="button"
                onClick={() => remove(photo.id)}
                aria-label="Usuń zdjęcie"
                className="absolute right-1 top-1 inline-flex h-touch w-touch items-center justify-center rounded-button bg-surface text-danger shadow-card transition-colors duration-micro ease-out hover:bg-danger-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="sr-only"
        onChange={(event) => {
          if (event.target.files?.length) void handleFiles(event.target.files);
        }}
      />

      <Button
        onClick={() => inputRef.current?.click()}
        loading={busy}
        disabled={remaining <= 0}
        block
      >
        <ImagePlus size={18} aria-hidden="true" />
        {remaining > 0 ? "Dodaj zdjęcia" : "Masz komplet zdjęć"}
      </Button>

      {error ? (
        <p role="alert" className="text-ui text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
