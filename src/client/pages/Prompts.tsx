import { useState, useEffect, useCallback } from "react";
import { useApi, postApi, putApi, deleteApi } from "../hooks/useApi.js";
import "./Prompts.css";

interface ManifestVariant {
  description: string;
  file: string;
}

interface ManifestEntry {
  production: string;
  variants: Record<string, ManifestVariant>;
}

type Manifest = Record<string, ManifestEntry>;

interface VariantContent {
  variant: string;
  description: string;
  isProduction: boolean;
  content: string;
}

const TEMPLATE_VARIABLES: Record<string, string[]> = {
  "design-system": [
    "business_name", "doula_name", "tagline", "service_area", "style", "brand_feeling",
    "colour_bg", "colour_primary", "colour_accent", "colour_text", "colour_cta",
    "colour_bg_desc", "colour_primary_desc", "colour_accent_desc", "colour_text_desc", "colour_cta_desc",
    "heading_font", "body_font", "typography_scale", "spacing_density", "border_radius",
    "page_list", "social_links_desc", "year",
  ],
  "generate-page": [
    "business_name", "doula_name", "tagline", "service_area", "primary_keyword",
    "bio", "philosophy", "services_desc", "testimonials_desc", "photos_desc",
    "page", "subdomain", "email", "phone", "booking_url",
    "doula_uk", "training_provider", "training_year", "primary_location",
    "bio_previous_career", "bio_origin_story", "additional_training",
    "client_perception", "signature_story",
    "page_specific", "section_list", "year",
  ],
};

const PROMPT_TYPE_LABELS: Record<string, string> = {
  "design-system": "Design System",
  "generate-page": "Generate Page",
};

export function Prompts() {
  const { data: manifest, loading } = useApi<Manifest>("/prompts");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [savedDescription, setSavedDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [showVars, setShowVars] = useState(false);
  const [localManifest, setLocalManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    if (manifest) setLocalManifest(manifest);
  }, [manifest]);

  const loadVariant = useCallback(async (type: string, variant: string) => {
    setSelectedType(type);
    setSelectedVariant(variant);
    try {
      const res = await fetch(`/api/prompts/${type}/${variant}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as VariantContent;
      setContent(data.content);
      setSavedContent(data.content);
      setDescription(data.description);
      setSavedDescription(data.description);
    } catch {
      setContent("");
      setSavedContent("");
    }
  }, []);

  const hasChanges = content !== savedContent || description !== savedDescription;

  const save = async () => {
    if (!selectedType || !selectedVariant) return;
    setSaving(true);
    try {
      await putApi(`/prompts/${selectedType}/${selectedVariant}`, { content, description });
      setSavedContent(content);
      setSavedDescription(description);
      if (localManifest && selectedType in localManifest) {
        const updated = structuredClone(localManifest);
        const entry = updated[selectedType];
        if (entry && selectedVariant) {
          const variant = entry.variants[selectedVariant];
          if (variant) {
            variant.description = description;
          }
        }
        setLocalManifest(updated);
      }
    } catch (err) {
      alert(`Save failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const createVariant = async (type: string) => {
    try {
      await postApi(`/prompts/${type}`, {
        name: newName,
        description: newDescription,
        content: "",
      });
      setShowNewModal(null);
      setNewName("");
      setNewDescription("");
      if (localManifest && type in localManifest) {
        const updated = structuredClone(localManifest);
        const entry = updated[type];
        if (entry) {
          entry.variants[newName] = { description: newDescription, file: `${type}/${newName}.md` };
        }
        setLocalManifest(updated);
      }
      loadVariant(type, newName);
    } catch (err) {
      alert(`Create failed: ${err}`);
    }
  };

  const duplicateVariant = async (type: string, source: string) => {
    const name = prompt("New variant name (slug):");
    if (!name) return;
    try {
      await postApi(`/prompts/${type}/${source}/duplicate`, { name });
      if (localManifest && type in localManifest) {
        const updated = structuredClone(localManifest);
        const entry = updated[type];
        if (entry) {
          const sourceDesc = entry.variants[source]?.description ?? "";
          entry.variants[name] = { description: `Copy of ${sourceDesc}`, file: `${type}/${name}.md` };
        }
        setLocalManifest(updated);
      }
      loadVariant(type, name);
    } catch (err) {
      alert(`Duplicate failed: ${err}`);
    }
  };

  const deleteVariant = async (type: string, variant: string) => {
    if (!confirm(`Delete variant "${variant}"?`)) return;
    try {
      await deleteApi(`/prompts/${type}/${variant}`);
      if (localManifest && type in localManifest) {
        const updated = structuredClone(localManifest);
        const entry = updated[type];
        if (entry) {
          delete entry.variants[variant];
        }
        setLocalManifest(updated);
      }
      if (selectedType === type && selectedVariant === variant) {
        setSelectedType(null);
        setSelectedVariant(null);
        setContent("");
        setSavedContent("");
      }
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  const setProduction = async (type: string, variant: string) => {
    try {
      await putApi(`/prompts/${type}/production`, { variant });
      if (localManifest && type in localManifest) {
        const updated = structuredClone(localManifest);
        const entry = updated[type];
        if (entry) {
          entry.production = variant;
        }
        setLocalManifest(updated);
      }
    } catch (err) {
      alert(`Failed: ${err}`);
    }
  };

  if (loading) return <div className="loading">Loading prompts...</div>;

  const m = localManifest;

  return (
    <div className="prompts-page">
      <h2>Prompts</h2>
      <div className="prompts-layout">
        <div className="prompt-sidebar">
          {m && Object.entries(m).map(([type, entry]) => (
            <div key={type} className="prompt-group">
              <h4 className="prompt-group-title">{PROMPT_TYPE_LABELS[type] ?? type}</h4>
              {Object.entries(entry.variants).map(([name, variant]) => (
                <div
                  key={name}
                  className={`prompt-item ${selectedType === type && selectedVariant === name ? "active" : ""}`}
                  onClick={() => loadVariant(type, name)}
                >
                  <div className="prompt-item-header">
                    <strong>{name}</strong>
                    {entry.production === name && <span className="badge badge-live">LIVE</span>}
                  </div>
                  <span className="prompt-desc">{variant.description}</span>
                  <div className="prompt-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-tiny" onClick={() => duplicateVariant(type, name)}>Duplicate</button>
                    {entry.production !== name && (
                      <>
                        <button className="btn-tiny" onClick={() => setProduction(type, name)}>Set Live</button>
                        <button className="btn-tiny btn-danger" onClick={() => deleteVariant(type, name)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn-secondary btn-sm new-variant-btn" onClick={() => setShowNewModal(type)}>
                + New Variant
              </button>
            </div>
          ))}
        </div>

        <div className="prompt-editor card">
          {selectedType && selectedVariant ? (
            <>
              <div className="editor-header">
                <input
                  className="editor-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Variant description..."
                />
                <button className="btn-primary btn-sm" disabled={!hasChanges || saving} onClick={save}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
              <textarea
                className="editor-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
              />
              <details className="vars-panel" open={showVars} onToggle={(e) => setShowVars((e.target as HTMLDetailsElement).open)}>
                <summary>Template Variables</summary>
                <div className="vars-grid">
                  {(TEMPLATE_VARIABLES[selectedType] ?? []).map((v) => (
                    <code key={v} className="var-tag">{`{{${v}}}`}</code>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <p className="empty-state">Select a prompt variant to edit.</p>
          )}
        </div>
      </div>

      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>New {PROMPT_TYPE_LABELS[showNewModal] ?? showNewModal} Variant</h3>
            <label>
              Name (slug):
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="v2-minimal" />
            </label>
            <label>
              Description:
              <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Brief description..." />
            </label>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewModal(null)}>Cancel</button>
              <button className="btn-primary" disabled={!newName} onClick={() => createVariant(showNewModal)}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
