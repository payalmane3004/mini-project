import { useCallback, useEffect, useState } from "react";
import { Bell, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { createNotice, deleteDraftNotice, fetchAdminNotices, updateNotice } from "../../api/notices";
import "./Notices.css";

function localDateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reload, setReload] = useState(0);

  function reloadNotices() {
    setLoadState("loading");
    setReload((key) => key + 1);
  }

  const refresh = useCallback(async () => {
    setLoadState("loading");
    try {
      setNotices(await fetchAdminNotices());
      setLoadError("");
      setLoadState("ready");
    } catch (error) {
      setLoadError(error.message);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAdminNotices().then((rows) => {
      if (active) { setNotices(rows); setLoadError(""); setLoadState("ready"); }
    }).catch((error) => {
      if (active) { setLoadError(error.message); setLoadState("error"); }
    });
    return () => { active = false; };
  }, [reload]);

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const expiry = String(data.get("expires_at") || "");
    const values = {
      title: String(data.get("title") || "").trim(),
      content: String(data.get("content") || "").trim(),
      published: data.get("published") === "true",
      expires_at: expiry ? new Date(expiry).toISOString() : null,
    };
    if (!values.title || !values.content) {
      setFormError("Enter both a title and notice content.");
      return;
    }
    setSaving(true); setFormError(""); setMessage("");
    try {
      if (editing) await updateNotice(editing.id, values);
      else await createNotice(values);
      setEditing(null);
      formElement.reset();
      setMessage(editing ? "Notice updated." : values.published ? "Notice published." : "Draft saved.");
      await refresh();
    } catch (error) {
      setFormError(error.message);
    } finally { setSaving(false); }
  }

  async function changePublication(notice) {
    setSaving(true); setFormError(""); setMessage("");
    try {
      await updateNotice(notice.id, { published: !notice.published });
      setMessage(notice.published ? "Notice unpublished." : "Notice published.");
      await refresh();
    } catch (error) { setFormError(error.message); }
    finally { setSaving(false); }
  }

  async function removeDraft(notice) {
    if (!window.confirm(`Delete draft “${notice.title}”?`)) return;
    setSaving(true); setFormError(""); setMessage("");
    try {
      await deleteDraftNotice(notice.id);
      setMessage("Draft deleted.");
      await refresh();
    } catch (error) { setFormError(error.message); }
    finally { setSaving(false); }
  }

  function edit(notice) {
    setEditing(notice);
    setMessage(""); setFormError("");
    window.requestAnimationFrame(() => document.getElementById("notice-title")?.focus());
  }

  return <div className="notices-page">
    <header className="notices-heading"><div><h1>Campus Notices</h1><p>Create, edit, and manage notices shown to students.</p></div></header>
    <p className="notices-guidance">Only published, non-expired notices appear in the student view. Publication changes take effect immediately.</p>
    <form className="notices-form" onSubmit={submit}>
      <div className="notices-form-title"><span><Plus size={17}/></span><div><h2>{editing ? "Edit notice" : "Create notice"}</h2><p>Use verified information suitable for student distribution.</p></div></div>
      <label>Title<input id="notice-title" name="title" required maxLength={200} defaultValue={editing?.title || ""} key={`title-${editing?.id || "new"}`} /></label>
      <label>Content<textarea name="content" required rows={4} defaultValue={editing?.content || ""} key={`content-${editing?.id || "new"}`} /></label>
      <div className="notices-form-row"><label>Publication<select name="published" defaultValue={String(editing?.published ?? true)} key={`published-${editing?.id || "new"}`}><option value="false">Draft</option><option value="true">Publish now</option></select></label><label>Expiry (optional)<input name="expires_at" type="datetime-local" defaultValue={localDateValue(editing?.expires_at)} key={`expiry-${editing?.id || "new"}`} /></label></div>
      <div className="notices-form-actions"><button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Save notice"}</button>{editing && <button type="button" className="notices-secondary" onClick={() => setEditing(null)}>Cancel edit</button>}</div>
      {formError && <p role="alert" className="notices-error">{formError}</p>}{message && <p role="status" className="notices-success">{message}</p>}
    </form>
    <section className="notices-list-section"><div className="notices-list-heading"><div><h2>Stored notices</h2><p>Drafts are visible only to administrators.</p></div><button type="button" onClick={reloadNotices} disabled={loadState === "loading"} aria-label="Refresh notices"><RefreshCw size={16}/> Refresh</button></div>
      {loadState === "loading" && <p role="status">Loading notices…</p>}
      {loadState === "error" && <div className="notices-empty" role="alert"><p>{loadError}</p><button type="button" onClick={reloadNotices}>Retry</button></div>}
      {loadState === "ready" && notices.length === 0 && <div className="notices-empty"><Bell size={24}/><strong>No notices yet</strong><span>Create a draft or publish a notice above.</span></div>}
      {loadState === "ready" && notices.length > 0 && <div className="notices-list">{notices.map((notice) => <article className="notice-card" key={notice.id}><div className="notice-card-main"><div className="notice-card-meta"><span className={`notice-status ${notice.published ? "is-published" : "is-draft"}`}>{notice.published ? "Published" : "Draft"}</span>{notice.is_demo && <span className="notice-status is-draft">Demo only</span>}<small>Created {notice.created_at ? new Date(notice.created_at).toLocaleString() : "time unavailable"}{notice.expires_at ? ` · expires ${new Date(notice.expires_at).toLocaleString()}` : " · no expiry"}</small></div><h3>{notice.title}</h3><p>{notice.content}</p></div><div className="notice-card-actions"><button type="button" disabled={saving} onClick={() => edit(notice)}><Pencil size={15}/> Edit</button><button type="button" disabled={saving} onClick={() => changePublication(notice)}>{notice.published ? "Unpublish" : "Publish"}</button>{!notice.published && <button type="button" className="notice-delete" disabled={saving} onClick={() => removeDraft(notice)} aria-label={`Delete draft ${notice.title}`}><Trash2 size={15}/> Delete draft</button>}</div></article>)}</div>}
    </section>
  </div>;
}
